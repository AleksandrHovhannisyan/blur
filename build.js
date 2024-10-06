import { build } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

async function customBuild(outDir, manifestSrc) {
  await build({
    build: {
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
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: manifestSrc,
            dest: "", // Copy to the root of `outDir`
            rename: "manifest.json",
          },
        ],
      }),
    ],
  });
}

await Promise.all([
  customBuild("dist/chrome", "manifest-chrome.json"),
  customBuild("dist/firefox", "manifest-firefox.json")
]);
