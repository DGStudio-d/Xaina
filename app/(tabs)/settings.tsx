import { SettingKey } from "@/context/settings-context";
import { useSettings, useSettingsDispatch } from "@/hooks/use-settings";
import { useSetTheme, useTheme, type ThemeName } from "@/hooks/use-theme";
import { clearContentCache, getContentCacheSize } from "@/lib/db";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const THEMES: { key: ThemeName | "system"; label: string }[] = [
  { key: "system", label: "System" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "sepia", label: "Sepia" },
];

const FONTS = ["sans-serif", "serif", "monospace"] as const;

export default function SettingsScreen() {
  const { theme } = useTheme();
  const settings = useSettings();
  const update = useSettingsDispatch();
  const setTheme = useSetTheme();
  const router = useRouter();
  const [cacheSize, setCacheSize] = useState(0);

  useEffect(() => {
    setCacheSize(getContentCacheSize());
  }, []);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 20, gap: 16 },
    section: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 4,
      marginTop: 8,
    },
    label: { color: theme.textSecondary, fontSize: 14, marginBottom: 4 },
    row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipActive: {
      backgroundColor: theme.primaryDark,
      borderColor: theme.primary,
    },
    chipText: { color: theme.textMuted, fontSize: 13 },
    chipTextActive: { color: theme.primary, fontWeight: "600" },
    navRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    navText: { flex: 1, color: theme.text, fontSize: 15 },
    navSub: { color: theme.textMuted, fontSize: 13, marginRight: 8 },
  });

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={[s.section, { marginTop: 0 }]}>Appearance</Text>

      <Text style={s.label}>Theme</Text>
      <View style={s.row}>
        {THEMES.map((t) => (
          <Pressable
            key={t.key}
            style={[s.chip, settings.theme === t.key && s.chipActive]}
            onPress={() => setTheme(t.key as ThemeName)}
          >
            <Text
              style={[s.chipText, settings.theme === t.key && s.chipTextActive]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.section}>Reader</Text>

      <Text style={s.label}>Font Size: {settings.fontSize}px</Text>
      <Slider
        minimumValue={12}
        maximumValue={28}
        step={1}
        value={settings.fontSize}
        onValueChange={(v: number) =>
          update({ key: SettingKey.FONT_SIZE, value: v })
        }
        minimumTrackTintColor={theme.primary}
        thumbTintColor={theme.primary}
      />

      <Text style={s.label}>Line Height: {settings.lineHeight.toFixed(1)}</Text>
      <Slider
        minimumValue={1.2}
        maximumValue={2.4}
        step={0.1}
        value={settings.lineHeight}
        onValueChange={(v: number) =>
          update({
            key: SettingKey.LINE_HEIGHT,
            value: parseFloat(v.toFixed(1)),
          })
        }
        minimumTrackTintColor={theme.primary}
        thumbTintColor={theme.primary}
      />

      <Text style={s.label}>Font Family</Text>
      <View style={s.row}>
        {FONTS.map((f) => (
          <Pressable
            key={f}
            style={[s.chip, settings.fontFamily === f && s.chipActive]}
            onPress={() => update({ key: SettingKey.FONT_FAMILY, value: f })}
          >
            <Text
              style={[
                s.chipText,
                settings.fontFamily === f && s.chipTextActive,
              ]}
            >
              {f}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.section}>Sources</Text>
      <Pressable
        style={s.navRow}
        onPress={() => router.push("/settings/extensions" as any)}
      >
        <Ionicons
          name="apps-outline"
          size={20}
          color={theme.primary}
          style={{ marginRight: 12 }}
        />
        <Text style={s.navText}>Extensions</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </Pressable>

      <Text style={s.section}>Storage</Text>
      <View style={[s.navRow, { justifyContent: "space-between" }]}>
        <View>
          <Text style={s.navText}>Chapter Cache</Text>
          <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
            {cacheSize} chapters cached
          </Text>
        </View>
        <Pressable
          style={{
            backgroundColor: "#3a1a1a",
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 8,
          }}
          disabled={cacheSize === 0}
          onPress={() =>
            Alert.alert("Clear Cache", `Delete ${cacheSize} cached chapters?`, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Clear",
                style: "destructive",
                onPress: () => {
                  clearContentCache();
                  setCacheSize(0);
                },
              },
            ])
          }
        >
          <Text
            style={{
              color: cacheSize === 0 ? theme.textMuted : theme.danger,
              fontWeight: "600",
              fontSize: 13,
            }}
          >
            Clear
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
