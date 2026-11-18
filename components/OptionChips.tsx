import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

/** A row of choices where exactly one is selected. */
export function OptionChips<T extends string | number>({
  options,
  value,
  onSelect,
  testIDPrefix,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onSelect: (value: T) => void;
  testIDPrefix: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(option.value)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? colors.primary : colors.background,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
            testID={`${testIDPrefix}-${option.value}`}
          >
            <Text
              style={[
                styles.chipText,
                { color: selected ? colors.primaryForeground : colors.foreground },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingLeft: 48 },
  chip: { minHeight: 34, minWidth: 54, paddingHorizontal: 11, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});
