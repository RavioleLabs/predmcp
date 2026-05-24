// src/index.ts
import { loadConfig } from './config/index.js';
import { initDb } from './core/db/index.js';
import { initSecretsStoreSync } from './secrets/store.js';
import { startHttpServer } from './core/server/http.js';
import { createLogger } from './core/logger.js';

const log = createLogger('main');

async function main() {
  const config = loadConfig();
  initSecretsStoreSync(config.dataDir);
  initDb(config.dataDir);
  log.info('PredMCP starting...');
  await startHttpServer();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
