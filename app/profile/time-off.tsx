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
import { formatDateKey, myDateKey, myStartOfDay } from '../../lib/timeFormat';

// S8b — Request Time Off. Inline calendar picker → reason → notes → submit.
//
// Range semantics: both endpoints INCLUSIVE in the UI ("17 to 19 May = 3 days").
// The mutation converts to the schema's half-open range internally.
//
// Tap behaviour: first tap = start, second tap = end (or new start if before
// current start). Third tap restarts.

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

function daysBetweenInclusive(start: string, end: string): number {
  // Both are exact MY midnights and Malaysia has no DST, so the day count is
  // exact rather than rounded-and-hoped.
  const s = myStartOfDay(myMidnight(start));
  const e = myStartOfDay(myMidnight(end));
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

// The key is already a calendar day, so format the string — putting it through
// a Date only invites a timezone onto a value that doesn't have one.
const formatDate = formatDateKey;

export default function TimeOff() {
  const T = useTokens();
  const today = myDateKey(new Date());

  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate]     = useState<string | null>(null);
  const [reason, setReason]       = useState<TimeOffReason>('leave');
  const [notes, setNotes]         = useState('');

  const mutate = useRequestTimeOff();

  function onDayPress(day: DateData) {
    const d = day.dateString;
    if (!startDate || (startDate && endDate)) {
      // Begin a new range.
      setStartDate(d); setEndDate(null);
      return;
    }
    // We have startDate but no endDate.
    if (d < startDate) {
      // User tapped earlier than start → move start.
      setStartDate(d);
      return;
    }
    setEndDate(d);
  }

  // Build the `markedDates` map react-native-calendars expects for the period
  // marking style. We highlight start, end, and every in-between day.
  const markedDates = useMemo(() => {
    if (!startDate) return {};
    const marks: Record<string, object> = {};
    const final = endDate ?? startDate;
    // Step by MY day index rather than mutating with setDate(), which walks in
    // the DEVICE's local terms and would jump 23 or 25 hours across a DST
    // transition on phones in zones that observe one.
    const total = daysBetweenInclusive(startDate, final);
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

  const days = startDate && endDate ? daysBetweenInclusive(startDate, endDate)
              : startDate ? 1 : 0;
  const canSubmit = !!startDate && !!endDate && !mutate.isPending;

  async function onSubmit() {
    if (!canSubmit || !startDate || !endDate) return;
    try {
      await mutate.mutateAsync({ startDate, endDate, reason, notes });
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not submit request.';
      Alert.alert('Request failed', msg);
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
            ['Start date', startDate ? formatDate(startDate) : '—'],
            ['End date',   endDate ? formatDate(endDate) : (startDate ? '(tap a later day)' : '—')],
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

        {/* Day count + assignment hint */}
        {days > 0 && (
          <Band tone="amber" icon="calendarDays">
            {`${days} ${days === 1 ? 'day' : 'days'} requested${endDate ? ', awaiting dispatcher approval.' : ', tap a later date for a multi-day range.'}`}
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
        <View style={{ flex: 2, opacity: canSubmit ? 1 : 0.5 }}>
          <Button full onPress={onSubmit}>
            {mutate.isPending ? 'Submitting…' : 'Submit request'}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
