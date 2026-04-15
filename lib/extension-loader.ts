/**
 * Extension loader + XainaSource base class
 *
 * Bundles are self-contained JS files stored in SQLite (bundleCode column).
 * At eval time, globalThis.XainaSource is injected first so bundles can do:
 *
 *   class MySource extends globalThis.XainaSource {
 *     constructor() {
 *       super();
 *       this.id = 'mysource';
 *       this.name = 'My Source';
 *       this.version = '1.0.0';
 *       this.language = 'en';
 *       this.baseUrl = 'https://example.com';
 *       this.iconUrl = 'https://example.com/favicon.ico';
 *     }
 *     async search(query, page) { ... }
 *     async getPopular(page) { ... }
 *     async getNovelDetails(url) { ... }
 *     async getChapterContent(url) { ... }
 *   }
 *   globalThis.__xaina_source__ = new MySource();
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Novel {
  id: string;
  sourceId: string;
  title: string;
  author: string;
  cover: string;
  coverLocal?: string;
  description: string;
  status: "ongoing" | "completed" | "hiatus" | "unknown";
  genres: string[];
  url: string;
  inLibrary?: boolean;
  favorite?: boolean;
  lastReadChapter?: string;
  lastReadAt?: number;
  addedAt?: number;
}

export interface Chapter {
  id: string;
  novelId: string;
  sourceId: string;
  title: string;
  number: number;
  url: string;
  publishedAt?: string;
  read?: boolean;
  readAt?: number;
}

export interface SearchResult {
  novels: Novel[];
  hasNextPage: boolean;
}

export interface ChapterContent {
  chapterId: string;
  content: string;
}

export interface SourceBundle {
  id: string;
  name: string;
  version: string;
  language: string;
  baseUrl: string;
  iconUrl: string;
  search(query: string, page: number): Promise<SearchResult>;
  getPopular(page: number): Promise<SearchResult>;
  getNovelDetails(url: string): Promise<{
    novel: Novel;
    chapters: Chapter[];
    latestChapters?: Chapter[];
  }>;
  getChapterContent(url: string): Promise<ChapterContent>;
}

// ─── XainaSource base — injected into globalThis before every bundle eval ─────

/**
 * Minified base class string prepended to every bundle before eval.
 * Provides all shared helpers so bundle authors only implement the 4 methods.
 */
const XAINA_BASE = `
  class XainaSource{
    // ── HTTP ──────────────────────────────────────────────────────────────────
    async fetchHtml(url,h){
      const r=await fetch(url,{headers:Object.assign({
        "User-Agent":"Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36",
        "Accept":"text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language":"en-US,en;q=0.9"
      },h||{})});
      if(!r.ok)throw new Error("HTTP "+r.status+" "+url);
      return r.text();
    }
    async postForm(url,data,h){
      const r=await fetch(url,{method:"POST",headers:Object.assign({
        "User-Agent":"Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36",
        "Content-Type":"application/x-www-form-urlencoded",
        "Accept":"text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language":"en-US,en;q=0.9"
      },h||{}),body:new URLSearchParams(data).toString()});
      if(!r.ok)throw new Error("HTTP "+r.status+" POST "+url);
      return r.text();
    }
    // ── Parsing ───────────────────────────────────────────────────────────────
    extract(html,re){const m=html.match(re);return m?m[1].trim():undefined;}
    extractAll(html,re){
      const res=[];let m;
      while((m=re.exec(html))!==null){const v=m[1]&&m[1].trim();if(v)res.push(v);}
      return Array.from(new Set(res));
    }
    extractSection(html,cls,stop){
      const sp=stop?'|class="'+stop+'"':"";
      const re=new RegExp('class="'+cls+'"[^>]*>([\\s\\S]*?)(?=class="'+cls+'"'+sp+'|<\\/div>\\s*<\\/div>\\s*<\\/div>|$)');
      const m=html.match(re);return m?m[1].trim():undefined;
    }
    stripTags(html){return html.replace(/<[^>]+>/g,"").replace(/\\s+/g," ").trim();}
    absoluteUrl(href){
      if(!href)return"";
      if(href.startsWith("http"))return href;
      return this.baseUrl+(href.startsWith("/")?"":"/")+href;
    }
    // ── Chapter helpers ───────────────────────────────────────────────────────
    parseChapterLinks(scope,novelId,sourceId,idPrefix){
      const chs=[];const seen=new Set();
      const pat=/href="(\\/[^"]+\\/chapter-[^"]+)"[^>]*>([^<]+)<\\/a>/g;
      let m;let i=0;
      while((m=pat.exec(scope))!==null){
        const p=m[1];if(seen.has(p))continue;seen.add(p);
        const nm=p.match(/chapter-(\\d+(?:\\.\\d+)?)/i);
        const n=nm?parseFloat(nm[1]):++i;
        chs.push({id:idPrefix+"-ch-"+n,novelId,sourceId,title:m[2].trim(),number:n,url:this.absoluteUrl(p)});
      }
      return chs;
    }
    hasNextPage(html){
      return /href="[^"]*\\/\\d+"[^>]*>\\s*(?:Next|>>|›)/i.test(html)||
            /class="[^"]*next[^"]*"/i.test(html)||
            html.includes('aria-label="next"');
    }
    // ── Utility ───────────────────────────────────────────────────────────────
    sleep(ms){return new Promise(r=>setTimeout(r,ms));}
    randomDelay(min,max){
      min=min===undefined?500:min;max=max===undefined?1200:max;
      return this.sleep(min+Math.random()*(max-min));
    }
    // ── Abstract stubs ────────────────────────────────────────────────────────
    async search(){throw new Error(this.id+": search() not implemented");}
    async getPopular(){throw new Error(this.id+": getPopular() not implemented");}
    async getNovelDetails(){throw new Error(this.id+": getNovelDetails() not implemented");}
    async getChapterContent(){throw new Error(this.id+": getChapterContent() not implemented");}
  }
  globalThis.XainaSource=XainaSource;`;

// ─── Eval ─────────────────────────────────────────────────────────────────────

export function evalBundle(code: string): SourceBundle {
  (globalThis as any).__xaina_source__ = undefined;

  // Inject base class into globalThis first, then eval the bundle separately.
  // This ensures globalThis.XainaSource is set before the bundle code runs,
  // even when the bundle is a pre-compiled IIFE (e.g. .bundle files).
  eval(XAINA_BASE);
  eval(code);

  const bundle = (globalThis as any).__xaina_source__;

  if (!bundle?.id) {
    throw new Error("Bundle did not export a valid __xaina_source__");
  }

  return bundle;
}
