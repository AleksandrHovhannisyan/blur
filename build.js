import { build as viteBuild } from "vite";
import fs from "node:fs/promises";
import path from "node:path";
import zipPack from "vite-plugin-zip-pack";

// Shared Manifest v3 config (keys supported by both Chrome and Firefox)
const manifestShared = JSON.parse(
  await fs.readFile("manifests/manifest-base.json", "utf-8")
);

/**
 * Builds and merges a manifest.json file for the specified browser target.
 * @param {string} outDir The output directory for the final manifest.json.
 * @param {string} manifestSrc The browser-specific manifest.json config to read and merge with the shared config.
 */
function buildManifest(outDir, manifestSrc) {
  return {
    name: "build-manifest",
    closeBundle: async () => {
      const browserSpecificManifest = JSON.parse(
        await fs.readFile(manifestSrc, "utf-8")
      );
      const manifestOutFile = path.join(outDir, "manifest.json");
      console.log(`Writing manifest from ${manifestSrc} to ${manifestOutFile}`);
      await fs.writeFile(
        manifestOutFile,
        JSON.stringify({ ...manifestShared, ...browserSpecificManifest })
      );
    },
  };
}

/**
 * @param {string} outDir The output directory for the browser-specific code.
 * @param {string} manifestSrc The browser-specific manifest.json config to read and merge with the shared config.
 */
async function build(outDir, manifestSrc) {
  const plugins = [buildManifest(outDir, manifestSrc)];
  // Chrome and Firefox require .zip archives when publishing your extension,
  // so auto-zip as part of the build process for convenience. Don't do this for dev.
  if (process.env.BUILD_TARGET === "production") {
    plugins.push(
      zipPack({
        // We're zipping the output directory (e.g., dist/firefox)
        inDir: outDir,
        // ... and writing the archive back to the same output directory (e.g., dist/firefox/packed.zip)
        outDir,
        outFileName: "packed.zip",
      })
    );
  }
  return await viteBuild({
    plugins,
    build: {
      target: "esnext",
      outDir: outDir,
      copyPublicDir: true,
      rollupOptions: {
        input: {
          popup: "src/popup.html",
          background: "src/background.ts",
        },
        output: {
          entryFileNames: "src/[name].js",
        },
      },
    },
  });
}

await Promise.all([
  build("dist/chrome", "manifests/manifest-chrome.json"),
  build("dist/firefox", "manifests/manifest-firefox.json"),
]);
