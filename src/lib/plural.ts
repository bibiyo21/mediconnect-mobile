/** "1 walk-in" / "3 walk-ins": a count with the right singular or plural word, for copy shown to the doctor. */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}
