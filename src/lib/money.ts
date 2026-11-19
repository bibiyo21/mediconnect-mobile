/**
 * Pesos typed by a person ("650", "650.5", "1,200.00") to integer centavos
 * (D-18). String arithmetic only: no floating point touches a fee. Returns
 * null for anything that is not a non-negative amount with at most 2 decimals.
 */
export function pesosToCentavos(input: string): number | null {
  const cleaned = input.trim().replace(/^₱\s*/, '').replace(/,/g, '');
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const centavos = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || '0');
  return centavos <= 100_000_000 ? centavos : null;
}

/** 65000 → "650.00" (for prefilling a fee field). */
export function centavosToPesos(centavos: number): string {
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;
}
