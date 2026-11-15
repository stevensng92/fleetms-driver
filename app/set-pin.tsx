import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
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
import { TABULAR, fontFor, space, type } from '../theme/tokens';
import { completeDriverPinSetup, signOut } from '../lib/auth';
import { pinDigits } from '../lib/phone';

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
      // The card's own line says it; a red band with the same words would be a second copy.
      setExpired(true);
      return;
    }
    setError(result.message);
  }

  async function onSignOut() {
    await signOut();
    router.replace('/sign-in');
  }

  return (
    <AppFrame>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingBottom: space[6] }}>
        <View style={{ paddingHorizontal: space[6], paddingTop: space[6], gap: space[1] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Logo size={40}/>
            <Wordmark size={20}/>
          </View>
          <Text style={[type.body, { color: T.text2, paddingLeft: 40 + space[3] }]}>Driver</Text>
        </View>

        <View style={{ paddingHorizontal: space[4], paddingVertical: space[5] }}>
          <Card style={{ paddingVertical: space[6], paddingHorizontal: space[5], gap: space[5] }}>
            <View style={{ gap: space[2] }}>
              <Text style={[type.figure, { color: T.text }]}>
                {expired ? 'Temporary PIN expired' : 'Choose your PIN'}
              </Text>
              <Text style={[type.body, { color: T.text2 }]}>
                {expired
                  ? 'Your temporary PIN is no longer valid. Ask your dispatcher to issue a new one, then sign in again.'
                  : "You'll use this 6-digit PIN every time you sign in. Pick something only you know."}
              </Text>
            </View>

            <View style={{ gap: space[4] }}>
              {!expired && (
                <>
                  <FormField label="New PIN">
                    <PinInput value={pin} onChange={setPin} autoFocus/>
                  </FormField>

                  <FormField label="Confirm PIN" error={mismatch ? "PINs don't match." : undefined}>
                    <PinInput value={confirm} onChange={setConfirm} invalid={mismatch}/>
                  </FormField>
                </>
              )}

              {error && <Band tone="red">{error}</Band>}

              {expired ? (
                <Button full size="lg" onPress={onSignOut}>Sign out</Button>
              ) : (
                <Button full size="lg" disabled={!canSubmit} onPress={onSubmit}>
                  {submitting ? <ActivityIndicator color={T.onInk}/> : 'Save PIN'}
                </Button>
              )}
            </View>
          </Card>
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

// Local PIN input: single 6-digit field with letter-spacing for the dots/digits
// effect. Same shape on sign-in and set-pin so the user gets the same muscle memory.
function PinInput({
  value, onChange, autoFocus, invalid,
}: { value: string; onChange: (v: string) => void; autoFocus?: boolean; invalid?: boolean }) {
  return (
    <Input
      value={value}
      onChangeText={(t) => onChange(pinDigits(t))}
      keyboardType="number-pad"
      placeholder="••••••"
      maxLength={6}
      secureTextEntry
      autoFocus={autoFocus}
      invalid={invalid}
      style={[TABULAR, { fontFamily: fontFor('600'), fontWeight: '600', letterSpacing: space[1], textAlign: 'center' }]}
    />
  );
}
