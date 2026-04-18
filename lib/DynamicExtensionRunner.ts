/**
 * DynamicExtensionRunner — executes downloaded JS bundles at runtime.
 *
 * Uses eval() for Hermes compatibility (new Function() is not supported in
 * Hermes release builds on Android). The register callback and node-html-parser's
 * parse() function are exposed on globalThis so eval()'d code can access them,
 * then cleaned up immediately after execution.
 *
 * The bundle must call __xaina_register(api) with the required methods.
 */
import type {
  ChapterContent,
  ChapterResult,
  NovelDetail,
  NovelResult,
  SearchFilter,
} from "@/core/extension/types";
import { Extension } from "@/core/extension/types";
import parse from "node-html-parser";

// ─── Bundle API ───────────────────────────────────────────────────────────────

interface BundleAPI {
  id: string;
  name: string;
  lang?: string;
  version: string;
  baseUrl: string;
  iconUrl?: string;
  nsfw?: boolean;
  search(
    query: string,
    page: number,
    filters?: SearchFilter,
  ): Promise<NovelResult[]>;
  getNovelDetail(url: string): Promise<NovelDetail>;
  getChapters?(novelUrl: string): Promise<ChapterResult[]>;
  getChapterContent?(chapterUrl: string): Promise<ChapterContent[]>;
  getLatest?(page: number): Promise<NovelResult[]>;
  getPopular?(page: number): Promise<NovelResult[]>;
}

// ─── Extension wrapper ────────────────────────────────────────────────────────

class DynamicExtension extends Extension {
  readonly id: string;
  readonly name: string;
  readonly lang: string;
  readonly version: string;
  readonly baseUrl: string;
  override readonly iconUrl?: string;
  override readonly nsfw: boolean;
  private api: BundleAPI;

  constructor(api: BundleAPI) {
    super();
    this.api = api;
    this.id = api.id;
    this.name = api.name;
    this.lang = api.lang ?? api.id.split(".")[0] ?? "en";
    this.version = api.version;
    this.baseUrl = api.baseUrl;
    this.iconUrl = api.iconUrl;
    this.nsfw = api.nsfw ?? false;
  }

  search(q: string, page: number, filters?: SearchFilter) {
    return this.api.search(q, page, filters);
  }
  getNovelDetail(url: string) {
    return this.api.getNovelDetail(url);
  }
  getChapters(novelUrl: string) {
    return this.api.getChapters?.(novelUrl) ?? Promise.resolve([]);
  }
  getChapterContent(url: string) {
    return this.api.getChapterContent?.(url) ?? Promise.resolve([]);
  }
  override getLatest(page: number) {
    return this.api.getLatest?.(page) ?? super.getLatest(page);
  }
  override getPopular(page: number) {
    return this.api.getPopular?.(page) ?? super.getPopular(page);
  }
}

// ─── Runner ───────────────────────────────────────────────────────────────────

/**
 * Executes a bundle string and returns an Extension instance.
 *
 * Strategy:
 *  1. Assign a unique key on globalThis for the register callback.
 *  2. Assign parse (node-html-parser) on globalThis so the bundle can call it.
 *  3. Patch the bundle source to call our keyed register function.
 *  4. eval() the patched source — works on Hermes release builds.
 *  5. Clean up globalThis keys in a finally block.
 */
export function runBundle(source: string): Extension {
  let registered: BundleAPI | null = null;

  // Unique key avoids collisions if runBundle is called concurrently
  const regKey = `__xr_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Expose register callback globally (eval can't see outer locals in Hermes)
  (globalThis as any)[regKey] = (api: BundleAPI) => {
    registered = api;
  };

  // Expose parse globally so the bundle's parseHTML() works
  const prevParse = (globalThis as any).parse;
  (globalThis as any).parse = parse;

  try {
    // Replace __xaina_register( with our keyed version
    const patched = source.replace(/__xaina_register\s*\(/g, `${regKey}(`);
    // eslint-disable-next-line no-eval
    eval(patched);
  } finally {
    delete (globalThis as any)[regKey];
    if (prevParse !== undefined) {
      (globalThis as any).parse = prevParse;
    } else {
      delete (globalThis as any).parse;
    }
  }

  if (!registered) {
    throw new Error("Bundle did not call __xaina_register()");
  }

  return new DynamicExtension(registered);
}
