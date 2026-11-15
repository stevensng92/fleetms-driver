import React from 'react';
import { View, Text, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { Button } from './Button';
import { Card } from './Card';
import { useTokens } from '../theme/ThemeProvider';
import { TABULAR, fontFor, radius, space, type } from '../theme/tokens';

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
// from. A routine update reads as a calm card, not an error (no red).
export function UpdateRequiredScreen({ currentVersion, minimumVersion }: Props) {
  const T = useTokens();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.ground }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[4] }}>
        <Card style={{ paddingVertical: space[6], paddingHorizontal: space[5], gap: space[5], alignItems: 'center' }}>
          <View style={{
            width: 64, height: 64, borderRadius: radius.pill,
            backgroundColor: T.surfaceSunk,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="download" size={28} stroke={2} color={T.text}/>
          </View>

          <View style={{ gap: space[2], alignItems: 'center' }}>
            <Text style={[type.figure, { color: T.text, textAlign: 'center' }]}>
              Update required
            </Text>
            <Text style={[type.body, { color: T.text2, textAlign: 'center' }]}>
              This version of FleetMS Driver is no longer supported. Update the app to keep using it.
            </Text>
          </View>

          <View style={{
            width: '100%', gap: space[2],
            backgroundColor: T.surfaceSunk, borderRadius: radius.md,
            paddingHorizontal: space[4], paddingVertical: space[3],
          }}>
            <Row label="Your version" value={currentVersion}/>
            <Row label="Required version" value={minimumVersion ?? '—'}/>
          </View>

          <Button full size="lg" onPress={() => { Linking.openURL(DOWNLOAD_URL); }}>
            Update now
          </Button>
        </Card>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const T = useTokens();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={[type.label, { color: T.text2 }]}>{label}</Text>
      <Text style={[type.label, TABULAR, { color: T.text, fontFamily: fontFor('600'), fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}
