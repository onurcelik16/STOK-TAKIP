import 'dotenv/config';
process.env.TZ = 'Europe/Istanbul';
import { createServer } from './server/app';
import { ensureDatabaseInitialized } from './server/data/db';
import { scheduleStockChecks } from './server/jobs/checkStock';
import { startTelegramBot } from './server/services/telegramBot';

async function main() {
  ensureDatabaseInitialized();
  const app = createServer();
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  app.listen(port, () => {
    console.log(`[api] listening on http://localhost:${port}`);
  });

  scheduleStockChecks();
  startTelegramBot();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});



