/**
 * SocialLoginButtons - Google and GitHub sign-in buttons.
 *
 * Purpose:
 *   Signs the user in through Supabase OAuth. The Google / GitHub providers
 *   must be enabled in the Supabase dashboard (Authentication -> Providers)
 *   for these buttons to work; otherwise Supabase returns a clear error.
 */
import { useState } from 'react';
import { FiGithub } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { toast } from 'react-toastify';
import { supabase, SUPABASE_NOT_CONFIGURED_ERROR } from '../../lib/supabaseClient';
import { authErrorMessage } from '../../services/authService';
import './SocialLoginButtons.css';

export default function SocialLoginButtons() {
  const [pending, setPending] = useState(null);

  const handleOAuth = async (provider) => {
    if (!supabase) {
      toast.error(SUPABASE_NOT_CONFIGURED_ERROR);
      return;
    }
    setPending(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (error) toast.error(authErrorMessage(error));
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="slb-wrap">
      <div className="slb-divider">
        <span>OR</span>
      </div>
      <div className="slb-buttons">
        <button
          type="button"
          className="slb-btn"
          disabled={Boolean(pending)}
          onClick={() => handleOAuth('google')}
          aria-label="Sign in with Google"
        >
          <FcGoogle size={20} />
          <span>{pending === 'google' ? 'Redirecting...' : 'Google'}</span>
        </button>
        <button
          type="button"
          className="slb-btn"
          disabled={Boolean(pending)}
          onClick={() => handleOAuth('github')}
          aria-label="Sign in with GitHub"
        >
          <FiGithub size={20} />
          <span>{pending === 'github' ? 'Redirecting...' : 'GitHub'}</span>
        </button>
      </div>
    </div>
  );
}
