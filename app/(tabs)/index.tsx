import {
  getLibraryNovels,
  removeFromLibrary,
  toggleFavorite,
  type FilterKey,
  type LibraryNovel,
  type SortKey,
} from "@/core/library/store";
import { useTheme } from "@/hooks/use-theme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "addedAt", label: "Added" },
  { key: "lastReadAt", label: "Recent" },
  { key: "title", label: "Title" },
];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "reading", label: "Reading" },
  { key: "completed", label: "Completed" },
  { key: "favorites", label: "Favorites" },
];

export default function LibraryScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [novels, setNovels] = useState<LibraryNovel[]>([]);
  const [sort, setSort] = useState<SortKey>("addedAt");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const load = useCallback(() => {
    setNovels(getLibraryNovels(sort, filter, search));
  }, [sort, filter, search]);

  useFocusEffect(load);

  function handleLongPress(novel: LibraryNovel) {
    Alert.alert(novel.title, undefined, [
      {
        text: novel.favorite ? "Unfavorite" : "Favorite",
        onPress: () => {
          toggleFavorite(novel.id, !novel.favorite);
          load();
        },
      },
      {
        text: "Remove from library",
        style: "destructive",
        onPress: () => {
          removeFromLibrary(novel.id);
          load();
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    // ── Top bar ──
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      gap: 8,
    },
    title: { flex: 1, color: theme.text, fontSize: 20, fontWeight: "700" },
    iconBtn: { padding: 4 },
    searchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 15,
      paddingVertical: 4,
    },
    // ── Filter chips ──
    filterBar: {
      flexDirection: "row",
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
      backgroundColor: theme.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipActive: {
      backgroundColor: theme.primaryDark,
      borderColor: theme.primary,
    },
    chipText: { color: theme.textSecondary, fontSize: 13 },
    chipTextActive: { color: theme.primary, fontWeight: "600" },
    // ── Sort bar ──
    sortBar: {
      flexDirection: "row",
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 6,
      backgroundColor: theme.background,
    },
    sortBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: theme.surface,
    },
    sortBtnActive: { backgroundColor: theme.primaryDark },
    sortText: { color: theme.textMuted, fontSize: 12 },
    sortTextActive: { color: theme.primary, fontWeight: "600" },
    // ── Grid ──
    grid: { padding: 8 },
    gridItem: {
      flex: 1,
      margin: 4,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: theme.card,
    },
    gridCover: { width: "100%", aspectRatio: 2 / 3 },
    gridInfo: { padding: 6 },
    gridTitle: { color: theme.text, fontSize: 12, fontWeight: "600" },
    gridMeta: { color: theme.textMuted, fontSize: 10, marginTop: 2 },
    unreadBadge: {
      position: "absolute",
      top: 6,
      right: 6,
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    unreadText: { color: "#fff", fontSize: 10, fontWeight: "700" },
    favIcon: { position: "absolute", top: 6, left: 6 },
    // ── List ──
    listItem: {
      flexDirection: "row",
      padding: 10,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    listCover: {
      width: 52,
      height: 78,
      borderRadius: 6,
      backgroundColor: theme.surface,
    },
    listInfo: { flex: 1, justifyContent: "center", gap: 4 },
    listTitle: { color: theme.text, fontSize: 14, fontWeight: "600" },
    listAuthor: { color: theme.textSecondary, fontSize: 12 },
    listMeta: { color: theme.textMuted, fontSize: 11 },
    // ── Empty ──
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingTop: 80,
    },
    emptyText: { color: theme.text, fontSize: 18, fontWeight: "600" },
    emptyHint: { color: theme.textMuted, fontSize: 14 },
  });

  function GridItem({ item }: { item: LibraryNovel }) {
    return (
      <Pressable
        style={s.gridItem}
        onPress={() =>
          router.push(`/novel/${encodeURIComponent(item.id)}` as any)
        }
        onLongPress={() => handleLongPress(item)}
      >
        <Image
          source={
            item.coverLocal ? { uri: item.coverLocal } : { uri: item.cover }
          }
          style={s.gridCover}
          contentFit="cover"
          cachePolicy="disk"
        />
        {item.unreadCount > 0 && (
          <View style={s.unreadBadge}>
            <Text style={s.unreadText}>{item.unreadCount}</Text>
          </View>
        )}
        {!!item.favorite && (
          <View style={s.favIcon}>
            <Ionicons name="heart" size={14} color={theme.danger} />
          </View>
        )}
        <View style={s.gridInfo}>
          <Text style={s.gridTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={s.gridMeta} numberOfLines={1}>
            {item.author}
          </Text>
        </View>
      </Pressable>
    );
  }

  function ListItem({ item }: { item: LibraryNovel }) {
    return (
      <Pressable
        style={s.listItem}
        onPress={() =>
          router.push(`/novel/${encodeURIComponent(item.id)}` as any)
        }
        onLongPress={() => handleLongPress(item)}
      >
        <Image
          source={
            item.coverLocal ? { uri: item.coverLocal } : { uri: item.cover }
          }
          style={s.listCover}
          contentFit="cover"
          cachePolicy="disk"
        />
        <View style={s.listInfo}>
          <Text style={s.listTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={s.listAuthor} numberOfLines={1}>
            {item.author}
          </Text>
          <Text style={s.listMeta}>
            {item.unreadCount > 0 ? `${item.unreadCount} unread · ` : ""}
            {item.status}
            {item.favorite ? " · ♥" : ""}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </Pressable>
    );
  }

  return (
    <View style={s.container}>
      {/* Top bar */}
      <View style={s.topBar}>
        {showSearch ? (
          <TextInput
            style={s.searchInput}
            placeholder="Search library..."
            placeholderTextColor={theme.textMuted}
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              load();
            }}
            autoFocus
          />
        ) : (
          <Text style={s.title}>Library</Text>
        )}
        <Pressable
          style={s.iconBtn}
          onPress={() => {
            setShowSearch((v) => !v);
            setSearch("");
          }}
        >
          <Ionicons
            name={showSearch ? "close" : "search"}
            size={22}
            color={theme.primary}
          />
        </Pressable>
        <Pressable
          style={s.iconBtn}
          onPress={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
        >
          <Ionicons
            name={viewMode === "grid" ? "list" : "grid"}
            size={22}
            color={theme.primary}
          />
        </Pressable>
      </View>

      {/* Filter chips */}
      <View style={s.filterBar}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[s.chip, filter === f.key && s.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Sort bar */}
      <View style={s.sortBar}>
        {SORTS.map((so) => (
          <Pressable
            key={so.key}
            style={[s.sortBtn, sort === so.key && s.sortBtnActive]}
            onPress={() => setSort(so.key)}
          >
            <Text style={[s.sortText, sort === so.key && s.sortTextActive]}>
              {so.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Novel list */}
      {novels.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="library-outline" size={64} color={theme.border} />
          <Text style={s.emptyText}>Library is empty</Text>
          <Text style={s.emptyHint}>Browse sources to find novels</Text>
        </View>
      ) : viewMode === "grid" ? (
        <FlatList
          data={novels}
          keyExtractor={(n) => n.id}
          numColumns={3}
          contentContainerStyle={s.grid}
          renderItem={({ item }) => <GridItem item={item} />}
        />
      ) : (
        <FlatList
          data={novels}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => <ListItem item={item} />}
        />
      )}
    </View>
  );
}
