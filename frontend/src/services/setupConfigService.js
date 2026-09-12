import api from './api';

/**
 * Fetch the authenticated user's saved Setup configuration.
 * @returns {Promise<{exists: boolean, config: Object, updated_at: ?string}>}
 */
export async function getSetupConfig() {
  const response = await api.get('/setup-config');
  return response.data;
}

/**
 * Persist the Setup configuration document for the authenticated user.
 * The document is stored verbatim (camelCase keys); the backend normalizes it
 * internally when generating.
 * @param {Object} config - The configuration document.
 * @returns {Promise<{exists: boolean, config: Object, updated_at: ?string}>}
 */
export async function saveSetupConfig(config) {
  const response = await api.put('/setup-config', { config });
  return response.data;
}
