import { build as viteBuild } from "vite";
import fs from "node:fs/promises";
import path from "node:path";

const manifestBaseJSON = JSON.parse(
  await fs.readFile("./manifests/manifest-base.json", "utf-8")
);

async function build(outDir, manifestSrc) {
  await viteBuild({
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
  const browserSpecificManifestJSON = JSON.parse(
    await fs.readFile(manifestSrc, "utf-8")
  );
  await fs.writeFile(
    path.resolve(outDir, "manifest.json"),
    JSON.stringify({ ...manifestBaseJSON, ...browserSpecificManifestJSON })
  );
}

await Promise.all([
  build("dist/chrome", "./manifests/manifest-chrome.json"),
  build("dist/firefox", "./manifests/manifest-firefox.json"),
]);
