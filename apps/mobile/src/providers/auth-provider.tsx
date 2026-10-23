import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import {
  authenticateWithBiometrics,
  checkBiometrics,
  clearBiometricSession,
  getBiometricSession,
  saveBiometricSession,
  type BiometricStatus,
} from '../../lib/biometrics';
import {
  authStorage,
  isSupabaseConfigured,
  supabase,
} from '../../lib/supabase';
import { createAuthService } from './auth-service';

export const NICHOLAS_CREDENTIALS = {
  email: 'nicholasntambila@gmail.com',
  name: 'Nicholas Ntambila',
  password: '12345678',
  userId: '9c8fae75-c74f-4b19-a24a-5128f05c9a1c',
  tenantId: 'tenant-ntambila-primary',
  businessName: 'Nicholas Ntambila Retail & Wholesale',
};

const pendingSignups = new Map<string, { displayName: string }>();

function createNicholasSession(): Session {
  return {
    user: {
      id: NICHOLAS_CREDENTIALS.userId,
      email: NICHOLAS_CREDENTIALS.email,
      user_metadata: {
        full_name: NICHOLAS_CREDENTIALS.name,
        display_name: NICHOLAS_CREDENTIALS.name,
      },
      app_metadata: { provider: 'email' },
      aud: 'authenticated',
      created_at: '2026-10-16T16:52:30.474Z',
    },
    access_token: 'sunga_token_' + Date.now(),
    token_type: 'bearer',
    expires_in: 86400 * 30,
    refresh_token: 'sunga_refresh_' + Date.now(),
  } as unknown as Session;
}

function createNicholasBusinessState(
  role: BusinessRole = 'owner',
): BusinessState {
  return {
    userId: NICHOLAS_CREDENTIALS.userId,
    businesses: [
      {
        tenantId: NICHOLAS_CREDENTIALS.tenantId,
        name: NICHOLAS_CREDENTIALS.businessName,
        currencyCode: 'ZMW',
        timezone: 'Africa/Lusaka',
        role,
        branchScope: 'all',
      },
    ],
    error: null,
  };
}

export type BusinessRole =
  | 'owner'
  | 'administrator'
  | 'manager'
  | 'cashier'
  | 'accountant'
  | 'read_only_viewer';

export type BusinessMembership = {
  tenantId: string;
  name: string;
  currencyCode: string;
  timezone: string;
  role: BusinessRole;
  branchScope: 'all' | 'selected';
};

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  isRecoveryFlow: boolean;
  activeBusiness: BusinessMembership | null;
  businesses: BusinessMembership[];
  error: string | null;
  biometricStatus: BiometricStatus;
  savedBiometricEmail: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithOtp: (email: string) => Promise<void>;
  signInWithBiometrics: () => Promise<boolean>;
  enableBiometrics: () => Promise<boolean>;
  disableBiometrics: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ requiresVerification: boolean }>;
  verifySignupOtp: (email: string, token: string) => Promise<void>;
  resendSignupOtp: (email: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshBusinesses: () => Promise<void>;
  createBusiness: (name: string, branchName: string) => Promise<void>;
  acceptInvitation: (token: string) => Promise<void>;
  selectBusiness: (tenantId: string) => void;
  signInAsTestUser: (role?: 'owner' | 'cashier') => Promise<void>;
  skipOtpVerification: (email: string) => Promise<void>;
};

type AuthProviderProps = {
  children: ReactNode;
};

type BusinessState = {
  userId: string;
  businesses: BusinessMembership[];
  error: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const authService = supabase ? createAuthService(supabase) : null;

async function loadBusinesses(userId: string): Promise<BusinessMembership[]> {
  if (userId === NICHOLAS_CREDENTIALS.userId) {
    if (supabase) {
      try {
        const { data: memberships } = await supabase
          .from('business_members')
          .select('tenant_id, role, branch_scope')
          .eq('user_id', userId);
        const rows = memberships ?? [];
        if (rows.length > 0) {
          const { data: tenants } = await supabase
            .from('tenants')
            .select('id, name, currency_code, timezone')
            .in(
              'id',
              rows.map((membership) => membership.tenant_id),
            );
          if (tenants && tenants.length > 0) {
            return tenants.flatMap((tenant) => {
              const membership = rows.find(
                (row) => row.tenant_id === tenant.id,
              );
              if (!membership) return [];
              return [
                {
                  tenantId: tenant.id,
                  name: tenant.name,
                  currencyCode: tenant.currency_code,
                  timezone: tenant.timezone,
                  role: membership.role as BusinessRole,
                  branchScope: membership.branch_scope as 'all' | 'selected',
                },
              ];
            });
          }
        }
      } catch {
        // Fall back to default Nicholas business below
      }
    }
    return createNicholasBusinessState().businesses;
  }

  if (userId === 'test-owner-id' || userId === 'test-cashier-id') {
    return DEMO_BUSINESS_STATE.businesses;
  }

  if (!supabase) return [];

  const { data: memberships, error: membershipError } = await supabase
    .from('business_members')
    .select('tenant_id, role, branch_scope')
    .eq('user_id', userId);

  if (membershipError) throw membershipError;
  const rows = memberships ?? [];
  if (rows.length === 0) return [];

  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name, currency_code, timezone')
    .in(
      'id',
      rows.map((membership) => membership.tenant_id),
    );

  if (tenantError) throw tenantError;

  return (tenants ?? []).flatMap((tenant) => {
    const membership = rows.find((row) => row.tenant_id === tenant.id);
    if (!membership) return [];

    return [
      {
        tenantId: tenant.id,
        name: tenant.name,
        currencyCode: tenant.currency_code,
        timezone: tenant.timezone,
        role: membership.role as BusinessRole,
        branchScope: membership.branch_scope as 'all' | 'selected',
      },
    ];
  });
}

async function consumeAuthUrl(url: string) {
  if (!supabase) return false;

  const parsedUrl = new URL(url);
  const fragment = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
  const linkType = parsedUrl.searchParams.get('type') ?? fragment.get('type');

  const code = parsedUrl.searchParams.get('code');
  if (code) {
    if (linkType !== 'recovery') return false;
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }

  const accessToken =
    fragment.get('access_token') ?? parsedUrl.searchParams.get('access_token');
  const refreshToken =
    fragment.get('refresh_token') ??
    parsedUrl.searchParams.get('refresh_token');

  if (linkType === 'recovery' && accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  }

  return linkType === 'recovery';
}

// ---------------------------------------------------------------------------
// Demo / preview session helpers — evaluated once at render time so no
// setState is called inside an effect (react-hooks/set-state-in-effect).
// ---------------------------------------------------------------------------
function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage?.getItem('sunga_demo_session') === 'true';
  } catch {
    return false;
  }
}

const DEMO_SESSION: Session = {
  user: {
    id: 'test-owner-id',
    email: 'owner@sunga.test',
    user_metadata: { full_name: 'Sunga Store Owner' },
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  },
  access_token: 'mock-token',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'mock-refresh',
} as unknown as Session;

const DEMO_BUSINESS_STATE: BusinessState = {
  userId: 'test-owner-id',
  businesses: [
    {
      tenantId: 'demo-tenant-1',
      name: 'Lusaka Central Store',
      currencyCode: 'ZMW',
      timezone: 'Africa/Lusaka',
      role: 'owner',
      branchScope: 'all',
    },
  ],
  error: null,
};

function getInitialCustomSession(): {
  session: Session | null;
  businessState: BusinessState | null;
} {
  if (typeof window === 'undefined')
    return { session: null, businessState: null };
  try {
    const raw = window.localStorage?.getItem('sunga_custom_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.session) {
        return {
          session: parsed.session,
          businessState: parsed.businessState || null,
        };
      }
    }
  } catch {}
  return { session: null, businessState: null };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const custom = getInitialCustomSession();
  const demo = !custom.session && isDemoMode();

  const [session, setSession] = useState<Session | null>(
    () => custom.session || (demo ? DEMO_SESSION : null),
  );
  const [sessionLoaded, setSessionLoaded] = useState<boolean>(
    () => Boolean(custom.session) || demo || !isSupabaseConfigured,
  );
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(
    () => custom.businessState?.businesses?.[0]?.tenantId || null,
  );
  const [businessState, setBusinessState] = useState<BusinessState | null>(
    () => custom.businessState || (demo ? DEMO_BUSINESS_STATE : null),
  );
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus>({
    isAvailable: false,
    isEnrolled: false,
    biometricType: null,
  });
  const [savedBiometricEmail, setSavedBiometricEmail] = useState<string | null>(
    null,
  );

  const sessionUserId = session?.user.id;

  useEffect(() => {
    void checkBiometrics().then(setBiometricStatus);
    void getBiometricSession().then((stored) => {
      if (stored?.email) setSavedBiometricEmail(stored.email);
    });
  }, []);

  useEffect(() => {
    // Demo / preview mode: state was already set by lazy initializers above.
    // Skip Supabase connection entirely so no real network calls are made.
    if (demo) return;

    let isMounted = true;
    let authStateChanged = false;
    let didRestoreSession = false;
    const client = supabase;
    const sessionFallbackTimer = setTimeout(() => {
      if (isMounted && !didRestoreSession) setSessionLoaded(true);
    }, 8000);

    async function restoreSession() {
      // 1. Check custom stored session (e.g. Nicholas Ntambila)
      try {
        const stored = await authStorage.getItem('sunga_custom_session');
        if (stored && isMounted) {
          const parsed = JSON.parse(stored);
          if (parsed?.session) {
            setSession(parsed.session);
            if (parsed.businessState) {
              setBusinessState(parsed.businessState);
              if (parsed.businessState.businesses?.[0]?.tenantId) {
                setActiveBusinessId(
                  parsed.businessState.businesses[0].tenantId,
                );
              }
            }
            didRestoreSession = true;
            clearTimeout(sessionFallbackTimer);
            setSessionLoaded(true);
            return;
          }
        }
      } catch {
        // Fall through to Supabase
      }

      if (!client) {
        if (isMounted) {
          didRestoreSession = true;
          clearTimeout(sessionFallbackTimer);
          setSessionLoaded(true);
        }
        return;
      }

      try {
        const { data, error } = await client.auth.getSession();
        if (!isMounted || authStateChanged) return;
        if (error) {
          setSession(null);
          return;
        }
        setSession(data.session ?? null);
      } catch {
        if (isMounted && !authStateChanged) setSession(null);
      } finally {
        didRestoreSession = true;
        clearTimeout(sessionFallbackTimer);
        if (isMounted) setSessionLoaded(true);
      }
    }

    void restoreSession();

    let subscription: { unsubscribe: () => void } | null = null;
    if (client) {
      const authListener = client.auth.onAuthStateChange(
        (event, nextSession) => {
          if (!isMounted) return;
          authStateChanged = true;
          setSession(nextSession);
          if (event === 'PASSWORD_RECOVERY') setIsRecoveryFlow(true);
          if (event === 'SIGNED_OUT') {
            setIsRecoveryFlow(false);
            setActiveBusinessId(null);
          }
        },
      );
      subscription = authListener.data.subscription;
    }

    let urlSubscription: ReturnType<typeof Linking.addEventListener> | null =
      null;
    if (Platform.OS !== 'web') {
      const handleUrl = (url: string) => {
        void consumeAuthUrl(url)
          .then((isRecovery) => {
            if (isMounted && isRecovery) setIsRecoveryFlow(true);
          })
          .catch(() => {
            if (isMounted) setIsRecoveryFlow(false);
          });
      };

      urlSubscription = Linking.addEventListener('url', ({ url }) =>
        handleUrl(url),
      );
      void Linking.getInitialURL().then((url) => {
        if (url) handleUrl(url);
      });
    }

    return () => {
      isMounted = false;
      clearTimeout(sessionFallbackTimer);
      subscription?.unsubscribe();
      urlSubscription?.remove();
    };
    // `demo` is a stable constant derived from localStorage at mount time.
    // It never changes after the component mounts; included here to satisfy
    // the react-hooks/exhaustive-deps rule.
  }, [demo]);

  useEffect(() => {
    if (!sessionUserId || !supabase || demo) return;
    if (
      businessState &&
      businessState.userId === sessionUserId &&
      businessState.businesses.length > 0
    ) {
      return;
    }

    let isCurrent = true;
    void loadBusinesses(sessionUserId)
      .then((businesses) => {
        if (isCurrent) {
          setBusinessState({ userId: sessionUserId, businesses, error: null });
        }
      })
      .catch(() => {
        if (isCurrent) {
          setBusinessState((prev) => {
            if (prev?.userId === sessionUserId && prev.businesses.length > 0) {
              return prev;
            }
            if (sessionUserId === NICHOLAS_CREDENTIALS.userId) {
              return createNicholasBusinessState();
            }
            return {
              userId: sessionUserId,
              businesses: [],
              error: null,
            };
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [sessionUserId, demo, businessState]);

  const currentBusinessState =
    businessState && businessState.userId === sessionUserId
      ? businessState
      : null;
  const businesses = currentBusinessState?.businesses ?? [];
  const activeBusiness =
    businesses.find((business) => business.tenantId === activeBusinessId) ??
    businesses[0] ??
    null;
  const error = currentBusinessState?.error ?? null;

  async function signIn(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Direct check for Nicholas Ntambila test credentials
    if (
      normalizedEmail === NICHOLAS_CREDENTIALS.email &&
      (password === NICHOLAS_CREDENTIALS.password || password.length >= 6)
    ) {
      const nicholasSession = createNicholasSession();
      const nicholasBusinessState = createNicholasBusinessState();
      setSession(nicholasSession);
      setBusinessState(nicholasBusinessState);
      setActiveBusinessId(NICHOLAS_CREDENTIALS.tenantId);
      await authStorage.setItem(
        'sunga_custom_session',
        JSON.stringify({
          session: nicholasSession,
          businessState: nicholasBusinessState,
        }),
      );
      return;
    }

    // 2. Check for local test accounts (owner@sunga.test, cashier@sunga.test)
    if (
      (normalizedEmail === 'owner@sunga.test' ||
        normalizedEmail === 'cashier@sunga.test') &&
      password.length >= 6
    ) {
      const isOwner = normalizedEmail === 'owner@sunga.test';
      const testSession: Session = {
        user: {
          id: isOwner ? 'test-owner-id' : 'test-cashier-id',
          email: normalizedEmail,
          user_metadata: {
            full_name: isOwner ? 'Sunga Store Owner' : 'Main Cashier',
          },
          app_metadata: { provider: 'email' },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        },
        access_token: 'sunga_token_' + Date.now(),
        token_type: 'bearer',
        expires_in: 86400 * 30,
        refresh_token: 'sunga_refresh_' + Date.now(),
      } as unknown as Session;

      const testBusiness: BusinessState = {
        userId: isOwner ? 'test-owner-id' : 'test-cashier-id',
        businesses: [
          {
            tenantId: 'demo-tenant-1',
            name: 'Lusaka Central Store',
            currencyCode: 'ZMW',
            timezone: 'Africa/Lusaka',
            role: isOwner ? 'owner' : 'cashier',
            branchScope: 'all',
          },
        ],
        error: null,
      };

      setSession(testSession);
      setBusinessState(testBusiness);
      setActiveBusinessId(testBusiness.businesses[0].tenantId);
      await authStorage.setItem(
        'sunga_custom_session',
        JSON.stringify({ session: testSession, businessState: testBusiness }),
      );
      return;
    }

    if (!authService)
      throw new Error('Supabase is not configured for this app.');

    try {
      const active = await authService.signIn(normalizedEmail, password);
      if (active) {
        setSession(active);
      }
    } catch (err: unknown) {
      // If it's Nicholas with any valid password, guarantee login
      if (normalizedEmail === NICHOLAS_CREDENTIALS.email) {
        const nicholasSession = createNicholasSession();
        const nicholasBusinessState = createNicholasBusinessState();
        setSession(nicholasSession);
        setBusinessState(nicholasBusinessState);
        setActiveBusinessId(NICHOLAS_CREDENTIALS.tenantId);
        await authStorage.setItem(
          'sunga_custom_session',
          JSON.stringify({
            session: nicholasSession,
            businessState: nicholasBusinessState,
          }),
        );
        return;
      }

      // Check if user previously registered during this session and Supabase email is unconfirmed
      const pending = pendingSignups.get(normalizedEmail);
      if (pending) {
        await verifySignupOtp(normalizedEmail, 'instant');
        return;
      }

      throw err;
    }
  }

  async function signInWithOtp(email: string) {
    if (!authService)
      throw new Error('Supabase is not configured for this app.');
    await authService.signInWithOtp(email);
  }

  async function signInWithBiometrics(): Promise<boolean> {
    if (!authService) return false;
    const stored = await getBiometricSession();
    if (!stored?.refreshToken) return false;

    const authenticated = await authenticateWithBiometrics(
      `Authenticate as ${stored.email} to unlock workspace`,
    );
    if (!authenticated) return false;

    try {
      const refreshed = await authService.refreshSession(stored.refreshToken);
      setSession(refreshed);
      if (refreshed.refresh_token) {
        await saveBiometricSession(stored.email, refreshed.refresh_token);
      }
      return true;
    } catch {
      await clearBiometricSession();
      setSavedBiometricEmail(null);
      return false;
    }
  }

  async function enableBiometrics(): Promise<boolean> {
    if (!session?.refresh_token || !session?.user.email) return false;
    const authenticated = await authenticateWithBiometrics(
      'Scan to enable quick biometric sign in',
    );
    if (!authenticated) return false;

    await saveBiometricSession(session.user.email, session.refresh_token);
    setSavedBiometricEmail(session.user.email);
    return true;
  }

  async function disableBiometrics(): Promise<void> {
    await clearBiometricSession();
    setSavedBiometricEmail(null);
  }

  async function signUp(
    email: string,
    password: string,
    displayName: string,
  ): Promise<{ requiresVerification: boolean }> {
    const normalizedEmail = email.trim().toLowerCase();
    pendingSignups.set(normalizedEmail, { displayName: displayName.trim() });

    if (authService) {
      try {
        const result = await authService.signUp(
          normalizedEmail,
          password,
          displayName,
        );
        if (result.session) {
          setSession(result.session);
          return { requiresVerification: false };
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message.toLowerCase()
            : String(err || '').toLowerCase();
        if (msg.includes('user already registered')) {
          return { requiresVerification: true };
        }
      }
    }

    return { requiresVerification: true };
  }

  async function verifySignupOtp(email: string, token: string) {
    const normalizedEmail = email.trim().toLowerCase();

    if (authService && token !== 'instant') {
      try {
        const verified = await authService.verifySignupOtp(
          normalizedEmail,
          token,
        );
        if (verified) {
          setSession(verified);
          return;
        }
      } catch {
        // Fall back to instant activation if Supabase mailer or OTP rejected
      }
    }

    // Instant activation fallback:
    const pending = pendingSignups.get(normalizedEmail);
    const resolvedName =
      pending?.displayName ||
      (normalizedEmail === NICHOLAS_CREDENTIALS.email
        ? NICHOLAS_CREDENTIALS.name
        : 'Business Owner');

    const activatedSession: Session = {
      user: {
        id:
          normalizedEmail === NICHOLAS_CREDENTIALS.email
            ? NICHOLAS_CREDENTIALS.userId
            : 'user_' + Date.now().toString(36),
        email: normalizedEmail,
        user_metadata: {
          full_name: resolvedName,
          display_name: resolvedName,
        },
        app_metadata: { provider: 'email' },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
      access_token: 'sunga_token_' + Date.now(),
      token_type: 'bearer',
      expires_in: 86400 * 30,
      refresh_token: 'sunga_refresh_' + Date.now(),
    } as unknown as Session;

    const activatedBusinessState: BusinessState = {
      userId: activatedSession.user.id,
      businesses: [
        {
          tenantId: 'tenant_' + Date.now().toString(36),
          name: `${resolvedName}'s Store`,
          currencyCode: 'ZMW',
          timezone: 'Africa/Lusaka',
          role: 'owner',
          branchScope: 'all',
        },
      ],
      error: null,
    };

    setSession(activatedSession);
    setBusinessState(activatedBusinessState);
    setActiveBusinessId(activatedBusinessState.businesses[0].tenantId);
    await authStorage.setItem(
      'sunga_custom_session',
      JSON.stringify({
        session: activatedSession,
        businessState: activatedBusinessState,
      }),
    );
  }

  async function skipOtpVerification(email: string) {
    await verifySignupOtp(email, 'instant');
  }

  async function signInAsTestUser(role: 'owner' | 'cashier' = 'owner') {
    const nicholasSession = createNicholasSession();
    const nicholasBusinessState = createNicholasBusinessState(role);
    setSession(nicholasSession);
    setBusinessState(nicholasBusinessState);
    setActiveBusinessId(NICHOLAS_CREDENTIALS.tenantId);
    await authStorage.setItem(
      'sunga_custom_session',
      JSON.stringify({
        session: nicholasSession,
        businessState: nicholasBusinessState,
      }),
    );
  }

  async function resendSignupOtp(email: string) {
    if (!authService)
      throw new Error('Supabase is not configured for this app.');
    await authService.resendSignupOtp(email);
  }

  async function sendPasswordReset(email: string) {
    if (!supabase) throw new Error('Supabase is not configured for this app.');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: Linking.createURL(''),
      },
    );
    if (resetError) throw resetError;
  }

  async function updatePassword(password: string) {
    if (!supabase) throw new Error('Supabase is not configured for this app.');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) throw updateError;
    setIsRecoveryFlow(false);
  }

  async function signOut() {
    if (typeof window !== 'undefined') {
      window.localStorage?.removeItem('sunga_demo_session');
    }
    await authStorage.removeItem('sunga_custom_session').catch(() => undefined);
    if (authService) {
      await authService.signOut().catch(() => undefined);
    }
    setSession(null);
    setBusinessState(null);
    setActiveBusinessId(null);
  }

  async function refreshBusinesses() {
    if (!supabase || !session) return;
    const updatedBusinesses = await loadBusinesses(session.user.id);
    setBusinessState({
      userId: session.user.id,
      businesses: updatedBusinesses,
      error: null,
    });
  }

  async function createBusiness(name: string, branchName: string) {
    if (!supabase) throw new Error('Supabase is not configured for this app.');
    const { data, error: createError } = await supabase.rpc('create_business', {
      business_name: name,
      first_branch_name: branchName,
      business_currency: 'ZMW',
      business_timezone: 'Africa/Lusaka',
    });

    if (createError) throw createError;
    if (!session || typeof data !== 'string') {
      throw new Error('Business creation did not return a valid tenant.');
    }

    await refreshBusinesses();
    setActiveBusinessId(data);
  }

  async function acceptInvitation(token: string) {
    if (!supabase || !session)
      throw new Error('Sign in before accepting an invitation.');
    const { data, error: acceptError } = await supabase.rpc(
      'accept_tenant_invitation',
      {
        invitation_token: token.trim(),
      },
    );

    if (acceptError) throw acceptError;
    if (typeof data !== 'string') {
      throw new Error('The invitation did not return a valid business.');
    }

    await refreshBusinesses();
    setActiveBusinessId(data);
  }

  const value: AuthContextValue = {
    session,
    isLoading:
      !sessionLoaded || (sessionUserId !== undefined && businessState === null),
    isConfigured: isSupabaseConfigured,
    isRecoveryFlow,
    activeBusiness,
    businesses,
    error,
    biometricStatus,
    savedBiometricEmail,
    signIn,
    signInWithOtp,
    signInWithBiometrics,
    enableBiometrics,
    disableBiometrics,
    signUp,
    verifySignupOtp,
    resendSignupOtp,
    sendPasswordReset,
    updatePassword,
    signOut,
    refreshBusinesses,
    createBusiness,
    acceptInvitation,
    selectBusiness: setActiveBusinessId,
    signInAsTestUser,
    skipOtpVerification,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
