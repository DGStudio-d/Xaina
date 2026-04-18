import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("main.db");

/** Create all tables on first launch */
export function initDb() {
  db.execSync(`
    -- ── Extensions (source bundles) ──────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS extensions (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      version     TEXT NOT NULL,
      language    TEXT NOT NULL,
      baseUrl     TEXT NOT NULL,
      iconUrl     TEXT,
      sourceUrl   TEXT NOT NULL,
      bundleCode  TEXT,              -- full JS; NULL = available but not installed
      installed   INTEGER DEFAULT 0, -- 1 = active
      installedAt INTEGER,
      description TEXT,
      indexedAt   INTEGER
    );

    -- ── Novels ────────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS novels (
      id              TEXT PRIMARY KEY,
      sourceId        TEXT NOT NULL,
      title           TEXT NOT NULL,
      author          TEXT,
      cover           TEXT,
      coverLocal      TEXT,          -- local filesystem URI after cover cached
      description     TEXT,
      status          TEXT DEFAULT 'unknown',
      genres          TEXT DEFAULT '[]', -- JSON array
      url             TEXT NOT NULL,
      inLibrary       INTEGER DEFAULT 0,
      favorite        INTEGER DEFAULT 0,
      lastReadChapter TEXT,
      lastReadAt      INTEGER,
      addedAt         INTEGER
    );

    -- ── Chapters ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS chapters (
      id          TEXT PRIMARY KEY,
      novelId     TEXT NOT NULL,
      sourceId    TEXT NOT NULL,
      title       TEXT NOT NULL,
      number      REAL NOT NULL,
      url         TEXT NOT NULL,
      publishedAt TEXT,
      read        INTEGER DEFAULT 0,
      readAt      INTEGER,
      FOREIGN KEY(novelId) REFERENCES novels(id)
    );

    -- ── Chapter content cache ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS chapter_cache (
      chapterId TEXT PRIMARY KEY,
      content   TEXT NOT NULL,
      cachedAt  INTEGER NOT NULL
    );

    -- ── Reading scroll positions ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS scroll_positions (
      chapterId TEXT PRIMARY KEY,
      position  REAL NOT NULL
    );

    -- ── App settings (key/value) ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- ── Indexes ───────────────────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_novels_inLibrary   ON novels(inLibrary);
    CREATE INDEX IF NOT EXISTS idx_novels_lastReadAt  ON novels(lastReadAt DESC);
    CREATE INDEX IF NOT EXISTS idx_novels_addedAt     ON novels(addedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_novels_favorite    ON novels(favorite);
    CREATE INDEX IF NOT EXISTS idx_chapters_novelId   ON chapters(novelId);
    CREATE INDEX IF NOT EXISTS idx_chapters_read      ON chapters(novelId, read);
    CREATE INDEX IF NOT EXISTS idx_chapter_cache      ON chapter_cache(chapterId);
  `);
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

export function getSetting<T>(key: string, fallback: T): T {
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    key,
  );
  return row ? JSON.parse(row.value) : fallback;
}

export function setSetting(key: string, value: unknown) {
  db.runSync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)",
    key,
    JSON.stringify(value),
  );
}

// ─── Novel helpers ────────────────────────────────────────────────────────────

export interface DbNovel {
  id: string;
  sourceId: string;
  title: string;
  author: string;
  cover: string;
  coverLocal: string | null;
  description: string;
  status: string;
  genres: string; // JSON array string
  url: string;
  inLibrary: number;
  favorite: number;
  lastReadChapter: string | null;
  lastReadAt: number | null;
  addedAt: number | null;
}

export interface DbChapter {
  id: string;
  novelId: string;
  sourceId: string;
  title: string;
  number: number;
  url: string;
  publishedAt: string | null;
  read: number;
  readAt: number | null;
}

export function getNovelById(id: string): DbNovel | null {
  return (
    db.getFirstSync<DbNovel>("SELECT * FROM novels WHERE id = ?", id) ?? null
  );
}

export function upsertNovel(
  n: Omit<DbNovel, "inLibrary" | "favorite"> & {
    inLibrary?: number;
    favorite?: number;
  },
) {
  db.runSync(
    `INSERT INTO novels (id,sourceId,title,author,cover,coverLocal,description,status,genres,url,inLibrary,favorite,lastReadChapter,lastReadAt,addedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title, author=excluded.author, cover=excluded.cover,
       description=excluded.description, status=excluded.status, genres=excluded.genres,
       url=excluded.url`,
    n.id,
    n.sourceId,
    n.title,
    n.author ?? "",
    n.cover ?? "",
    n.coverLocal ?? null,
    n.description ?? "",
    n.status ?? "unknown",
    n.genres ?? "[]",
    n.url,
    n.inLibrary ?? 0,
    n.favorite ?? 0,
    n.lastReadChapter ?? null,
    n.lastReadAt ?? null,
    n.addedAt ?? null,
  );
}

export function setInLibrary(novelId: string, value: boolean) {
  db.runSync(
    "UPDATE novels SET inLibrary = ?, addedAt = ? WHERE id = ?",
    value ? 1 : 0,
    value ? Date.now() : null,
    novelId,
  );
}

export function setFavorite(novelId: string, value: boolean) {
  db.runSync(
    "UPDATE novels SET favorite = ? WHERE id = ?",
    value ? 1 : 0,
    novelId,
  );
}

export function setLastRead(novelId: string, chapterId: string) {
  db.runSync(
    "UPDATE novels SET lastReadChapter = ?, lastReadAt = ? WHERE id = ?",
    chapterId,
    Date.now(),
    novelId,
  );
}

// ─── Chapter helpers ──────────────────────────────────────────────────────────

export function getChaptersByNovel(novelId: string): DbChapter[] {
  return db.getAllSync<DbChapter>(
    "SELECT * FROM chapters WHERE novelId = ? ORDER BY number ASC",
    novelId,
  );
}

export function upsertChapters(chapters: Omit<DbChapter, "read" | "readAt">[]) {
  for (const c of chapters) {
    db.runSync(
      `INSERT INTO chapters (id,novelId,sourceId,title,number,url,publishedAt,read,readAt)
       VALUES (?,?,?,?,?,?,?,0,NULL)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, url=excluded.url`,
      c.id,
      c.novelId,
      c.sourceId,
      c.title,
      c.number,
      c.url,
      c.publishedAt ?? null,
    );
  }
}

export function markChapterRead(chapterId: string) {
  db.runSync(
    "UPDATE chapters SET read=1, readAt=? WHERE id=?",
    Date.now(),
    chapterId,
  );
}

export function getUnreadCount(novelId: string): number {
  const r = db.getFirstSync<{ n: number }>(
    "SELECT COUNT(*) as n FROM chapters WHERE novelId=? AND read=0",
    novelId,
  );
  return r?.n ?? 0;
}

// ─── Chapter content cache ────────────────────────────────────────────────────

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getCachedContent(chapterId: string): string | null {
  const row = db.getFirstSync<{ content: string; cachedAt: number }>(
    "SELECT content, cachedAt FROM chapter_cache WHERE chapterId = ?",
    chapterId,
  );
  if (!row) return null;
  if (Date.now() - row.cachedAt > CACHE_TTL) {
    db.runSync("DELETE FROM chapter_cache WHERE chapterId = ?", chapterId);
    return null;
  }
  return row.content;
}

export function setCachedContent(chapterId: string, content: string) {
  db.runSync(
    "INSERT OR REPLACE INTO chapter_cache (chapterId, content, cachedAt) VALUES (?,?,?)",
    chapterId,
    content,
    Date.now(),
  );
}

export function clearContentCache() {
  db.runSync("DELETE FROM chapter_cache");
}

export function getContentCacheSize(): number {
  return (
    db.getFirstSync<{ n: number }>("SELECT COUNT(*) as n FROM chapter_cache")
      ?.n ?? 0
  );
}

// ─── Scroll positions ─────────────────────────────────────────────────────────

export function getScrollPosition(chapterId: string): number {
  return (
    db.getFirstSync<{ position: number }>(
      "SELECT position FROM scroll_positions WHERE chapterId = ?",
      chapterId,
    )?.position ?? 0
  );
}

export function setScrollPosition(chapterId: string, position: number) {
  db.runSync(
    "INSERT OR REPLACE INTO scroll_positions (chapterId, position) VALUES (?,?)",
    chapterId,
    position,
  );
}
