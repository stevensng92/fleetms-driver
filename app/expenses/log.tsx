import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../components/Button';
import { Icon, IconName } from '../../components/Icon';
import { useTokens } from '../../theme/ThemeProvider';
import { useMyVehicles } from '../../lib/queries/vehicles';
import { useLogExpense } from '../../lib/mutations/logExpense';
import type { ExpenseCategory } from '../../lib/queries/expenses';

const MONO = 'ui-monospace, Menlo, Monaco, "Courier New", monospace';

const CATS: { value: ExpenseCategory; label: string; icon: IconName }[] = [
  { value: 'fuel',  label: 'Fuel',  icon: 'fuel' },
  { value: 'toll',  label: 'Toll',  icon: 'toll' },
  { value: 'other', label: 'Other', icon: 'dots' },
];

export default function LogExpense() {
  const T = useTokens();

  const [cat, setCat] = useState<ExpenseCategory>('fuel');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);

  const { data: vehicles, isLoading: vehiclesLoading } = useMyVehicles();
  const logExpense = useLogExpense();

  // Auto-select the default vehicle the first time the list lands.
  useEffect(() => {
    if (vehicleId || !vehicles?.length) return;
    const def = vehicles.find(v => v.isDefault) ?? vehicles[0];
    setVehicleId(def.id);
  }, [vehicles, vehicleId]);

  const selectedVehicle = useMemo(
    () => vehicles?.find(v => v.id === vehicleId) ?? null,
    [vehicles, vehicleId],
  );

  const todayLocal = new Date().toLocaleDateString('en-MY', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const todayIso = new Date().toISOString().slice(0, 10);

  async function pickReceipt(source: 'camera' | 'library') {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        source === 'camera' ? 'Allow camera access to take a receipt photo.' : 'Allow photo access to pick a receipt.',
      );
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.9, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
    }
  }

  function showReceiptOptions() {
    if (receiptUri) {
      Alert.alert('Receipt photo', undefined, [
        { text: 'Replace with camera',   onPress: () => pickReceipt('camera') },
        { text: 'Replace from library',  onPress: () => pickReceipt('library') },
        { text: 'Remove',                style: 'destructive', onPress: () => setReceiptUri(null) },
        { text: 'Cancel',                style: 'cancel' },
      ]);
    } else {
      Alert.alert('Add receipt', undefined, [
        { text: 'Take photo',  onPress: () => pickReceipt('camera') },
        { text: 'From library', onPress: () => pickReceipt('library') },
        { text: 'Cancel',       style: 'cancel' },
      ]);
    }
  }

  async function onSave() {
    const num = parseFloat(amount);
    if (!num || num <= 0) {
      Alert.alert('Amount required', 'Enter an amount greater than zero.');
      return;
    }
    if (!vehicleId) {
      Alert.alert('Vehicle required', 'Pick a vehicle for this expense.');
      return;
    }
    try {
      await logExpense.mutateAsync({
        category: cat,
        amount: num,
        expenseDate: todayIso,
        vehicleId,
        notes: notes.trim() || undefined,
        receiptUri,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Unknown error');
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: T.surface }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: T.border,
      }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: T.text, letterSpacing: -0.4 }}>
          Log Expense
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
        <Label>Category</Label>
        <View style={{ flexDirection: 'row', backgroundColor: T.raised, borderRadius: 8, padding: 4, marginBottom: 16 }}>
          {CATS.map(c => {
            const sel = c.value === cat;
            return (
              <Pressable
                key={c.value}
                onPress={() => setCat(c.value)}
                style={{
                  flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 6,
                  alignItems: 'center', gap: 4,
                  backgroundColor: sel ? T.surface : 'transparent',
                }}
              >
                <Icon name={c.icon} size={20} color={sel ? T.primary : T.mutedLight}/>
                <Text style={{ fontSize: 13, fontWeight: sel ? '700' : '500', color: sel ? T.text : T.muted }}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Label>Amount</Label>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          borderWidth: 1.5, borderColor: T.accent, borderRadius: 8,
          paddingHorizontal: 16, paddingVertical: 6, marginBottom: 16,
        }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: T.muted, marginRight: 10 }}>RM</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={T.mutedLight}
            style={{
              flex: 1, fontSize: 32, fontWeight: '800', color: T.text,
              letterSpacing: -1, fontFamily: MONO,
            }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Label>Date</Label>
            <View style={{
              paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: T.border,
              borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface,
            }}>
              <Icon name="calendar" size={16} color={T.muted}/>
              <Text style={{ fontSize: 15, fontWeight: '600', color: T.text }}>{todayLocal}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Label>Vehicle</Label>
            <Pressable
              onPress={() => setShowVehiclePicker(true)}
              disabled={vehiclesLoading || !vehicles?.length}
              style={{
                paddingHorizontal: 14, paddingVertical: 12, backgroundColor: T.surface,
                borderWidth: 1, borderColor: T.border,
                borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
              }}
            >
              <Icon name="car" size={16} color={T.muted}/>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: T.text }} numberOfLines={1}>
                {vehiclesLoading
                  ? 'Loading…'
                  : selectedVehicle
                    ? selectedVehicle.plateNumber
                    : 'Pick vehicle'}
              </Text>
              <Icon name="chevDown" size={14} color={T.muted}/>
            </Pressable>
          </View>
        </View>

        <Label>Receipt photo</Label>
        <Pressable
          onPress={showReceiptOptions}
          style={{
            borderWidth: receiptUri ? 0 : 2, borderStyle: 'dashed', borderColor: T.borderHard,
            borderRadius: 10, paddingVertical: receiptUri ? 0 : 20, alignItems: 'center',
            marginBottom: 16, overflow: 'hidden',
          }}
        >
          {receiptUri ? (
            <Image source={{ uri: receiptUri }} style={{ width: '100%', height: 200 }} resizeMode="cover"/>
          ) : (
            <>
              <View style={{
                width: 44, height: 44, borderRadius: 22, backgroundColor: T.raised,
                alignItems: 'center', justifyContent: 'center', marginBottom: 8,
              }}>
                <Icon name="camera" size={22} color={T.muted}/>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: T.text }}>Take photo or upload</Text>
              <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>JPG or PNG, up to 10 MB</Text>
            </>
          )}
        </Pressable>

        <Label>Notes (optional)</Label>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Plus highway, KL–Seremban"
          placeholderTextColor={T.mutedLight}
          style={{
            paddingHorizontal: 14, paddingVertical: 12, borderRadius: 8,
            borderWidth: 1, borderColor: T.border,
            fontSize: 14, color: T.text, backgroundColor: T.surface,
          }}
        />
      </ScrollView>

      <View style={{
        flexDirection: 'row', gap: 10,
        paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 30,
        borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.surface,
      }}>
        <Button variant="secondary" style={{ flex: 1 }} onPress={() => router.back()} >
          Cancel
        </Button>
        <Button style={{ flex: 2 }} onPress={onSave}>
          {logExpense.isPending ? 'Saving…' : 'Save Expense'}
        </Button>
      </View>

      {showVehiclePicker && (
        <VehicleSheet
          vehicles={vehicles ?? []}
          selectedId={vehicleId}
          onPick={id => { setVehicleId(id); setShowVehiclePicker(false); }}
          onClose={() => setShowVehiclePicker(false)}
        />
      )}
    </SafeAreaView>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  const T = useTokens();
  return (
    <Text style={{
      fontSize: 12, fontWeight: '700', color: T.muted,
      letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
    }}>
      {children}
    </Text>
  );
}

// Lightweight bottom-sheet replacement using absolute positioning. Avoids
// pulling in another nav layer just to pick a vehicle.
function VehicleSheet({
  vehicles, selectedId, onPick, onClose,
}: {
  vehicles: Array<{ id: string; plateNumber: string; type: string; model: string | null; isDefault: boolean }>;
  selectedId: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const T = useTokens();
  return (
    <View style={{ position: 'absolute', inset: 0 }}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: T.scrim }}/>
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: T.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingBottom: 30, maxHeight: '70%',
      }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: T.border }}/>
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', color: T.text, padding: 16 }}>
          Pick vehicle
        </Text>
        {vehicles.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator color={T.muted}/>
            <Text style={{ marginTop: 10, fontSize: 13, color: T.muted }}>
              No active vehicles in your org.
            </Text>
          </View>
        ) : (
          <ScrollView>
            {vehicles.map(v => {
              const sel = v.id === selectedId;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => onPick(v.id)}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 14,
                    borderTopWidth: 1, borderTopColor: T.border,
                    backgroundColor: sel ? T.raised : T.surface,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: T.text }}>
                        {v.plateNumber}
                      </Text>
                      {v.isDefault && (
                        <Text style={{
                          fontSize: 10, fontWeight: '700', color: T.primary,
                          letterSpacing: 0.5, textTransform: 'uppercase',
                          backgroundColor: T.accentSoft, paddingHorizontal: 6, paddingVertical: 2,
                          borderRadius: 4,
                        }}>
                          Default
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                      {v.type}{v.model ? ` · ${v.model}` : ''}
                    </Text>
                  </View>
                  {sel && <Icon name="check" size={18} color={T.primary}/>}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
