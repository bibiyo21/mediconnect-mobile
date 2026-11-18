import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, size, space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.card}>
      {title ? (
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: size.hairline, borderColor: c.border, padding: space[4], gap: space[2] },
    title: { ...typography.heading, color: c.textPrimary },
  });
