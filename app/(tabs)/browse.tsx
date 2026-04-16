import { useTheme } from "@/hooks/use-theme";
import { upsertNovel } from "@/lib/db";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function BrowseScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [sources, setSources] = useState<[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [novels, setNovels] = useState<[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);



  const activeSource = sources.find((s) => s.id === activeId);

  async function doSearch(p = 1, q = query) {
    if (!activeSource) return;
    setLoading(true);
    setError(null);
    try {
      const result = q.trim()
        ? await activeSource.search(q, p)
        : await activeSource.getPopular(p);
      const list = p === 1 ? result.novels : [...novels, ...result.novels];
      result.novels.forEach((n) =>
        upsertNovel({
          ...n,
          genres: JSON.stringify(n.genres),
          coverLocal: null,
          inLibrary: 0,
          favorite: 0,
          lastReadChapter: n.lastReadChapter ?? null,
          lastReadAt: n.lastReadAt ?? null,
          addedAt: n.addedAt ?? null,
        }),
      );
      setNovels(list);
      setHasNext(result.hasNextPage);
      setPage(p);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    sourceBar: {
      backgroundColor: theme.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    sourceTab: { paddingHorizontal: 16, paddingVertical: 10, marginRight: 4 },
    sourceTabActive: { borderBottomWidth: 2, borderBottomColor: theme.primary },
    sourceTabText: { color: theme.textMuted, fontSize: 13, fontWeight: "600" },
    sourceTabTextActive: { color: theme.primary },
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
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingTop: 80,
    },
    emptyText: { color: theme.textMuted, fontSize: 15 },
    errorBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 12,
      backgroundColor: "#2a1a1a",
    },
    errorText: { color: theme.danger, fontSize: 13, flex: 1 },
    retryText: { color: theme.primary, fontSize: 13, fontWeight: "600" },
  });

  return (
    <View style={s.container}>
      {/* Source tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.sourceBar}
      >
        {sources.map((src) => (
          <Pressable
            key={src.id}
            style={[s.sourceTab, activeId === src.id && s.sourceTabActive]}
            onPress={() => {
              setActiveId(src.id);
              setNovels([]);
            }}
          >
            <Text
              style={[
                s.sourceTabText,
                activeId === src.id && s.sourceTabTextActive,
              ]}
            >
              {src.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Search */}
      <View style={s.searchRow}>
        <TextInput
          style={s.input}
          placeholder="Search novels..."
          placeholderTextColor={theme.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => doSearch(1)}
          returnKeyType="search"
        />
        <Pressable style={s.searchBtn} onPress={() => doSearch(1)}>
          <Text style={s.searchBtnText}>Go</Text>
        </Pressable>
      </View>

      {error && (
        <View style={s.errorBar}>
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={() => doSearch(1)}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {sources.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="apps-outline" size={48} color={theme.border} />
          <Text style={s.emptyText}>No sources installed</Text>
          <Text style={{ color: theme.textMuted, fontSize: 13 }}>
            Go to Settings → Extensions
          </Text>
        </View>
      ) : novels.length === 0 && !loading ? (
        <Pressable style={[s.empty]} onPress={() => doSearch(1)}>
          <Ionicons name="search" size={48} color={theme.border} />
          <Text style={s.emptyText}>Tap to load popular</Text>
        </Pressable>
      ) : (
        <FlatList
          data={novels}
          keyExtractor={(n) => n.id}
          onEndReached={() => hasNext && !loading && doSearch(page + 1)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading ? (
              <ActivityIndicator
                color={theme.primary}
                style={{ padding: 16 }}
              />
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
                source={{ uri: item.cover }}
                style={s.cover}
                contentFit="cover"
                cachePolicy="memory"
              />
              <View style={s.info}>
                <Text style={s.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={s.cardAuthor} numberOfLines={1}>
                  {item.author}
                </Text>
                <Text style={s.cardStatus}>{item.status}</Text>
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
