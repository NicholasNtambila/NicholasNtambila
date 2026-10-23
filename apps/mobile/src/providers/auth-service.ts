import type { Session, SupabaseClient } from '@supabase/supabase-js';

type AuthClient = Pick<SupabaseClient, 'auth'>;

export type SignUpResult = {
  session: Session | null;
  requiresVerification: boolean;
};

export function createAuthService(client: AuthClient) {
  return {
    async signIn(email: string, password: string): Promise<Session | null> {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data?.session ?? null;
    },

    async signInWithOtp(email: string): Promise<void> {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
    },

    async signUp(
      email: string,
      password: string,
      displayName: string,
    ): Promise<SignUpResult> {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      if (error) throw error;

      // If Supabase returns an active session immediately, the account is created
      // and confirmed without requiring an extra OTP step.
      if (data.session) {
        return {
          session: data.session,
          requiresVerification: false,
        };
      }

      // If no session is returned, email verification code was dispatched.
      return {
        session: null,
        requiresVerification: true,
      };
    },

    async verifyOtp(
      email: string,
      token: string,
      type: 'email' | 'signup' = 'email',
    ): Promise<Session> {
      const { data, error } = await client.auth.verifyOtp({
        email,
        token,
        type,
      });
      if (error) throw error;
      if (!data.session) {
        throw new Error(
          'Verification did not return an active session. Request a new code and try again.',
        );
      }
      return data.session;
    },

    async verifySignupOtp(email: string, token: string): Promise<Session> {
      // Supabase signup confirmation emails use type 'signup'.
      // Try 'signup' first; fall back to 'email' (magic link / passwordless OTP).
      try {
        return await this.verifyOtp(email, token, 'signup');
      } catch {
        return await this.verifyOtp(email, token, 'email');
      }
    },

    async refreshSession(refreshToken: string): Promise<Session> {
      const { data, error } = await client.auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (error) throw error;
      if (!data.session) {
        throw new Error('Could not refresh session.');
      }
      return data.session;
    },

    async resendSignupOtp(email: string): Promise<void> {
      const { error } = await client.auth.resend({ type: 'signup', email });
      if (error) throw error;
    },

    async signOut(): Promise<void> {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
  };
}
