import { insertNewExtension } from "@/core/extension/store";
import { Extension } from "@/core/extension/types";
import { db } from "@/lib/db";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { runBundle } from "./DynamicExtensionRunner";

const BUNDLE_ID = "en.freewebnovel";

function getStoredVersion(id: string): string | null {
  return (
    db.getFirstSync<{ version: string }>(
      `SELECT version FROM extensions WHERE id=?`,
      id,
    )?.version ?? null
  );
}

/**
 * Reads the local bundle asset and returns its raw JS string.
 */
async function readBundleCode(): Promise<string> {
  const asset = Asset.fromModule(require("@/assets/bundle/en.freenovel.txt"));
  // Only download if not already cached locally
  if (!asset.localUri) await asset.downloadAsync();
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

/**
 * Seeds the local bundled extension into the DB only when the version changed.
 * Checks the stored version FIRST before reading the asset — fast path on every
 * normal launch after the first install.
 */
export async function seedLocalExtension(): Promise<void> {
  try {
    // ── Fast path: read the version from the bundle header without executing it ──
    // The bundle always has `version: 'X.Y.Z'` near the top — extract it with regex
    // so we avoid the expensive asset read + runBundle on every launch.
    const asset = Asset.fromModule(require("@/assets/bundle/en.freenovel.txt"));
    if (!asset.localUri) await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;

    let code: string;
    if (uri.startsWith("http")) {
      const res = await fetch(uri);
      code = await res.text();
    } else {
      code = await new File(uri).text();
    }

    // Extract version from bundle without executing it
    const versionMatch = code.match(/version:\s*['"]([^'"]+)['"]/);
    const bundleVersion = versionMatch?.[1] ?? null;
    const stored = getStoredVersion(BUNDLE_ID);

    if (bundleVersion && stored === bundleVersion) {
      console.log(`⏭️  Extension up-to-date: v${bundleVersion}`);
      return;
    }

    // Version changed (or first install) — execute and store
    const ext = runBundle(code);

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
