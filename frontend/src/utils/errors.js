/**
 * errors.js - Shared error-message extraction for API failures.
 *
 * FastAPI returns errors in several shapes:
 *   - "string"                                   -> plain detail message
 *   - { detail: "..." }                          -> validation detail
 *   - { status, message, errors: [...] }         -> our custom handlers
 *   - { detail: [{ msg, error, ... }] }          -> pydantic validation list
 */
export function extractErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const data = err?.response?.data;
  if (data) {
    if (typeof data === 'string') return data;
    if (typeof data.detail === 'string') return data.detail;

    if (data.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)) {
      return data.detail.message || fallback;
    }

    if (Array.isArray(data.detail)) {
      return data.detail.map((d) => d.msg || d.error).filter(Boolean).join('; ') || fallback;
    }

    if (data.message) return data.message;
  }

  if (typeof err === 'string') return err;
  if (err?.message) return err.message;

  return fallback;
}

/**
 * Extract the structured per-item error list when present (e.g. manual-edit
 * validation returns { status, message, errors: [...] }).
 */
export function extractErrorList(err) {
  const data = err?.response?.data;
  if (!data) return [];
  if (Array.isArray(data.errors)) return data.errors;
  if (Array.isArray(data.detail)) return data.detail.map((d) => d.msg || d.error).filter(Boolean);
  return [];
}
