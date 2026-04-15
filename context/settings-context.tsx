import { getSetting } from "@/lib/db";
import React, { createContext } from "react";

export const SettingKey = {
  FONT_SIZE: "FONT_SIZE",
  LINE_HEIGHT: "LINE_HEIGHT",
  FONT_FAMILY: "FONT_FAMILY",
  THEME: "THEME",
} as const;

export const initialSettings = {
  fontSize: 14,
  lineHeight: 1.5,
  fontFamily: "sans-serif",
  theme: "system",
};

export type Settings = typeof initialSettings;
export type SettingsAction = { key: string; value: string | number };

export const settingsContext = createContext<Settings | null>(null);
export const settingsDispatchContext =
  createContext<React.Dispatch<SettingsAction> | null>(null);

export const settingsReducer = (
  settings: Settings,
  action: SettingsAction,
): Settings => {
  switch (action.key) {
    case SettingKey.FONT_SIZE:
      return { ...settings, fontSize: action.value as number };
    case SettingKey.LINE_HEIGHT:
      return { ...settings, lineHeight: action.value as number };
    case SettingKey.FONT_FAMILY:
      return { ...settings, fontFamily: action.value as string };
    case SettingKey.THEME:
      return { ...settings, theme: action.value as string };
    default:
      throw new Error(`Unknown setting: ${action.key}`);
  }
};

export const SettingsContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // Load each setting individually from DB using its own key
  const persisted: Settings = {
    fontSize: getSetting<number>(
      SettingKey.FONT_SIZE,
      initialSettings.fontSize,
    ),
    lineHeight: getSetting<number>(
      SettingKey.LINE_HEIGHT,
      initialSettings.lineHeight,
    ),
    fontFamily: getSetting<string>(
      SettingKey.FONT_FAMILY,
      initialSettings.fontFamily,
    ),
    theme: getSetting<string>(SettingKey.THEME, initialSettings.theme),
  };
  const [settings, dispatch] = React.useReducer(settingsReducer, persisted);

  return (
    <settingsContext.Provider value={settings}>
      <settingsDispatchContext.Provider value={dispatch}>
        {children}
      </settingsDispatchContext.Provider>
    </settingsContext.Provider>
  );
};
