import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { router } from 'expo-router';
import { AppFrame } from '../components/AppFrame';
import { Logo, Wordmark } from '../components/Logo';
import { Button } from '../components/Button';
import { useTokens } from '../theme/ThemeProvider';

// S1 — Sign In (phone + OTP). Auth is mocked: "Send OTP" just routes to /(tabs).
export default function SignIn() {
  const T = useTokens();
  const [phone, setPhone] = React.useState('12-345 6789');

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
          <Text style={{ fontSize: 14, color: T.muted, marginBottom: 28 }}>
            Enter your registered phone number to receive a one-time code.
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
              placeholderTextColor={T.mutedLight}
              style={{
                flex: 1, paddingHorizontal: 14, paddingVertical: 14,
                fontSize: 17, fontWeight: '500', color: T.text, letterSpacing: 0.3,
              }}
            />
          </View>

          <View style={{ marginTop: 20 }}>
            <Button full onPress={() => router.replace('/(tabs)')}>Send OTP</Button>
          </View>

          <View style={{ marginTop: 22, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: T.muted }}>
              Having trouble?{' '}
              <Text style={{ color: T.text, fontWeight: '600', textDecorationLine: 'underline' }}>
                Contact your dispatcher
              </Text>
            </Text>
          </View>
        </View>

        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: T.mutedLight, letterSpacing: 0.4 }}>
            v0.1.0 · Continental Limo Services
          </Text>
        </View>
      </View>
    </AppFrame>
  );
}
