import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button, Card, ChoiceGroup } from '@/components/ui';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';
import type { PriorityReasonCode } from './api';
import { OVERRIDE_GATE_BODY, OVERRIDE_GATE_TITLE, PRIORITY_REASON_LABELS } from './copy';

const REASONS: { value: PriorityReasonCode; label: string }[] = (Object.keys(PRIORITY_REASON_LABELS) as PriorityReasonCode[]).map((value) => ({
  value,
  label: PRIORITY_REASON_LABELS[value],
}));

interface Props {
  label: string;
  /** The server's answer, already worded (protected until, or the hold). */
  windowText: string;
  /** The reason the patient is in the queue, shown as a hint only. It is never pre-selected for the override. */
  queueReasonLabel: string | null;
  busy: boolean;
  disabled: boolean;
  onConfirm: (reason: PriorityReasonCode) => void;
  onCancel: () => void;
}

/** The confirm step for an urgent call during a protected window. Shows the gate wording and the reason code it sends. */
export function OverrideConfirm({ label, windowText, queueReasonLabel, busy, disabled, onConfirm, onCancel }: Props) {
  const styles = useThemedStyles(createStyles);
  // No reason is selected at the start: the doctor must choose one on purpose, so one tap cannot confirm a default.
  const [reason, setReason] = useState<PriorityReasonCode | null>(null);

  return (
    <Card title={OVERRIDE_GATE_TITLE}>
      <Text style={styles.body}>{`${label}: ${windowText}`}</Text>
      <Text style={styles.note}>{OVERRIDE_GATE_BODY}</Text>
      <ChoiceGroup
        label="Why are you calling now? (choose one)"
        options={REASONS}
        value={reason}
        onChange={setReason}
        variant="list"
      />
      {queueReasonLabel ? <Text style={styles.note}>{`Queue reason: ${queueReasonLabel}`}</Text> : null}
      <Button
        label={`Call ${label} now`}
        onPress={() => reason && onConfirm(reason)}
        loading={busy}
        disabled={disabled || reason === null}
        accessibilityHint={reason === null ? 'Choose a reason first' : undefined}
      />
      <Button label="Do not call" variant="secondary" onPress={onCancel} disabled={busy} />
    </Card>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    body: { ...typography.body, color: c.textPrimary, paddingBottom: space[1] },
    note: { ...typography.small, color: c.textMuted, paddingBottom: space[2] },
  });
