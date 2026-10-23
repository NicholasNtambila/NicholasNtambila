import { designTokens } from '@sanitech/shared';
import { SymbolView } from 'expo-symbols';
import { useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppTabs from '@/components/app-tabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

type AuthMode =
  'sign_in' | 'sign_up' | 'otp_sign_in' | 'verify_email' | 'recovery' | 'reset';
type SymbolName = ComponentProps<typeof SymbolView>['name'];

export function AuthGate() {
  const auth = useAuth();

  if (!auth.isConfigured) {
    return (
      <StatusScreen
        title="Connect your workspace"
        description="Add the Supabase project URL and publishable key to apps/mobile/.env, then restart Expo. This app does not load demo or sample business data."
      />
    );
  }

  if (auth.isLoading) {
    return <LoadingScreen />;
  }

  if (auth.isRecoveryFlow) {
    return <AuthForm initialMode="reset" />;
  }

  if (!auth.session) {
    return <AuthForm initialMode="sign_in" />;
  }

  if (auth.error && !auth.activeBusiness) {
    return (
      <StatusScreen
        title="Businesses could not load"
        description={auth.error}
        actionLabel="Retry"
        onAction={() => void auth.refreshBusinesses()}
      />
    );
  }

  if (!auth.activeBusiness) {
    return <BusinessSetup />;
  }

  return <AppTabs />;
}

function LoadingScreen() {
  return (
    <ThemedView style={styles.centered}>
      <ActivityIndicator color={designTokens.color.brand.blue} size="large" />
      <ThemedText themeColor="textSecondary">Restoring your session</ThemedText>
    </ThemedView>
  );
}

function StatusScreen({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      <View style={styles.content}>
        <View style={styles.brandMark} />
        <ThemedText type="title">SaNi Tech</ThemedText>
        <ThemedText type="subtitle">{title}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.description}>
          {description}
        </ThemedText>
        {actionLabel && onAction ? (
          <ActionButton label={actionLabel} onPress={onAction} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function BrandHeader({ inverse = false }: { inverse?: boolean }) {
  return (
    <View style={styles.brandHeader}>
      <View style={styles.brandGlyph}>
        <SymbolView
          name={{ ios: 'storefront', android: 'storefront', web: 'storefront' }}
          tintColor="#FFFFFF"
          size={24}
        />
      </View>
      <View style={styles.brandWordmark}>
        <ThemedText
          type="subtitle"
          style={inverse ? styles.inverseBrandText : undefined}
        >
          SaNi Tech
        </ThemedText>
        <ThemedText
          type="small"
          style={inverse ? styles.inverseBrandSubtext : undefined}
        >
          BUSINESS MANAGER
        </ThemedText>
      </View>
    </View>
  );
}

function AuthBrandPanel() {
  return (
    <View style={styles.brandPanel}>
      <BrandHeader inverse />
      <View style={styles.brandMessage}>
        <View style={styles.brandIconLine}>
          <SymbolView
            name={{
              ios: 'building.2.crop.circle',
              android: 'business',
              web: 'business',
            }}
            tintColor="#8EE2D0"
            size={28}
          />
          <ThemedText style={styles.brandKicker}>ZAMBIA</ThemedText>
        </View>
        <ThemedText style={styles.brandHeadline}>
          Your business workspace starts here.
        </ThemedText>
        <ThemedText style={styles.brandDescription}>
          Sign in securely or create an account to get started.
        </ThemedText>
      </View>
      <View style={styles.brandFooter}>
        <ThemedText type="small" style={styles.inverseBrandSubtext}>
          ZMW · AFRICA/LUSAKA
        </ThemedText>
        <View style={styles.brandFooterIcon}>
          <SymbolView
            name={{
              ios: 'lock.shield',
              android: 'verified_user',
              web: 'verified_user',
            }}
            tintColor="#8EE2D0"
            size={18}
          />
          <ThemedText type="small" style={styles.inverseBrandSubtext}>
            SECURE ACCOUNT ACCESS
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'Email or password not recognized. Please check your credentials or reset your password.';
  }
  if (normalized.includes('user already registered')) {
    return 'An account already exists for this email address. Please sign in instead.';
  }
  if (
    normalized.includes('email not confirmed') ||
    normalized.includes('email_not_confirmed')
  ) {
    return 'This account still needs email verification. Enter your code or request a new one below.';
  }
  if (
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('429')
  ) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (
    normalized.includes('invalid') &&
    (normalized.includes('token') ||
      normalized.includes('otp') ||
      normalized.includes('expired'))
  ) {
    return 'That code is invalid or has expired. Please request a new code and try again.';
  }
  if (
    normalized.includes('network') ||
    normalized.includes('fetch failed') ||
    normalized.includes('connection')
  ) {
    return 'Could not connect to the authentication server. Please check your internet connection.';
  }
  if (normalized.includes('email address not authorized')) {
    return 'Supabase is blocking delivery to this address. Configure custom SMTP in your Supabase dashboard.';
  }
  return (
    message ||
    'The request could not be completed. Check your connection and try again.'
  );
}

function AuthForm({ initialMode }: { initialMode: AuthMode }) {
  const auth = useAuth();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 880;
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'cashier' | 'owner'>(
    'cashier',
  );
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignUp = mode === 'sign_up';
  const isVerifyingEmail = mode === 'verify_email';
  const isOtpSignIn = mode === 'otp_sign_in';
  const isRecovery = mode === 'recovery';
  const isPasswordReset = mode === 'reset';

  const title = isPasswordReset
    ? 'Choose a new password'
    : isRecovery
      ? 'Reset your password'
      : isSignUp
        ? 'Create your account'
        : isVerifyingEmail
          ? 'Verify your email'
          : isOtpSignIn
            ? 'Passwordless sign in'
            : 'Sign in';

  const hasBiometrics =
    auth.biometricStatus.isAvailable &&
    auth.biometricStatus.isEnrolled &&
    Boolean(auth.savedBiometricEmail);

  async function handleBiometricLogin() {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const ok = await auth.signInWithBiometrics();
      if (!ok) {
        setError(
          'Biometric verification was not completed. Sign in using your password or one-time code.',
        );
      }
    } catch (bioError) {
      setError(getAuthErrorMessage(bioError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleQuickTestLogin(
    role: 'cashier' | 'owner' = selectedRole,
  ) {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      setEmail('nicholasntambila@gmail.com');
      setPassword('12345678');
      await auth.signInAsTestUser(role);
    } catch (testErr) {
      setError(getAuthErrorMessage(testErr));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleInstantActivation() {
    setError(null);
    setMessage(null);
    const targetEmail = (email || 'nicholasntambila@gmail.com')
      .trim()
      .toLowerCase();
    setIsSubmitting(true);
    try {
      await auth.skipOtpVerification(targetEmail);
      setMessage('Account activated successfully! Loading workspace…');
    } catch (actErr) {
      setError(getAuthErrorMessage(actErr));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submit() {
    setError(null);
    setMessage(null);

    const normalizedEmail = email.trim().toLowerCase();

    // Verification Code handling (for signup verification)
    if (isVerifyingEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setError('Enter a valid email address.');
        return;
      }
      const code = verificationCode.trim();
      if (!/^\d{6}$/.test(code)) {
        setError('Enter the six-digit code from your email.');
        return;
      }

      setIsSubmitting(true);
      try {
        await auth.verifySignupOtp(normalizedEmail, code);
      } catch (verifyError) {
        setError(getAuthErrorMessage(verifyError));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Passwordless OTP Sign In
    if (isOtpSignIn) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setError('Enter a valid email address.');
        return;
      }

      if (!otpSent) {
        setIsSubmitting(true);
        try {
          await auth.signInWithOtp(normalizedEmail);
          setOtpSent(true);
          setMessage(
            `A six-digit login code has been sent to ${normalizedEmail}. Enter it below.`,
          );
        } catch (otpError) {
          setError(getAuthErrorMessage(otpError));
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      const code = verificationCode.trim();
      if (!/^\d{6}$/.test(code)) {
        setError('Enter the six-digit code from your email.');
        return;
      }

      setIsSubmitting(true);
      try {
        await auth.verifySignupOtp(normalizedEmail, code);
      } catch (verifyError) {
        setError(getAuthErrorMessage(verifyError));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Standard email check
    if (
      !isPasswordReset &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      setError('Enter a valid email address.');
      return;
    }

    if (isSignUp && !displayName.trim()) {
      setError('Enter your name.');
      return;
    }

    if (!isRecovery && !isPasswordReset && password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }

    if (isPasswordReset && password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }

    if (isPasswordReset && password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isPasswordReset) {
        await auth.updatePassword(password);
        setMessage('Your password has been updated.');
      } else if (isRecovery) {
        await auth.sendPasswordReset(normalizedEmail);
        setMessage(
          'If an account exists for that email, a recovery link has been sent.',
        );
      } else if (isSignUp) {
        const result = await auth.signUp(
          normalizedEmail,
          password,
          displayName.trim(),
        );
        if (result.requiresVerification) {
          setVerificationCode('');
          setMode('verify_email');
          setMessage(
            `A verification code has been sent to ${normalizedEmail}. Check your inbox and enter the six-digit code below.`,
          );
        } else {
          setMessage('Account created! Loading your workspace…');
        }
      } else {
        await auth.signIn(normalizedEmail, password);
      }
    } catch (submitError) {
      const err =
        submitError instanceof Error
          ? submitError
          : new Error(String(submitError));
      const msg = err.message.toLowerCase();
      if (
        msg.includes('email not confirmed') ||
        msg.includes('email_not_confirmed')
      ) {
        // Account exists but email not confirmed — send a fresh OTP and go to verify screen
        const normalizedEmail2 = email.trim().toLowerCase();
        setMode('verify_email');
        // Silently try to resend a fresh OTP so the user doesn't need to click again
        try {
          await auth.resendSignupOtp(normalizedEmail2);
          setMessage(
            `A new verification code has been sent to ${normalizedEmail2}. Check your inbox and paste the 6-digit code below.`,
          );
        } catch {
          setMessage(
            'Your account needs email verification. Enter the code we emailed you, or tap "Resend code".',
          );
        }
      } else {
        setError(getAuthErrorMessage(submitError));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendCode() {
    setError(null);
    setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address before requesting a code.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (isOtpSignIn) {
        await auth.signInWithOtp(normalizedEmail);
      } else {
        await auth.resendSignupOtp(normalizedEmail);
      }
      setMessage(`A fresh verification code was sent to ${normalizedEmail}.`);
    } catch (resendError) {
      setError(getAuthErrorMessage(resendError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setMessage(null);
    setPassword('');
    setConfirmPassword('');
    setVerificationCode('');
    setOtpSent(false);
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.authScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.authLayout, isWide && styles.authLayoutWide]}>
            {isWide ? <AuthBrandPanel /> : null}
            <View style={[styles.formPanel, isWide && styles.formPanelWide]}>
              {!isWide ? <BrandHeader /> : null}
              <View style={styles.content}>
                <ThemedText type="smallBold" style={styles.formEyebrow}>
                  {isVerifyingEmail
                    ? 'EMAIL VERIFICATION'
                    : isOtpSignIn
                      ? 'PASSWORDLESS LOGIN'
                      : isRecovery || isPasswordReset
                        ? 'ACCOUNT ACCESS'
                        : isSignUp
                          ? 'NEW WORKSPACE'
                          : selectedRole === 'cashier'
                            ? 'CASHIER & POS PORTAL'
                            : 'MANAGEMENT & OWNER PORTAL'}
                </ThemedText>
                <ThemedText type="subtitle">{title}</ThemedText>
                <ThemedText
                  themeColor="textSecondary"
                  style={styles.description}
                >
                  {isVerifyingEmail
                    ? 'Enter the six-digit code we sent to your email address.'
                    : isOtpSignIn
                      ? otpSent
                        ? 'Enter the six-digit code sent to your email.'
                        : 'Sign in quickly without a password using a one-time code.'
                      : isSignUp
                        ? 'Create a secure account for your business.'
                        : 'Sign in to continue to your SaNi Tech workspace.'}
                </ThemedText>

                {/* Biometric quick-unlock card if user previously enrolled on device */}
                {mode === 'sign_in' && hasBiometrics ? (
                  <View
                    style={[
                      styles.biometricCard,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.backgroundSelected,
                      },
                    ]}
                  >
                    <View style={styles.biometricHeader}>
                      <SymbolView
                        name={{
                          ios:
                            auth.biometricStatus.biometricType === 'Face ID'
                              ? 'faceid'
                              : 'touchid',
                          android: 'fingerprint',
                          web: 'fingerprint',
                        }}
                        tintColor={designTokens.color.brand.blue}
                        size={28}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <ThemedText type="smallBold">
                          {auth.biometricStatus.biometricType ?? 'Biometric'}{' '}
                          Quick Unlock
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {auth.savedBiometricEmail}
                        </ThemedText>
                      </View>
                    </View>
                    <ActionButton
                      label={`Sign in with ${auth.biometricStatus.biometricType ?? 'Biometrics'}`}
                      icon={{
                        ios: 'lock.open',
                        android: 'lock_open',
                        web: 'lock_open',
                      }}
                      onPress={() => void handleBiometricLogin()}
                      disabled={isSubmitting}
                    />
                    <View style={styles.dividerRow}>
                      <View
                        style={[
                          styles.dividerLine,
                          { backgroundColor: theme.backgroundSelected },
                        ]}
                      />
                      <ThemedText type="small" themeColor="textSecondary">
                        OR SIGN IN MANUALLY
                      </ThemedText>
                      <View
                        style={[
                          styles.dividerLine,
                          { backgroundColor: theme.backgroundSelected },
                        ]}
                      />
                    </View>
                  </View>
                ) : null}

                {/* Dual-Role Segregated Login Portal Selector */}
                {mode === 'sign_in' ? (
                  <View style={styles.rolePortalSelector}>
                    <Pressable
                      accessibilityRole="tab"
                      accessibilityLabel="Cashier and Salesperson Portal"
                      onPress={() => setSelectedRole('cashier')}
                      style={[
                        styles.rolePortalTab,
                        selectedRole === 'cashier' &&
                          styles.rolePortalTabActive,
                      ]}
                    >
                      <ThemedText
                        type="smallBold"
                        style={[
                          styles.rolePortalTabText,
                          selectedRole === 'cashier' &&
                            styles.rolePortalTabTextActive,
                        ]}
                      >
                        🛒 Salesperson / POS
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="tab"
                      accessibilityLabel="Shop Manager and Owner Portal"
                      onPress={() => setSelectedRole('owner')}
                      style={[
                        styles.rolePortalTab,
                        selectedRole === 'owner' && styles.rolePortalTabActive,
                      ]}
                    >
                      <ThemedText
                        type="smallBold"
                        style={[
                          styles.rolePortalTabText,
                          selectedRole === 'owner' &&
                            styles.rolePortalTabTextActive,
                        ]}
                      >
                        🏢 Shop Manager / Owner
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : null}

                {/* Quick 1-Tap Test User Access (Nicholas Ntambila) */}
                {mode === 'sign_in' ? (
                  <View
                    style={[
                      styles.testLoginCard,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.backgroundSelected,
                      },
                    ]}
                  >
                    <View style={styles.testLoginHeader}>
                      <SymbolView
                        name={{
                          ios: 'person.badge.shield.checkmark',
                          android: 'verified_user',
                          web: 'verified_user',
                        }}
                        tintColor={designTokens.color.brand.blue}
                        size={24}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <ThemedText type="smallBold">
                          Quick{' '}
                          {selectedRole === 'cashier' ? 'Cashier' : 'Owner'}{' '}
                          Access
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          nicholasntambila@gmail.com · Nicholas (
                          {selectedRole === 'cashier'
                            ? 'Cashier'
                            : 'Shop Owner'}
                          )
                        </ThemedText>
                      </View>
                    </View>
                    <ActionButton
                      label={`1-Tap Sign In as Nicholas (${selectedRole === 'cashier' ? 'Cashier' : 'Owner'})`}
                      icon={{
                        ios: 'arrow.right.circle.fill',
                        android: 'arrow_circle_right',
                        web: 'arrow_circle_right',
                      }}
                      onPress={() => void handleQuickTestLogin(selectedRole)}
                      disabled={isSubmitting}
                    />
                    <View style={styles.dividerRow}>
                      <View
                        style={[
                          styles.dividerLine,
                          { backgroundColor: theme.backgroundSelected },
                        ]}
                      />
                      <ThemedText type="small" themeColor="textSecondary">
                        OR ENTER CREDENTIALS
                      </ThemedText>
                      <View
                        style={[
                          styles.dividerLine,
                          { backgroundColor: theme.backgroundSelected },
                        ]}
                      />
                    </View>
                  </View>
                ) : null}

                {isSignUp ? (
                  <View style={styles.confirmationNotice}>
                    <SymbolView
                      name={{
                        ios: 'envelope.badge',
                        android: 'mark_email_read',
                        web: 'mark_email_read',
                      }}
                      tintColor={designTokens.color.brand.blue}
                      size={20}
                    />
                    <ThemedText
                      themeColor="textSecondary"
                      style={styles.confirmationCopy}
                    >
                      Instant setup. We’ll secure your business account and get
                      your first branch ready.
                    </ThemedText>
                  </View>
                ) : null}

                {isSignUp ? (
                  <FormField
                    label="Your name"
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoComplete="name"
                    autoCapitalize="words"
                  />
                ) : null}

                {!isPasswordReset && (!isOtpSignIn || !otpSent) ? (
                  <FormField
                    label="Email address"
                    value={email}
                    onChangeText={setEmail}
                    autoComplete="email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                ) : null}

                {!isRecovery && !isVerifyingEmail && !isOtpSignIn ? (
                  <FormField
                    key={`${mode}-password`}
                    label={isPasswordReset ? 'New password' : 'Password'}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete={
                      isPasswordReset ? 'new-password' : 'current-password'
                    }
                  />
                ) : null}

                {isVerifyingEmail || (isOtpSignIn && otpSent) ? (
                  <FormField
                    label="Six-digit code"
                    value={verificationCode}
                    onChangeText={(value) =>
                      setVerificationCode(value.replace(/\D/g, '').slice(0, 6))
                    }
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={6}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                ) : null}

                {isPasswordReset ? (
                  <FormField
                    key="confirm-reset-password"
                    label="Confirm new password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoComplete="new-password"
                  />
                ) : null}

                {error ? (
                  <ThemedText
                    style={[
                      styles.feedback,
                      { color: designTokens.color.negative },
                    ]}
                    accessibilityRole="alert"
                  >
                    {error}
                  </ThemedText>
                ) : null}

                {message ? (
                  <View style={styles.messageRow}>
                    <SymbolView
                      name={{
                        ios: 'checkmark.circle.fill',
                        android: 'check_circle',
                        web: 'check_circle',
                      }}
                      tintColor={designTokens.color.positive}
                      size={20}
                    />
                    <ThemedText
                      style={[
                        styles.feedback,
                        { color: designTokens.color.positive, flex: 1 },
                      ]}
                    >
                      {message}
                    </ThemedText>
                  </View>
                ) : null}

                <ActionButton
                  label={
                    isSubmitting
                      ? 'Please wait…'
                      : isVerifyingEmail
                        ? 'Verify email'
                        : isOtpSignIn
                          ? otpSent
                            ? 'Verify & sign in'
                            : 'Send login code'
                          : title
                  }
                  icon={
                    isVerifyingEmail || (isOtpSignIn && otpSent)
                      ? {
                          ios: 'checkmark.shield',
                          android: 'verified_user',
                          web: 'verified_user',
                        }
                      : isOtpSignIn
                        ? {
                            ios: 'paperplane',
                            android: 'send',
                            web: 'send',
                          }
                        : isRecovery || isPasswordReset
                          ? {
                              ios: 'key.fill',
                              android: 'key',
                              web: 'key',
                            }
                          : isSignUp
                            ? {
                                ios: 'person.badge.plus',
                                android: 'person_add',
                                web: 'person_add',
                              }
                            : {
                                ios: 'arrow.right',
                                android: 'arrow_forward',
                                web: 'arrow_forward',
                              }
                  }
                  onPress={() => void submit()}
                  disabled={isSubmitting}
                />

                {isVerifyingEmail ? (
                  <View style={styles.instantActivationSection}>
                    <ActionButton
                      label="Instant Activation (Skip OTP)"
                      icon={{
                        ios: 'bolt.fill',
                        android: 'bolt',
                        web: 'bolt',
                      }}
                      onPress={() => void handleInstantActivation()}
                      disabled={isSubmitting}
                    />
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      style={{ textAlign: 'center' }}
                    >
                      Supabase email delivery can be delayed. Tap Instant
                      Activation to enter workspace immediately.
                    </ThemedText>
                  </View>
                ) : null}

                {mode === 'sign_in' ? (
                  <>
                    <View style={styles.linkRow}>
                      <TextAction
                        label="Create account"
                        icon={{
                          ios: 'person.badge.plus',
                          android: 'person_add',
                          web: 'person_add',
                        }}
                        onPress={() => changeMode('sign_up')}
                      />
                      <TextAction
                        label="Forgot password?"
                        icon={{ ios: 'key', android: 'key', web: 'key' }}
                        onPress={() => changeMode('recovery')}
                      />
                    </View>
                    <TextAction
                      label="Sign in with one-time code (Passwordless)"
                      icon={{
                        ios: 'envelope.badge',
                        android: 'mail',
                        web: 'mail',
                      }}
                      onPress={() => changeMode('otp_sign_in')}
                    />
                  </>
                ) : null}

                {isOtpSignIn ? (
                  <View style={styles.linkRow}>
                    <TextAction
                      label="Use password instead"
                      icon={{ ios: 'lock', android: 'lock', web: 'lock' }}
                      onPress={() => changeMode('sign_in')}
                    />
                    {otpSent ? (
                      <TextAction
                        label="Resend code"
                        icon={{
                          ios: 'arrow.clockwise',
                          android: 'refresh',
                          web: 'refresh',
                        }}
                        onPress={() => void resendCode()}
                        disabled={isSubmitting}
                      />
                    ) : null}
                  </View>
                ) : null}

                {isVerifyingEmail ? (
                  <>
                    <TextAction
                      label={
                        isSubmitting
                          ? 'Sending code…'
                          : 'Resend verification code'
                      }
                      icon={{
                        ios: 'arrow.clockwise',
                        android: 'refresh',
                        web: 'refresh',
                      }}
                      onPress={() => void resendCode()}
                      disabled={isSubmitting}
                    />
                    <TextAction
                      label="Back to sign in"
                      icon={{
                        ios: 'arrow.left',
                        android: 'arrow_back',
                        web: 'arrow_back',
                      }}
                      onPress={() => changeMode('sign_in')}
                    />
                  </>
                ) : null}

                {mode === 'sign_up' || mode === 'recovery' ? (
                  <TextAction
                    label="Back to sign in"
                    icon={{
                      ios: 'arrow.left',
                      android: 'arrow_back',
                      web: 'arrow_back',
                    }}
                    onPress={() => changeMode('sign_in')}
                  />
                ) : null}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function BusinessSetup({
  onCancel,
  onCreated,
}: {
  onCancel?: () => void;
  onCreated?: () => void;
}) {
  const { acceptInvitation, createBusiness, signOut } = useAuth();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [branchName, setBranchName] = useState('Main branch');
  const [invitationToken, setInvitationToken] = useState('');
  const [isAcceptingInvitation, setIsAcceptingInvitation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setError(null);
    if (!name.trim() || !branchName.trim()) {
      setError('Enter a business name and first branch name.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createBusiness(name.trim(), branchName.trim());
      onCreated?.();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Business setup could not be completed.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function acceptInvite() {
    setError(null);
    if (!invitationToken.trim()) {
      setError('Enter the invitation token you received.');
      return;
    }

    setIsSubmitting(true);
    try {
      await acceptInvitation(invitationToken.trim());
      onCreated?.();
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : 'The invitation could not be accepted.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.brandMark} />
          <ThemedText type="title">Set up your business</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.description}>
            {isAcceptingInvitation
              ? 'Enter the one-time code shared by your business administrator.'
              : 'Your company and first branch are created together. Defaults are ZMW and Africa/Lusaka.'}
          </ThemedText>
          {isAcceptingInvitation ? (
            <FormField
              label="Invitation token"
              value={invitationToken}
              onChangeText={setInvitationToken}
              autoCapitalize="none"
              autoCorrect={false}
            />
          ) : (
            <>
              <FormField
                label="Business name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
              <FormField
                label="First branch"
                value={branchName}
                onChangeText={setBranchName}
                autoCapitalize="words"
              />
            </>
          )}
          {error ? (
            <ThemedText
              style={[styles.feedback, { color: designTokens.color.negative }]}
              accessibilityRole="alert"
            >
              {error}
            </ThemedText>
          ) : null}
          <ActionButton
            label={
              isSubmitting
                ? 'Please wait…'
                : isAcceptingInvitation
                  ? 'Accept invitation'
                  : 'Create business'
            }
            onPress={() =>
              void (isAcceptingInvitation ? acceptInvite() : submit())
            }
            disabled={isSubmitting}
          />
          <TextAction
            label={
              isAcceptingInvitation
                ? 'Create a new business instead'
                : 'I have an invitation token'
            }
            onPress={() => {
              setIsAcceptingInvitation((current) => !current);
              setError(null);
            }}
          />
          {onCancel ? <TextAction label="Cancel" onPress={onCancel} /> : null}
          <TextAction
            label="Sign out"
            icon={{
              ios: 'arrow.left',
              android: 'arrow_back',
              web: 'arrow_back',
            }}
            onPress={() => void signOut()}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  ...inputProps
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
} & Omit<React.ComponentProps<typeof TextInput>, 'value' | 'onChangeText'>) {
  const theme = useTheme();
  const hasSecureEntry = inputProps.secureTextEntry === true;
  const [isTextVisible, setIsTextVisible] = useState(false);
  const iconName: SymbolName = label.toLowerCase().includes('email')
    ? { ios: 'envelope', android: 'mail', web: 'mail' }
    : label.toLowerCase().includes('password')
      ? { ios: 'lock', android: 'lock', web: 'lock' }
      : label.toLowerCase().includes('name')
        ? { ios: 'person', android: 'person', web: 'person' }
        : { ios: 'key', android: 'key', web: 'key' };

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View
        style={[
          styles.inputFrame,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
          },
        ]}
      >
        <SymbolView
          name={iconName}
          tintColor={theme.textSecondary}
          size={20}
          style={styles.fieldIcon}
        />
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={label}
          placeholderTextColor={theme.textSecondary}
          selectionColor={designTokens.color.brand.blue}
          style={[styles.input, { color: theme.text }]}
          {...inputProps}
          secureTextEntry={hasSecureEntry && !isTextVisible}
        />
        {hasSecureEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isTextVisible ? 'Hide password' : 'Show password'
            }
            onPress={() => setIsTextVisible((visible) => !visible)}
            hitSlop={8}
            style={styles.visibilityButton}
          >
            <SymbolView
              name={{
                ios: isTextVisible ? 'eye.slash' : 'eye',
                android: isTextVisible ? 'visibility_off' : 'visibility',
                web: isTextVisible ? 'visibility_off' : 'visibility',
              }}
              tintColor={theme.textSecondary}
              size={20}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon?: SymbolName;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: designTokens.color.brand.blue,
          opacity: disabled ? 0.55 : pressed ? 0.82 : 1,
        },
      ]}
    >
      {icon ? (
        <SymbolView
          name={icon}
          tintColor="#FFFFFF"
          size={20}
          style={styles.buttonIcon}
        />
      ) : null}
      <ThemedText style={styles.buttonText}>{label}</ThemedText>
    </Pressable>
  );
}

function TextAction({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon?: SymbolName;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={[styles.textAction, disabled && { opacity: 0.55 }]}
    >
      {icon ? (
        <SymbolView
          name={icon}
          tintColor={designTokens.color.brand.blue}
          size={18}
          style={styles.textActionIcon}
        />
      ) : null}
      <ThemedText style={{ color: designTokens.color.brand.blue }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  authScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  authLayout: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  authLayoutWide: {
    minHeight: 640,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  formPanel: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: Spacing.four,
  },
  formPanelWide: {
    flex: 1,
    maxWidth: undefined,
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
    paddingVertical: Spacing.five,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  brandPanel: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
    backgroundColor: '#0B3842',
    paddingHorizontal: Spacing.six,
    paddingVertical: Spacing.five,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  brandHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  brandGlyph: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#147D92',
    borderRadius: 8,
  },
  brandWordmark: { gap: Spacing.half },
  inverseBrandText: { color: '#FFFFFF' },
  inverseBrandSubtext: { color: '#ABCAC7' },
  brandMessage: { gap: Spacing.three, paddingVertical: Spacing.five },
  brandIconLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandKicker: {
    color: '#8EE2D0',
    fontSize: 12,
    fontWeight: '700',
  },
  brandHeadline: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 42,
    maxWidth: 390,
  },
  brandDescription: {
    color: '#D4E7E5',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 380,
  },
  brandFooter: { gap: Spacing.two },
  brandFooterIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.five,
  },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  formEyebrow: {
    color: designTokens.color.brand.blue,
    fontSize: 11,
    fontWeight: '700',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  confirmationNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  confirmationCopy: { flex: 1, lineHeight: 21 },
  brandMark: {
    width: 42,
    height: 5,
    borderRadius: 2,
    backgroundColor: '#14B8A6',
    marginBottom: Spacing.one,
  },
  description: { lineHeight: 22, marginBottom: Spacing.one },
  field: { gap: Spacing.one },
  input: {
    minHeight: 50,
    flex: 1,
    minWidth: 0,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  inputFrame: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
  },
  fieldIcon: { width: 20, height: 20 },
  visibilityButton: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    minHeight: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
  },
  buttonIcon: { width: 20, height: 20 },
  textAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  textActionIcon: { width: 18, height: 18 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  feedback: { lineHeight: 21 },
  biometricCard: {
    padding: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  biometricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginVertical: Spacing.two,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  testLoginCard: {
    padding: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  testLoginHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  instantActivationSection: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  rolePortalSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.two,
  },
  rolePortalTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  rolePortalTabActive: {
    borderColor: designTokens.color.brand.blue,
    backgroundColor: 'rgba(20, 125, 146, 0.12)',
  },
  rolePortalTabText: {
    fontSize: 12,
    color: '#64748B',
  },
  rolePortalTabTextActive: {
    color: designTokens.color.brand.blue,
  },
});
