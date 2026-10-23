import { supabase, supabaseStatus, getSupabase } from './supabase';
import { UserRole, UserAccount, normalizeUserRole } from '../types';

export interface SupabaseAuthResult {
  success: boolean;
  user?: UserAccount;
  error?: string;
  errorCode?: string;
  verified?: boolean;
  emailSent?: boolean;
}

// Trusted bootstrap administrators that can be automatically confirmed as Administrator
export const TRUSTED_BOOTSTRAP_ADMIN_EMAILS = [
  'devendraagarwal907@gmail.com',
  'admin@smartpds.gov.in',
  'sunil.verma@smartpds.gov.in',
  '2k24.csai1a.2412094@gmail.com',
  'visionvibes14589@gmail.com',
  'hackathonnn123@gmail.com',
  'aglpihu2006@gmail.com',
];

/**
 * Resolves the valid, reachable web app origin.
 * Strictly guarantees that localhost:3000 is never hardcoded.
 */
export function getValidAppOrigin(): string | undefined {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (origin && origin !== 'null' && !origin.startsWith('file:') && !origin.startsWith('blob:')) {
      return origin.replace(/\/+$/, '');
    }
  }

  const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    try {
      const parsed = new URL(envUrl.trim());
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return envUrl.trim().replace(/\/+$/, '');
      }
    } catch {
      // ignore invalid URL
    }
  }

  return undefined;
}

/**
 * Maps Supabase Auth user + public.user_profiles row into a typed UserAccount
 */
export function mapSupabaseUserToAccount(
  authUser: any,
  profileRow?: any
): UserAccount {
  const isEmailVerified = Boolean(
    authUser.email_confirmed_at || authUser.confirmed_at || authUser.user_metadata?.email_verified
  );

  const isBootstrap = TRUSTED_BOOTSTRAP_ADMIN_EMAILS.includes(
    (authUser.email || '').toLowerCase()
  );

  const fallbackRole: UserRole = isBootstrap ? 'Administrator' : 'Ration Shop Dealer';
  const role: UserRole = profileRow?.role ? normalizeUserRole(profileRow.role) : fallbackRole;
  const name: string =
    profileRow?.name ||
    authUser.user_metadata?.name ||
    authUser.email?.split('@')[0] ||
    'Civil Supplies Officer';

  const designation: string =
    profileRow?.designation ||
    (role === 'Administrator'
      ? 'State Systems & Security Administrator'
      : role === 'Warehouse Operator'
      ? 'Senior Warehouse Intake & Gate Operator'
      : 'Licensed Fair Price Shop Dealer');

  const department: string =
    profileRow?.department ||
    (role === 'Administrator'
      ? 'Civil Supplies IT Directorate'
      : role === 'Warehouse Operator'
      ? 'Depot Bay Operations'
      : 'Fair Price Shop Network');

  return {
    id: authUser.id,
    name,
    email: authUser.email || '',
    role,
    designation,
    department,
    lastLogin: profileRow?.last_login || new Date().toISOString(),
    emailVerified: isEmailVerified,
  };
}

/**
 * Fetches authoritative user profile from public.user_profiles table
 */
export async function fetchSupabaseProfile(userId: string): Promise<any | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[SmartPDS Supabase Auth]: Profile fetch error:', error.message);
      return null;
    }
    return data;
  } catch (err: any) {
    console.warn('[SmartPDS Supabase Auth]: Profile query exception:', err?.message || err);
    return null;
  }
}

/**
 * Ensures a public.user_profiles record exists for the given auth user.
 * Role escalation is strictly prevented by DB-side triggers and RLS policies.
 */
export async function ensureSupabaseProfile(
  authUser: any,
  requestedRole: UserRole,
  fullName: string
): Promise<UserAccount> {
  const client = getSupabase();
  const existing = await fetchSupabaseProfile(authUser.id);

  if (existing) {
    // Record login timestamp asynchronously
    (client.from('user_profiles') as any)
      .update({ last_login: new Date().toISOString() })
      .eq('id', authUser.id)
      .then(() => {})
      .catch?.(() => {});

    return mapSupabaseUserToAccount(authUser, existing);
  }

  // Security enforcement: Disallow unauthorized self-assignment of elevated privileges
  const isBootstrap = TRUSTED_BOOTSTRAP_ADMIN_EMAILS.includes(
    (authUser.email || '').toLowerCase()
  );

  const assignedRole: UserRole = isBootstrap
    ? 'Administrator'
    : requestedRole === 'Administrator'
    ? 'Warehouse Operator'
    : requestedRole;

  const designation = isBootstrap
    ? 'State Systems & Security Administrator'
    : assignedRole === 'Administrator'
    ? 'State Systems & Security Administrator'
    : assignedRole === 'Warehouse Operator'
    ? 'Senior Warehouse Intake & Gate Operator'
    : 'Licensed Fair Price Shop Dealer';

  const department =
    assignedRole === 'Administrator'
      ? 'Civil Supplies IT Directorate'
      : assignedRole === 'Warehouse Operator'
      ? 'Depot Bay Operations'
      : 'Fair Price Shop Network';

  const profilePayload = {
    id: authUser.id,
    email: authUser.email,
    name: fullName.trim() || authUser.email?.split('@')[0] || 'Civil Supplies Officer',
    role: assignedRole,
    designation,
    department,
    is_active: true,
    last_login: new Date().toISOString(),
  };

  try {
    const { data, error } = await (client.from('user_profiles') as any)
      .upsert(profilePayload)
      .select()
      .single();

    if (error) {
      console.warn('[SmartPDS Supabase Auth]: Profile upsert warning:', error.message);
      return mapSupabaseUserToAccount(authUser, profilePayload);
    }
    return mapSupabaseUserToAccount(authUser, data);
  } catch (err) {
    console.warn('[SmartPDS Supabase Auth]: Profile upsert exception:', err);
    return mapSupabaseUserToAccount(authUser, profilePayload);
  }
}

/**
 * Supabase Sign In with Email and Password
 */
export async function supabaseSignIn(credentials: {
  email: string;
  password?: string;
  role?: UserRole;
}): Promise<SupabaseAuthResult> {
  if (!supabaseStatus.isConfigured || !supabase) {
    return {
      success: false,
      errorCode: 'supabase/not-configured',
      error: 'Supabase credentials are not configured in environment.',
    };
  }

  const { email, password, role } = credentials;

  if (!email || !email.trim()) {
    return {
      success: false,
      errorCode: 'auth/invalid-email',
      error: 'Please enter your registered official email address.',
    };
  }

  if (!password || !password.trim()) {
    return {
      success: false,
      errorCode: 'auth/missing-password',
      error: 'Please enter your account password.',
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      let friendlyMsg = error.message;
      if (error.message.includes('Invalid login credentials')) {
        friendlyMsg = 'Invalid email or password. Please verify your credentials.';
      } else if (error.message.includes('Email not confirmed')) {
        friendlyMsg = 'Your email address has not been confirmed yet. Please verify your email.';
      }
      return {
        success: false,
        error: friendlyMsg,
        errorCode: error.status ? `supabase/${error.status}` : 'auth/invalid-credential',
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: 'No user data returned from authentication.',
        errorCode: 'auth/unknown-error',
      };
    }

    const profile = await fetchSupabaseProfile(data.user.id);
    const userAccount = profile
      ? mapSupabaseUserToAccount(data.user, profile)
      : await ensureSupabaseProfile(data.user, role || 'Warehouse Operator', email.split('@')[0]);

    const isVerified = Boolean(
      data.user.email_confirmed_at || data.user.confirmed_at
    );

    return {
      success: true,
      user: userAccount,
      verified: isVerified,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Authentication error occurred.',
      errorCode: 'auth/network-error',
    };
  }
}

/**
 * Supabase Sign Up with Email and Password
 */
export async function supabaseSignUp(credentials: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}): Promise<SupabaseAuthResult> {
  if (!supabaseStatus.isConfigured || !supabase) {
    return {
      success: false,
      errorCode: 'supabase/not-configured',
      error: 'Supabase credentials are not configured in environment.',
    };
  }

  const { email, password, name, role } = credentials;

  if (!email || !email.trim()) {
    return {
      success: false,
      errorCode: 'auth/invalid-email',
      error: 'Please enter a valid official email address.',
    };
  }

  if (!password || password.length < 6) {
    return {
      success: false,
      errorCode: 'auth/weak-password',
      error: 'Password must be at least 6 characters long.',
    };
  }

  const validOrigin = getValidAppOrigin();
  const signUpOptions: {
    data: { name: string; requested_role: UserRole };
    emailRedirectTo?: string;
  } = {
    data: {
      name: name.trim(),
      requested_role: role,
    },
  };

  if (validOrigin) {
    signUpOptions.emailRedirectTo = `${validOrigin}/verify-email`;
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: signUpOptions,
    });

    if (error) {
      let friendlyMsg = error.message;
      if (error.message.includes('User already registered')) {
        friendlyMsg = 'An account with this email address is already registered in Supabase.';
      }
      return {
        success: false,
        error: friendlyMsg,
        errorCode: error.status ? `supabase/${error.status}` : 'auth/signup-failed',
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: 'Registration failed to return user profile.',
        errorCode: 'auth/unknown-error',
      };
    }

    // Provision or verify public.user_profiles
    const userAccount = await ensureSupabaseProfile(data.user, role, name);

    const isVerified = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);

    return {
      success: true,
      user: userAccount,
      verified: isVerified,
      emailSent: !isVerified,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to complete registration.',
      errorCode: 'auth/network-error',
    };
  }
}

/**
 * Supabase Sign Out
 */
export async function supabaseSignOut(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('[SmartPDS Supabase Auth]: Sign out note:', e);
  }
}

/**
 * Restore current Supabase Session
 */
export async function supabaseGetSession(): Promise<{
  user: UserAccount | null;
  session: any | null;
}> {
  if (!supabase) return { user: null, session: null };
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session || !data.session.user) {
      return { user: null, session: null };
    }

    const authUser = data.session.user;
    const profile = await fetchSupabaseProfile(authUser.id);
    const userAccount = mapSupabaseUserToAccount(authUser, profile);

    return { user: userAccount, session: data.session };
  } catch {
    return { user: null, session: null };
  }
}

/**
 * Send Password Reset Email via Supabase
 */
export async function supabaseSendPasswordReset(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase is not configured.' };
  if (!email || !email.trim()) return { success: false, error: 'Email address is required.' };

  const validOrigin = getValidAppOrigin();
  const resetOptions: { redirectTo?: string } = {};
  if (validOrigin) {
    resetOptions.redirectTo = `${validOrigin}/?mode=resetPassword`;
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), resetOptions);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Password reset request failed.' };
  }
}

/**
 * Resend Email Verification link via Supabase
 */
export async function supabaseResendVerification(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase is not configured.' };
  if (!email || !email.trim()) return { success: false, error: 'Email address is required.' };

  const validOrigin = getValidAppOrigin();
  const resendParams: {
    type: 'signup';
    email: string;
    options?: { emailRedirectTo?: string };
  } = {
    type: 'signup',
    email: email.trim(),
  };

  if (validOrigin) {
    resendParams.options = {
      emailRedirectTo: `${validOrigin}/verify-email`,
    };
  }

  try {
    const { error } = await supabase.auth.resend(resendParams);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to resend confirmation email.' };
  }
}
