import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { fetchSupabaseProfile, mapSupabaseUserToAccount } from '../../lib/supabaseAuth';

import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Boxes,
  Mail,
  ShieldCheck,
  ExternalLink,
  LogOut,
  Home,
} from 'lucide-react';

interface EmailVerificationCallbackViewProps {
  onProceedToApp?: () => void;
  onProceedToLogin?: () => void;
  onReturnToLanding?: () => void;
}

export const EmailVerificationCallbackView: React.FC<EmailVerificationCallbackViewProps> = ({
  onProceedToApp,
  onProceedToLogin,
  onReturnToLanding,
}) => {
  const {
    currentUser,
    setActiveView,
    logout,
    checkVerificationStatus,
  } = useApp();

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verifiedRole, setVerifiedRole] = useState<string | null>(null);
  const [hasActiveSession, setHasActiveSession] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setActiveView('verification-callback');

    async function handleVerification() {
      if (typeof window === 'undefined') return;

      try {
        const search = window.location.search;
        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.substring(1)
          : window.location.hash;

        const searchParams = new URLSearchParams(search);
        const hashParams = new URLSearchParams(hash);

        // 1. Check for error parameters returned by Supabase Auth (query or hash)
        const errorDesc =
          searchParams.get('error_description') ||
          hashParams.get('error_description') ||
          searchParams.get('error') ||
          hashParams.get('error');

        const errorCode = searchParams.get('error_code') || hashParams.get('error_code');

        if (errorDesc || errorCode) {
          if (!isMounted) return;
          setStatus('error');
          let friendly = errorDesc
            ? decodeURIComponent(errorDesc.replace(/\+/g, ' '))
            : 'Email verification link is invalid or has expired.';
          if (errorCode === 'otp_expired' || friendly.toLowerCase().includes('expired')) {
            friendly = 'The confirmation link has expired or has already been used. Please request a new verification email.';
          }
          setErrorMessage(friendly);
          return;
        }

        // 2. PKCE Authorization Code Flow: ?code=...
        const code = searchParams.get('code');
        if (code && supabase) {
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              if (!isMounted) return;
              setStatus('error');
              const msg = error.message.toLowerCase().includes('expired')
                ? 'The confirmation link has expired or has already been used. Please request a new verification email.'
                : error.message;
              setErrorMessage(msg);
              return;
            }

            if (data?.user) {
              if (!isMounted) return;
              const isVerified = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);
              if (isVerified) {
                setVerifiedEmail(data.user.email || null);
                const profile = await fetchSupabaseProfile(data.user.id);
                const account = mapSupabaseUserToAccount(data.user, profile);
                setVerifiedRole(account.role);
                setHasActiveSession(true);
                await checkVerificationStatus(true);
                setStatus('success');
                // Clean browser URL without reload to remove one-time code
                try {
                  window.history.replaceState({}, document.title, window.location.pathname);
                } catch {}
                return;
              }
            }
          } catch (codeErr: any) {
            console.warn('[SmartPDS]: PKCE code exchange notice:', codeErr);
          }
        }

        // 3. Token Hash OTP Verification Flow: ?token_hash=...
        const tokenHash = searchParams.get('token_hash');
        if (tokenHash && supabase) {
          const type = (searchParams.get('type') || 'email') as any;
          try {
            const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
            if (error) {
              if (!isMounted) return;
              setStatus('error');
              const msg = error.message.toLowerCase().includes('expired')
                ? 'The confirmation link has expired or has already been used. Please request a new verification email.'
                : error.message;
              setErrorMessage(msg);
              return;
            }

            if (data?.user) {
              if (!isMounted) return;
              const profile = await fetchSupabaseProfile(data.user.id);
              const account = mapSupabaseUserToAccount(data.user, profile);
              setVerifiedEmail(data.user.email || null);
              setVerifiedRole(account.role);
              setHasActiveSession(true);
              await checkVerificationStatus(true);
              setStatus('success');
              try {
                window.history.replaceState({}, document.title, window.location.pathname);
              } catch {}
              return;
            }
          } catch (otpErr: any) {
            console.warn('[SmartPDS]: VerifyOtp notice:', otpErr);
          }
        }

        // 4. Hash Fragment Token Flow (Implicit Flow: #access_token=...&type=signup)
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && supabase) {
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (error) {
              if (!isMounted) return;
              setStatus('error');
              setErrorMessage(error.message);
              return;
            }

            if (data?.user) {
              if (!isMounted) return;
              const isVerified = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);
              if (isVerified) {
                setVerifiedEmail(data.user.email || null);
                const profile = await fetchSupabaseProfile(data.user.id);
                const account = mapSupabaseUserToAccount(data.user, profile);
                setVerifiedRole(account.role);
                setHasActiveSession(true);
                await checkVerificationStatus(true);
                setStatus('success');
                try {
                  window.history.replaceState({}, document.title, window.location.pathname);
                } catch {}
                return;
              }
            }
          } catch (hashErr: any) {
            console.warn('[SmartPDS]: Hash token processing notice:', hashErr);
          }
        }

        // 5. Active Session Verification Check
        if (supabase) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.user) {
            const u = sessionData.session.user;
            const isVerified = Boolean(u.email_confirmed_at || u.confirmed_at);
            if (isVerified) {
              if (!isMounted) return;
              setVerifiedEmail(u.email || null);
              const profile = await fetchSupabaseProfile(u.id);
              const account = mapSupabaseUserToAccount(u, profile);
              setVerifiedRole(account.role);
              setHasActiveSession(true);
              await checkVerificationStatus(true);
              setStatus('success');
              return;
            }
          }
        }

        // 6. Context User Fallback Check

        if (currentUser && currentUser.emailVerified) {
          if (!isMounted) return;
          setVerifiedEmail(currentUser.email);
          setVerifiedRole(currentUser.role);
          setHasActiveSession(true);
          setStatus('success');
          return;
        }

        // 8. No verification credentials found
        if (!isMounted) return;
        setStatus('error');
        setErrorMessage(
          'No valid verification tokens were detected in the confirmation link. Please check your email inbox and tap the link again.'
        );
      } catch (err: any) {
        if (!isMounted) return;
        setStatus('error');
        setErrorMessage(err?.message || 'An unexpected verification error occurred.');
      }
    }

    handleVerification();

    return () => {
      isMounted = false;
    };
  }, [currentUser, checkVerificationStatus, setActiveView]);

  const handleGoToApp = () => {
    if (onProceedToApp) {
      onProceedToApp();
    } else {
      setActiveView('app');
    }
  };

  const handleGoToLogin = () => {
    if (onProceedToLogin) {
      onProceedToLogin();
    } else {
      setActiveView('auth');
    }
  };

  const handleGoToLanding = () => {
    if (onReturnToLanding) {
      onReturnToLanding();
    } else {
      setActiveView('landing');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-[#F1F5F9] flex flex-col justify-between selection:bg-[#9F1745]/30 selection:text-[#C4B5FD]">
      {/* Top Bar */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between border-b border-[#293548]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#480F25] to-[#9F1745] border border-[#9F1745]/50 flex items-center justify-center text-[#C4B5FD] shadow-xs">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <span className="font-heading font-bold text-lg text-[#F1F5F9] tracking-tight">
              Smart<span className="text-[#C4B5FD]">PDS</span>
            </span>
            <div className="text-[10px] uppercase tracking-wider text-[#98A2B3] font-medium">
              Civil Supplies Security Gateway
            </div>
          </div>
        </div>

        <button
          onClick={handleGoToLanding}
          className="flex items-center gap-1.5 text-xs text-[#98A2B3] hover:text-[#F1F5F9] px-3 py-1.5 rounded-lg border border-[#293548] hover:bg-[#141C29] transition-colors cursor-pointer"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Public Portal</span>
        </button>
      </div>

      {/* Main Verification Card */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-xl w-full bg-[#141C29] rounded-2xl border border-[#293548] p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
          {/* Subtle Ambient Glow */}
          <div
            className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none ${
              status === 'success'
                ? 'bg-emerald-500/15'
                : status === 'error'
                ? 'bg-red-500/15'
                : 'bg-[#A9144B]/15'
            }`}
          />

          {/* STATE 1: VERIFYING IN PROGRESS */}
          {status === 'verifying' && (
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#101827] border border-[#293548] flex items-center justify-center text-[#C4B5FD] shadow-inner">
                <RefreshCw className="w-8 h-8 animate-spin text-[#C4B5FD]" />
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#C4B5FD] bg-[#4A182A] px-2.5 py-0.5 rounded-full border border-[#A9144B]/40">
                  Supabase Authentication Gateway
                </span>
                <h2 className="text-xl sm:text-2xl font-bold font-heading text-[#F1F5F9] tracking-tight">
                  Verifying Your Email Address...
                </h2>
                <p className="text-xs sm:text-sm text-[#98A2B3] max-w-md mx-auto leading-relaxed">
                  Connecting to Supabase Auth to confirm your electronic credentials and establish your official civil supplies clearance.
                </p>
              </div>
            </div>
          )}

          {/* STATE 2: SUCCESS VERIFIED */}
          {status === 'success' && (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    Statutory Clearance Confirmed
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold font-heading text-emerald-300 mt-2 tracking-tight">
                    Email verified successfully!
                  </h2>
                  <p className="text-xs sm:text-sm text-[#98A2B3] mt-1.5 max-w-md mx-auto leading-relaxed">
                    Your official email address has been verified in Supabase. Your civil supplies personnel account is active and authorized.
                  </p>
                </div>
              </div>

              {/* Verified Account Summary Details */}
              <div className="p-4 rounded-xl bg-[#101827] border border-emerald-500/30 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-[#293548]/60 text-xs">
                  <span className="text-[#98A2B3] font-medium">Verified Email:</span>
                  <span className="font-mono text-emerald-300 font-semibold flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    {verifiedEmail || currentUser?.email || 'Registered Officer'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-[#293548]/60 text-xs">
                  <span className="text-[#98A2B3] font-medium">Authentication Engine:</span>
                  <span className="font-mono text-[#F1F5F9] font-medium">
                    Supabase Auth · PostgreSQL RLS
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="text-[#98A2B3] font-medium">Operational Status:</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-300 bg-emerald-950/40 border border-emerald-600/40 px-2.5 py-0.5 rounded-md font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Credentials Confirmed</span>
                  </span>
                </div>
              </div>

              {/* Action Buttons: Never redirect immediately, provide clear user-controlled buttons */}
              <div className="space-y-2.5 pt-2">
                {hasActiveSession ? (
                  <button
                    type="button"
                    onClick={handleGoToApp}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold text-white bg-[#A9144B] hover:bg-[#8D103E] active:bg-[#4A182A] rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    <span>Enter SmartPDS Warehouse Terminal</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGoToLogin}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold text-white bg-[#A9144B] hover:bg-[#8D103E] active:bg-[#4A182A] rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    <span>Proceed to Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleGoToLanding}
                    className="flex-1 py-2 text-xs font-medium text-[#98A2B3] hover:text-[#F1F5F9] bg-[#101827] hover:bg-[#1E293B] border border-[#293548] rounded-xl transition-colors cursor-pointer text-center"
                  >
                    Back to Public Portal
                  </button>

                  {hasActiveSession && (
                    <button
                      type="button"
                      onClick={logout}
                      className="flex-1 py-2 text-xs font-medium text-[#98A2B3] hover:text-red-300 bg-[#101827] hover:bg-[#1E293B] border border-[#293548] rounded-xl transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STATE 3: ERROR / EXPIRED */}
          {status === 'error' && (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shadow-inner">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20">
                    Verification Notice
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold font-heading text-[#F1F5F9] mt-2 tracking-tight">
                    Verification Link Expired or Invalid
                  </h2>
                  <p className="text-xs sm:text-sm text-red-200 mt-1.5 max-w-md mx-auto leading-relaxed bg-red-950/40 p-3 rounded-lg border border-red-500/40">
                    {errorMessage || 'The verification link has expired or has already been used.'}
                  </p>
                </div>
              </div>

              {/* Helpful Guidance */}
              <div className="p-4 rounded-xl bg-[#101827] border border-[#293548] text-xs text-[#98A2B3] space-y-2">
                <div className="text-[#F1F5F9] font-semibold text-xs">
                  Why did this happen?
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed">
                  <li>Supabase confirmation links expire automatically for security reasons.</li>
                  <li>If you previously clicked this link, your account may already be verified.</li>
                  <li>You can sign in directly or request a fresh verification link from the login screen.</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleGoToLogin}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#A9144B] hover:bg-[#8D103E] active:bg-[#4A182A] border border-[#A9144B] rounded-xl transition-all shadow-md cursor-pointer"
                >
                  <span>Go to Sign In / Request New Link</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleGoToLanding}
                  className="w-full py-2 text-xs font-medium text-[#98A2B3] hover:text-[#F1F5F9] bg-[#101827] hover:bg-[#1E293B] border border-[#293548] rounded-xl transition-colors cursor-pointer text-center"
                >
                  Back to Public Portal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="py-4 border-t border-[#293548] text-center text-xs text-[#98A2B3]">
        SmartPDS &copy; {new Date().getFullYear()} · Public Distribution System Commodity Allocation Portal
      </div>
    </div>
  );
};
