import { db } from "@/lib/db";

export type SortKey = "addedAt" | "lastReadAt" | "title";
export type FilterKey = "all" | "reading" | "completed" | "favorites";

export interface LibraryNovel {
  id: string;
  sourceId: string;
  title: string;
  author: string;
  cover: string;
  coverLocal: string | null;
  status: string;
  inLibrary: number;
  favorite: number;
  lastReadChapter: string | null;
  lastReadAt: number | null;
  addedAt: number | null;
  unreadCount: number;
}

export function getLibraryNovels(
  sort: SortKey = "addedAt",
  filter: FilterKey = "all",
  search = "",
): LibraryNovel[] {
  const orderCol =
    sort === "title"
      ? "n.title ASC"
      : sort === "lastReadAt"
        ? "n.lastReadAt DESC"
        : "n.addedAt DESC";

  const filterClause =
    filter === "reading"
      ? "AND n.lastReadChapter IS NOT NULL AND n.status != 'completed'"
      : filter === "completed"
        ? "AND n.status = 'completed'"
        : filter === "favorites"
          ? "AND n.favorite = 1"
          : "";

  const searchClause = search.trim()
    ? `AND (n.title LIKE '%${search.replace(/'/g, "''")}%' OR n.author LIKE '%${search.replace(/'/g, "''")}%')`
    : "";

  return db.getAllSync<LibraryNovel>(`
    SELECT
      n.*,
      (SELECT COUNT(*) FROM chapters c WHERE c.novelId = n.id AND c.read = 0) AS unreadCount
    FROM novels n
    WHERE n.inLibrary = 1
    ${filterClause}
    ${searchClause}
    ORDER BY ${orderCol}
  `);
}

export function toggleFavorite(novelId: string, fav: boolean) {
  db.runSync(
    "UPDATE novels SET favorite = ? WHERE id = ?",
    fav ? 1 : 0,
    novelId,
  );
}

export function removeFromLibrary(novelId: string) {
  db.runSync("UPDATE novels SET inLibrary = 0 WHERE id = ?", novelId);
}
