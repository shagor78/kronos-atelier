import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './backend/src/repositories/database.ts';
import {
  securityHeadersMiddleware,
  createRateLimiter,
} from './backend/src/middleware/security.ts';
import { apiV1Router } from './api/routes/v1.ts';
import { envConfig } from './backend/src/config/env.ts';
import { writeStructuredLog } from './backend/src/utils/logger.ts';

export async function createAppServer(options?: { isTest?: boolean; dbPath?: string }) {
  initDatabase(options?.dbPath);

  const app = express();
  app.disable('x-powered-by');

  // Security headers & JSON body parser with payload limit
  app.use(securityHeadersMiddleware);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Serve generated studio product images statically in both dev and prod
  const assetsPath = path.resolve(process.cwd(), 'src', 'assets');
  if (fs.existsSync(assetsPath)) {
    app.use('/src/assets', express.static(assetsPath));
  }

  // Apply sliding-window rate limiting to API routes
  app.use('/api/v1', createRateLimiter(250, 60_000), apiV1Router);

  // Alias /api/health for container and load balancer probes
  app.get('/api/health', (_req, res) => {
    res.redirect(307, '/api/v1/health');
  });

  // Centralized API 404 handler
  app.use('/api', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'ENDPOINT_NOT_FOUND',
        message: `API route ${req.method} ${req.originalUrl} does not exist.`,
      },
    });
  });

  // Centralized error handling middleware
  app.use(
    (
      err: Error,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      writeStructuredLog({
        level: 'ERROR',
        category: 'EXPRESS_SERVER',
        action: 'UNHANDLED_API_ERROR',
        details: { path: req.originalUrl, message: err.message },
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected server error occurred.',
        },
      });
    }
  );

  if (!options?.isTest) {
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  return app;
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(process.cwd(), 'server.ts');

if (isDirectExecution) {
  createAppServer()
    .then((app) => {
      const port = envConfig.port || 3000;
      app.listen(port, '0.0.0.0', () => {
        writeStructuredLog({
          level: 'INFO',
          category: 'SERVER',
          action: 'SERVER_LISTENING',
          details: { port, environment: envConfig.nodeEnv },
        });
        console.log(`[Kronos Atelier] Production E-Commerce Server listening on http://0.0.0.0:${port}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}
