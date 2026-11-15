import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../components/Button';
import { Icon, IconName } from '../../components/Icon';
import { FormField } from '../../components/FormField';
import { Input } from '../../components/Input';
import { Segmented } from '../../components/Segmented';
import { Sheet } from '../../components/Sheet';
import { Pill } from '../../components/Pill';
import { useTokens } from '../../theme/ThemeProvider';
import { fontFor, radius, space, TABULAR, type } from '../../theme/tokens';
import { useMyVehicles } from '../../lib/queries/vehicles';
import { useLogExpense } from '../../lib/mutations/logExpense';
import type { ExpenseCategory } from '../../lib/queries/expenses';
import { formatDateLong, myDateKey } from '../../lib/timeFormat';
import { amountValue, checkExpense, checkReceiptFile, receiptFileOf, vehicleOptionLine } from '../../lib/expenses';

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
  const [amountFocused, setAmountFocused] = useState(false);
  // Messages sit under their field. A pop-up hides the form it is about.
  const [errors, setErrors] = useState<{ amount?: string; vehicle?: string; receipt?: string }>({});

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

  // Both derived from the same Malaysian instant, so the date shown and the
  // date stored can never disagree. They used to: the label was device-local
  // while the stored value came from toISOString(), which is UTC, so between
  // 00:00 and 08:00 MY a driver saw one day and filed the expense on the day
  // before, pushing it into the wrong month at a period boundary.
  const now = new Date();
  const todayLocal = formatDateLong(now);
  const todayIso = myDateKey(now);

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
      const asset = result.assets[0];
      // Checked here, on the file the driver chose, before the upload step
      // shrinks it to a JPEG and hides what it was.
      const problem = checkReceiptFile(receiptFileOf(asset));
      if (problem) {
        setErrors(x => ({ ...x, receipt: problem }));
        return;
      }
      setErrors(x => ({ ...x, receipt: undefined }));
      setReceiptUri(asset.uri);
    }
  }

  function showReceiptOptions() {
    if (receiptUri) {
      Alert.alert('Receipt photo', undefined, [
        { text: 'Replace with camera',   onPress: () => pickReceipt('camera') },
        { text: 'Replace from library',  onPress: () => pickReceipt('library') },
        { text: 'Remove',                style: 'destructive', onPress: () => { setReceiptUri(null); setErrors(x => ({ ...x, receipt: undefined })); } },
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
    const found = checkExpense(amount, vehicleId);
    if (found.amount || found.vehicle) {
      setErrors({ amount: found.amount, vehicle: found.vehicle });
      return;
    }
    const num = amountValue(amount);
    if (num === null || !vehicleId) return;
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
        paddingHorizontal: space[5], paddingVertical: space[3],
        borderBottomWidth: 1, borderBottomColor: T.hairline,
      }}>
        <Text style={[type.heading, { color: T.text }]}>
          Log expense
        </Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            width: 36, height: 36, borderRadius: radius.pill, backgroundColor: T.track,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="x" size={16} color={T.text2}/>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[5], gap: space[5] }}>
        <FormField label="Category">
          <Segmented
            block
            options={CATS.map(c => ({ value: c.value, label: c.label }))}
            value={cat}
            onChange={setCat}
          />
        </FormField>

        <FormField label="Amount" error={errors.amount}>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: T.surfaceSunk, borderRadius: radius.md, borderWidth: 2,
            borderColor: errors.amount ? T.red : amountFocused ? T.ink : 'transparent',
            paddingLeft: space[4],
          }}>
            <Text style={[type.title, { color: T.text2, marginRight: space[2] }]}>RM</Text>
            <Input
              value={amount}
              onChangeText={(t) => { setAmount(t); if (errors.amount) setErrors(x => ({ ...x, amount: undefined })); }}
              invalid={!!errors.amount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              onFocus={() => setAmountFocused(true)}
              onBlur={() => setAmountFocused(false)}
              style={[type.figure, TABULAR, {
                flex: 1, height: 52, borderWidth: 0, backgroundColor: 'transparent',
                paddingHorizontal: 0, color: T.text,
              }]}
            />
          </View>
        </FormField>

        <FormField label="Date" hint="Expenses are always logged for today.">
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: space[2],
            minHeight: 44, paddingHorizontal: space[5], borderRadius: radius.pill,
            backgroundColor: T.surfaceSunk,
          }}>
            <Icon name="calendar" size={18} color={T.text3}/>
            <Text style={[type.body, { color: T.text }]}>{todayLocal}</Text>
          </View>
        </FormField>

        <FormField label="Vehicle" error={errors.vehicle}>
          <Pressable
            onPress={() => setShowVehiclePicker(true)}
            disabled={vehiclesLoading}
            accessibilityRole="button"
            style={{
              flexDirection: 'row', alignItems: 'center', gap: space[2],
              minHeight: 44, paddingHorizontal: space[5], borderRadius: radius.pill,
              backgroundColor: T.surface, borderWidth: 1, borderColor: errors.vehicle ? T.red : T.controlRing,
              boxShadow: T.shadow1,
            }}
          >
            <Icon name="car" size={18} color={T.text3}/>
            <Text style={[type.body, { flex: 1, color: T.text }]} numberOfLines={1}>
              {vehiclesLoading
                ? 'Loading…'
                : selectedVehicle
                  ? selectedVehicle.plateNumber
                  : 'Pick vehicle'}
            </Text>
            <Icon name="chevDown" size={18} color={T.text3}/>
          </Pressable>
        </FormField>

        <FormField label="Receipt photo" error={errors.receipt}>
          <Pressable
            onPress={showReceiptOptions}
            accessibilityRole="button"
            style={{
              borderRadius: radius.md, overflow: 'hidden', alignItems: 'center',
              ...(receiptUri
                ? {}
                : {
                    backgroundColor: T.surfaceSunk, borderWidth: 2, borderColor: T.controlRing,
                    paddingVertical: space[5], paddingHorizontal: space[4], gap: space[1],
                  }),
            }}
          >
            {receiptUri ? (
              <Image source={{ uri: receiptUri }} style={{ width: '100%', height: 200 }} resizeMode="cover"/>
            ) : (
              <>
                <View style={{
                  width: 44, height: 44, borderRadius: radius.pill, backgroundColor: T.surface,
                  alignItems: 'center', justifyContent: 'center', marginBottom: space[1],
                }}>
                  <Icon name="camera" size={22} color={T.text2}/>
                </View>
                <Text style={[type.body, { fontFamily: fontFor('600'), fontWeight: '600', color: T.text }]}>Take photo or upload</Text>
                <Text style={[type.caption, { color: T.text2 }]}>JPG or PNG, up to 10 MB</Text>
              </>
            )}
          </Pressable>
        </FormField>

        <FormField label="Notes (optional)">
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Plus highway, KL–Seremban"
          />
        </FormField>
      </ScrollView>

      <View style={{
        flexDirection: 'row', gap: space[3],
        paddingHorizontal: space[5], paddingVertical: space[4], paddingBottom: 30,
        borderTopWidth: 1, borderTopColor: T.hairline, backgroundColor: T.surface,
      }}>
        <Button variant="secondary" style={{ flex: 1 }} onPress={() => router.back()} >
          Cancel
        </Button>
        <Button style={{ flex: 2 }} onPress={onSave}>
          {logExpense.isPending ? 'Saving…' : 'Save expense'}
        </Button>
      </View>

      <VehicleSheet
        visible={showVehiclePicker}
        vehicles={vehicles ?? []}
        selectedId={vehicleId}
        onPick={id => { setVehicleId(id); setErrors(x => ({ ...x, vehicle: undefined })); setShowVehiclePicker(false); }}
        onClose={() => setShowVehiclePicker(false)}
      />
    </SafeAreaView>
  );
}

function VehicleSheet({
  visible, vehicles, selectedId, onPick, onClose,
}: {
  visible: boolean;
  vehicles: { id: string; plateNumber: string; type: string; model: string | null; isDefault: boolean }[];
  selectedId: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const T = useTokens();
  return (
    <Sheet visible={visible} onClose={onClose} title="Pick vehicle">
      {vehicles.length === 0 ? (
        <View style={{ padding: space[5], alignItems: 'center' }}>
          <Text style={[type.label, { color: T.text2 }]}>
            No active vehicles in your org.
          </Text>
        </View>
      ) : (
        <ScrollView style={{ maxHeight: 360 }}>
          {vehicles.map(v => {
            const sel = v.id === selectedId;
            return (
              <Pressable
                key={v.id}
                onPress={() => onPick(v.id)}
                accessibilityRole="button"
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: space[2], paddingVertical: space[3], minHeight: 60,
                  borderRadius: radius.sm,
                  backgroundColor: sel ? T.surfaceSunk : 'transparent',
                }}
              >
                <View style={{ flex: 1, gap: space[1] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                    <Text style={[type.title, { color: T.text }]}>
                      {v.plateNumber}
                    </Text>
                    {v.isDefault && <Pill tone="neutral">Default</Pill>}
                  </View>
                  <Text style={[type.caption, { color: T.text2 }]}>
                    {vehicleOptionLine(v)}
                  </Text>
                </View>
                {sel && <Icon name="check" size={20} stroke={2.6} color={T.text}/>}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </Sheet>
  );
}
