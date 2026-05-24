// src/core/oauth/clients.ts
//
// Dynamic Client Registration (RFC 7591). claude.ai and other MCP hosts POST
// here with their metadata; we mint a client_id (no secret — public clients
// using PKCE) and persist their redirect_uris so we can validate them later
// at /oauth/authorize and /oauth/token.

import { randomBytes } from 'crypto';
import { getDb } from '../db/index.js';

export interface OAuthClient {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: 'none' | 'client_secret_post';
  created_at: number;
}

export interface RegisterRequest {
  client_name?: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: 'none' | 'client_secret_post';
  scope?: string;
}

function generateClientId(): string {
  return 'mcpc_' + randomBytes(12).toString('hex');
}

/**
 * Validate redirect_uri per OAuth 2.1: must be https:// or http://localhost,
 * absolute, no fragment. Reject anything weird (data:, javascript:, etc).
 */
export function isValidRedirectUri(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === 'https:') return true;
  if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return true;
  return false;
}

export function registerClient(req: RegisterRequest): OAuthClient {
  const grantTypes = req.grant_types ?? ['authorization_code'];
  const responseTypes = req.response_types ?? ['code'];
  const tokenAuth = req.token_endpoint_auth_method ?? 'none';

  if (!Array.isArray(req.redirect_uris) || req.redirect_uris.length === 0) {
    throw new Error('redirect_uris required');
  }
  for (const uri of req.redirect_uris) {
    if (!isValidRedirectUri(uri)) {
      throw new Error(`invalid redirect_uri: ${uri}`);
    }
  }
  if (!grantTypes.includes('authorization_code')) {
    throw new Error('only authorization_code grant supported');
  }
  if (!responseTypes.includes('code')) {
    throw new Error('only "code" response_type supported');
  }

  const clientId = generateClientId();
  const now = Date.now();

  getDb()
    .prepare(
      `INSERT INTO oauth_clients
       (client_id, client_name, redirect_uris, grant_types, response_types, token_endpoint_auth_method, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      clientId,
      req.client_name ?? null,
      JSON.stringify(req.redirect_uris),
      JSON.stringify(grantTypes),
      JSON.stringify(responseTypes),
      tokenAuth,
      now,
    );

  return {
    client_id: clientId,
    client_name: req.client_name ?? null,
    redirect_uris: req.redirect_uris,
    grant_types: grantTypes,
    response_types: responseTypes,
    token_endpoint_auth_method: tokenAuth,
    created_at: now,
  };
}

export function getClient(clientId: string): OAuthClient | null {
  const row = getDb()
    .prepare('SELECT * FROM oauth_clients WHERE client_id = ?')
    .get(clientId) as
    | {
        client_id: string;
        client_name: string | null;
        redirect_uris: string;
        grant_types: string;
        response_types: string;
        token_endpoint_auth_method: 'none' | 'client_secret_post';
        created_at: number;
      }
    | undefined;
  if (!row) return null;
  return {
    client_id: row.client_id,
    client_name: row.client_name,
    redirect_uris: JSON.parse(row.redirect_uris) as string[],
    grant_types: JSON.parse(row.grant_types) as string[],
    response_types: JSON.parse(row.response_types) as string[],
    token_endpoint_auth_method: row.token_endpoint_auth_method,
    created_at: row.created_at,
  };
}

/**
 * Check that a redirect_uri exactly matches one of the client's registered URIs.
 */
export function clientAllowsRedirect(client: OAuthClient, redirectUri: string): boolean {
  return client.redirect_uris.includes(redirectUri);
}
