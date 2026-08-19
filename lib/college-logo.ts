import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

let collegeLogoDataUriPromise: Promise<string> | null = null;

/** Loads the bundled ICRE crest once for use in native HTML/PDF exports. */
export function getCollegeLogoDataUri() {
  if (!collegeLogoDataUriPromise) {
    collegeLogoDataUriPromise = (async () => {
      const asset = Asset.fromModule(require("../assets/images/college-logo.png"));
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      if (!uri) throw new Error("The bundled college logo could not be loaded for the PDF header.");
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      return `data:image/png;base64,${base64}`;
    })();
  }
  return collegeLogoDataUriPromise;
}
