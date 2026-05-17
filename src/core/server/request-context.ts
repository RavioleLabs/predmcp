import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  ip?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestIp(): string | undefined {
  return requestContext.getStore()?.ip;
}
