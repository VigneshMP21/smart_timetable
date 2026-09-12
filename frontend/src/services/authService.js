/**
 * AuthService - Supabase Auth + backend profile API calls.
 *
 * Purpose:
 *   Single facade for all authentication operations. Sign up, sign in, email
 *   verification, password resets and OAuth are handled by the Supabase Auth
 *   client; profile reads/writes go through the FastAPI backend using the
 *   Supabase access token.
 */
import api from './api';
import { supabase, SUPABASE_NOT_CONFIGURED_ERROR } from '../lib/supabaseClient';
import { setSessionPersistence, clearToken } from '../lib/session';

/**
 * Map a Supabase Auth error to a user-friendly message.
 * @param {Object} error Supabase Auth API error ({ message, code }).
 * @returns {string} A user-friendly message.
 */
export function authErrorMessage(error) {
  const message = error?.message || 'Something went wrong. Please try again.';
  const low = message.toLowerCase();

  if (low.includes('invalid login credentials')) return 'Invalid email or password.';
  if (low.includes('email not confirmed')) return 'Please verify your email before signing in.';
  if (low.includes('already registered') || low.includes('already been registered'))
    return 'An account with this email already exists. Try signing in.';
  if (low.includes('at least 8 characters')) return 'Password must be at least 8 characters.';
  if (low.includes('user not found')) return 'No account found with this email.';
  if (low.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
  if (low.includes('session missing') || low.includes('auth session missing'))
    return 'This reset link is invalid or has expired.';
  if (low.includes('new password should be different'))
    return 'New password must be different from your current password.';
  if (low.includes('invalid email') || low.includes('email address'))
    return 'Please enter a valid email address.';

  return message;
}

/**
 * Establish an auth session from the URL recovery/verification parameters
 * when Supabase's auto-detection has not already done so.
 * @returns {Promise<Object|null>} Supabase session or null.
 */
async function ensureAuthSession() {
  if (!supabase) return null;

  let { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type');

  try {
    if (code) {
      const res = await supabase.auth.exchangeCodeForSession(code);
      if (res.data.session) return res.data.session;
    } else if (tokenHash) {
      const otpType = type === 'recovery' ? 'recovery' : 'email';
      const res = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
      if (res.data.session) return res.data.session;
    }
  } catch {
    // Fall through - the caller decides how to handle a missing session.
  }

  return null;
}

const authService = {
  /**
   * Register a new account (Supabase sends the email confirmation link).
   * @param {Object} data Registration form values.
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async register(data) {
    if (!supabase) return { success: false, error: SUPABASE_NOT_CONFIGURED_ERROR };
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.name || '',
            college_name: data.college || '',
            department: data.department || '',
            phone_number: data.phone || '',
          },
        },
      });
      if (error) return { success: false, error: authErrorMessage(error) };
      return { success: true };
    } catch (err) {
      return { success: false, error: authErrorMessage(err) };
    }
  },

  /**
   * Sign in with email + password (remember me controls persistence).
   * @param {string} email
   * @param {string} password
   * @param {boolean} rememberMe
   * @returns {Promise<{success: boolean, error?: string, data?: Object}>}
   */
  async login(email, password, rememberMe = true) {
    if (!supabase) return { success: false, error: SUPABASE_NOT_CONFIGURED_ERROR };
    setSessionPersistence(rememberMe ? 'localStorage' : 'sessionStorage');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: authErrorMessage(error) };
      return {
        success: true,
        data: { session: data.session, user: data.user },
      };
    } catch (err) {
      return { success: false, error: authErrorMessage(err) };
    }
  },

  /**
   * Sign out the current user and clear the persisted session.
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async logout() {
    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) return { success: false, error: authErrorMessage(error) };
      }
    } catch {
      // Non-fatal - the local session is cleared regardless.
    }
    await clearToken();
    return { success: true };
  },

  /**
   * Request a password reset email (Supabase sends the recovery link).
   * @param {string} email
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async forgotPassword(email) {
    if (!supabase) return { success: false, error: SUPABASE_NOT_CONFIGURED_ERROR };
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return { success: false, error: authErrorMessage(error) };
      return { success: true };
    } catch (err) {
      return { success: false, error: authErrorMessage(err) };
    }
  },

  /**
   * Set a new password from a recovery link. The link's code/token_hash
   * establishes the recovery session (Supabase auto-detects it or we exchange
   * it explicitly), then the password is updated and the session cleared.
   * @param {string} token Recovery code/token from the email link (may be empty).
   * @param {string} newPassword
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async resetPassword(token, newPassword) {
    if (!supabase) return { success: false, error: SUPABASE_NOT_CONFIGURED_ERROR };
    try {
      await ensureAuthSession();

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: authErrorMessage(error) };

      try {
        await supabase.auth.signOut();
      } catch {
        // Non-fatal - the user is redirected to sign in with the new password.
      }
      await clearToken();
      return { success: true };
    } catch (err) {
      return { success: false, error: authErrorMessage(err) };
    }
  },

  /**
   * Confirm an email address from the verification link (token_hash + type).
   * @param {string} token The token_hash from the verification link.
   * @returns {Promise<{success: boolean, error?: string, message?: string}>}
   */
  async verifyEmail(token) {
    if (!supabase) return { success: false, error: SUPABASE_NOT_CONFIGURED_ERROR };
    try {
      const params = new URLSearchParams(window.location.search);
      const type = params.get('type') || 'email';

      const { error } = await supabase.auth.verifyOtp({ token_hash: token, type });
      if (error) return { success: false, error: authErrorMessage(error) };

      await supabase.auth.refreshSession();
      return { success: true, message: 'Email verified successfully!' };
    } catch (err) {
      return { success: false, error: authErrorMessage(err) };
    }
  },

  /**
   * Resend the email confirmation link.
   * @param {string} email
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async resendConfirmation(email) {
    if (!supabase) return { success: false, error: SUPABASE_NOT_CONFIGURED_ERROR };
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) return { success: false, error: authErrorMessage(error) };
      return { success: true };
    } catch (err) {
      return { success: false, error: authErrorMessage(err) };
    }
  },

  /**
   * Fetch the current user's profile row from the backend.
   * @returns {Promise<Object>} Axios response with the profile.
   */
  getProfile: () => api.get('/auth/profile'),

  /**
   * Update the current user's profile via the backend.
   * @param {Object} data Profile fields to update.
   * @returns {Promise<Object>} Axios response with the updated profile.
   */
  updateProfile: (data) => api.put('/auth/profile', data),

  /** Fetch current user info from the Supabase token (backend /auth/me). */
  getMe: () => api.get('/auth/me'),

  /**
   * Permanently delete the current user's account.
   * The backend removes user-owned classes and deletes the Supabase Auth user
   * (the profile row cascades). The caller must clear the local session.
   * @returns {Promise<Object>} Axios response with the confirmation message.
   */
  deleteAccount: () => api.delete('/auth/account'),
};

export default authService;
