/**
 * types.ts — shared data models and the Extension abstract base class.
 *
 * Data models:
 *   NovelResult    — search result (id, title, coverUrl, url, sourceId)
 *   NovelDetail    — full novel info (extends NovelResult + description, authors, genres, status)
 *   ChapterResult  — chapter list entry (id, title, number, uploadedAt, url)
 *   ChapterContent — single paragraph of chapter text (index, text)
 *   SearchFilter   — optional search parameters (genres, status, orderBy)
 *
 * Extension base class:
 *   Abstract — every source extends this and implements search(), getNovelDetail(),
 *   getChapters(), getChapterContent(). Optional overrides: getLatest(), getPopular().
 *
 *   HTTP helpers available to all subclasses:
 *     fetchText(url)           — raw string response
 *     fetchJson<T>(url)        — parsed JSON
 *     fetchHtml(url)           — node-html-parser HTMLElement (CSS selectors)
 *     fetchHtmlViaWebView(url) — same but via hidden WebView (Cloudflare bypass)
 */
// ─── Data models ─────────────────────────────────────────────────────────────

export interface NovelResult {
  id: string;
  title: string;
  coverUrl?: string;
  url: string;
  /** Source extension id that produced this result */
  sourceId: string;
}

export interface NovelDetail extends NovelResult {
  description?: string;
  authors?: string[];
  genres?: string[];
  status?: 'ongoing' | 'completed' | 'hiatus' | 'unknown';
}

export interface ChapterResult {
  id: string;
  title: string;
  number: number;
  uploadedAt?: Date;
  url: string;
}

/** Text content of a chapter — paragraphs of the novel */
export interface ChapterContent {
  index: number;
  text: string;
}

export interface SearchFilter {
  genres?: string[];
  status?: NovelDetail['status'];
  orderBy?: 'latest' | 'popular' | 'az';
}

// ─── Base scraper class — every extension extends this ───────────────────────

export abstract class Extension {
  /** Unique reverse-domain id, e.g. "en.royalroad" */
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly lang: string;
  abstract readonly version: string;
  abstract readonly baseUrl: string;
  readonly iconUrl?: string;
  readonly nsfw: boolean = false;

  /**
   * Search for novels by query string and optional filters.
   */
  abstract search(
    query: string,
    page: number,
    filters?: SearchFilter,
  ): Promise<NovelResult[]>;

  /**
   * Fetch full details for a single novel.
   */
  abstract getNovelDetail(url: string): Promise<NovelDetail>;

  /**
   * Fetch the chapter list for a novel.
   */
  abstract getChapters(novelUrl: string): Promise<ChapterResult[]>;

  /**
   * Fetch the text content of a chapter as an array of paragraphs.
   */
  abstract getChapterContent(chapterUrl: string): Promise<ChapterContent[]>;

  // ─── Optional overrides ──────────────────────────────────────────────────

  async getLatest(page: number): Promise<NovelResult[]> {
    return this.search('', page, { orderBy: 'latest' });
  }

  async getPopular(page: number): Promise<NovelResult[]> {
    return this.search('', page, { orderBy: 'popular' });
  }

  // ─── Shared HTTP helpers ─────────────────────────────────────────────────

  protected async fetchText(
    url: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    return res.text();
  }

  protected async fetchJson<T = unknown>(
    url: string,
    headers?: Record<string, string>,
  ): Promise<T> {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    return res.json() as Promise<T>;
  }

  /**
   * Fetch a URL and return a parsed HTML root you can query with CSS selectors.
   *
   * Example:
   *   const $ = await this.fetchHtml('https://example.com/novel/1');
   *   const title = $.querySelector('h1.title')?.text ?? '';
   *   const paras = $.querySelectorAll('.chapter-content p').map(p => p.text);
   */
  protected async fetchHtml(
    url: string,
    headers?: Record<string, string>,
  ): Promise<import('node-html-parser').HTMLElement> {
    const { parse } = await import('node-html-parser');
    const html = await this.fetchText(url, headers);
    return parse(html);
  }

  /**
   * Fetch a Cloudflare-protected URL via a hidden WebView (real browser).
   * Returns a parsed HTML root just like fetchHtml().
   *
   * The CloudflareProvider must be mounted in the component tree.
   * Set useCloudflare = true in your extension to opt in automatically.
   *
   * Example:
   *   const $ = await this.fetchHtmlViaWebView('https://protected-site.com/novel/1');
   */
  protected async fetchHtmlViaWebView(
    url: string,
  ): Promise<import('node-html-parser').HTMLElement> {
    const { parse } = await import('node-html-parser');
    if (!Extension._webViewFetcher) {
      throw new Error(
        'fetchHtmlViaWebView: CloudflareProvider is not mounted. ' +
        'Wrap your app in <CloudflareProvider>.',
      );
    }
    const html = await Extension._webViewFetcher(url);
    return parse(html);
  }

  // Injected by CloudflareProvider at runtime
  static _webViewFetcher: ((url: string) => Promise<string>) | null = null;
}
