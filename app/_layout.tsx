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


import { useEffect } from "react";
import { runBundle } from "@/lib/DynamicExtensionRunner";
import { loadExtensionBundle } from "@/lib/extension-loader";
import { Extension } from "@/core/extension/types";

// Initialize DB
initDb();

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useEffect(() => {
    async function testExtension() {
      try {
        console.log("Running bundle...");
        
        // 1. Await the loader
        const source = await loadExtensionBundle();
        
        if (source) {
          console.log(`✅ Loaded: ${source.name}`);
          
          // 2. Await the method call
          const latestNovels = await source.getLatest(3);
          console.log("📚 Latest Novels:", latestNovels);
        } else {
          console.log("❌ Failed to load source.");
        }
      } catch (error) {
        console.error("Error testing extension:", error);
      }
    }

    testExtension();
  }, []);

  return (
    <SettingsContextProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SettingsContextProvider>
  );
}
