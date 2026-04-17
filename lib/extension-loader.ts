import { insertNewExtension } from "@/core/extension/store";
import { Extension } from "@/core/extension/types";
import { db } from "@/lib/db";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { runBundle } from "./DynamicExtensionRunner";

/**
 * Reads the local bundle asset and returns its raw JS string.
 */
async function readBundleCode(): Promise<string> {
  const asset = Asset.fromModule(require("@/assets/bundle/en.freenovel.txt"));
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;

  if (uri.startsWith("http")) {
    const response = await fetch(uri);
    return response.text();
  }
  return new File(uri).text();
}

/**
 * Loads the local bundle, runs it, and returns the Extension instance.
 */
export async function loadExtensionBundle(): Promise<Extension> {
  try {
    const code = await readBundleCode();
    const extension = runBundle(code);
    console.log(
      `🚀 Successfully initialized: ${extension.name} [${extension.id}]`,
    );
    return extension;
  } catch (error) {
    throw new Error(`Failed to load extension bundle: ${error}`);
  }
}

function getStoredVersion(id: string): string | null {
  return (
    db.getFirstSync<{ version: string }>(
      `SELECT version FROM extensions WHERE id=?`,
      id,
    )?.version ?? null
  );
}

/**
 * Seeds the local bundled extension into the DB only when the version changed.
 * On first install the row won't exist, so it always seeds then.
 */
export async function seedLocalExtension(): Promise<void> {
  try {
    const code = await readBundleCode();
    const ext = runBundle(code);

    const stored = getStoredVersion(ext.id);
    if (stored === ext.version) {
      console.log(`⏭️  Extension up-to-date: ${ext.name} v${ext.version}`);
      return;
    }

    insertNewExtension({
      id: ext.id,
      name: ext.name,
      version: ext.version,
      language: ext.lang ?? ext.id.split(".")[0] ?? "en",
      baseUrl: ext.baseUrl,
      iconUrl: ext.iconUrl ?? "",
      sourceUrl: "",
      bundleCode: code,
      installed: true,
      installedAt: Date.now(),
      description: "",
      indexedAt: null,
    });

    console.log(
      `✅ Extension seeded: ${ext.name} v${ext.version}${stored ? ` (was v${stored})` : " (new)"}`,
    );
  } catch (error) {
    console.error("Failed to seed local extension:", error);
  }
}
