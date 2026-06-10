// src/server/mcp-handler.ts
//
// Bridges Fastify HTTP requests to the MCP StreamableHTTPServerTransport.
//
// Strategy: stateless mode — a fresh transport + McpServer pair is created per
// request so there is no shared session state. This is the correct approach for
// a stateless HTTP MCP server.
//
// We use reply.hijack() to hand full response ownership to the MCP transport,
// which writes directly to the underlying Node.js ServerResponse.

import type { FastifyRequest, FastifyReply } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildServer } from '../../server/index.js';
import { createLogger } from '../logger.js';
import { recordToolCall } from '../auth/keys.js';

const log = createLogger('mcp-handler');

/** Peek at the parsed JSON-RPC body and, when it is a `tools/call`, record an
 *  (api_key, tool_name, hour) bucket. Fire-and-forget — never affects the
 *  request/response cycle. Tool *arguments* are never inspected. */
function trackIfToolCall(body: unknown, apiKey: string | undefined): void {
  if (!apiKey || !body || typeof body !== 'object') return;
  const b = body as { method?: unknown; params?: unknown };
  if (b.method !== 'tools/call') return;
  const params = b.params as { name?: unknown } | undefined;
  const name = params?.name;
  if (typeof name !== 'string' || name.length === 0 || name.length > 128) return;
  recordToolCall(apiKey, name);
}

export async function handleMcpRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Stateless transport — no session ID generation, no session state
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  const server = await buildServer();

  try {
    // Track per-tool usage before handing off to the transport. Reads the
    // API key from the same header validateAndConsume uses, peeks the parsed
    // JSON-RPC body to detect `tools/call`, and UPSERTs an hour bucket.
    const apiKey = (request.headers['x-api-key'] as string | undefined)
      ?? (typeof request.headers.authorization === 'string'
        ? request.headers.authorization.replace(/^Bearer\s+/i, '')
        : undefined);
    trackIfToolCall(request.body, apiKey);

    // Connect the MCP server to the transport (registers message handlers)
    await server.connect(transport);

    // Hand off response ownership to the transport — it will write headers and body
    reply.hijack();

    // Pass the raw Node.js objects along with the pre-parsed body
    await transport.handleRequest(request.raw, reply.raw, request.body);
  } catch (err) {
    log.error('MCP handler error', err);
    // If hijack hasn't happened yet (connect failed), let Fastify send the error
    if (!reply.sent) {
      reply.status(500).send({ error: 'Internal server error' });
    }
  } finally {
    // Always close the per-request transport to avoid resource leaks
    await transport.close().catch(() => {});
  }
}
