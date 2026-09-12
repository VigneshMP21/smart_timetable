/**
 * api.js - Shared Axios instance for the Smart Timetable backend.
 *
 * Purpose:
 *   Configures base URL, timeout, and interceptors that:
 *   - Attach the current Supabase access token as a Bearer token (refreshing
 *     it transparently when it is missing or near expiry).
 *   - On a 401 response, refreshes the session once and retries the request.
 *     If the session is genuinely invalid, clears the stored session and
 *     notifies the app so it can sign the user out automatically (except on
 *     auth pages / during login).
 */
import axios from 'axios';
import { getSessionToken, clearToken } from '../lib/session';
import { API_BASE_URL } from '../utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
});

let suppressAutoSignOut = false;

export function setSuppressAutoSignOut(value) {
  suppressAutoSignOut = value;
}

/** Signal the rest of the app that the stored session is no longer valid. */
function dispatchSessionExpired() {
  window.dispatchEvent(new CustomEvent('auth:session-expired'));
}

api.interceptors.request.use(
  async (config) => {
    const accessToken = await getSessionToken();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.code === 'ECONNABORTED') {
      error.message = 'Request timed out. Please try again.';
    } else if (!error.response) {
      error.message = 'Network error. Please check your connection.';
    } else if (error.response.status === 401) {
      const original = error.config;
      if (original && !original._retried && !suppressAutoSignOut) {
        original._retried = true;
        const accessToken = await getSessionToken();
        if (accessToken) {
          original.headers.Authorization = `Bearer ${accessToken}`;
          return api(original);
        }
      }

      const authPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
      const isAuthPage = authPaths.some((p) => window.location.pathname === p);
      if (!isAuthPage && !suppressAutoSignOut) {
        clearToken();
        dispatchSessionExpired();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
