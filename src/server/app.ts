import express from 'express';
import productsRouter from './routes/products';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import notificationsRouter from './routes/notifications';
import proxyRouter from './routes/proxy';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { logger } from './utils/logger';

export function createServer() {
  const app = express();

  // Security & Logging
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true
  }));
  app.use(morgan('dev'));
  app.use(express.json({ limit: '10kb' })); // Limit JSON size

  app.use((req, _res, next) => {
    logger.info({ method: req.method, url: req.url, ip: req.ip }, '[req] Incoming request');
    next();
  });

  app.get('/', (_req, res) => {
    res.json({
      name: 'stock-tracker',
      ok: true,
      endpoints: {
        health: '/health',
        products: {
          list: '/products',
          create: '/products',
          detail: '/products/:id',
          delete: '/products/:id',
        },
      },
    });
  });

  app.get('/health', (_req, res) => {
    try {
      // Simple query to verify DB is alive
      const { db } = require('./data/db');
      db.prepare('SELECT 1').get();
      res.json({ ok: true, database: 'connected' });
    } catch (err: any) {
      logger.error(err, '[health] Database check failed');
      res.status(503).json({ ok: false, error: 'Database not ready' });
    }
  });

  app.use('/auth', authRouter);
  app.use('/products', productsRouter);
  app.use('/admin', adminRouter);
  app.use('/notifications', notificationsRouter);
  app.use('/proxy', proxyRouter);

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const status = err.status || 500;
    const message = err.message || 'Something went wrong';

    logger.error(`[Error] ${status} - ${message} - ${req.method} ${req.url}`);

    res.status(status).json({
      error: message,
      code: err.code || 'INTERNAL_ERROR'
    });
  });

  return app;
}


