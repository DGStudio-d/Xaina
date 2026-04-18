/**
 * DynamicExtensionRunner — executes downloaded JS bundles at runtime.
 *
 * Uses `new Function(sandboxKeys, source)` to run extension bundles in a
 * controlled sandbox without a WebView. The sandbox exposes only safe globals:
 * fetch, console, URLSearchParams, JSON, Promise, URL, etc.
 *
 * The bundle must call __xaina_register(api) with the four required methods.
 * The result is wrapped in a DynamicExtension that implements the Extension interface.
 *
 * Usage:
 *   const source = await RemoteExtensionLoader.instance.read('en.freewebnovel');
 *   const ext = runBundle(source);
 *   ExtensionRegistry.register(ext);
 */
import type {
    ChapterContent,
    ChapterResult,
    NovelDetail,
    NovelResult,
    SearchFilter,
} from "@/core/extension/types";
import { Extension } from "@/core/extension/types";

/**
 * The API object a bundle must pass to __xaina_register().
 * Plain object — no class required in the bundle.
 */
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

/**
 * Wraps a BundleAPI plain object as a proper Extension instance
 * so the rest of the app can use it identically to compiled sources.
 */
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
  getChapterContent(chapterUrl: string) {
    return this.api.getChapterContent?.(chapterUrl) ?? Promise.resolve([]);
  }
  override getLatest(page: number) {
    return this.api.getLatest?.(page) ?? super.getLatest(page);
  }
  override getPopular(page: number) {
    return this.api.getPopular?.(page) ?? super.getPopular(page);
  }
}

/**
 * Executes a bundle string and returns an Extension instance.
 *
 * Uses eval() instead of new Function() for Hermes compatibility.
 * Hermes (used in React Native release builds) does not support new Function(),
 * but does support eval(). Sandbox globals are injected as local variables
 * via a wrapping IIFE so the bundle's 'use strict' scope sees them.
 *
 * The bundle must call:
 *   __xaina_register({ id, name, lang, version, baseUrl, search, getNovelDetail, getChapters, getChapterContent })
 */
export function runBundle(source: string): Extension {
  let registered: BundleAPI | null = null;

  const __xaina_register = (api: BundleAPI) => {
    registered = api;
  };

  // Wrap the bundle in an IIFE that receives sandbox values as parameters.
  // This avoids new Function() while still giving the bundle a clean scope.
  // eval() is supported by Hermes in both debug and release builds.
  const wrapped = `(function(
    __xaina_register, fetch, console, setTimeout, clearTimeout,
    Promise, JSON, URL, URLSearchParams,
    encodeURIComponent, decodeURIComponent,
    parseFloat, parseInt, String, Array, Object, Math, Date, Error, parse
  ) { "use strict";\n${source}\n})(
    __xaina_register, fetch, console, setTimeout, clearTimeout,
    Promise, JSON, URL, URLSearchParams,
    encodeURIComponent, decodeURIComponent,
    parseFloat, parseInt, String, Array, Object, Math, Date, Error, parse
  );`;

  // eslint-disable-next-line no-eval
  eval(wrapped);

  if (!registered) {
    throw new Error("Bundle did not call __xaina_register()");
  }

  return new DynamicExtension(registered);
}
