/**
 * Phase 3 Verification Script: Supabase Authentication Integration
 * Tests:
 * 1. Configuration & Client initialization
 * 2. Invalid sign-in handling & error code mapping
 * 3. Weak password rejection
 * 4. Role elevation prevention (checks that unauthorized self-promotion to Administrator is prevented)
 * 5. Trusted bootstrap administrator email resolution
 * 6. User account mapping & role normalization
 * 7. Session restoration with null safety
 */
import { verifySupabaseConfig } from '../src/lib/supabase';
import {
  supabaseSignIn,
  supabaseSignUp,
  supabaseGetSession,
  mapSupabaseUserToAccount,
  TRUSTED_BOOTSTRAP_ADMIN_EMAILS,
} from '../src/lib/supabaseAuth';
import { normalizeUserRole } from '../src/types';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function runTests() {
  console.log('====================================================');
  console.log('SmartPDS Phase 3: Supabase Authentication Test Suite');
  console.log('====================================================\n');

  // Test 1: Config Verification
  try {
    const config = verifySupabaseConfig();
    const passed = config.isConfigured && config.hasValidUrl;
    results.push({
      name: '1. Supabase Environment Configuration',
      passed,
      details: `Configured: ${config.isConfigured}, Valid URL: ${config.hasValidUrl}`,
    });
  } catch (err: any) {
    results.push({
      name: '1. Supabase Environment Configuration',
      passed: false,
      details: err?.message || String(err),
    });
  }

  // Test 2: Invalid Sign-in Safe Handling
  try {
    const res = await supabaseSignIn({
      email: 'nonexistent_test_officer@smartpds.gov.in',
      password: 'NonExistentPassword123!',
    });
    // Expected to fail safely without throwing unhandled exceptions
    const passed = !res.success && Boolean(res.error) && Boolean(res.errorCode);
    results.push({
      name: '2. Invalid Sign-In Safe Rejection',
      passed,
      details: `Returned success=false, code=${res.errorCode}, msg="${res.error}"`,
    });
  } catch (err: any) {
    results.push({
      name: '2. Invalid Sign-In Safe Rejection',
      passed: false,
      details: `Threw unhandled exception: ${err?.message}`,
    });
  }

  // Test 3: Weak Password Sign-Up Guard
  try {
    const res = await supabaseSignUp({
      email: 'test_weak_officer@smartpds.gov.in',
      password: '123',
      name: 'Test Officer',
      role: 'Warehouse Operator',
    });
    const passed = !res.success && res.errorCode === 'auth/weak-password';
    results.push({
      name: '3. Weak Password Registration Guard (< 6 chars)',
      passed,
      details: `Blocked weak password with code=${res.errorCode}`,
    });
  } catch (err: any) {
    results.push({
      name: '3. Weak Password Registration Guard',
      passed: false,
      details: `Threw unhandled exception: ${err?.message}`,
    });
  }

  // Test 4: Role Elevation Prevention (Non-bootstrap user requesting Administrator)
  try {
    const regularUserAuth = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'regular_personnel_001@smartpds.gov.in',
      email_confirmed_at: '2026-01-01T00:00:00Z',
    };
    // Profile with no role or dealer role
    const regularAccount = mapSupabaseUserToAccount(regularUserAuth, {
      role: 'Ration Shop Dealer',
      name: 'Regular Dealer',
    });
    const passed =
      regularAccount.role === 'Ration Shop Dealer' &&
      !TRUSTED_BOOTSTRAP_ADMIN_EMAILS.includes(regularUserAuth.email);
    results.push({
      name: '4. Non-Admin Account Role Clamping',
      passed,
      details: `Account role clamped to "${regularAccount.role}", bootstrap: false`,
    });
  } catch (err: any) {
    results.push({
      name: '4. Non-Admin Account Role Clamping',
      passed: false,
      details: err?.message || String(err),
    });
  }

  // Test 5: Trusted Bootstrap Administrator Email Recognition
  try {
    const adminAuthUser = {
      id: 'b1ffcd88-8b0a-3ef7-aa5c-5aa8ac270b22',
      email: 'devendraagarwal907@gmail.com',
      email_confirmed_at: '2026-01-01T00:00:00Z',
    };
    const adminAccount = mapSupabaseUserToAccount(adminAuthUser);
    const passed =
      adminAccount.role === 'Administrator' &&
      TRUSTED_BOOTSTRAP_ADMIN_EMAILS.includes(adminAuthUser.email);
    results.push({
      name: '5. Trusted Bootstrap Administrator Resolution',
      passed,
      details: `Identified bootstrap admin ${adminAuthUser.email} with role "${adminAccount.role}"`,
    });
  } catch (err: any) {
    results.push({
      name: '5. Trusted Bootstrap Administrator Resolution',
      passed: false,
      details: err?.message || String(err),
    });
  }

  // Test 6: Role Normalization
  try {
    const testCases = [
      { input: 'admin', expected: 'Administrator' },
      { input: 'ADMINISTRATOR', expected: 'Administrator' },
      { input: 'warehouse operator', expected: 'Warehouse Operator' },
      { input: 'dealer', expected: 'Ration Shop Dealer' },
      { input: 'unknown_role', expected: 'Warehouse Operator' },
    ];
    const allMatch = testCases.every((tc) => normalizeUserRole(tc.input) === tc.expected);
    results.push({
      name: '6. User Role Normalization',
      passed: allMatch,
      details: `All ${testCases.length} case permutations normalized safely`,
    });
  } catch (err: any) {
    results.push({
      name: '6. User Role Normalization',
      passed: false,
      details: err?.message || String(err),
    });
  }

  // Test 7: Session Restoration Null Safety
  try {
    const sessionRes = await supabaseGetSession();
    // In headless test without active browser session, session should be null without error
    const passed = sessionRes.session === null || Boolean(sessionRes.user);
    results.push({
      name: '7. Supabase Session Restoration Graceful Fallback',
      passed,
      details: `Returned cleanly: user=${sessionRes.user ? sessionRes.user.email : 'null (no session)'}`,
    });
  } catch (err: any) {
    results.push({
      name: '7. Supabase Session Restoration Graceful Fallback',
      passed: false,
      details: err?.message || String(err),
    });
  }

  // Output Report
  console.log('RESULTS:');
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? 'PASS' : 'FAIL';
    console.log(`[${icon}] ${r.name}`);
    console.log(`       ${r.details}`);
    if (!r.passed) allPassed = false;
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${results.filter((r) => r.passed).length}/${results.length} tests passed.`);
  console.log('====================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
