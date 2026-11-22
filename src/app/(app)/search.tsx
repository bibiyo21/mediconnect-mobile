import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ChoiceGroup, Notice, Screen, StateView, TextField } from '@/components/ui';
import { BOOKING_NOTICE } from '@/features/directory/api';
import {
  DEGRADED_NOTICE,
  formatNextOpen,
  searchDoctors,
  TIME_WINDOWS,
  suggestionLabel,
  suggestSpecialties,
  toSpecialtyFilter,
  type ConsultationMode,
  type DoctorResult,
  type SearchDay,
  type SearchFilters,
  type SearchSort,
  type SearchTime,
} from '@/features/search/api';
import { ApiError } from '@mediconnect/api-client';
import { userMessage } from '@/lib/errors';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { radius, size, space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

const MODES: readonly { value: ConsultationMode; label: string }[] = [
  { value: 'ANY', label: 'Any' },
  { value: 'IN_PERSON', label: 'In person' },
  { value: 'ONLINE', label: 'Online' },
];

const DAYS: readonly { value: SearchDay; label: string }[] = [
  { value: 'ANY', label: 'Any day' },
  { value: 'TODAY', label: 'Today' },
  { value: 'TOMORROW', label: 'Tomorrow' },
];

const TIMES: readonly { value: SearchTime; label: string }[] = [
  { value: 'ANY', label: 'Any time' },
  ...(Object.entries(TIME_WINDOWS) as [Exclude<SearchTime, 'ANY'>, (typeof TIME_WINDOWS)[keyof typeof TIME_WINDOWS]][]).map(([value, w]) => ({ value, label: w.label })),
];

const SORTS: readonly { value: SearchSort; label: string }[] = [
  { value: 'relevance', label: 'Best match' },
  { value: 'next_available', label: 'Soonest open time' },
];

const searchError = (error: unknown) =>
  error instanceof ApiError && error.status === 429 ? 'You searched very quickly. Wait a moment, then try again.' : userMessage(error);

/**
 * Find a doctor (increment 3.6). Typing is debounced; each new query aborts the
 * one before it. Results lead to the read-only profiles from 2.11.
 */
export default function Search() {
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ q?: string }>();
  const [text, setText] = useState(typeof params.q === 'string' ? params.q : '');
  const [city, setCity] = useState('');
  const [mode, setMode] = useState<ConsultationMode>('ANY');
  const [specialty, setSpecialty] = useState<SearchFilters['specialty']>(null);
  const [day, setDay] = useState<SearchDay>('ANY');
  const [time, setTime] = useState<SearchTime>('ANY');
  const [sort, setSort] = useState<SearchSort>('relevance');

  // Typing waits for the debounce; clearing a field applies at once (no stale request in between).
  const typedQ = useDebouncedValue(text);
  const typedCity = useDebouncedValue(city);
  const q = text.trim() === '' ? '' : typedQ;
  const debouncedCity = city.trim() === '' ? '' : typedCity;
  const filters = useMemo<SearchFilters>(() => ({ q, city: debouncedCity, mode, specialty, day, time, sort }), [q, debouncedCity, mode, specialty, day, time, sort]);

  const suggestions = useQuery({
    queryKey: ['search', 'specialties', q.trim().toLowerCase()],
    queryFn: ({ signal }) => suggestSpecialties(q, signal),
    enabled: specialty === null && q.trim().length >= 2,
    staleTime: 60_000,
  });

  const results = useInfiniteQuery({
    queryKey: ['search', 'doctors', filters],
    queryFn: ({ pageParam, signal }) => searchDoctors(filters, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

  const pages = results.data?.pages ?? [];
  const doctors = pages.flatMap((p) => p.doctors);
  const found = pages[0]?.found ?? 0;
  const degraded = pages.some((p) => p.degraded);
  const stale = results.isPlaceholderData || text.trim() !== q.trim() || city.trim() !== debouncedCity.trim();

  return (
    <Screen title="Find a doctor" subtitle="Search by name, specialty, condition or clinic. Every doctor listed had their PRC licence checked by MediConnect.">
      <Notice tone="info" message={BOOKING_NOTICE} />
      <Card>
        <View accessibilityRole="search" style={styles.form}>
          <TextField
            label="Search"
            placeholder="For example pedia, heart doctor or Dr. Santos"
            value={text}
            onChangeText={setText}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            maxLength={100}
          />
          {suggestions.data && suggestions.data.length > 0 && specialty === null ? (
            <View style={styles.suggestions}>
              <Text style={styles.label} nativeID="specialty-suggestions">Specialties</Text>
              <View role="list" aria-labelledby="specialty-suggestions" style={styles.chips}>
                {suggestions.data.map((s) => (
                  <View key={s.id} role="listitem">
                    <Pressable
                      role="button"
                      accessibilityLabel={`Filter by ${suggestionLabel(s)}, ${s.doctor_count} ${s.doctor_count === 1 ? 'doctor' : 'doctors'}`}
                      onPress={() => {
                        setSpecialty(toSpecialtyFilter(s));
                        setText('');
                      }}
                      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                    >
                      <Text style={styles.chipText}>{suggestionLabel(s)}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {specialty ? (
            <View style={styles.selected}>
              <Text style={styles.body}>Specialty: {specialty.name}</Text>
              <Button label="Remove specialty" variant="secondary" onPress={() => setSpecialty(null)} />
            </View>
          ) : null}
          <TextField label="City" placeholder="For example Makati" value={city} onChangeText={setCity} autoCorrect={false} />
          <ChoiceGroup label="Consultation" options={MODES} value={mode} onChange={setMode} />
          <ChoiceGroup label="Open times" options={DAYS} value={day} onChange={setDay} />
          <ChoiceGroup label="Time of day" options={TIMES} value={time} onChange={setTime} />
          <ChoiceGroup label="Sort by" options={SORTS} value={sort} onChange={setSort} />
          {day !== 'ANY' || time !== 'ANY' || sort === 'next_available' ? <Text style={styles.meta}>Open times are a guide and can change; the clinic confirms every booking.</Text> : null}
        </View>
      </Card>

      {degraded ? <Notice tone="warning" message={DEGRADED_NOTICE} /> : null}
      {results.isPending ? <StateView state="loading" message="Searching" /> : null}
      {results.isError && !results.data ? <StateView state="error" message={searchError(results.error)} onRetry={() => results.refetch()} /> : null}
      {results.data ? (
        <Text style={styles.count} accessibilityLiveRegion="polite" role="status">
          {stale ? 'Searching…' : found === 0 ? 'No doctors match. Try a different word, or remove a filter.' : `${found} ${found === 1 ? 'doctor' : 'doctors'} found`}
        </Text>
      ) : null}

      <View role="list" style={styles.list}>
        {doctors.map((d) => (
          <View key={d.doctor_id} role="listitem">
            <ResultCard doctor={d} styles={styles} />
          </View>
        ))}
      </View>

      {results.hasNextPage ? (
        <Button
          label={results.isFetchingNextPage ? 'Loading more doctors' : 'Show more doctors'}
          variant="secondary"
          disabled={results.isFetchingNextPage}
          onPress={() => results.fetchNextPage()}
        />
      ) : null}
      {results.isFetchNextPageError ? <Notice tone="error" message={searchError(results.error)} /> : null}
    </Screen>
  );
}

function ResultCard({ doctor: d, styles }: { doctor: DoctorResult; styles: ReturnType<typeof createStyles> }) {
  const where = d.locations.length ? d.locations.map((l) => `${l.clinic_name}, ${l.city}`).join(' · ') : null;
  const how = [where, d.offers_online ? 'Online consultations' : null].filter(Boolean).join(' · ');
  const next = formatNextOpen(d.next_available_at);
  const label = [d.display_name, d.specialties.join(', '), d.fee_from ? `fees from ${d.fee_from.formatted}` : null, next ? `next open time ${next}` : null].filter(Boolean).join(', ');
  return (
    <Pressable role="link" accessibilityLabel={label} onPress={() => router.push(`/directory/doctor/${d.doctor_id}`)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <Text style={styles.name}>{d.display_name}</Text>
      <Text style={styles.meta}>{[d.professional_title, d.specialties.join(', ')].filter(Boolean).join(' · ') || 'Doctor'}</Text>
      {how ? <Text style={styles.meta}>{how}</Text> : null}
      {next ? <Text style={styles.next}>Next open time: {next}</Text> : null}
      <View style={styles.row}>
        {d.fee_from ? <Text style={styles.fee}>From {d.fee_from.formatted}</Text> : null}
        {d.is_verified ? <Text style={styles.badge}>PRC licence checked</Text> : null}
      </View>
    </Pressable>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    form: { gap: space[4] },
    suggestions: { gap: space[2] },
    label: { ...typography.label, color: c.textPrimary },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
    chip: { minHeight: size.touchTarget, justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radius.full, borderWidth: 1, borderColor: c.primary, backgroundColor: c.surface },
    chipText: { ...typography.label, color: c.primary },
    selected: { gap: space[2] },
    body: { ...typography.body, color: c.textPrimary },
    count: { ...typography.small, color: c.textSecondary },
    list: { gap: space[3] },
    item: { gap: space[1], padding: space[4], borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, backgroundColor: c.surface },
    pressed: { backgroundColor: c.primarySoft },
    name: { ...typography.label, color: c.primary },
    meta: { ...typography.small, color: c.textSecondary },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3], paddingTop: space[1] },
    fee: { ...typography.small, color: c.textPrimary },
    badge: { ...typography.small, color: c.success },
    next: { ...typography.small, color: c.textPrimary },
  });
