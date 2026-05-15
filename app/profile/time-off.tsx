import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useTokens } from '../../theme/ThemeProvider';

// S8b — Request Time Off (modal sheet).
export default function TimeOff() {
  const T = useTokens();
  const [reason, setReason] = useState('Family wedding in Penang');

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: T.surface }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: T.border,
      }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: T.text, letterSpacing: -0.4 }}>
          Request Time Off
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 32, height: 32, borderRadius: 16, backgroundColor: T.raised,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="x" size={16} color={T.muted}/>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          {[
            ['Start date', '17 May 2026'],
            ['End date',   '19 May 2026'],
          ].map(([k, v]) => (
            <View key={k} style={{ flex: 1 }}>
              <Text style={{
                fontSize: 12, fontWeight: '700', color: T.muted,
                letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
              }}>{k}</Text>
              <View style={{
                paddingHorizontal: 14, paddingVertical: 12,
                borderWidth: 1, borderColor: T.border, borderRadius: 8,
                flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface,
              }}>
                <Icon name="calendar" size={16} color={T.muted}/>
                <Text style={{ fontSize: 14, fontWeight: '600', color: T.text }}>{v}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{
          paddingHorizontal: 14, paddingVertical: 10,
          backgroundColor: T.amberSoft, borderWidth: 1, borderColor: T.amber,
          borderRadius: 8, marginBottom: 16,
          flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        }}>
          <Icon name="bell" size={14} color={T.amber}/>
          <Text style={{ flex: 1, fontSize: 12.5, color: T.amberFg, fontWeight: '500' }}>
            3 days requested · 1 job will need re-assignment.
          </Text>
        </View>

        <Text style={{
          fontSize: 12, fontWeight: '700', color: T.muted,
          letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
        }}>Reason (optional)</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          multiline
          style={{
            paddingHorizontal: 14, paddingVertical: 12, borderRadius: 8,
            borderWidth: 1, borderColor: T.border,
            fontSize: 14, color: T.text, backgroundColor: T.surface,
            minHeight: 70, textAlignVertical: 'top',
          }}
        />
      </ScrollView>

      <View style={{
        flexDirection: 'row', gap: 10,
        paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 30,
        borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.surface,
      }}>
        <Button variant="secondary" style={{ flex: 1 }} onPress={() => router.back()}>Cancel</Button>
        <Button style={{ flex: 2 }} onPress={() => router.back()}>Submit Request</Button>
      </View>
    </SafeAreaView>
  );
}
