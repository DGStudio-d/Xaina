import { getBundleCode, getInstalled } from "@/core/extension/store";
import { Extension } from "@/core/extension/types";
import { runBundle } from "@/lib/DynamicExtensionRunner";
import React, { createContext, useContext, useEffect } from "react";

export type ExtensionsAction =
  | { type: "add"; value: Extension }
  | { type: "reset"; value: Extension[] };

export const extensionReducer = (
  state: Extension[],
  action: ExtensionsAction,
): Extension[] => {
  switch (action.type) {
    case "add":
      return [...state, action.value];
    case "reset":
      return action.value;
    default:
      return state;
  }
};

const ExtensionContext = createContext<Extension[]>([]);
const ExtensionDispatchContext =
  createContext<React.Dispatch<ExtensionsAction> | null>(null);

export const ExtensionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [extensions, dispatch] = React.useReducer(extensionReducer, []);

  useEffect(() => {
    const installed = getInstalled();
    const loaded: Extension[] = [];
    for (const ext of installed) {
      const code = getBundleCode(ext.id);
      if (code) loaded.push(runBundle(code));
    }
    dispatch({ type: "reset", value: loaded });
  }, []);

  return (
    <ExtensionContext.Provider value={extensions}>
      <ExtensionDispatchContext.Provider value={dispatch}>
        {children}
      </ExtensionDispatchContext.Provider>
    </ExtensionContext.Provider>
  );
};

export function useExtensions(): Extension[] {
  return useContext(ExtensionContext);
}

export function useExtensionsDispatch() {
  return useContext(ExtensionDispatchContext);
}
