import { useExtensions } from "@/context/extension-context";
import { Extension, NovelResult } from "@/core/extension/types";
import { useTheme } from "@/hooks/use-theme";
import { upsertNovel } from "@/lib/db";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

type Screen = "list" | "novels";

export default function ExploreScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const extensions = useExtensions();
  const [screen, setScreen] = useState<Screen>("list");
  const [activeExt, setActiveExt] = useState<Extension | null>(null);

  // Novel browser state
  const [novels, setNovels] = useState<NovelResult[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ref so onEndReached always sees the latest page without stale closure
  const pageRef = React.useRef(1);
  const loadingRef = React.useRef(false);

  function openExtension(ext: Extension) {
    setActiveExt(ext);
    setNovels([]);
    setQuery("");
    setPage(1);
    pageRef.current = 1;
    setHasNext(true);
    setError(null);
    setScreen("novels");
    doLoadWith(ext, 1, "");
  }

  function goBack() {
    setScreen("list");
    setActiveExt(null);
    setNovels([]);
    setPage(1);
    pageRef.current = 1;
    setHasNext(true);
    setError(null);
  }

  async function doLoadWith(ext: Extension, p: number, q: string) {
    if (loadingRef.current) return; // prevent double-fire
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const raw = q.trim() ? await ext.search(q, p) : await ext.getPopular(p);
      const results: NovelResult[] = Array.isArray(raw) ? raw : [];

      results.forEach((n) =>
        upsertNovel({
          id: n.id,
          sourceId: n.sourceId ?? ext.id,
          title: n.title,
          author: (n as any).author ?? "",
          cover: n.coverUrl ?? (n as any).cover_url ?? "",
          coverLocal: null,
          description: (n as any).description ?? "",
          status: (n as any).status ?? "unknown",
          genres: JSON.stringify((n as any).genres ?? []),
          url: n.url,
          inLibrary: 0,
          favorite: 0,
          lastReadChapter: null,
          lastReadAt: null,
          addedAt: null,
        }),
      );

      setNovels((prev) => {
        const combined = p === 1 ? results : [...prev, ...results];
        const seen = new Set<string>();
        return combined.filter((n) => {
          if (!n.id || seen.has(n.id)) return false;
          seen.add(n.id);
          return true;
        });
      });

      // assume there's a next page if we got any results; stop when empty
      const nextHasMore = results.length > 0;
      setHasNext(nextHasMore);
      pageRef.current = p;
      setPage(p);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  async function doLoad(p = pageRef.current, q = query) {
    if (!activeExt) return;
    await doLoadWith(activeExt, p, q);
  }

  function loadNextPage() {
    if (!activeExt || loadingRef.current || !hasNext) return;
    doLoadWith(activeExt, pageRef.current + 1, query);
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 52,
      paddingBottom: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      gap: 10,
    },
    headerTitle: {
      flex: 1,
      color: theme.text,
      fontSize: 20,
      fontWeight: "700",
    },
    backBtn: { padding: 4 },
    // Extension list
    extCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      gap: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    extIcon: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: theme.surface,
    },
    extInfo: { flex: 1 },
    extName: { color: theme.text, fontSize: 16, fontWeight: "600" },
    extMeta: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
    extLang: {
      backgroundColor: theme.primaryDark,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      alignSelf: "flex-start",
      marginTop: 4,
    },
    extLangText: { color: theme.primary, fontSize: 11, fontWeight: "600" },
    // Empty state
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingTop: 80,
    },
    emptyText: { color: theme.textMuted, fontSize: 15 },
    emptyHint: { color: theme.textMuted, fontSize: 13 },
    // Novel browser
    searchRow: { flexDirection: "row", padding: 12, gap: 8 },
    input: {
      flex: 1,
      backgroundColor: theme.surface,
      color: theme.text,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchBtn: {
      backgroundColor: theme.primaryDark,
      borderRadius: 8,
      paddingHorizontal: 16,
      justifyContent: "center",
    },
    searchBtnText: { color: theme.primary, fontWeight: "600" },
    errorBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 12,
      backgroundColor: "#2a1a1a",
    },
    errorText: { color: theme.danger, fontSize: 13, flex: 1 },
    retryText: { color: theme.primary, fontSize: 13, fontWeight: "600" },
    card: {
      flexDirection: "row",
      padding: 12,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    cover: {
      width: 60,
      height: 90,
      borderRadius: 6,
      backgroundColor: theme.surface,
    },
    info: { flex: 1, justifyContent: "center", gap: 4 },
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: "600" },
    cardAuthor: { color: theme.textSecondary, fontSize: 13 },
    cardStatus: {
      color: theme.primary,
      fontSize: 11,
      textTransform: "capitalize",
    },
  });

  // ── Extension list screen ──────────────────────────────────────────────────
  if (screen === "list") {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Explore</Text>
        </View>

        {extensions.length === 0 ? (
          <View style={s.empty}>
            <Ionicons
              name="extension-puzzle-outline"
              size={48}
              color={theme.border}
            />
            <Text style={s.emptyText}>No extensions installed</Text>
            <Text style={s.emptyHint}>
              Go to Settings → Extensions to install one
            </Text>
          </View>
        ) : (
          <FlatList
            data={extensions}
            keyExtractor={(e) => e.id}
            renderItem={({ item }) => (
              <Pressable style={s.extCard} onPress={() => openExtension(item)}>
                <Image
                  source={{ uri: item.iconUrl }}
                  style={s.extIcon}
                  contentFit="contain"
                  cachePolicy="memory"
                />
                <View style={s.extInfo}>
                  <Text style={s.extName}>{item.name}</Text>
                  <Text style={s.extMeta}>{item.baseUrl}</Text>
                  <View style={s.extLang}>
                    <Text style={s.extLangText}>{item.lang.toUpperCase()}</Text>
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.textMuted}
                />
              </Pressable>
            )}
          />
        )}
      </View>
    );
  }

  // ── Novel browser screen ───────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={goBack}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>
          {activeExt?.name}
        </Text>
      </View>

      <View style={s.searchRow}>
        <TextInput
          style={s.input}
          placeholder="Search novels..."
          placeholderTextColor={theme.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => {
            pageRef.current = 1;
            doLoad(1, query);
          }}
          returnKeyType="search"
        />
        <Pressable
          style={s.searchBtn}
          onPress={() => {
            pageRef.current = 1;
            doLoad(1, query);
          }}
        >
          <Text style={s.searchBtnText}>Go</Text>
        </Pressable>
      </View>

      {error && (
        <View style={s.errorBar}>
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={() => doLoad(1)}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {novels.length === 0 && loading ? (
        <View style={s.empty}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : novels.length === 0 && !loading ? (
        <View style={s.empty}>
          <Ionicons name="book-outline" size={48} color={theme.border} />
          <Text style={s.emptyText}>No results found</Text>
        </View>
      ) : (
        <FlatList
          data={novels}
          keyExtractor={(n) => n.id}
          onEndReached={loadNextPage}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading ? (
              <ActivityIndicator
                color={theme.primary}
                style={{ padding: 16 }}
              />
            ) : !hasNext && novels.length > 0 ? (
              <Text
                style={{
                  color: theme.textMuted,
                  textAlign: "center",
                  padding: 16,
                  fontSize: 13,
                }}
              >
                No more results
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={s.card}
              onPress={() =>
                router.push(`/novel/${encodeURIComponent(item.id)}` as any)
              }
            >
              <Image
                source={{ uri: item.coverUrl ?? (item as any).cover_url }}
                style={s.cover}
                contentFit="cover"
                cachePolicy="memory"
              />
              <View style={s.info}>
                <Text style={s.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={s.cardStatus}>{(item as any).status}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.textMuted}
              />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
