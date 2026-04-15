const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

class FreeWebNovelSource extends globalThis.XainaSource {
  constructor() {
    super();
    this.id = "freewebnovel";
    this.name = "FreeWebNovel";
    this.version = "1.2.0";
    this.language = "en";
    this.baseUrl = "https://freewebnovel.com";
    this.iconUrl = "https://freewebnovel.com/favicon.ico";
  }

  // Override fetchHtml with polite delay + full browser headers
  async fetchHtml(url) {
    await this.randomDelay(800, 1400);
    return super.fetchHtml(
      url,
      Object.assign({}, BROWSER_HEADERS, {
        Referer: this.baseUrl + "/",
      }),
    );
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  async search(query, page) {
    const html =
      page === 1
        ? await this._postSearch(query)
        : await this.fetchHtml(
            this.baseUrl +
              "/search/" +
              page +
              "?searchkey=" +
              encodeURIComponent(query),
          );
    return this._parseNovelList(html);
  }

  async getPopular(page) {
    const html = await this.fetchHtml(
      this.baseUrl + "/sort/latest-release/" + page,
    );
    return this._parseNovelList(html);
  }

  async _postSearch(query) {
    await this.randomDelay(800, 1400);
    const res = await fetch(this.baseUrl + "/search/", {
      method: "POST",
      headers: Object.assign({}, BROWSER_HEADERS, {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: this.baseUrl + "/",
        Origin: this.baseUrl,
      }),
      body: "searchkey=" + encodeURIComponent(query),
    });
    if (!res.ok) throw new Error("HTTP " + res.status + " on search POST");
    return res.text();
  }

  // ─── Novel detail ──────────────────────────────────────────────────────────

  async getNovelDetails(novelUrl) {
    const html = await this.fetchHtml(novelUrl);

    const title =
      this.extract(html, /<h1[^>]*class="tit"[^>]*>([^<]+)<\/h1>/) ||
      this.extract(html, /<h1[^>]*>([^<]+)<\/h1>/) ||
      "Unknown";

    const cover =
      this.extract(
        html,
        /class="m-imgtxt"[\s\S]{0,200}?<img[^>]*src="([^"]+)"/,
      ) ||
      this.extract(
        html,
        /<img[^>]*class="[^"]*cover[^"]*"[^>]*src="([^"]+)"/,
      ) ||
      "";

    const author =
      this.extract(html, /href="\/authors\/[^"]*"[^>]*>([^<]+)<\/a>/) || "";

    const statusRaw =
      this.extract(
        html,
        /class="[^"]*status[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/,
      ) ||
      this.extract(html, />\s*(OnGoing|Completed|Hiatus|Ongoing)\s*</) ||
      "";
    const STATUS = {
      ongoing: "ongoing",
      completed: "completed",
      hiatus: "hiatus",
    };
    const status = STATUS[statusRaw.toLowerCase()] || "unknown";

    const genres = this.extractAll(
      html,
      /href="\/genre\/[^"]*"[^>]*>([^<]+)<\/a>/g,
    );

    const summary =
      this.extract(html, /class="m-desc"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/) ||
      this.extract(html, /class="txt"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/) ||
      "";

    const slug = novelUrl
      .replace(this.baseUrl, "")
      .replace(/^\/novel\//, "")
      .replace(/\/$/, "");
    const novelId = "freewebnovel-" + slug;

    const novel = {
      id: novelId,
      sourceId: this.id,
      title,
      author,
      cover: this.absoluteUrl(cover),
      description: this.stripTags(summary),
      status,
      genres,
      url: novelUrl,
    };

    // .m-newest2 = full chapter list, .m-newest1 = latest releases preview
    const chapters = await this._fetchChapterList(novelUrl, novelId, html);
    const latestChapters = this._parseLatestChapters(html, novelId);

    return { novel, chapters, latestChapters };
  }

  // ─── Chapter content ───────────────────────────────────────────────────────

  async getChapterContent(chapterUrl) {
    const html = await this.fetchHtml(chapterUrl);

    const raw =
      this.extract(
        html,
        /<div[^>]*class="[^"]*txt[^"]*"[^>]*>([\s\S]*?)<\/div>/,
      ) ||
      this.extract(html, /<div[^>]*id="article"[^>]*>([\s\S]*?)<\/div>/) ||
      "";

    const content =
      raw
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<ins[\s\S]*?<\/ins>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .trim() || "<p>Content not found.</p>";

    const chapterId = (chapterUrl.match(/chapter-(\d+(?:\.\d+)?)/i) || [
      chapterUrl,
    ])[0];
    return { chapterId, content };
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  async _fetchChapterList(novelUrl, novelId, firstPageHtml) {
    const scope =
      this.extractSection(firstPageHtml, "m-newest2", "m-newest1") ||
      firstPageHtml;

    const idPrefix = "freewebnovel-" + novelId;
    const chapters = this.parseChapterLinks(scope, novelId, this.id, idPrefix);
    const seen = new Set(chapters.map((c) => c.url));

    if (
      firstPageHtml.includes("chapter-list") &&
      firstPageHtml.includes("page=2")
    ) {
      let page = 2;
      while (page <= 50) {
        const pageHtml = await this.fetchHtml(novelUrl + "?page=" + page);
        const pageChs = this.parseChapterLinks(
          pageHtml,
          novelId,
          this.id,
          idPrefix,
        ).filter((c) => !seen.has(c.url));
        if (pageChs.length === 0) break;
        pageChs.forEach((c) => seen.add(c.url));
        chapters.push(...pageChs);
        page++;
      }
    }

    return chapters;
  }

  _parseLatestChapters(html, novelId) {
    const scope = this.extractSection(html, "m-newest2");
    if (!scope) return [];
    return this.parseChapterLinks(
      scope,
      novelId,
      this.id,
      "freewebnovel-" + novelId,
    );
  }

  _parseNovelList(html) {
    const novels = [];
    const seen = new Set();
    const linkPattern = /href="(\/novel\/[^"]+)"[^>]*>\s*([^<]{2,})\s*<\/a>/g;
    let m;

    while ((m = linkPattern.exec(html)) !== null) {
      const href = m[1];
      const title = m[2].trim();
      if (!href || !title || seen.has(href) || href.includes("/chapter-"))
        continue;
      seen.add(href);

      const slug = href.replace(/^\/novel\//, "").replace(/\/$/, "");
      const nearby = html.slice(Math.max(0, m.index - 500), m.index + 200);
      const coverMatch = nearby.match(
        /src="([^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i,
      );
      const cover = coverMatch ? this.absoluteUrl(coverMatch[1]) : "";

      novels.push({
        id: "freewebnovel-" + slug,
        sourceId: this.id,
        title,
        author: "",
        cover,
        description: "",
        status: "unknown",
        genres: [],
        url: this.baseUrl + href,
      });

      if (novels.length >= 20) break;
    }

    return { novels, hasNextPage: this.hasNextPage(html) };
  }
}

globalThis.__xaina_source__ = new FreeWebNovelSource();
