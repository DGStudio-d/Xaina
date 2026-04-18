import { useExtensions } from "@/context/extension-context";
import {
    useAddToLibrary,
    useRemoveFromLibrary,
    useToggleFavorite,
} from "@/hooks/use-library";
import { useTheme } from "@/hooks/use-theme";
import {
    DbChapter,
    DbNovel,
    getCachedContent,
    getChaptersByNovel,
    getNovelById,
    setCachedContent,
    setFavorite,
    upsertChapters,
    upsertNovel,
} from "@/lib/db";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

// ─── Download state per chapter ───────────────────────────────────────────────

type DlState = "idle" | "downloading" | "done" | "error";

export default function NovelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const extensions = useExtensions();

  const addToLib = useAddToLibrary();
  const removeFromLib = useRemoveFromLibrary();
  const toggleFav = useToggleFavorite();

  const [novel, setNovel] = useState<DbNovel | null>(null);
  const [chapters, setChapters] = useState<DbChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // download tracking
  const [dlStates, setDlStates] = useState<Record<string, DlState>>({});
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const cancelRef = useRef(false);

  // ── Load novel + chapters ──────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    loadNovel();
  }, [id]);

  async function loadNovel() {
    setLoading(true);
    setError(null);
    try {
      let n = getNovelById(id);

      // If we have no detail yet, fetch from extension
      if (n && !n.description) {
        const ext = extensions.find((e) => e.id === n!.sourceId);
        if (ext) {
          const detail = await ext.getNovelDetail(n.url);
          upsertNovel({
            id: n.id,
            sourceId: n.sourceId,
            title: detail.title,
            author: (detail as any).authors?.[0] ?? n.author,
            cover: detail.coverUrl ?? n.cover,
            coverLocal: n.coverLocal,
            description: detail.description ?? "",
            status: detail.status ?? n.status,
            genres: JSON.stringify(detail.genres ?? []),
            url: n.url,
          });
          n = getNovelById(id);
        }
      }

      setNovel(n);

      // Load chapters from DB first
      const dbChapters = getChaptersByNovel(id);
      if (dbChapters.length > 0) {
        setChapters(dbChapters);
      } else {
        await fetchChapters(n);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function fetchChapters(n: DbNovel | null = novel) {
    if (!n) return;
    const ext = extensions.find((e) => e.id === n.sourceId);
    if (!ext) return;
    setChaptersLoading(true);
    try {
      const results = await ext.getChapters(n.url);
      upsertChapters(
        results.map((c) => ({
          id: c.id,
          novelId: n.id,
          sourceId: n.sourceId,
          title: c.title,
          number: c.number,
          url: c.url,
          publishedAt: c.uploadedAt
            ? c.uploadedAt instanceof Date
              ? c.uploadedAt.toISOString()
              : String(c.uploadedAt)
            : null,
        })),
      );
      setChapters(getChaptersByNovel(n.id));
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to fetch chapters");
    } finally {
      setChaptersLoading(false);
    }
  }

  // ── Library / favorite actions ─────────────────────────────────────────────

  function handleLibraryToggle() {
    if (!novel) return;
    if (novel.inLibrary) {
      removeFromLib(novel.id);
      setNovel((prev) => (prev ? { ...prev, inLibrary: 0 } : prev));
    } else {
      addToLib(novel.id);
      setNovel((prev) => (prev ? { ...prev, inLibrary: 1 } : prev));
    }
  }

  function handleFavoriteToggle() {
    if (!novel) return;
    const next = !novel.favorite;
    toggleFav(novel.id, next);
    setFavorite(novel.id, next);
    setNovel((prev) => (prev ? { ...prev, favorite: next ? 1 : 0 } : prev));
  }

  // ── Download ───────────────────────────────────────────────────────────────

  const downloadChapter = useCallback(
    async (chapter: DbChapter) => {
      if (getCachedContent(chapter.id)) {
        setDlStates((s) => ({ ...s, [chapter.id]: "done" }));
        return;
      }
      const ext = extensions.find((e) => e.id === chapter.sourceId);
      if (!ext) return;
      setDlStates((s) => ({ ...s, [chapter.id]: "downloading" }));
      try {
        const content = await ext.getChapterContent(chapter.url);
        setCachedContent(chapter.id, JSON.stringify(content));
        setDlStates((s) => ({ ...s, [chapter.id]: "done" }));
      } catch {
        setDlStates((s) => ({ ...s, [chapter.id]: "error" }));
      }
    },
    [extensions],
  );

  async function downloadAll() {
    cancelRef.current = false;
    setBulkDownloading(true);
    for (const ch of chapters) {
      if (cancelRef.current) break;
      await downloadChapter(ch);
    }
    setBulkDownloading(false);
  }

  function cancelDownload() {
    cancelRef.current = true;
    setBulkDownloading(false);
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const genres = useMemo<string[]>(() => {
    try {
      return JSON.parse(novel?.genres ?? "[]");
    } catch {
      return [];
    }
  }, [novel?.genres]);

  const downloadedCount = useMemo(
    () =>
      Object.values(dlStates).filter((s) => s === "done").length +
      chapters.filter((c) => !!getCachedContent(c.id) && !dlStates[c.id])
        .length,
    [dlStates, chapters],
  );

  // ── Styles ─────────────────────────────────────────────────────────────────

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 52,
      paddingBottom: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      gap: 10,
    },
    headerTitle: {
      flex: 1,
      color: theme.text,
      fontSize: 17,
      fontWeight: "700",
    },
    // Hero
    hero: {
      flexDirection: "row",
      padding: 16,
      gap: 14,
      backgroundColor: theme.surface,
    },
    cover: {
      width: 100,
      height: 150,
      borderRadius: 10,
      backgroundColor: theme.card,
    },
    heroInfo: { flex: 1, justifyContent: "flex-end", gap: 6 },
    novelTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "700",
      lineHeight: 24,
    },
    novelAuthor: { color: theme.textSecondary, fontSize: 14 },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    statusBadge: {
      backgroundColor: theme.primaryDark,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    statusText: {
      color: theme.primary,
      fontSize: 11,
      fontWeight: "600",
      textTransform: "capitalize",
    },
    // Action buttons
    actions: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 10,
      backgroundColor: theme.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionBtnActive: {
      backgroundColor: theme.primaryDark,
      borderColor: theme.primary,
    },
    actionBtnDanger: { backgroundColor: "#2a1010", borderColor: theme.danger },
    actionText: { color: theme.textSecondary, fontSize: 13, fontWeight: "600" },
    actionTextActive: { color: theme.primary },
    actionTextDanger: { color: theme.danger },
    // Genres
    genreRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 6,
      backgroundColor: theme.surface,
    },
    genre: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    genreText: { color: theme.textMuted, fontSize: 11 },
    // Description
    section: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    sectionTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "700",
      marginBottom: 8,
    },
    description: { color: theme.textSecondary, fontSize: 14, lineHeight: 22 },
    // Chapter list header
    chapterHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      gap: 8,
    },
    chapterCount: {
      flex: 1,
      color: theme.text,
      fontSize: 15,
      fontWeight: "700",
    },
    dlProgress: { color: theme.textMuted, fontSize: 12 },
    dlBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.primaryDark,
    },
    dlBtnText: { color: theme.primary, fontSize: 13, fontWeight: "600" },
    // Chapter row
    chapterRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      gap: 10,
    },
    chapterNum: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: "700",
      width: 36,
    },
    chapterTitle: { flex: 1, color: theme.text, fontSize: 14 },
    chapterTitleRead: { color: theme.textMuted },
    chapterDate: { color: theme.textMuted, fontSize: 11 },
    dlIcon: { width: 22, alignItems: "center" },
    // Loading / error
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    errorText: { color: theme.danger, fontSize: 14 },
    retryText: { color: theme.primary, fontSize: 14, fontWeight: "600" },
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  if (error || !novel) {
    return (
      <View style={[s.container, s.center]}>
        <Text style={s.errorText}>{error ?? "Novel not found"}</Text>
        <Pressable onPress={loadNovel}>
          <Text style={s.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const firstUnread = chapters.find((c) => !c.read);
  const continueChapter = novel.lastReadChapter
    ? chapters.find((c) => c.id === novel.lastReadChapter)
    : null;
  const readTarget = continueChapter ?? firstUnread ?? chapters[0];

  function dlIconFor(ch: DbChapter) {
    const state = dlStates[ch.id];
    const cached = !!getCachedContent(ch.id);
    if (state === "downloading")
      return <ActivityIndicator size={14} color={theme.primary} />;
    if (state === "done" || cached)
      return (
        <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
      );
    if (state === "error")
      return <Ionicons name="alert-circle" size={16} color={theme.danger} />;
    return (
      <Ionicons name="download-outline" size={16} color={theme.textMuted} />
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>
          {novel.title}
        </Text>
      </View>

      <FlatList
        data={chapters}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <>
            {/* Hero */}
            <View style={s.hero}>
              <Image
                source={
                  novel.coverLocal
                    ? { uri: novel.coverLocal }
                    : { uri: novel.cover }
                }
                style={s.cover}
                contentFit="cover"
                cachePolicy="disk"
              />
              <View style={s.heroInfo}>
                <Text style={s.novelTitle}>{novel.title}</Text>
                <Text style={s.novelAuthor}>{novel.author}</Text>
                <View style={s.statusRow}>
                  <View style={s.statusBadge}>
                    <Text style={s.statusText}>{novel.status}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Action buttons */}
            <View style={s.actions}>
              {/* Library toggle */}
              <Pressable
                style={[
                  s.actionBtn,
                  novel.inLibrary ? s.actionBtnActive : null,
                ]}
                onPress={handleLibraryToggle}
              >
                <Ionicons
                  name={novel.inLibrary ? "bookmark" : "bookmark-outline"}
                  size={18}
                  color={novel.inLibrary ? theme.primary : theme.textSecondary}
                />
                <Text
                  style={[
                    s.actionText,
                    novel.inLibrary ? s.actionTextActive : null,
                  ]}
                >
                  {novel.inLibrary ? "In Library" : "Add"}
                </Text>
              </Pressable>

              {/* Favorite toggle */}
              <Pressable
                style={[s.actionBtn, novel.favorite ? s.actionBtnDanger : null]}
                onPress={handleFavoriteToggle}
              >
                <Ionicons
                  name={novel.favorite ? "heart" : "heart-outline"}
                  size={18}
                  color={novel.favorite ? theme.danger : theme.textSecondary}
                />
                <Text
                  style={[
                    s.actionText,
                    novel.favorite ? s.actionTextDanger : null,
                  ]}
                >
                  {novel.favorite ? "Favorited" : "Favorite"}
                </Text>
              </Pressable>

              {/* Read / Continue */}
              {readTarget && (
                <Pressable
                  style={[s.actionBtn, s.actionBtnActive]}
                  onPress={() =>
                    router.push(
                      `/reader/${encodeURIComponent(novel.id)}/${encodeURIComponent(readTarget.id)}` as any,
                    )
                  }
                >
                  <Ionicons name="book" size={18} color={theme.primary} />
                  <Text style={s.actionTextActive}>
                    {continueChapter ? "Continue" : "Read"}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Genres */}
            {genres.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.genreRow}
              >
                {genres.map((g) => (
                  <View key={g} style={s.genre}>
                    <Text style={s.genreText}>{g}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Description */}
            {!!novel.description && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Synopsis</Text>
                <Text style={s.description}>{novel.description}</Text>
              </View>
            )}

            {/* Chapter list header */}
            <View style={s.chapterHeader}>
              <Text style={s.chapterCount}>
                {chapters.length} Chapter{chapters.length !== 1 ? "s" : ""}
              </Text>
              {chapters.length > 0 && (
                <Text style={s.dlProgress}>
                  {downloadedCount}/{chapters.length} downloaded
                </Text>
              )}
              {chaptersLoading ? (
                <ActivityIndicator size={16} color={theme.primary} />
              ) : (
                <Pressable
                  style={s.dlBtn}
                  onPress={bulkDownloading ? cancelDownload : downloadAll}
                >
                  <Ionicons
                    name={
                      bulkDownloading
                        ? "stop-circle-outline"
                        : "cloud-download-outline"
                    }
                    size={16}
                    color={theme.primary}
                  />
                  <Text style={s.dlBtnText}>
                    {bulkDownloading ? "Cancel" : "Download all"}
                  </Text>
                </Pressable>
              )}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            style={s.chapterRow}
            onPress={() =>
              router.push(
                `/reader/${encodeURIComponent(novel.id)}/${encodeURIComponent(item.id)}` as any,
              )
            }
            onLongPress={() => downloadChapter(item)}
          >
            <Text style={s.chapterNum}>{item.number}</Text>
            <Text
              style={[s.chapterTitle, item.read ? s.chapterTitleRead : null]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {item.publishedAt && (
              <Text style={s.chapterDate}>
                {new Date(item.publishedAt).toLocaleDateString()}
              </Text>
            )}
            <View style={s.dlIcon}>{dlIconFor(item)}</View>
          </Pressable>
        )}
      />
    </View>
  );
}
