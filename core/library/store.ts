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

  const conditions: string[] = ["n.inLibrary = 1"];
  const params: (string | number)[] = [];

  if (filter === "reading") {
    conditions.push(
      "n.lastReadChapter IS NOT NULL AND n.status != 'completed'",
    );
  } else if (filter === "completed") {
    conditions.push("n.status = 'completed'");
  } else if (filter === "favorites") {
    conditions.push("n.favorite = 1");
  }

  if (search.trim()) {
    conditions.push("(n.title LIKE ? OR n.author LIKE ?)");
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  const where = conditions.join(" AND ");

  return db.getAllSync<LibraryNovel>(
    `SELECT
       n.*,
       COALESCE(uc.unreadCount, 0) AS unreadCount
     FROM novels n
     LEFT JOIN (
       SELECT novelId, COUNT(*) AS unreadCount
       FROM chapters
       WHERE read = 0
       GROUP BY novelId
     ) uc ON uc.novelId = n.id
     WHERE ${where}
     ORDER BY ${orderCol}`,
    ...params,
  );
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
