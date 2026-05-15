import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { AppFrame } from '../../components/AppFrame';
import { AppHeader, SectionLabel } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { useTokens, useThemeControls } from '../../theme/ThemeProvider';
import { DRIVER, TIME_OFF } from '../../data/mock';

const MONO = 'ui-monospace, Menlo, Monaco, "Courier New", monospace';

export default function Profile() {
  const T = useTokens();
  const { preference, setPreference } = useThemeControls();

  return (
    <AppFrame>
      <AppHeader title="Profile"/>

      {/* Identity card */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 20 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32, backgroundColor: T.heroBg,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: T.heroFg, fontSize: 22, fontWeight: '700', letterSpacing: 0.5 }}>
              {DRIVER.initials}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: T.text, letterSpacing: -0.4 }}>
              {DRIVER.name}
            </Text>
            <Text style={{ fontSize: 13, color: T.muted, marginTop: 2, fontFamily: MONO }}>
              {DRIVER.phone}
            </Text>
            <View style={{
              alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 8, paddingVertical: 3,
              borderRadius: 9999, backgroundColor: T.doneBg,
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }}>
              <Icon name="checkCirc" size={11} color={T.doneFg}/>
              <Text style={{ fontSize: 11, fontWeight: '700', color: T.doneFg, letterSpacing: 0.3 }}>
                ACTIVE · ON SHIFT
              </Text>
            </View>
          </View>
        </Card>
      </View>

      <SectionLabel>Driver info</SectionLabel>
      <Card style={{ marginHorizontal: 16, marginBottom: 18, overflow: 'hidden' }}>
        <InfoRow k="License class"   v={DRIVER.licenseClass}/>
        <InfoRow k="Organisation"    v={DRIVER.org}/>
        <InfoRow k="Vehicle assigned" v={DRIVER.vehicle} last/>
      </Card>

      <SectionLabel
        right={
          <Pressable
            onPress={() => router.push('/profile/time-off')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Icon name="plus" size={14} color={T.primary}/>
            <Text style={{ fontSize: 13, color: T.primary, fontWeight: '700' }}>Request Time Off</Text>
          </Pressable>
        }
      >Time Off</SectionLabel>
      <Card style={{ marginHorizontal: 16, marginBottom: 18, paddingHorizontal: 16, paddingVertical: 14 }}>
        {TIME_OFF.map((t, i) => (
          <View key={t.id} style={{
            paddingVertical: 8,
            flexDirection: 'row', alignItems: 'center', gap: 12,
            borderBottomWidth: i < TIME_OFF.length - 1 ? 1 : 0,
            borderBottomColor: T.border,
          }}>
            <View style={{
              width: 4, height: 32, borderRadius: 2,
              backgroundColor: t.status === 'pending' ? T.pendingDot : T.doneDot,
            }}/>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: T.text }}>{t.range}</Text>
              <Text style={{ fontSize: 12, color: T.muted }}>
                {t.days} days · {t.reason}
              </Text>
            </View>
            <View style={{
              paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9999,
              backgroundColor: t.status === 'pending' ? T.pendingBg : T.doneBg,
            }}>
              <Text style={{
                fontSize: 11, fontWeight: '700', letterSpacing: 0.3,
                color: t.status === 'pending' ? T.pendingFg : T.doneFg,
              }}>{t.status === 'pending' ? 'PENDING' : 'APPROVED'}</Text>
            </View>
          </View>
        ))}
      </Card>

      <SectionLabel>Appearance</SectionLabel>
      <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
        <Text style={{ fontSize: 11, color: T.mutedLight, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Theme
        </Text>
        <View style={{ flexDirection: 'row', backgroundColor: T.raised, borderRadius: 8, padding: 4, marginTop: 8 }}>
          {(['system', 'light', 'dark'] as const).map(p => {
            const sel = p === preference;
            return (
              <Pressable
                key={p}
                onPress={() => setPreference(p)}
                style={{
                  flex: 1, paddingVertical: 9, borderRadius: 6, alignItems: 'center',
                  backgroundColor: sel ? T.surface : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 13, fontWeight: sel ? '700' : '500',
                  color: sel ? T.text : T.muted,
                  textTransform: 'capitalize',
                }}>{p}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View style={{ marginHorizontal: 16, marginVertical: 24, alignItems: 'center' }}>
        <Pressable onPress={() => router.replace('/sign-in')}>
          <Text style={{ fontSize: 15, color: T.red, fontWeight: '700' }}>Sign Out</Text>
        </Pressable>
      </View>
    </AppFrame>
  );
}

function InfoRow({ k, v, last }: { k: string; v: string; last?: boolean }) {
  const T = useTokens();
  return (
    <View style={{
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: T.border,
    }}>
      <Text style={{
        fontSize: 11, color: T.mutedLight, fontWeight: '700',
        letterSpacing: 0.5, textTransform: 'uppercase',
      }}>{k}</Text>
      <Text style={{ fontSize: 15, fontWeight: '600', color: T.text, marginTop: 3 }}>{v}</Text>
    </View>
  );
}
