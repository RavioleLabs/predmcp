// src/core/oauth/discovery.ts
//
// RFC 8414 — OAuth 2.0 Authorization Server Metadata, plus the MCP-specific
// RFC 9728 protected-resource metadata. Both served as static JSON.

const ISSUER = 'https://predmcp.com';

export const authorizationServerMetadata = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/oauth/authorize`,
  token_endpoint: `${ISSUER}/oauth/token`,
  registration_endpoint: `${ISSUER}/oauth/register`,
  scopes_supported: ['mcp'],
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
  service_documentation: ISSUER,
};

export const protectedResourceMetadata = {
  resource: `${ISSUER}/mcp`,
  authorization_servers: [ISSUER],
  bearer_methods_supported: ['header'],
  scopes_supported: ['mcp'],
};
