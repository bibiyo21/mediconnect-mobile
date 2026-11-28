import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';
import type { QueueAction } from './queueActions';
import { estimateText, hmoText, PRIORITY_REASON_LABELS } from './copy';
import type { WalkInEntry } from './api';

const ACTION_LABEL: Record<QueueAction, (label: string) => string> = {
  call: (l) => `Call ${l}`,
  recall: (l) => `Recall ${l}`,
  skip: (l) => `Skip ${l}`,
  noShow: (l) => `Mark ${l} as no-show`,
  return: (l) => `Put ${l} back in line`,
  priority: (l) => `Change priority for ${l}`,
  startConsultation: (l) => `Start consultation with ${l}`,
  endConsultation: (l) => `End consultation with ${l}`,
  interrupt: (l) => `Interrupt consultation with ${l}`,
  resume: (l) => `Resume consultation with ${l}`,
};

const STATUS_TEXT: Record<WalkInEntry['status'], string> = {
  REGISTERED: 'Not arrived yet',
  WAITING: 'Waiting',
  CALLED: 'Called',
  IN_CONSULTATION: 'In consultation',
  COMPLETED: 'Completed',
  SKIPPED: 'Skipped',
  NO_SHOW: 'No-show',
  CANCELLED: 'Cancelled',
};

interface Props {
  entry: WalkInEntry;
  actions: QueueAction[];
  /** Status words for an interrupted consultation, shown when the consultation is read. */
  consultationNote?: string;
  disabled: boolean;
  pendingAction: QueueAction | null;
  onAction: (action: QueueAction) => void;
}

/** One patient in the doctor's queue. Shows names (the doctor's own queue) and the server's estimate and HMO label only. */
export function EntryRow({ entry, actions, consultationNote, disabled, pendingAction, onAction }: Props) {
  const styles = useThemedStyles(createStyles);
  const name = entry.name ?? (entry.is_guest ? 'Guest' : 'Patient');
  const priority = entry.priority_level !== 'NORMAL' && entry.priority_reason_code ? PRIORITY_REASON_LABELS[entry.priority_reason_code] : null;
  const estimate = estimateText(entry);
  const hmo = hmoText(entry);

  return (
    <View style={styles.row}>
      <Text style={styles.title} accessibilityRole="header">
        {entry.label} · {name}
      </Text>
      <Text style={styles.meta}>
        {STATUS_TEXT[entry.status]}
        {priority ? ` · Priority: ${priority}` : ''}
        {entry.status === 'CALLED' && entry.recall_count ? ` · Recalled ${entry.recall_count}×` : ''}
      </Text>
      {consultationNote ? <Text style={styles.meta}>{consultationNote}</Text> : null}
      {estimate ? <Text style={styles.meta}>{estimate}</Text> : null}
      {hmo ? <Text style={styles.meta}>{hmo}</Text> : null}
      {actions.map((action) => (
        <Button
          key={action}
          label={ACTION_LABEL[action](entry.label)}
          variant={action === 'noShow' || action === 'skip' ? 'secondary' : 'primary'}
          loading={pendingAction === action}
          disabled={disabled || pendingAction !== null}
          onPress={() => onAction(action)}
        />
      ))}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: { gap: space[1], paddingVertical: space[2] },
    title: { ...typography.label, color: c.textPrimary },
    meta: { ...typography.small, color: c.textMuted },
  });
