import {
    initialSettings,
    settingsContext,
    settingsDispatchContext,
    type SettingsAction,
} from "@/context/settings-context";
import { setSetting } from "@/lib/db";
import { useCallback, useContext } from "react";

export const useSettings = () => {
  const settings = useContext(settingsContext);
  // Return defaults instead of throwing — safe to call anywhere in the tree
  return settings ?? initialSettings;
};

export const useSettingsDispatch = () => {
  const dispatch = useContext(settingsDispatchContext);

  const updateSetting = useCallback(
    (action: SettingsAction) => {
      if (!dispatch) return; // no-op outside provider
      dispatch(action);
      setSetting(action.key, action.value);
    },
    [dispatch],
  );

  return updateSetting;
};

/** Load persisted settings from DB — call once on app start */
