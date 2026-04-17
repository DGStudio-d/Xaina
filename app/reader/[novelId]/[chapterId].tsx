import { useExtensions } from "@/context/extension-context";
import { ChapterContent } from "@/core/extension/types";
import { useTheme } from "@/hooks/use-theme";
import {
    DbChapter,
    getCachedContent,
    getChaptersByNovel,
    getNovelById,
    getScrollPosition,
    markChapterRead,
    setCachedContent,
    setLastRead,
    setScrollPosition,
} from "@/lib/db";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoadedChapter {
  chapter: DbChapter;
  paragraphs: ChapterContent[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatChapterLabel(c: DbChapter) {
  return `Ch. ${c.number} — ${c.title}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReaderScreen() {
  const { novelId, chapterId } = useLocalSearchParams<{
    novelId: string;
    chapterId: string;
  }>();
  const router = useRouter();
  const { theme } = useTheme();
  const extensions = useExtensions();

  const scrollRef = useRef<ScrollView>(null);
  const chapterOffsets = useRef<Record<string, number>>({});
  const lastSavedPosition = useRef(0);
  const hasRestoredScroll = useRef(false);

  const [allChapters, setAllChapters] = useState<DbChapter[]>([]);
  const [loaded, setLoaded] = useState<LoadedChapter[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [novelTitle, setNovelTitle] = useState("");
  const [headerVisible, setHeaderVisible] = useState(true);

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!novelId || !chapterId) return;

    const novel = getNovelById(novelId);
    if (novel) setNovelTitle(novel.title);

    const chapters = getChaptersByNovel(novelId);
    setAllChapters(chapters);

    const start = chapters.find((c) => c.id === chapterId);
    if (start) loadChapter(start, chapters, true);
  }, [novelId, chapterId]);

  // ── Load a chapter (with cache) ────────────────────────────────────────────

  async function loadChapter(
    chapter: DbChapter,
    chapters: DbChapter[] = allChapters,
    isFirst = false,
  ) {
    if (loaded.find((l) => l.chapter.id === chapter.id)) return;
    setLoadingId(chapter.id);

    try {
      let paragraphs: ChapterContent[] = [];

      const cached = getCachedContent(chapter.id);
      if (cached) {
        paragraphs = JSON.parse(cached);
      } else {
        const ext = extensions.find((e) => e.id === chapter.sourceId);
        if (!ext) throw new Error(`Extension "${chapter.sourceId}" not loaded`);
        paragraphs = await ext.getChapterContent(chapter.url);
        setCachedContent(chapter.id, JSON.stringify(paragraphs));
      }

      markChapterRead(chapter.id);
      setLastRead(chapter.novelId, chapter.id);

      setLoaded((prev) => {
        // keep chapters in order
        const next = [...prev, { chapter, paragraphs }];
        next.sort((a, b) => a.chapter.number - b.chapter.number);
        return next;
      });

      // Restore saved scroll position for the first chapter
      if (isFirst) {
        const saved = getScrollPosition(chapter.id);
        if (saved > 0) {
          setTimeout(() => {
            scrollRef.current?.scrollTo({ y: saved, animated: false });
          }, 300);
        }
        hasRestoredScroll.current = true;
      }
    } catch (e: any) {
      console.warn("Failed to load chapter:", e?.message);
    } finally {
      setLoadingId(null);
    }
  }

  // ── Scroll tracking ────────────────────────────────────────────────────────

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y;
    const height = e.nativeEvent.layoutMeasurement.height;
    const total = e.nativeEvent.contentSize.height;

    // Save scroll position (throttled — only when moved >50px)
    if (Math.abs(y - lastSavedPosition.current) > 50) {
      lastSavedPosition.current = y;
      const current = getCurrentChapter(y);
      if (current) setScrollPosition(current.id, y);
    }

    // Hide/show header based on scroll direction
    setHeaderVisible(y < 60);

    // Auto-load next chapter when near bottom (within 1.5 screens)
    if (y + height >= total - height * 1.5) {
      const lastLoaded = loaded[loaded.length - 1];
      if (!lastLoaded || loadingId) return;

      const idx = allChapters.findIndex((c) => c.id === lastLoaded.chapter.id);
      const next = allChapters[idx + 1];
      if (next && !loaded.find((l) => l.chapter.id === next.id)) {
        loadChapter(next);
      }
    }
  }

  function getCurrentChapter(scrollY: number): DbChapter | null {
    let current: DbChapter | null = null;
    for (const lc of loaded) {
      const offset = chapterOffsets.current[lc.chapter.id] ?? 0;
      if (scrollY >= offset) current = lc.chapter;
    }
    return current;
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 48,
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
      fontSize: 15,
      fontWeight: "600",
    },
    scrollContent: { paddingTop: 100, paddingBottom: 80 },
    // Chapter content
    chapterBlock: { paddingHorizontal: 20, paddingBottom: 32 },
    paragraph: {
      color: theme.text,
      fontSize: 17,
      lineHeight: 28,
      marginBottom: 16,
    },
    // Divider card between chapters
    dividerCard: {
      marginHorizontal: 20,
      marginVertical: 24,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      gap: 10,
    },
    dividerSep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginHorizontal: 14,
    },
    dividerLabel: { color: theme.textMuted, fontSize: 11, fontWeight: "600" },
    dividerTitle: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
      fontWeight: "600",
    },
    dividerNum: { color: theme.primary, fontSize: 13, fontWeight: "700" },
    // Loading footer
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: 24,
    },
    loadingText: { color: theme.textMuted, fontSize: 14 },
    // End of novel
    endCard: {
      margin: 20,
      padding: 24,
      borderRadius: 12,
      backgroundColor: theme.surface,
      alignItems: "center",
      gap: 8,
    },
    endTitle: { color: theme.text, fontSize: 16, fontWeight: "700" },
    endSub: { color: theme.textMuted, fontSize: 13 },
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  const lastLoadedChapter = loaded[loaded.length - 1]?.chapter;
  const lastIdx = lastLoadedChapter
    ? allChapters.findIndex((c) => c.id === lastLoadedChapter.id)
    : -1;
  const isAtEnd = lastIdx === allChapters.length - 1;

  return (
    <View style={s.container}>
      {/* Floating header */}
      {headerVisible && (
        <View style={s.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>
            {novelTitle}
          </Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        showsVerticalScrollIndicator={false}
      >
        {loaded.map((lc, i) => {
          const prev = loaded[i - 1]?.chapter ?? null;
          const isFirst = i === 0;

          return (
            <View
              key={lc.chapter.id}
              onLayout={(e) => {
                chapterOffsets.current[lc.chapter.id] = e.nativeEvent.layout.y;
              }}
            >
              {/* Divider card between chapters */}
              {!isFirst && prev && (
                <View style={s.dividerCard}>
                  <View style={s.dividerRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={theme.primary}
                    />
                    <Text style={s.dividerLabel}>FINISHED</Text>
                    <Text style={s.dividerTitle} numberOfLines={1}>
                      {prev.title}
                    </Text>
                    <Text style={s.dividerNum}>Ch. {prev.number}</Text>
                  </View>
                  <View style={s.dividerSep} />
                  <View style={s.dividerRow}>
                    <Ionicons
                      name="book-outline"
                      size={18}
                      color={theme.textMuted}
                    />
                    <Text style={s.dividerLabel}>UP NEXT</Text>
                    <Text style={s.dividerTitle} numberOfLines={1}>
                      {lc.chapter.title}
                    </Text>
                    <Text style={s.dividerNum}>Ch. {lc.chapter.number}</Text>
                  </View>
                </View>
              )}

              {/* Chapter paragraphs */}
              <View style={s.chapterBlock}>
                {lc.paragraphs.map((p) => (
                  <Text key={p.index} style={s.paragraph}>
                    {p.text}
                  </Text>
                ))}
              </View>
            </View>
          );
        })}

        {/* Loading next chapter */}
        {loadingId && (
          <View style={s.loadingRow}>
            <ActivityIndicator color={theme.primary} />
            <Text style={s.loadingText}>Loading next chapter…</Text>
          </View>
        )}

        {/* End of novel */}
        {isAtEnd && !loadingId && loaded.length > 0 && (
          <View style={s.endCard}>
            <Ionicons name="trophy-outline" size={32} color={theme.primary} />
            <Text style={s.endTitle}>You've reached the end</Text>
            <Text style={s.endSub}>No more chapters available</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
