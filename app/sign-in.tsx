import React from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { AppFrame } from '../components/AppFrame';
import { Logo, Wordmark } from '../components/Logo';
import { Button } from '../components/Button';
import { useTokens } from '../theme/ThemeProvider';
import { signInWithPin, fetchDriverProfile } from '../lib/auth';

const APP_VERSION = Constants.expoConfig?.version ?? '';

// S1 — Sign In (phone + PIN). Replaces the WhatsApp OTP plan which was
// blocked on Meta WABA verification. See docs/driver-pin-auth.md in fleetms.
export default function SignIn() {
  const T = useTokens();
  const [phone, setPhone] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const digitCount = phone.replace(/\D/g, '').length;
  const canSubmit = digitCount >= 9 && digitCount <= 15 && pin.length === 6 && !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    const signIn = await signInWithPin(phone, pin);
    if (!signIn.ok) {
      setError(signIn.message);
      setSubmitting(false);
      return;
    }
    // Sanity check the driver record exists; the gate at "/" will decide
    // pinSet → /set-pin vs /(tabs) on its own.
    const profile = await fetchDriverProfile();
    setSubmitting(false);
    if (profile.kind === 'error') {
      // Transient — auth succeeded, downstream call failed. Don't burn the
      // session, let the user retry the gate by hitting Sign In again or
      // letting the gate retry on next cold start.
      setError('Signed in, but we couldn’t verify your account right now. Try again in a moment.');
      return;
    }
    if (profile.kind === 'no-row') {
      // Auth succeeded but no driver record — shouldn't happen in normal flow.
      setError('Signed in, but no driver record was found. Contact your dispatcher.');
      return;
    }
    // Defer one frame; combined with animation: 'none' on the Stack screen,
    // avoids the Fabric "child already has parent" race captured in Sentry
    // on 2026-05-20.
    setTimeout(() => router.replace('/'), 0);
  }

  return (
    <AppFrame bg={T.surface}>
      <View style={{
        flex: 1, paddingHorizontal: 28, paddingTop: 64, paddingBottom: 40,
        justifyContent: 'space-between',
      }}>
        {/* Logo lockup */}
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <Logo size={56}/>
            <Wordmark size={32}/>
          </View>
          <Text style={{
            fontSize: 13, color: T.muted, fontWeight: '600',
            letterSpacing: 2.4, textTransform: 'uppercase',
          }}>Driver</Text>
        </View>

        {/* Form */}
        <View>
          <Text style={{
            fontSize: 22, fontWeight: '700', color: T.text,
            letterSpacing: -0.4, marginBottom: 6,
          }}>Sign in to start your shift</Text>
          <Text style={{ fontSize: 14, color: T.muted, marginBottom: 24 }}>
            Enter your registered phone number and 6-digit PIN.
          </Text>

          <Text style={{
            fontSize: 12, fontWeight: '600', color: T.muted, marginBottom: 8,
            letterSpacing: 0.3, textTransform: 'uppercase',
          }}>Phone number</Text>

          <View style={{
            flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
            borderWidth: 1.5, borderColor: T.accent, borderRadius: 8,
            backgroundColor: T.surface,
            shadowColor: T.accent, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
            marginBottom: 16,
          }}>
            <View style={{
              paddingHorizontal: 14, paddingVertical: 14,
              borderRightWidth: 1, borderRightColor: T.border,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            }}>
              <Text style={{ fontSize: 16 }}>🇲🇾</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: T.text }}>+60</Text>
            </View>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="12-345 6789"
              placeholderTextColor={T.mutedLight}
              autoComplete="tel"
              style={{
                flex: 1, paddingHorizontal: 14, paddingVertical: 14,
                fontSize: 17, fontWeight: '500', color: T.text, letterSpacing: 0.3,
              }}
            />
          </View>

          <Text style={{
            fontSize: 12, fontWeight: '600', color: T.muted, marginBottom: 8,
            letterSpacing: 0.3, textTransform: 'uppercase',
          }}>PIN</Text>

          <View style={{
            borderWidth: 1.5, borderColor: T.border, borderRadius: 8,
            backgroundColor: T.surface, marginBottom: 6,
          }}>
            <TextInput
              value={pin}
              onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="••••••"
              placeholderTextColor={T.mutedLight}
              maxLength={6}
              secureTextEntry
              style={{
                paddingHorizontal: 14, paddingVertical: 14,
                fontSize: 22, fontWeight: '600', color: T.text,
                letterSpacing: 12, textAlign: 'center',
              }}
            />
          </View>

          {error && (
            <Text style={{ fontSize: 13, color: T.red, marginTop: 8 }}>
              {error}
            </Text>
          )}

          <View style={{ marginTop: 20 }}>
            <View style={{ opacity: canSubmit ? 1 : 0.5 }}>
              <Button full onPress={onSubmit}>
                {submitting ? <ActivityIndicator color="#fff"/> : 'Sign in'}
              </Button>
            </View>
          </View>

          <View style={{ marginTop: 22, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: T.muted, textAlign: 'center' }}>
              Don&apos;t have a PIN, or forgot it?{'\n'}
              <Text style={{ color: T.text, fontWeight: '600' }}>
                Contact your dispatcher.
              </Text>
            </Text>
          </View>
        </View>

        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: T.mutedLight, letterSpacing: 0.4 }}>
            v{APP_VERSION}
          </Text>
        </View>
      </View>
    </AppFrame>
  );
}
