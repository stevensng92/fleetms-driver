import React, { useState } from 'react';
import { View, Text, Pressable, NativeSyntheticEvent, TextLayoutEventData } from 'react-native';
import { Icon } from './Icon';
import { useTokens } from '../theme/ThemeProvider';
import { SectionLabel } from './AppHeader';

// Amber instruction card. Sits below the client card on both Job Detail and
// Active Job. Truncates to 2 rows by default; if the text overflows, the
// whole card becomes tappable to expand/collapse. The "Read more / less"
// affordance only renders when truncation actually fires.
//
// Overflow detection trick: render a hidden mirror Text without numberOfLines
// that gets onTextLayout — its lines.length is the unclamped count.
// onTextLayout on a clamped Text would report ≤ 2 lines and miss overflow.
export function SpecialInstructionsCard({ text }: { text: string }) {
  const T = useTokens();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  function measureMirror(e: NativeSyntheticEvent<TextLayoutEventData>) {
    if (!overflows && e.nativeEvent.lines.length > 2) {
      setOverflows(true);
    }
  }

  return (
    <>
      <SectionLabel>Special instructions</SectionLabel>
      <Pressable
        onPress={overflows ? () => setExpanded(x => !x) : undefined}
        style={({ pressed }) => ({
          backgroundColor: T.amberSoft, borderColor: T.amber, borderWidth: 1,
          borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 18,
          opacity: overflows && pressed ? 0.8 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="bell" size={18} color={T.amber}/>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={expanded ? undefined : 2}
              style={{ fontSize: 14, color: T.amberFg, fontWeight: '500', lineHeight: 20 }}
            >
              {text}
            </Text>
            {overflows && (
              <Text style={{
                fontSize: 12, color: T.amberFg, fontWeight: '700',
                marginTop: 6, letterSpacing: 0.3,
              }}>
                {expanded ? 'SHOW LESS ▴' : 'READ MORE ▾'}
              </Text>
            )}
            {/* Hidden mirror for unclamped line measurement. position: 'absolute'
                + opacity 0 keeps it offscreen-equivalent and laid out at full
                width so its lines.length reflects the true line count. */}
            <Text
              onTextLayout={measureMirror}
              style={{
                position: 'absolute', left: 0, right: 0, top: 0,
                fontSize: 14, fontWeight: '500', lineHeight: 20,
                opacity: 0, color: 'transparent',
              }}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {text}
            </Text>
          </View>
        </View>
      </Pressable>
    </>
  );
}
