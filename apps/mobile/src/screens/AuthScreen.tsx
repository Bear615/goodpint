import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GoldButton } from '../components/GoldButton';
import { PressableScale } from '../components/Motion';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import { colors, font, radii, spacing } from '../theme';

type Mode = 'login' | 'signup';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  const submit = async () => {
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (isSignup && !name.trim()) {
      setError('Enter your name.');
      return;
    }
    if (isSignup && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (isSignup) {
        await signUp(trimmedEmail, password, name.trim());
      } else {
        await signIn(trimmedEmail, password);
      }
      // On success the AuthProvider flips status and this screen unmounts.
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Could not reach GoodPint. Check your connection and try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(isSignup ? 'login' : 'signup');
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <Text style={styles.brand}>Good</Text>
          <Text style={[styles.brand, styles.brandGold]}>Pint</Text>
        </View>
        <Text style={styles.tagline}>pints, points, plans</Text>

        <View style={styles.card}>
          <Text style={styles.title}>{isSignup ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={styles.subtitle}>
            {isSignup ? 'Join GoodPint to earn points on every round.' : 'Sign in to your GoodPint account.'}
          </Text>

          {isSignup ? (
            <View style={styles.field}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.textSubtle}
                autoCapitalize="words"
                testID="auth-name"
              />
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
              testID="auth-email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
              placeholderTextColor={colors.textSubtle}
              secureTextEntry
              testID="auth-password"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <GoldButton
            label={submitting ? '' : isSignup ? 'Create account' : 'Sign in'}
            onPress={submit}
            iconRight={submitting ? <ActivityIndicator color="#080808" /> : undefined}
            style={styles.submit}
            testID="auth-submit"
          />

          <PressableScale onPress={switchMode} style={styles.switch}>
            <Text style={styles.switchText}>
              {isSignup ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.switchTextGold}>{isSignup ? 'Sign in' : 'Sign up'}</Text>
            </Text>
          </PressableScale>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  brandRow: { flexDirection: 'row', justifyContent: 'center' },
  brand: { color: colors.text, fontFamily: font.bold, fontSize: 40, letterSpacing: 0.5 },
  brandGold: { color: colors.gold },
  tagline: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  title: { color: colors.text, fontFamily: font.bold, fontSize: 24 },
  subtitle: { color: colors.textMuted, fontFamily: font.regular, fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.lg },
  field: { marginBottom: spacing.md },
  label: { color: colors.textMuted, fontFamily: font.medium, fontSize: 13, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.panelRaised,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 16,
  },
  error: { color: colors.danger, fontFamily: font.regular, fontSize: 13, marginBottom: spacing.sm },
  submit: { marginTop: spacing.sm },
  switch: { alignItems: 'center', marginTop: spacing.lg },
  switchText: { color: colors.textMuted, fontFamily: font.regular, fontSize: 14 },
  switchTextGold: { color: colors.gold, fontFamily: font.medium },
});
