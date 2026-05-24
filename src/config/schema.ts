import { z } from 'zod';

export const ConfigSchema = z.object({
  dataDir: z.string().default('~/.predmcp'),
  server: z.object({
    port: z.number().min(1).max(65535).default(3000),
    host: z.string().default('127.0.0.1'),
  }).default({}),
  polymarket: z.object({
    host: z.string().url().default('https://clob.polymarket.com'),
    chainId: z.number().positive().default(137),
  }).default({}),
  hyperliquid: z.object({
    url: z.string().url().default('https://api.hyperliquid.xyz'),
  }).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
