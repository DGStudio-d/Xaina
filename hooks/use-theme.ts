import { SettingKey } from "@/context/settings-context";
import { useSettings, useSettingsDispatch } from "@/hooks/use-settings";
import { useColorScheme } from "react-native";

// ─── Palette ──────────────────────────────────────────────────────────────────

const themes = {
  light: {
    background: "#ffffff",
    surface: "#f5f5f5",
    border: "#e0e0e0",
    text: "#111111",
    textSecondary: "#666666",
    textMuted: "#999999",
    primary: "#4a9eff",
    primaryDark: "#1a3a5a",
    danger: "#f66",
    success: "#4f4",
    card: "#ffffff",
    tabBar: "#ffffff",
    tabBarBorder: "#e0e0e0",
    header: "#ffffff",
  },
  dark: {
    background: "#111111",
    surface: "#1a1a1a",
    border: "#2a2a2a",
    text: "#eeeeee",
    textSecondary: "#aaaaaa",
    textMuted: "#666666",
    primary: "#4a9eff",
    primaryDark: "#1a3a5a",
    danger: "#f66",
    success: "#4f4",
    card: "#1e1e1e",
    tabBar: "#111111",
    tabBarBorder: "#222222",
    header: "#111111",
  },
  sepia: {
    background: "#f4ecd8",
    surface: "#ede0c4",
    border: "#c8b89a",
    text: "#3b2a1a",
    textSecondary: "#6b4c2a",
    textMuted: "#9b7c5a",
    primary: "#8b5e3c",
    primaryDark: "#5c3a1e",
    danger: "#c0392b",
    success: "#27ae60",
    card: "#f4ecd8",
    tabBar: "#ede0c4",
    tabBarBorder: "#c8b89a",
    header: "#ede0c4",
  },
} as const;

export type ThemeName = keyof typeof themes;
export type Theme = typeof themes.dark;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme() {
  const settings = useSettings();
  const deviceScheme = useColorScheme(); // "light" | "dark" | null

  // "system" or unrecognised value → follow device scheme
  const saved = settings.theme;
  const resolved: ThemeName =
    saved === "system" || !(saved in themes)
      ? ((deviceScheme ?? "dark") as ThemeName)
      : (saved as ThemeName);

  return {
    theme: themes[resolved],
    themeName: resolved,
    isDark: resolved === "dark",
    isLight: resolved === "light",
    isSepia: resolved === "sepia",
  };
}

export function useSetTheme() {
  const update = useSettingsDispatch();
  return (name: ThemeName) => update({ key: SettingKey.THEME, value: name });
}
