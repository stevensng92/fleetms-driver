import React from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { AppFrame } from '../components/AppFrame';
import { Logo, Wordmark } from '../components/Logo';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Band } from '../components/Band';
import { FormField } from '../components/FormField';
import { Input } from '../components/Input';
import { useTokens } from '../theme/ThemeProvider';
import { TABULAR, fontFor, radius, space, type } from '../theme/tokens';
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

  const [phoneFocused, setPhoneFocused] = React.useState(false);

  return (
    <AppFrame>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingBottom: space[6] }}>
        {/* Logo lockup: the mark and the name, with the plain word "Driver" under */}
        <View style={{ paddingHorizontal: space[6], paddingTop: space[6], gap: space[1] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Logo size={40}/>
            <Wordmark size={20}/>
          </View>
          <Text style={[type.body, { color: T.text2, paddingLeft: 40 + space[3] }]}>Driver</Text>
        </View>

        <View style={{ paddingHorizontal: space[4], paddingVertical: space[5], gap: space[4] }}>
          <Card style={{ paddingVertical: space[6], paddingHorizontal: space[5], gap: space[5] }}>
            <View style={{ gap: space[2] }}>
              <Text style={[type.figure, { color: T.text }]}>Sign in to start your shift</Text>
              <Text style={[type.body, { color: T.text2 }]}>
                Enter your registered phone number and 6-digit PIN.
              </Text>
            </View>

            <View style={{ gap: space[4] }}>
              <FormField label="Phone number">
                {/* The +60 prefix is plain text inside the field (change 8), not a flag. */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', height: 48,
                  backgroundColor: T.surfaceSunk, borderRadius: radius.md,
                  borderWidth: 2, borderColor: phoneFocused ? T.ink : 'transparent',
                  paddingHorizontal: space[4], gap: space[3],
                }}>
                  <Text style={{ fontFamily: fontFor('600'), fontWeight: '600', fontSize: 16, color: T.text2 }}>+60</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    onFocus={() => setPhoneFocused(true)}
                    onBlur={() => setPhoneFocused(false)}
                    keyboardType="phone-pad"
                    placeholder="12-345 6789"
                    placeholderTextColor={T.text3}
                    autoComplete="tel"
                    style={[TABULAR, {
                      flex: 1, height: '100%', padding: 0,
                      fontFamily: fontFor('500'), fontWeight: '500', fontSize: 16, color: T.text,
                    }]}
                  />
                </View>
              </FormField>

              <FormField label="PIN">
                <Input
                  value={pin}
                  onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  placeholder="••••••"
                  maxLength={6}
                  secureTextEntry
                  style={[TABULAR, { fontFamily: fontFor('600'), fontWeight: '600', letterSpacing: space[1], textAlign: 'center' }]}
                />
              </FormField>

              {error && <Band tone="red">{error}</Band>}

              <Button full size="lg" disabled={!canSubmit} onPress={onSubmit}>
                {submitting ? <ActivityIndicator color={T.onInk}/> : 'Sign in'}
              </Button>
            </View>
          </Card>

          <Text style={[type.body, { color: T.text2, textAlign: 'center', paddingHorizontal: space[2] }]}>
            Don&apos;t have a PIN, or forgot it?{'\n'}
            <Text style={{ color: T.text, fontFamily: fontFor('600'), fontWeight: '600' }}>
              Contact your dispatcher.
            </Text>
          </Text>
        </View>

        <View style={{ alignItems: 'center' }}>
          <Text style={[type.label, { color: T.text3 }]}>
            v{APP_VERSION}
          </Text>
        </View>
      </View>
    </AppFrame>
  );
}
