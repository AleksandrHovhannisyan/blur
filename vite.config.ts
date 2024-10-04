import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    copyPublicDir: true,
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: 'src/popup.html',
        background: 'src/background.ts',
      },
      output: {
        entryFileNames: 'src/[name].js',
      },
    },
  },
});
