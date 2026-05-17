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
import { buildServer } from './index.js';
import { createLogger } from '../logger.js';

const log = createLogger('mcp-handler');

export async function handleMcpRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Stateless transport — no session ID generation, no session state
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  const server = buildServer();

  try {
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
