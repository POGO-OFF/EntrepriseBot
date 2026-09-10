import { logger } from './logger.js';

export function bridgeEnabled() {
  return Boolean(process.env.SITE_BASE_URL && process.env.SITE_SYNC_SECRET);
}

export async function bridgeRequest(path = '/api/bot/bridge', options = {}) {
  if (!bridgeEnabled()) return null;
  const response = await fetch(`${process.env.SITE_BASE_URL.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.SITE_SYNC_SECRET}`,
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) throw new Error(`Passerelle du site refusée (${response.status})`);
  return response.json();
}

export async function postBridge(event, data) {
  try {
    return await bridgeRequest('/api/bot/bridge', { method: 'POST', body: JSON.stringify({ event, ...data }) });
  } catch (error) {
    logger.error('Envoi vers le Command Center impossible', { event, message: error.message });
    return null;
  }
}
