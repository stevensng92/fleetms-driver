import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { useTokens } from '../theme/ThemeProvider';

const DOWNLOAD_URL = 'https://app.fleetms.my/driver-app';

type Props = {
  currentVersion: string;
  minimumVersion: string | null;
};

// Full-screen, non-dismissible hard block. Replaces the ENTIRE app shell
// (including the sign-in screen) when the installed build is below
// minimum_version — there is no back button, no close affordance, and no
// route out of this screen other than updating. Rendered directly from
// app/_layout.tsx, outside the normal Stack, so it can't be navigated away
// from.
export function UpdateRequiredScreen({ currentVersion, minimumVersion }: Props) {
  const T = useTokens();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.page }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>
        <View style={{ alignItems: 'center' }}>
          <View style={{
            width: 88, height: 88, borderRadius: 44,
            backgroundColor: T.redSoft,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
          }}>
            <Icon name="x" size={40} stroke={2.4} color={T.red}/>
          </View>

          <Text style={{
            fontSize: 24, fontWeight: '700', color: T.text,
            letterSpacing: -0.5, textAlign: 'center', marginBottom: 10,
          }}>
            Update required
          </Text>

          <Text style={{
            fontSize: 15, color: T.muted, textAlign: 'center',
            lineHeight: 22, marginBottom: 28, maxWidth: 320,
          }}>
            This version of FleetMS Driver is no longer supported. Please update the app to keep using it.
          </Text>

          <View style={{
            width: '100%', maxWidth: 320,
            backgroundColor: T.redSoft, borderRadius: 12,
            borderWidth: 1, borderColor: T.red,
            paddingHorizontal: 16, paddingVertical: 14,
            marginBottom: 24,
          }}>
            <Row label="Your version" value={currentVersion} fg={T.redFg}/>
            <View style={{ height: 8 }}/>
            <Row label="Required version" value={minimumVersion ?? '—'} fg={T.redFg}/>
          </View>

          <Pressable
            onPress={() => { Linking.openURL(DOWNLOAD_URL); }}
            style={({ pressed }) => ({
              width: '100%', maxWidth: 320,
              backgroundColor: T.red, borderRadius: 12,
              paddingVertical: 15, alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
              Update Now
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, fg }: { label: string; value: string; fg: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13, color: fg, fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 13, color: fg, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}
