import { getBundleCode, getInstalled, StoredExtension } from "@/core/extension/store";
import { Extension } from "@/core/extension/types";
import { runBundle } from "@/lib/DynamicExtensionRunner";
import React, { createContext, useEffect } from "react";

export const initextension: Extension[] = [];
export type ExtensionsAction={type:string,value:Extension}
export const extensionReducer=(state:Extension[],action:ExtensionsAction)=>{
    switch (action.type) {
        case 'add':
            return [...state, action.value]
        default:
            return state;
    }
}

const ExtensionContext = createContext<Extension | null>(null);
const ExtensionDispatchContext = createContext<React.Dispatch<ExtensionsAction> | null>(null);

export const ExtensionProvider = ({ children }: { children: React.ReactNode}) => {
    const installedExt:Extension[]=[]
    useEffect(() => {
        const extensionInstalled=getInstalled()

        for(const ex in extensionInstalled) {
            const code = getBundleCode(ex?.id)
            const bundle=runBundle(code ? code:'')
            installedExt.push(bundle)
        }
    }, [])
    const [extension, dispatch] = React.useReducer(extensionReducer,installedExt );
    
  return (
    <ExtensionContext.Provider value={extension}>
      <ExtensionDispatchContext.Provider value={dispatch}>
        {children}
      </ExtensionDispatchContext.Provider>
    </ExtensionContext.Provider>
  );
};