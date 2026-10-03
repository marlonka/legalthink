import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// PDF fonts, character maps and image decoders stay on the application server.
function pdfAssets(): Plugin {
  const assets = new Map<string, string>();
  for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
    const base = new URL(`./node_modules/pdfjs-dist/${directory}/`, import.meta.url);
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (entry.isFile())
        assets.set(`/pdfjs/${directory}/${entry.name}`, fileURLToPath(new URL(entry.name, base)));
    }
  }
  return {
    name: 'local-pdf-assets',
    generateBundle() {
      for (const [url, path] of assets)
        this.emitFile({ type: 'asset', fileName: url.slice(1), source: readFileSync(path) });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = assets.get(request.url?.split('?')[0] ?? '');
        if (!path) return next();
        response.setHeader(
          'Content-Type',
          path.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream',
        );
        response.end(readFileSync(path));
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), pdfAssets()],
  server: {
    port: 5175,
    strictPort: true,
    proxy: { '/api': loadEnv(mode, '.', 'VITE_').VITE_API_PROXY || 'http://127.0.0.1:8000' },
  },
}));
