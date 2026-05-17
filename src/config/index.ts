import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConfigSchema, type Config } from './schema.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('config');

let _config: Config | null = null;

function resolvePath(p: string): string {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

export function loadConfig(configPath?: string): Config {
  const cfgPath = configPath ?? path.join(
    resolvePath(process.env.DATA_DIR ?? '~/.predmcp'),
    'config.json'
  );

  let raw: Record<string, unknown> = {};
  if (fs.existsSync(cfgPath)) {
    raw = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    log.info(`config loaded`, { path: cfgPath });
  } else {
    log.info(`no config file, using defaults`, { path: cfgPath });
  }

  // Merge env overrides
  if (process.env.PORT) raw.server = { ...(raw.server as object ?? {}), port: parseInt(process.env.PORT) };
  if (process.env.DATA_DIR) raw.dataDir = process.env.DATA_DIR;

  _config = ConfigSchema.parse(raw);
  return _config;
}

export function getConfig(): Config {
  if (!_config) throw new Error('Config not loaded. Call loadConfig() first.');
  return _config;
}
