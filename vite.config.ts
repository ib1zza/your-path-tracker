import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const rootDir = dirname(fileURLToPath(import.meta.url));
const maplibreDist = join(rootDir, 'node_modules/maplibre-gl/dist');
const maplibreWorkerFiles = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

function maplibreWorkerAssets(): Plugin {
  const publicBase = '/maplibre/';

  return {
    name: 'maplibre-worker-assets',
    configureServer(server) {
      server.middlewares.use(publicBase, (req, res, next) => {
        const fileName = req.url?.replace(/^\//, '').split('?')[0];
        if (!fileName || !maplibreWorkerFiles.includes(fileName)) {
          next();
          return;
        }

        res.setHeader('Content-Type', 'text/javascript');
        import('node:fs').then(({ createReadStream }) => {
          createReadStream(join(maplibreDist, fileName)).pipe(res);
        });
      });
    },
    writeBundle(options) {
      const outDir = options.dir ?? 'dist';
      const targetDir = join(outDir, 'maplibre');
      mkdirSync(targetDir, { recursive: true });

      for (const fileName of maplibreWorkerFiles) {
        cpSync(join(maplibreDist, fileName), join(targetDir, fileName));
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), maplibreWorkerAssets()],
  optimizeDeps: {
    include: ['maplibre-gl'],
    exclude: ['maplibre-gl/dist/maplibre-gl-worker.mjs'],
  },
});
