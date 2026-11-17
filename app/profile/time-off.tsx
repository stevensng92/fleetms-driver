import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Band } from '../../components/Band';
import { FormField } from '../../components/FormField';
import { Input } from '../../components/Input';
import { useTokens } from '../../theme/ThemeProvider';
import { FONT, fontFor, radius, space, type } from '../../theme/tokens';
import { useRequestTimeOff } from '../../lib/mutations/timeOff';
import type { TimeOffReason } from '../../lib/queries/timeOff';
import { formatDate, myDateKey, myStartOfDay } from '../../lib/timeFormat';
import { errorWords } from '../../lib/errorWords';
import { dayCount, MISSING_DAY_MESSAGE, pickDay, requestNote, type DayRange } from '../../lib/timeOff';

// S8b — Request Time Off. Inline calendar picker → reason → notes → submit.
//
// Range semantics: both endpoints INCLUSIVE in the UI ("17 to 19 May = 3 days").
// The mutation converts to the schema's half-open range internally.
//
// Tap behaviour (change 24): one tap is a one-day request. A second tap on a
// later day makes it the last day; any other tap starts again (lib/timeOff.ts,
// pickDay). Submit is always on: with no day picked it says what is missing.

const REASONS: { key: TimeOffReason; label: string; help: string }[] = [
  { key: 'leave',    label: 'Leave',    help: 'Planned paid leave' },
  { key: 'mc',       label: 'MC',       help: 'Medical certificate' },
  { key: 'off_duty', label: 'Off duty', help: 'Rest day or personal' },
];

// Calendar keys are MALAYSIAN calendar days, matching lib/timeFormat.ts and the
// range this screen ultimately submits. The parse/format round-trip used to be
// device-local at both ends — self-consistent, so the marking loop worked, but
// `today` below was then the DEVICE's today, which on a phone outside MY offers
// the driver the wrong first selectable day.
const myMidnight = (key: string) => `${key}T00:00:00+08:00`;

// "5 Mar 2030": the day not padded, as the mock writes it. The key is a calendar
// day, so it is read as that Malaysian day rather than put through the device zone.
const formatDay = (key: string) => `${formatDate(myMidnight(key))} ${key.slice(0, 4)}`;

export default function TimeOff() {
  const T = useTokens();
  const today = myDateKey(new Date());

  const [range, setRange]       = useState<DayRange>({ start: null, end: null });
  const [missing, setMissing]     = useState<string | null>(null);
  const { start: startDate, end: endDate } = range;
  const [reason, setReason]       = useState<TimeOffReason>('leave');
  const [notes, setNotes]         = useState('');

  const mutate = useRequestTimeOff();

  function onDayPress(day: DateData) {
    setMissing(null);
    setRange((r) => pickDay(r, day.dateString));
  }

  // Build the `markedDates` map react-native-calendars expects for the period
  // marking style. We highlight start, end, and every in-between day.
  const markedDates = useMemo(() => {
    if (!startDate || !endDate) return {};
    const marks: Record<string, object> = {};
    const final = endDate;
    // Step by MY day index rather than mutating with setDate(), which walks in
    // the DEVICE's local terms and would jump 23 or 25 hours across a DST
    // transition on phones in zones that observe one.
    const total = dayCount(startDate, final);
    for (let i = 0; i < total; i++) {
      const key = myDateKey(myStartOfDay(myMidnight(startDate), i));
      const isStart = key === startDate;
      const isEnd   = key === final;
      marks[key] = {
        startingDay: isStart,
        endingDay:   isEnd,
        color:       T.ink,
        textColor:   T.onInk,
      };
    }
    return marks;
  }, [startDate, endDate, T.ink, T.onInk]);

  const note = requestNote(range);

  async function onSubmit() {
    if (mutate.isPending) return;
    if (!startDate || !endDate) {
      setMissing(MISSING_DAY_MESSAGE);
      return;
    }
    try {
      await mutate.mutateAsync({ startDate, endDate, reason, notes });
      router.back();
    } catch (err) {
      Alert.alert('Request failed', errorWords(err));
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: T.surface }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: space[5], paddingVertical: space[3],
        borderBottomWidth: 1, borderBottomColor: T.hairline,
      }}>
        <Text style={[type.heading, { color: T.text }]}>
          Request time off
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

      <ScrollView contentContainerStyle={{ padding: space[5], gap: space[4] }}>
        {/* Selected range summary */}
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          {[
            ['Start date', startDate ? formatDay(startDate) : '—'],
            ['End date',   endDate ? formatDay(endDate) : '—'],
          ].map(([k, v]) => (
            <View key={k} style={{
              flex: 1, gap: space[1], paddingVertical: space[3], paddingHorizontal: space[4],
              borderRadius: radius.md, backgroundColor: T.surfaceSunk,
            }}>
              <Text style={[type.label, { color: T.text2 }]}>{k}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 24 }}>
                <Icon name="calendar" size={16} color={T.text3}/>
                <Text style={[type.body, { fontFamily: fontFor('600'), fontWeight: '600', color: T.text }]}>{v}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Inline calendar */}
        <View style={{
          borderRadius: radius.lg, overflow: 'hidden', backgroundColor: T.surface,
          boxShadow: T.shadow1, padding: space[2],
        }}>
          <Calendar
            minDate={today}
            markingType="period"
            markedDates={markedDates}
            onDayPress={onDayPress}
            theme={{
              backgroundColor:     T.surface,
              calendarBackground:  T.surface,
              dayTextColor:        T.text,
              monthTextColor:      T.text,
              textSectionTitleColor: T.text3,
              textDisabledColor:   T.text3,
              arrowColor:          T.ink,
              todayTextColor:      T.ink,
              textDayFontFamily:   FONT.medium,
              textMonthFontFamily: FONT.bold,
              textDayHeaderFontFamily: FONT.medium,
              textDayFontWeight:   '500',
              textMonthFontWeight: '700',
            }}
          />
        </View>

        {missing && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Icon name="circleAlert" size={14} color={T.redText}/>
            <Text accessibilityRole="alert" style={[type.caption, { color: T.redText, flexShrink: 1 }]}>{missing}</Text>
          </View>
        )}

        {/* Day count and the wait for approval */}
        {note && (
          <Band tone="amber" icon="calendarDays">
            {note}
          </Band>
        )}

        {/* Reason */}
        <FormField label="Reason">
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            {REASONS.map(r => {
              const sel = r.key === reason;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => setReason(r.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sel }}
                  style={{
                    flex: 1, paddingVertical: space[3], paddingHorizontal: space[2], borderRadius: radius.md,
                    borderWidth: 2, borderColor: sel ? T.ink : T.hairlineStrong,
                    backgroundColor: T.surface, alignItems: 'center', gap: 2,
                  }}
                >
                  <Text style={[type.body, { fontFamily: fontFor('600'), fontWeight: '600', color: T.text }]}>{r.label}</Text>
                  <Text style={[type.caption, { color: T.text2, textAlign: 'center' }]}>{r.help}</Text>
                </Pressable>
              );
            })}
          </View>
        </FormField>

        {/* Notes */}
        <FormField label="Notes (optional)">
          <Input
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="e.g. Family wedding in Penang"
          />
        </FormField>
      </ScrollView>

      {/* Footer */}
      <View style={{
        flexDirection: 'row', gap: space[3],
        paddingHorizontal: space[5], paddingVertical: space[4], paddingBottom: 30,
        borderTopWidth: 1, borderTopColor: T.hairline, backgroundColor: T.surface,
      }}>
        <Button variant="secondary" style={{ flex: 1 }} onPress={() => router.back()}>Cancel</Button>
        <View style={{ flex: 2 }}>
          <Button full onPress={onSubmit}>
            {mutate.isPending ? 'Submitting…' : 'Submit request'}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
