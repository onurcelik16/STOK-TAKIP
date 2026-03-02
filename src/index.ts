import 'dotenv/config';
process.env.TZ = 'Europe/Istanbul';
import { createServer } from './server/app';
import { ensureDatabaseInitialized } from './server/data/db';
import { scheduleStockChecks } from './server/jobs/checkStock';
import { startTelegramBot } from './server/services/telegramBot';
import { logger } from './server/utils/logger';

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection at Promise');
});

process.on('uncaughtException', (err) => {
  logger.error(err, 'Uncaught Exception thrown');
  process.exit(1);
});

async function main() {
  logger.info({
    env: process.env.NODE_ENV,
    port: process.env.PORT,
    node: process.version
  }, 'Application process starting');

  try {
    ensureDatabaseInitialized();
    logger.info('[db] Database ready');
  } catch (err) {
    logger.fatal(err, '[db] Failed to initialize database');
    process.exit(1);
  }

  const app = createServer();
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`[api] server listening on 0.0.0.0:${port}`);
    console.log(`READY_ON_PORT_${port}`);
  });

  // Keep-alive heartbeat every 30s
  setInterval(() => {
    logger.debug('[system] Heartbeat: process is alive');
  }, 30000);

  server.on('error', (err) => {
    logger.error(err, '[api] Server error');
  });

  scheduleStockChecks();
  startTelegramBot();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});



