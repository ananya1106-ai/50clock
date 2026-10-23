import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import {
  Boxes,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Warehouse,
  Truck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Database,
} from 'lucide-react';

interface AuthViewProps {
  onSuccessRedirect?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccessRedirect }) => {
  const {
    login,
    signup,
    sendPasswordReset,
    setActiveView,
    preselectedAuthRole,
    setPreselectedAuthRole,
    addToast,
    supabaseStatus,
  } = useApp();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [selectedRole, setSelectedRole] = useState<UserRole>(
    preselectedAuthRole || 'Warehouse Operator'
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);

  // Sync if preselected role changes
  useEffect(() => {
    if (preselectedAuthRole) {
      setSelectedRole(preselectedAuthRole);
    }
  }, [preselectedAuthRole]);

  // Handle selecting an authorized operational role
  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setPreselectedAuthRole(role);
    setErrorMessage(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setErrorMessage(null);

    if (!email || !email.trim()) {
      setErrorMessage('Please enter your registered official email address.');
      return;
    }
    if (!password || !password.trim()) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login({
        role: selectedRole,
        email: email.trim(),
        password: password.trim(),
      });

      if (result.success) {
        setIsSuccess(true);
        if (onSuccessRedirect) {
          onSuccessRedirect();
        }
      } else {
        setErrorMessage(result.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unexpected login error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setErrorMessage(null);

    if (!fullName || !fullName.trim()) {
      setErrorMessage('Please enter your full official name.');
      return;
    }
    if (!email || !email.trim()) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signup({
        role: selectedRole,
        name: fullName.trim(),
        email: email.trim(),
        password: password.trim(),
      });

      if (result.success) {
        setIsSuccess(true);
        if (onSuccessRedirect) {
          onSuccessRedirect();
        }
      } else {
        setErrorMessage(result.error || 'Registration failed.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unexpected registration error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSendingReset) return;
    setResetFeedback(null);

    if (!resetEmail || !resetEmail.trim()) {
      setResetFeedback('Please enter your registered email address.');
      return;
    }

    setIsSendingReset(true);
    try {
      const res = await sendPasswordReset(resetEmail.trim());
      if (res.success) {
        setResetFeedback(`Password recovery email dispatched to ${resetEmail}. Check your inbox.`);
      } else {
        setResetFeedback(res.error || 'Failed to dispatch recovery instructions.');
      }
    } catch (err: any) {
      setResetFeedback(err?.message || 'Error sending password reset email.');
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#0B0F17] text-[#344054] dark:text-[#F1F5F9] flex flex-col justify-between selection:bg-[#9F1745]/30 selection:text-[#C4B5FD] transition-colors duration-200">
      {/* Top Bar Header */}
      <header className="w-full border-b border-[#E7E2DF] dark:border-[#263449] bg-white/80 dark:bg-[#0D1420]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveView('landing')}
              className="p-2 -ml-2 text-[#707887] dark:text-[#94A3B8] hover:text-[#344054] dark:hover:text-[#F1F5F9] hover:bg-[#F3EFEA] dark:hover:bg-[#141D2A] rounded-lg transition-colors cursor-pointer"
              title="Return to Public Portal"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-lg bg-[#A9144B] flex items-center justify-center text-white shadow-xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <span className="font-heading font-bold text-lg text-[#0F172A] dark:text-[#F1F5F9] tracking-tight">
                Smart<span className="text-[#A9144B] dark:text-[#C4B5FD]">PDS</span>
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#64748B] dark:text-[#94A3B8] ml-2 px-1.5 py-0.5 rounded bg-[#FAF2F4] dark:bg-[#3B1221] border border-[#E8CCD2] dark:border-[#A9144B]/40">
                Security Gateway
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full">
              <Database className="w-3.5 h-3.5" />
              <span>Supabase PostgreSQL · RLS Active</span>
            </div>

            <button
              onClick={() => setActiveView('landing')}
              className="text-xs text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F1F5F9] px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#263449] hover:bg-[#F8FAFC] dark:hover:bg-[#141D2A] transition-colors cursor-pointer"
            >
              Public Portal
            </button>
          </div>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-xl bg-white dark:bg-[#141D2A] rounded-2xl border border-[#E2E8F0] dark:border-[#263449] shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
          {/* Header Title */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold font-heading text-[#0F172A] dark:text-[#F1F5F9] tracking-tight">
              {authMode === 'signin' ? 'Civil Supplies Official Sign In' : 'Register Civil Supplies Personnel'}
            </h1>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-md mx-auto">
              {authMode === 'signin'
                ? 'Authorized access for government depot operations, FIFO allocation, and statutory grain registers.'
                : 'Create an official account with assigned operational clearance.'}
            </p>
          </div>

          {/* Role Selection Buttons */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
              Select Operational Clearance Role:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectRole('Administrator')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  selectedRole === 'Administrator'
                    ? 'border-[#A9144B] bg-[#FAF2F4] dark:bg-[#3B1221] text-[#A9144B] dark:text-[#C4B5FD] font-bold shadow-xs'
                    : 'border-[#E2E8F0] dark:border-[#263449] bg-[#F8FAFC] dark:bg-[#0D1420] text-[#64748B] dark:text-[#94A3B8] hover:border-[#CBD5E1]'
                }`}
              >
                <ShieldCheck className="w-4 h-4 mb-1 text-[#A9144B] dark:text-[#C4B5FD]" />
                <span>Admin</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectRole('Warehouse Operator')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  selectedRole === 'Warehouse Operator'
                    ? 'border-[#A9144B] bg-[#FAF2F4] dark:bg-[#3B1221] text-[#A9144B] dark:text-[#C4B5FD] font-bold shadow-xs'
                    : 'border-[#E2E8F0] dark:border-[#263449] bg-[#F8FAFC] dark:bg-[#0D1420] text-[#64748B] dark:text-[#94A3B8] hover:border-[#CBD5E1]'
                }`}
              >
                <Warehouse className="w-4 h-4 mb-1 text-[#A9144B] dark:text-[#C4B5FD]" />
                <span>Operator</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectRole('Ration Shop Dealer')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  selectedRole === 'Ration Shop Dealer'
                    ? 'border-[#A9144B] bg-[#FAF2F4] dark:bg-[#3B1221] text-[#A9144B] dark:text-[#C4B5FD] font-bold shadow-xs'
                    : 'border-[#E2E8F0] dark:border-[#263449] bg-[#F8FAFC] dark:bg-[#0D1420] text-[#64748B] dark:text-[#94A3B8] hover:border-[#CBD5E1]'
                }`}
              >
                <Truck className="w-4 h-4 mb-1 text-[#A9144B] dark:text-[#C4B5FD]" />
                <span>FPS Dealer</span>
              </button>
            </div>
          </div>

          {/* Error Message Box */}
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={authMode === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
            {authMode === 'signup' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                  Full Official Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Sunil K. Verma"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E2E8F0] dark:border-[#263449] bg-[#F8FAFC] dark:bg-[#0D1420] text-[#0F172A] dark:text-[#F1F5F9]"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                Official Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B] dark:text-[#94A3B8]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@smartpds.gov.in"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#E2E8F0] dark:border-[#263449] bg-[#F8FAFC] dark:bg-[#0D1420] text-[#0F172A] dark:text-[#F1F5F9]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                  Password <span className="text-rose-500">*</span>
                </label>
                {authMode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-[11px] text-[#A9144B] dark:text-[#C4B5FD] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B] dark:text-[#94A3B8]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-9 py-2 text-xs rounded-lg border border-[#E2E8F0] dark:border-[#263449] bg-[#F8FAFC] dark:bg-[#0D1420] text-[#0F172A] dark:text-[#F1F5F9]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F1F5F9] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authMode === 'signup' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B] dark:text-[#94A3B8]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#E2E8F0] dark:border-[#263449] bg-[#F8FAFC] dark:bg-[#0D1420] text-[#0F172A] dark:text-[#F1F5F9]"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#A9144B] hover:bg-[#8D103E] active:bg-[#4A182A] rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 mt-2"
            >
              <span>
                {isLoading
                  ? 'Verifying clearance in Supabase...'
                  : authMode === 'signin'
                  ? `Sign In as ${selectedRole}`
                  : `Create Account as ${selectedRole}`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Toggle between Sign In and Sign Up */}
          <div className="text-center pt-2 border-t border-[#E2E8F0] dark:border-[#263449] text-xs text-[#64748B] dark:text-[#94A3B8]">
            {authMode === 'signin' ? (
              <span>
                New personnel or official?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setErrorMessage(null);
                  }}
                  className="font-semibold text-[#A9144B] dark:text-[#C4B5FD] hover:underline cursor-pointer"
                >
                  Register here
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setErrorMessage(null);
                  }}
                  className="font-semibold text-[#A9144B] dark:text-[#C4B5FD] hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </span>
            )}
          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#141D2A] rounded-2xl border border-[#E2E8F0] dark:border-[#263449] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#263449]">
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                Password Reset Recovery
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(false);
                  setResetFeedback(null);
                }}
                className="text-xs text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F1F5F9]"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
              Enter your registered official email address to receive password reset instructions from Supabase Authentication.
            </p>

            {resetFeedback && (
              <div className="p-3 rounded-lg bg-[#FAF2F4] dark:bg-[#3B1221] border border-[#E8CCD2] dark:border-[#A9144B]/40 text-xs text-[#A9144B] dark:text-[#C4B5FD]">
                {resetFeedback}
              </div>
            )}

            <form onSubmit={handleSendResetEmail} className="space-y-3">
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="officer@smartpds.gov.in"
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#E2E8F0] dark:border-[#263449] bg-[#F8FAFC] dark:bg-[#0D1420] text-[#0F172A] dark:text-[#F1F5F9]"
              />

              <button
                type="submit"
                disabled={isSendingReset}
                className="w-full py-2 text-xs font-semibold text-white bg-[#A9144B] hover:bg-[#8D103E] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSendingReset ? 'Dispatching instructions...' : 'Send Recovery Email'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-4 border-t border-[#E2E8F0] dark:border-[#263449] text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
        SmartPDS &copy; {new Date().getFullYear()} · Public Distribution System · Real PostgreSQL Backend
      </footer>
    </div>
  );
};
