/**
 * AuthContext - Supabase authentication state management.
 *
 * Purpose:
 *   Single source of truth for the authenticated user across the app.
 *   Supabase Auth owns credentials and sessions (access tokens are sent to
 *   the FastAPI backend as Bearer tokens); the backend serves profile rows
 *   from the "profiles" table. This context handles:
 *     - Initial session restore from Supabase (auto login from storage)
 *     - Sign in / sign out / token refresh via onAuthStateChange
 *     - Profile loading & updates through the FastAPI backend
 *     - The "login required" modal for guest users
 *
 * Exposes:
 *   user, session, isAuthenticated, isLoading
 *   login, register, logout, deleteAccount, forgotPassword, resetPassword,
 *   verifyEmail, resendConfirmation, updateProfile, refreshProfile,
 *   openAuthModal, closeAuthModal
 */
import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { initSessionPersistence, clearToken } from '../lib/session';
import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import authService from '../services/authService';
import { setSuppressAutoSignOut } from '../services/api';

const AuthContext = createContext(null);

const initialState = {
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  showAuthModal: false,
  authModalMessage: '',
};

function authReducer(state, action) {
  switch (action.type) {
    case 'SET_SESSION':
      return {
        ...state,
        session: action.payload,
        isAuthenticated: Boolean(action.payload),
        isLoading: false,
      };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SIGNED_OUT':
      return {
        ...state,
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'SESSION_READY':
      return { ...state, isLoading: false };
    case 'SHOW_AUTH_MODAL':
      return {
        ...state,
        showAuthModal: true,
        authModalMessage: action.payload || '',
      };
    case 'HIDE_AUTH_MODAL':
      return { ...state, showAuthModal: false, authModalMessage: '' };
    default:
      return state;
  }
}

/**
 * Normalize a backend profile row (plus Supabase user claims) into the user
 * object consumed by the UI.
 * @param {Object} p Profile row returned by the backend.
 * @returns {Object} Normalized user object.
 */
function normalizeUser(p = {}) {
  return {
    id: p.id,
    email: p.email || '',
    emailConfirmed: Boolean(p.email_confirmed_at || p.email_verified),
    full_name: p.full_name || '',
    college_name: p.college_name || '',
    department: p.department || '',
    role: p.role || 'user',
    phone_number: p.phone_number || '',
    profile_image: p.profile_image || '',
    created_at: p.created_at || null,
    updated_at: p.updated_at || null,
    last_login: p.last_sign_in_at || p.last_login || null,
    last_sign_in_at: p.last_sign_in_at || p.last_login || null,
    user_metadata: p.user_metadata || {},
  };
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  /**
   * Load the current user's profile from the backend and update state.
   * @param {Object} [tokenUser] User object from the Supabase session.
   * @returns {Promise<Object|null>} The normalized user or null.
   */
  const loadProfile = useCallback(async (tokenUser) => {
    try {
      const res = await authService.getProfile();
      const profile = res.data?.profile || {};
      let authUser = tokenUser || {};
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          authUser = {
            ...authUser,
            id: data.user.id,
            email: data.user.email || '',
            email_confirmed_at: data.user.email_confirmed_at || null,
            last_sign_in_at: data.user.last_sign_in_at || null,
            user_metadata: data.user.user_metadata || {},
          };
        }
      }
      const user = normalizeUser({ ...authUser, ...profile });
      dispatch({ type: 'SET_USER', payload: user });
      return user;
    } catch (err) {
      if (err?.response?.status === 401) {
        dispatch({ type: 'SIGNED_OUT' });
        return null;
      }
      if (tokenUser) {
        const user = normalizeUser(tokenUser);
        dispatch({ type: 'SET_USER', payload: user });
        return user;
      }
      return null;
    }
  }, []);

  /**
   * Restore the session on startup from Supabase's persisted storage.
   */
  const bootstrap = useCallback(async () => {
    initSessionPersistence();

    if (!supabase) {
      dispatch({ type: 'SIGNED_OUT' });
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        dispatch({ type: 'SET_SESSION', payload: data.session });
        await loadProfile();
      } else {
        dispatch({ type: 'SIGNED_OUT' });
      }
    } catch {
      dispatch({ type: 'SIGNED_OUT' });
    }
  }, [loadProfile]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Keep auth state in sync with Supabase (sign-in, token refresh, sign-out).
  useEffect(() => {
    if (!supabase) return undefined;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        dispatch({ type: 'SET_SESSION', payload: session });
        if (session) loadProfile();
      } else if (event === 'SIGNED_OUT') {
        dispatch({ type: 'SIGNED_OUT' });
      }
    });
    return () => listener?.subscription?.unsubscribe();
  }, [loadProfile]);

  // Global auto sign-out when the API clears the token on a failed 401.
  useEffect(() => {
    const handleExpired = () => dispatch({ type: 'SIGNED_OUT' });
    window.addEventListener('auth:session-expired', handleExpired);
    return () => window.removeEventListener('auth:session-expired', handleExpired);
  }, []);

  /** Sign in with email + password. */
  const login = useCallback(async (email, password, rememberMe = true) => {
    setSuppressAutoSignOut(true);
    try {
      const result = await authService.login(email, password, rememberMe);
      if (result.success) {
        dispatch({ type: 'SET_SESSION', payload: result.data.session });
        dispatch({ type: 'SET_USER', payload: normalizeUser(result.data.user) });
        await loadProfile(result.data.user);
      }
      return result;
    } finally {
      setSuppressAutoSignOut(false);
    }
  }, [loadProfile]);

  /** Create a new account (Supabase sends the email confirmation link). */
  const register = useCallback(async (data) => {
    return authService.register(data);
  }, []);

  /** Sign out and clear the persisted session. */
  const logout = useCallback(async () => {
    await authService.logout();
    dispatch({ type: 'SIGNED_OUT' });
  }, []);

  /**
   * Permanently delete the current user's account.
   * The backend removes user-owned data and the Supabase Auth user; the local
   * session is cleared afterwards since the access token is now invalid.
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const deleteAccount = useCallback(async () => {
    try {
      await authService.deleteAccount();
      try {
        if (supabase) await supabase.auth.signOut();
      } catch {
        // The auth user was already removed server-side - nothing to sign out.
      }
      await clearToken();
      dispatch({ type: 'SIGNED_OUT' });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error:
          err.response?.data?.detail ||
          err.message ||
          'Account deletion failed. Please try again.',
      };
    }
  }, []);

  /** Request a password reset email (Supabase sends the recovery link). */
  const forgotPassword = useCallback(async (email) => {
    return authService.forgotPassword(email);
  }, []);

  /** Set a new password using the link from the recovery email. */
  const resetPassword = useCallback(async (token, newPassword) => {
    return authService.resetPassword(token, newPassword);
  }, []);

  /** Confirm an email address with the token_hash from the verification link. */
  const verifyEmail = useCallback(async (token) => {
    return authService.verifyEmail(token);
  }, []);

  /** Resend the email confirmation link. */
  const resendConfirmation = useCallback(async (email) => {
    return authService.resendConfirmation(email);
  }, []);

  /** Update the user's profile via the backend. */
  const updateProfile = useCallback(async (data) => {
    try {
      const res = await authService.updateProfile(data);
      const updated = normalizeUser(res.data?.profile);
      dispatch({ type: 'SET_USER', payload: updated });
      return { success: true, profile: updated };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.detail || err.message || 'Profile update failed.',
      };
    }
  }, []);

  /** Re-fetch the profile from the backend. */
  const refreshProfile = useCallback(async () => {
    if (state.user?.id) {
      await loadProfile();
    }
  }, [state.user, loadProfile]);

  const openAuthModal = useCallback((message) => {
    dispatch({ type: 'SHOW_AUTH_MODAL', payload: message });
  }, []);

  const closeAuthModal = useCallback(() => {
    dispatch({ type: 'HIDE_AUTH_MODAL' });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      supabaseConfigured,
      login,
      register,
      logout,
      deleteAccount,
      forgotPassword,
      resetPassword,
      verifyEmail,
      resendConfirmation,
      updateProfile,
      refreshProfile,
      openAuthModal,
      closeAuthModal,
    }),
    [
      state,
      login,
      register,
      logout,
      deleteAccount,
      forgotPassword,
      resetPassword,
      verifyEmail,
      resendConfirmation,
      updateProfile,
      refreshProfile,
      openAuthModal,
      closeAuthModal,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
