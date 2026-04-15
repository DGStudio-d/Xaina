import { useTheme } from "@/hooks/use-theme";
import { db } from "@/lib/db";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

interface HistoryEntry {
  id: string;
  title: string;
  cover: string;
  coverLocal: string | null;
  lastReadChapter: string | null;
  lastReadAt: number | null;
  chapterTitle: string | null;
}

function getHistory(): HistoryEntry[] {
  return db.getAllSync<HistoryEntry>(`
    SELECT n.id, n.title, n.cover, n.coverLocal, n.lastReadChapter, n.lastReadAt,
           c.title as chapterTitle
    FROM novels n
    LEFT JOIN chapters c ON c.id = n.lastReadChapter
    WHERE n.lastReadAt IS NOT NULL
    ORDER BY n.lastReadAt DESC
    LIMIT 100
  `);
}

export default function HistoryScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      setEntries(getHistory());
    }, []),
  );

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { padding: 16, paddingBottom: 8 },
    headerText: { color: theme.text, fontSize: 20, fontWeight: "700" },
    row: {
      flexDirection: "row",
      padding: 12,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    cover: {
      width: 50,
      height: 75,
      borderRadius: 6,
      backgroundColor: theme.surface,
    },
    info: { flex: 1, justifyContent: "center", gap: 4 },
    title: { color: theme.text, fontSize: 14, fontWeight: "600" },
    chapter: { color: theme.textSecondary, fontSize: 12 },
    time: { color: theme.textMuted, fontSize: 11 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    emptyText: { color: theme.textMuted, fontSize: 15 },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerText}>History</Text>
      </View>
      {entries.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>No reading history yet</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => (
            <Pressable
              style={s.row}
              onPress={() => {
                if (item.lastReadChapter) {
                  router.push(
                    `/reader/${encodeURIComponent(item.id)}/${encodeURIComponent(item.lastReadChapter)}` as any,
                  );
                } else {
                  router.push(`/novel/${encodeURIComponent(item.id)}` as any);
                }
              }}
            >
              <Image
                source={
                  item.coverLocal
                    ? { uri: item.coverLocal }
                    : { uri: item.cover }
                }
                style={s.cover}
                contentFit="cover"
                cachePolicy="disk"
              />
              <View style={s.info}>
                <Text style={s.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={s.chapter} numberOfLines={1}>
                  {item.chapterTitle ?? "Not started"}
                </Text>
                <Text style={s.time}>
                  {item.lastReadAt
                    ? new Date(item.lastReadAt).toLocaleDateString()
                    : ""}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
