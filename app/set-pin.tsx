import React from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { AppFrame } from '../components/AppFrame';
import { Logo, Wordmark } from '../components/Logo';
import { Button } from '../components/Button';
import { useTokens } from '../theme/ThemeProvider';
import { completeDriverPinSetup, signOut } from '../lib/auth';

const APP_VERSION = Constants.expoConfig?.version ?? '';

// S1a — Set PIN. Reached after a successful sign-in when the driver is still
// on the dispatcher-issued temp PIN (drivers.pin_set = false). On success
// the driver is routed to /(tabs). On expired-temp-PIN the screen becomes a
// dead-end with a single "Sign out" affordance — recovery is dispatcher-only.
export default function SetPin() {
  const T = useTokens();
  const [pin, setPin] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expired, setExpired] = React.useState(false);

  const sixDigits  = /^[0-9]{6}$/.test(pin);
  const matches    = pin === confirm;
  const canSubmit  = sixDigits && matches && !submitting && !expired;
  const mismatch   = confirm.length === 6 && !matches;

  async function onSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    const result = await completeDriverPinSetup(pin);
    setSubmitting(false);
    if (result.ok) {
      // Defer one frame so the current React commit (form unmount, keyboard
      // dismiss) finishes before the route transition starts. Combined with
      // animation: 'none' on the Stack screen, this stops the Fabric race
      // first captured in Sentry on 2026-05-20.
      setTimeout(() => router.replace('/'), 0);
      return;
    }
    if (result.reason === 'expired') {
      setExpired(true);
      setError(result.message);
      return;
    }
    setError(result.message);
  }

  async function onSignOut() {
    await signOut();
    router.replace('/sign-in');
  }

  return (
    <AppFrame bg={T.surface}>
      <View style={{
        flex: 1, paddingHorizontal: 28, paddingTop: 64, paddingBottom: 40,
        justifyContent: 'space-between',
      }}>
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <Logo size={56}/>
            <Wordmark size={32}/>
          </View>
          <Text style={{
            fontSize: 13, color: T.muted, fontWeight: '600',
            letterSpacing: 2.4, textTransform: 'uppercase',
          }}>Driver</Text>
        </View>

        <View>
          <Text style={{
            fontSize: 22, fontWeight: '700', color: T.text,
            letterSpacing: -0.4, marginBottom: 6,
          }}>{expired ? 'Temporary PIN expired' : 'Choose your PIN'}</Text>
          <Text style={{ fontSize: 14, color: T.muted, marginBottom: 24, lineHeight: 20 }}>
            {expired
              ? 'Your temporary PIN is no longer valid. Ask your dispatcher to issue a new one, then sign in again.'
              : 'You\'ll use this 6-digit PIN every time you sign in. Pick something only you know.'}
          </Text>

          {!expired && (
            <>
              <Text style={{
                fontSize: 12, fontWeight: '600', color: T.muted, marginBottom: 8,
                letterSpacing: 0.3, textTransform: 'uppercase',
              }}>New PIN</Text>
              <PinInput value={pin} onChange={setPin} T={T} autoFocus/>

              <View style={{ height: 16 }}/>

              <Text style={{
                fontSize: 12, fontWeight: '600', color: T.muted, marginBottom: 8,
                letterSpacing: 0.3, textTransform: 'uppercase',
              }}>Confirm PIN</Text>
              <PinInput value={confirm} onChange={setConfirm} T={T}/>

              {mismatch && (
                <Text style={{ fontSize: 13, color: T.red, marginTop: 8 }}>
                  PINs don&apos;t match.
                </Text>
              )}
            </>
          )}

          {error && (
            <Text style={{ fontSize: 13, color: T.red, marginTop: 12 }}>
              {error}
            </Text>
          )}

          <View style={{ marginTop: 20 }}>
            {expired ? (
              <Button full onPress={onSignOut}>Sign out</Button>
            ) : (
              <View style={{ opacity: canSubmit ? 1 : 0.5 }}>
                <Button full onPress={onSubmit}>
                  {submitting ? <ActivityIndicator color="#fff"/> : 'Save PIN'}
                </Button>
              </View>
            )}
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

// Local PIN input — single 6-digit field with monospaced letter-spacing for
// the dots/digits effect. Same shape on sign-in and set-pin so the user gets
// the same muscle memory.
function PinInput({
  value, onChange, T, autoFocus,
}: { value: string; onChange: (v: string) => void; T: ReturnType<typeof useTokens>; autoFocus?: boolean }) {
  return (
    <View style={{
      borderWidth: 1.5, borderColor: T.border, borderRadius: 8,
      backgroundColor: T.surface,
    }}>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        placeholder="••••••"
        placeholderTextColor={T.mutedLight}
        maxLength={6}
        secureTextEntry
        autoFocus={autoFocus}
        style={{
          paddingHorizontal: 14, paddingVertical: 14,
          fontSize: 22, fontWeight: '600', color: T.text,
          letterSpacing: 12, textAlign: 'center',
        }}
      />
    </View>
  );
}
