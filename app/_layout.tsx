import { ExtensionProvider } from "@/context/extension-context";
import { LibraryProvider } from "@/context/library-context";
import { SettingsContextProvider } from "@/context/settings-context";
import { initDb } from "@/lib/db";
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { seedLocalExtension } from "@/lib/extension-loader";
import { useEffect } from "react";

// Initialize DB synchronously — must run before any provider accesses the DB
initDb();

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useEffect(() => {
    // Fire and forget — never block the UI
    seedLocalExtension();
  }, []);

  return (
    <SettingsContextProvider>
      <ExtensionProvider>
        <LibraryProvider>
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="novel/[id]"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="reader/[novelId]/[chapterId]"
                options={{ headerShown: false }}
              />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </LibraryProvider>
      </ExtensionProvider>
    </SettingsContextProvider>
  );
}
