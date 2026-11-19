import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Notice, Screen, StateView } from '@/components/ui';
import { fetchMyDoctorProfile, nextStepText, ONBOARDING_STEPS } from '@/features/doctors/api';
import { formatManilaDate } from '@/lib/dates';
import { userMessage } from '@/lib/errors';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

/** Doctor profile and verification progress. */
export default function DoctorHome() {
  const styles = useThemedStyles(createStyles);
  const profile = useQuery({ queryKey: ['doctor-profile'], queryFn: fetchMyDoctorProfile });

  if (profile.isPending) return <Screen title="Doctor profile"><StateView state="loading" message="Loading your doctor profile" /></Screen>;
  if (profile.isError) return <Screen title="Doctor profile"><StateView state="error" message={userMessage(profile.error)} onRetry={() => profile.refetch()} /></Screen>;

  const p = profile.data;
  const rejected = p.onboarding_status === 'REJECTED';
  const reached = rejected ? 1 : ONBOARDING_STEPS.findIndex((s) => s.status === p.onboarding_status);
  const rejection = [...p.verification_history].reverse().find((e) => e.to_status === 'REJECTED');
  const primary = p.specialties.find((s) => s.is_primary);

  return (
    <Screen title={p.display_name} subtitle={[p.professional_title, primary?.specialty_name].filter(Boolean).join(' · ') || undefined}>
      <Card title="Verification">
        <View role="list" aria-label="Verification steps" style={styles.steps}>
          {ONBOARDING_STEPS.map((s, i) => {
            const state = i < reached || (i === reached && p.onboarding_status === 'ACTIVE') ? 'done' : i === reached ? 'current' : 'todo';
            return (
              <View key={s.status} role="listitem" accessible accessibilityLabel={`${s.label}: ${state === 'done' ? 'done' : state === 'current' ? 'current step' : 'not yet'}`} style={styles.step}>
                <Text style={[styles.marker, state === 'done' && styles.markerDone, state === 'current' && styles.markerCurrent]} aria-hidden>{state === 'done' ? '✓' : i + 1}</Text>
                <Text style={[styles.stepLabel, state === 'current' && styles.stepCurrent]}>{s.label}</Text>
              </View>
            );
          })}
        </View>
        {rejected ? <Notice tone="warning" message={`Changes needed${rejection?.reason ? `: ${rejection.reason}` : '.'}`} /> : null}
        <Text style={styles.body}>{nextStepText(p.onboarding_status)}</Text>
      </Card>

      <Card title="Profile">
        <Text style={styles.body}>{p.profile_completeness}% complete</Text>
        <View style={styles.bar} role="progressbar" aria-label="Profile completeness" accessibilityValue={{ min: 0, max: 100, now: p.profile_completeness }}>
          <View style={[styles.barFill, { width: `${p.profile_completeness}%` }]} />
        </View>
        <Text style={styles.meta}>PRC licence: {p.prc_license_number_masked ?? 'not added yet'}</Text>
        <Text style={styles.meta}>Languages: {p.languages.length ? p.languages.join(', ') : 'not added yet'}</Text>
        {p.specialties.map((s) => (
          <Text key={`${s.specialty_id}-${s.subspecialty_id ?? ''}`} style={styles.meta}>
            {s.specialty_name}{s.subspecialty_name ? ` (${s.subspecialty_name})` : ''}{s.board_certified ? ', board certified' : ''} · {s.verification_status === 'CONFIRMED' ? 'confirmed by MediConnect' : 'self-reported, confirmed at review'}
          </Text>
        ))}
        {p.specialty_review_pending ? <Notice tone="info" message="Your specialty changes will be checked by a medical administrator. Until then, patients see only your confirmed specialties." /> : null}
        <Button label="Edit doctor profile" variant="secondary" onPress={() => router.push('/doctor/edit')} />
      </Card>

      <Card title="History">
        {p.verification_history.map((e, i) => (
          <Text key={i} style={styles.meta}>{formatManilaDate(e.occurred_at)} · {e.to_status.replace('_', ' ').toLowerCase()}{e.reason ? ` · ${e.reason}` : ''}</Text>
        ))}
      </Card>
    </Screen>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    steps: { gap: space[2] },
    step: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
    marker: { ...typography.small, width: 28, height: 28, borderRadius: 14, textAlign: 'center', lineHeight: 28, borderWidth: 1, borderColor: c.borderStrong, color: c.textMuted, overflow: 'hidden' },
    markerDone: { backgroundColor: c.success, borderColor: c.success, color: c.primaryForeground },
    markerCurrent: { borderColor: c.primary, color: c.primary, fontWeight: '700' },
    stepLabel: { ...typography.body, color: c.textSecondary },
    stepCurrent: { color: c.textPrimary, fontWeight: '600' },
    body: { ...typography.body, color: c.textPrimary },
    meta: { ...typography.small, color: c.textMuted },
    bar: { height: 8, borderRadius: 4, backgroundColor: c.border, overflow: 'hidden' },
    barFill: { height: 8, backgroundColor: c.primary },
  });
