import { z } from 'zod';
import { createKey, ipHasKey } from '../core/auth/keys.js';
import { getRequestIp } from '../core/server/request-context.js';

export const createApiKeySchema = {
  email: z.string().email().describe('Your email address — used to identify your key and for account recovery'),
};

export async function createApiKeyHandler(input: { email: string }) {
  const ip = getRequestIp();

  if (ip && ipHasKey(ip)) {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          error: 'One free key per IP address. If you lost your key, contact support at predmcp.com',
        }),
      }],
    };
  }

  const key = createKey(input.email, 'free', ip);
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        api_key: key.key,
        tier: 'free',
        daily_limit: 100,
        note: 'Store this key — it cannot be retrieved again. Pass it as x-api-key header.',
        setup: {
          mcpServers: {
            predmcp: {
              type: 'http',
              url: 'https://predmcp.com/mcp',
              headers: { 'x-api-key': key.key },
            },
          },
        },
      }),
    }],
  };
}
