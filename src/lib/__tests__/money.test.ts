import { centavosToPesos, pesosToCentavos } from '../money';

describe('pesosToCentavos', () => {
  it.each([
    ['650', 65000], ['650.5', 65050], ['650.05', 65005], ['1,200.00', 120000], ['₱ 800', 80000], ['0', 0], [' 99.99 ', 9999],
  ])('%s → %i', (input, expected) => expect(pesosToCentavos(input)).toBe(expected));

  it.each(['', 'abc', '-5', '650.555', '1.2.3', '12e3', '10000001'])('rejects %p', (input) => expect(pesosToCentavos(input)).toBeNull());

  it('round-trips through the display form', () => {
    expect(centavosToPesos(65005)).toBe('650.05');
    expect(pesosToCentavos(centavosToPesos(123456))).toBe(123456);
  });
});
