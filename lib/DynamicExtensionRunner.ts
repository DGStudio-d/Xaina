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
import { Extension } from '@/core/extension/types';
import type {
  NovelResult,
  NovelDetail,
  ChapterResult,
  ChapterContent,
  SearchFilter,
} from '@/core/extension/types';
import parse from 'node-html-parser';

/**
 * The API object a bundle must pass to __xaina_register().
 * Plain object — no class required in the bundle.
 */
interface BundleAPI {
  id: string;
  name: string;
  lang: string;
  version: string;
  baseUrl: string;
  iconUrl?: string;
  nsfw?: boolean;
  search(query: string, page: number, filters?: SearchFilter): Promise<NovelResult[]>;
  getNovelDetail(url: string): Promise<NovelDetail>;
  getChapters(novelUrl: string): Promise<ChapterResult[]>;
  getChapterContent(chapterUrl: string): Promise<ChapterContent[]>;
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
    this.api     = api;
    this.id      = api.id;
    this.name    = api.name;
    this.lang    = api.lang;
    this.version = api.version;
    this.baseUrl = api.baseUrl;
    this.iconUrl = api.iconUrl;
    this.nsfw    = api.nsfw ?? false;
  }

  search(q: string, page: number, filters?: SearchFilter)  { return this.api.search(q, page, filters); }
  getNovelDetail(url: string)                               { return this.api.getNovelDetail(url); }
  getChapters(novelUrl: string)                             { return this.api.getChapters(novelUrl); }
  getChapterContent(chapterUrl: string)                     { return this.api.getChapterContent(chapterUrl); }
  override getLatest(page: number)  { return this.api.getLatest?.(page) ?? super.getLatest(page); }
  override getPopular(page: number) { return this.api.getPopular?.(page) ?? super.getPopular(page); }
}

/**
 * Executes a bundle string and returns an Extension instance.
 *
 * The bundle must call:
 *   __xaina_register({ id, name, lang, version, baseUrl, search, getNovelDetail, getChapters, getChapterContent })
 */
export function runBundle(source: string): Extension {
  let registered: BundleAPI | null = null;

  // Sandbox: only expose what the bundle needs
  const sandbox = {
    __xaina_register: (api: BundleAPI) => { registered = api; },
    fetch,                          // native fetch
    console,
    setTimeout,
    clearTimeout,
    Promise,
    JSON,
    URL,
    URLSearchParams,
    encodeURIComponent,
    decodeURIComponent,
    parseFloat,
    parseInt,
    String,
    Array,
    Object,
    Math,
    Date,
    Error,
    parse,
  };

  // Build a function with sandbox keys as parameters
  const keys = Object.keys(sandbox);
  const vals = Object.values(sandbox);

  // eslint-disable-next-line no-new-func
  const fn = new Function(...keys, `"use strict";\n${source}`);
  fn(...vals);

  if (!registered) {
    throw new Error('Bundle did not call __xaina_register()');
  }

  return new DynamicExtension(registered);
}
