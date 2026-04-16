import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { runBundle } from './DynamicExtensionRunner';
import { Extension } from '@/core/extension/types';

/**
 * Modern loader using expo-file-system File objects.
 */
export async function loadExtensionBundle():Promise<Extension> {
  try {
    // 1. Resolve the asset (ensure your metro.config.js allows .txt)
    const asset = Asset.fromModule(require('@/assets/bundle/en.freenovel.txt'));
    await asset.downloadAsync();

    // 2. Determine path (handle dev-server vs local storage)
    const uri = asset.localUri || asset.uri;
    let code = '';

    if (uri.startsWith('http')) {
      // Development mode: Fetch from Metro
      const response = await fetch(uri);
      code = await response.text();
    } else {
      // Production mode: Use Modern File API
      const assetFile = new File(uri);
      code = await assetFile.text();
    }

    // 3. Execute through your registration runner
    const extension = runBundle(code);
    
    console.log(`🚀 Successfully initialized: ${extension.name} [${extension.id}]`);
    return extension;

  } catch (error) {
    throw new Error(`Failed to load extension bundle: ${error}`);
  }
}