import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Local development middleware that maps /api/* requests
 * directly to the TypeScript handlers in the api/ directory.
 */
function apiDevMiddleware(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        try {
          const parsedUrl = new URL(req.url, 'http://localhost:5173');
          const pathname = parsedUrl.pathname;
          const routePath = pathname.replace(/^\/api\//, '');
          const modulePath = `./api/${routePath}.ts`;

          let body: any = {};
          if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            const buffers: Buffer[] = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const rawBody = Buffer.concat(buffers).toString('utf8');
            try {
              body = JSON.parse(rawBody);
            } catch {
              body = rawBody;
            }
          }

          const mod = await server.ssrLoadModule(modulePath);
          const handler = mod.default;

          if (typeof handler !== 'function') {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: `Handler not found for ${pathname}` }));
          }

          const vercelRes: any = res;
          vercelRes.status = (code: number) => {
            res.statusCode = code;
            return vercelRes;
          };
          vercelRes.json = (data: any) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return vercelRes;
          };
          vercelRes.send = (data: any) => {
            res.end(data);
            return vercelRes;
          };

          const vercelReq: any = req;
          vercelReq.body = body;
          vercelReq.query = Object.fromEntries(parsedUrl.searchParams.entries());

          await handler(vercelReq, vercelRes);
        } catch (err: any) {
          console.error('[API Dev Server Error]', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, message: err.message || 'Internal Server Error' }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [react(), apiDevMiddleware()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
