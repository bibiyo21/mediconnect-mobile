import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme/tokens';
import { OfflineBanner } from './OfflineBanner';

interface Props {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
  /** Screens without a navigation header also need the top inset. */
  topInset?: boolean;
}

export function Screen({ title, subtitle, children, scroll = true, topInset = false }: Props) {
  const edges = topInset ? (['top', 'bottom', 'left', 'right'] as const) : (['bottom', 'left', 'right'] as const);
  const body = (
    <View style={styles.content}>
      {title ? (
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      ) : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={edges}>
      <OfflineBanner />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  content: { flex: 1, padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.muted },
});
