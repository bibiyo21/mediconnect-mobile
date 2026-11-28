import { StyleSheet } from 'react-native';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { EntryRow } from '../EntryRow';
import type { WalkInEntry } from '../api';

const estimate = { min_minutes: 5, max_minutes: 12, wait_status: 'OK' } as unknown as WalkInEntry['estimate'];

function entry(overrides: Partial<WalkInEntry>): WalkInEntry {
  return {
    id: 'e1',
    label: 'A-01',
    name: 'Ana Reyes',
    is_guest: false,
    status: 'WAITING',
    priority_level: 'NORMAL',
    priority_reason_code: null,
    recall_count: 0,
    estimate,
    hmo_claim: null,
    consultation_id: null,
    ...overrides,
  } as unknown as WalkInEntry;
}

const noop = () => {};

describe('EntryRow', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('shows the estimate only before the patient is called', async () => {
    await render(<EntryRow entry={entry({ status: 'WAITING' })} actions={[]} disabled={false} pendingAction={null} onAction={noop} />);
    expect(screen.getByText(/About 5 to 12 min/)).toBeTruthy();
    await cleanup();
    await render(<EntryRow entry={entry({ status: 'CALLED' })} actions={[]} disabled={false} pendingAction={null} onAction={noop} />);
    expect(screen.queryByText(/About 5 to 12 min/)).toBeNull();
  });

  it('shows the label alone with a plain fallback when no name is given (never the word Patient)', async () => {
    await render(<EntryRow entry={entry({ name: null, is_guest: false })} actions={[]} disabled={false} pendingAction={null} onAction={noop} />);
    expect(screen.getByText('A-01 · Name not given')).toBeTruthy();
  });

  it('keeps skip and no-show apart and sends the pressed action', async () => {
    const onAction = jest.fn();
    await render(
      <EntryRow entry={entry({ status: 'CALLED' })} actions={['startConsultation', 'recall', 'skip', 'noShow']} disabled={false} pendingAction={null} onAction={onAction} />,
    );
    expect(screen.getByRole('button', { name: 'Start consultation with A-01' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Recall A-01' }));
    expect(onAction).toHaveBeenCalledWith('recall');
    expect(screen.getByRole('button', { name: 'Skip A-01' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark A-01 as no-show' })).toBeTruthy();
  });

  it('gives exactly one primary action per row (the first main action); the rest are secondary and grouped apart', async () => {
    await render(
      <EntryRow entry={entry({ status: 'CALLED' })} actions={['startConsultation', 'recall', 'skip', 'noShow']} disabled={false} pendingAction={null} onAction={noop} />,
    );
    const fill = (name: string) => StyleSheet.flatten(screen.getByRole('button', { name }).props.style).backgroundColor;
    const primary = fill('Start consultation with A-01');
    expect(primary).toBeTruthy();
    // Recall, Skip and No-show are secondary: none carries the primary fill.
    expect(fill('Recall A-01')).not.toBe(primary);
    expect(fill('Skip A-01')).not.toBe(primary);
    expect(fill('Mark A-01 as no-show')).not.toBe(primary);
    expect(fill('Recall A-01')).toBe(fill('Skip A-01'));
    expect(fill('Skip A-01')).toBe(fill('Mark A-01 as no-show'));
  });
});
