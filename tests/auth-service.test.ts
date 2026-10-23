import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAuthService } from '../apps/mobile/src/providers/auth-service';

const auth = {
  signInWithPassword: vi.fn(),
  signInWithOtp: vi.fn(),
  signUp: vi.fn(),
  verifyOtp: vi.fn(),
  refreshSession: vi.fn(),
  resend: vi.fn(),
  signOut: vi.fn(),
};

const client = { auth } as unknown as Pick<SupabaseClient, 'auth'>;
const service = createAuthService(client);

const verifiedSession = {
  user: { email_confirmed_at: '2026-10-14T10:00:00Z' },
} as Session;

beforeEach(() => {
  vi.resetAllMocks();
  auth.signInWithPassword.mockResolvedValue({
    data: { session: verifiedSession },
    error: null,
  });
  auth.signInWithOtp.mockResolvedValue({ error: null });
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  auth.verifyOtp.mockResolvedValue({
    data: { session: verifiedSession },
    error: null,
  });
  auth.refreshSession.mockResolvedValue({
    data: { session: verifiedSession },
    error: null,
  });
  auth.resend.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
});

describe('Supabase auth service', () => {
  it('signs in with the supplied email and password', async () => {
    const session = await service.signIn(
      'cashier@example.com',
      'safe-password',
    );

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'cashier@example.com',
      password: 'safe-password',
    });
    expect(session).toBe(verifiedSession);
  });

  it('signs in with passwordless OTP', async () => {
    await service.signInWithOtp('owner@example.com');

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'owner@example.com',
      options: { shouldCreateUser: false },
    });
  });

  it('creates a signup and signals verification needed when session is null', async () => {
    const result = await service.signUp(
      'owner@example.com',
      'safe-password',
      'Owner',
    );

    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'safe-password',
      options: { data: { display_name: 'Owner' } },
    });
    expect(result.requiresVerification).toBe(true);
    expect(result.session).toBeNull();
  });

  it('creates a signup and immediately returns session when verification is disabled', async () => {
    auth.signUp.mockResolvedValue({
      data: { session: verifiedSession },
      error: null,
    });

    const result = await service.signUp(
      'owner@example.com',
      'safe-password',
      'Owner',
    );

    expect(result.requiresVerification).toBe(false);
    expect(result.session).toBe(verifiedSession);
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('verifies the email OTP and returns the session', async () => {
    await expect(
      service.verifySignupOtp('owner@example.com', '123456'),
    ).resolves.toBe(verifiedSession);

    // verifySignupOtp now tries 'signup' type first (Supabase account confirmation)
    // and falls back to 'email' (magic link / passwordless OTP) only if that fails.
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'owner@example.com',
      token: '123456',
      type: 'signup',
    });
  });

  it('refreshes session with token for biometric quick login', async () => {
    const session = await service.refreshSession('refresh-token-123');
    expect(auth.refreshSession).toHaveBeenCalledWith({
      refresh_token: 'refresh-token-123',
    });
    expect(session).toBe(verifiedSession);
  });

  it('resends the signup OTP and signs out through Supabase', async () => {
    await service.resendSignupOtp('owner@example.com');
    await service.signOut();

    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'owner@example.com',
    });
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it('surfaces Supabase errors to the caller', async () => {
    const error = new Error('Invalid login credentials');
    auth.signInWithPassword.mockResolvedValue({ error, data: {} });

    await expect(
      service.signIn('owner@example.com', 'wrong-password'),
    ).rejects.toBe(error);
  });
});
