import React, { useState } from 'react';
import { View, Text, Pressable, NativeSyntheticEvent, TextLayoutEventData } from 'react-native';
import { Band } from './Band';
import { Icon } from './Icon';
import { useTokens } from '../theme/ThemeProvider';
import { fontFor, space, type } from '../theme/tokens';

// Amber instruction band. Sits below the client card on both Job Detail and
// Active Job. Truncates to 2 rows by default; if the text overflows, the
// whole band becomes tappable to expand/collapse. The "Read more / Show less"
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
    <View style={{ gap: space[2] }}>
      <Text style={[type.title, { color: T.text }]}>Special instructions</Text>
      <Pressable
        onPress={overflows ? () => setExpanded(x => !x) : undefined}
        style={({ pressed }) => ({ opacity: overflows && pressed ? 0.8 : 1 })}
      >
        <Band tone="amber" icon="info">
          <View>
            <Text
              numberOfLines={expanded ? undefined : 2}
              style={[type.body, { color: T.amberText }]}
            >
              {text}
            </Text>
            {overflows && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], marginTop: space[2] }}>
                <Text style={[type.body, { fontFamily: fontFor('600'), fontWeight: '600', color: T.amberText }]}>
                  {expanded ? 'Show less' : 'Read more'}
                </Text>
                <Icon name={expanded ? 'chevUp' : 'chevDown'} size={16} stroke={2.4} color={T.amberText}/>
              </View>
            )}
            {/* Hidden mirror for unclamped line measurement. position: 'absolute'
                + opacity 0 keeps it offscreen-equivalent and laid out at full
                width so its lines.length reflects the true line count. */}
            <Text
              onTextLayout={measureMirror}
              style={[type.body, {
                position: 'absolute', left: 0, right: 0, top: 0,
                opacity: 0, color: 'transparent',
              }]}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {text}
            </Text>
          </View>
        </Band>
      </Pressable>
    </View>
  );
}
