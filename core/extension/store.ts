/**
 * Extension store — all SQLite operations for source bundles.
 *
 * Schema (extensions table):
 *   id          — source id, e.g. "freewebnovel"
 *   name        — display name
 *   version     — semver string
 *   language    — ISO language code, e.g. "en"
 *   baseUrl     — source website base URL
 *   iconUrl     — favicon / logo URL
 *   sourceUrl   — URL the bundle was downloaded from
 *   bundleCode  — full JS text of the bundle (NULL = not installed)
 *   installed   — 1 = active, 0 = available but not installed
 *   installedAt — unix ms timestamp of install
 *   description — short description shown in the Extensions UI
 *   indexedAt   — unix ms timestamp when fetched from community index
 */

import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredExtension {
  id: string;
  name: string;
  version: string;
  language: string;
  baseUrl: string;
  iconUrl: string;
  sourceUrl: string;
  bundleCode: string | null;
  installed: boolean;
  installedAt: number | null;
  description: string;
  indexedAt: number | null;
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Upsert an extension from the community index.
 * Does NOT overwrite bundleCode or installed status if the row already exists.
 */
export function upsertIndexEntry(
  ext: Omit<StoredExtension, "bundleCode" | "installed" | "installedAt">,
) {
  db.runSync(
    `INSERT INTO extensions (id,name,version,language,baseUrl,iconUrl,sourceUrl,bundleCode,installed,installedAt,description,indexedAt)
     VALUES (?,?,?,?,?,?,?,NULL,0,NULL,?,?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, version=excluded.version, language=excluded.language,
       baseUrl=excluded.baseUrl, iconUrl=excluded.iconUrl, sourceUrl=excluded.sourceUrl,
       description=excluded.description, indexedAt=excluded.indexedAt`,
    ext.id,
    ext.name,
    ext.version,
    ext.language,
    ext.baseUrl,
    ext.iconUrl ?? "",
    ext.sourceUrl,
    ext.description ?? "",
    ext.indexedAt ?? Date.now(),
  );
}

/**
 * Store the downloaded bundle code and mark the extension as installed.
 * Used when the extension was already in the index (installed=0 row exists).
 */
export function markInstalled(id: string, bundleCode: string) {
  db.runSync(
    `UPDATE extensions SET bundleCode=?, installed=1, installedAt=? WHERE id=?`,
    bundleCode,
    Date.now(),
    id,
  );
}

/**
 * Insert a brand-new extension that wasn't in the index (custom URL install).
 */
export function insertNewExtension(ext: StoredExtension) {
  db.runSync(
    `INSERT OR REPLACE INTO extensions
       (id,name,version,language,baseUrl,iconUrl,sourceUrl,bundleCode,installed,installedAt,description,indexedAt)
     VALUES (?,?,?,?,?,?,?,?,1,?,?,?)`,
    ext.id,
    ext.name,
    ext.version,
    ext.language,
    ext.baseUrl,
    ext.iconUrl ?? "",
    ext.sourceUrl,
    ext.bundleCode ?? "",
    ext.installedAt ?? Date.now(),
    ext.description ?? "",
    ext.indexedAt ?? null,
  );
}

/**
 * Uninstall: clear bundle code, set installed=0.
 * Keeps the row so the user can reinstall from the Available list.
 */
export function markUninstalled(id: string) {
  db.runSync(
    `UPDATE extensions SET bundleCode=NULL, installed=0, installedAt=NULL WHERE id=?`,
    id,
  );
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/** All installed extensions (installed=1, bundleCode present). */
export function getInstalled(): StoredExtension[] {
  return db
    .getAllSync<any>(
      `SELECT * FROM extensions WHERE installed=1 ORDER BY installedAt DESC`,
    )
    .map(row);
}

/** All extensions from the index (installed or not). */
export function getAll(): StoredExtension[] {
  return db
    .getAllSync<any>(`SELECT * FROM extensions ORDER BY name ASC`)
    .map(row);
}

/** Get the bundle JS for a specific installed extension. NULL if not installed. */
export function getBundleCode(id: string): string | null {
  const r = db.getFirstSync<{ bundleCode: string | null }>(
    `SELECT bundleCode FROM extensions WHERE id=? AND installed=1`,
    id,
  );
  return r?.bundleCode ?? null;
}

/** True if the extensions table has any rows (index has been fetched at least once). */
export function hasIndexData(): boolean {
  const r = db.getFirstSync<{ n: number }>(
    `SELECT COUNT(*) as n FROM extensions WHERE indexedAt IS NOT NULL`,
  );
  return (r?.n ?? 0) > 0;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function row(r: any): StoredExtension {
  return {
    id: r.id,
    name: r.name,
    version: r.version,
    language: r.language,
    baseUrl: r.baseUrl,
    iconUrl: r.iconUrl ?? "",
    sourceUrl: r.sourceUrl,
    bundleCode: r.bundleCode ?? null,
    installed: r.installed === 1,
    installedAt: r.installedAt ?? null,
    description: r.description ?? "",
    indexedAt: r.indexedAt ?? null,
  };
}
