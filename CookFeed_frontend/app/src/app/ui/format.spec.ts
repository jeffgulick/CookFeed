import { amount, joinWithAnd, longDate, plural, price } from './format';

/* The two small wordings every page shares (the prototype's plural and formatPrice in common.js). */
describe('format', () => {
  it('counts one thing in the singular and any other number in the plural', () => {
    expect(plural(1, 'recipe', 'recipes')).toBe('1 recipe');
    expect(plural(0, 'recipe', 'recipes')).toBe('0 recipes');
    expect(plural(5, 'recipe', 'recipes')).toBe('5 recipes');
  });

  it('shows cents as dollars and cents', () => {
    expect(price(1299)).toBe('$12.99');
    expect(price(900)).toBe('$9.00');
    expect(price(0)).toBe('$0.00');
  });

  it('writes a date out in full', () => {
    expect(longDate('2026-08-20T12:00:00+00:00')).toBe('August 20, 2026');
    expect(longDate('2026-01-05T12:00:00+00:00')).toBe('January 5, 2026');
  });

  it('joins a list of names the way a sentence does', () => {
    expect(joinWithAnd([])).toBe('');
    expect(joinWithAnd(['A'])).toBe('A');
    expect(joinWithAnd(['A', 'B'])).toBe('A and B');
    expect(joinWithAnd(['A', 'B', 'C'])).toBe('A, B and C');
  });

  it('shows an amount to at most two decimals, with no trailing zeros', () => {
    expect(amount(2)).toBe('2');
    expect(amount(2.5)).toBe('2.5');
    expect(amount(0.666)).toBe('0.67');
    expect(amount(500)).toBe('500');
  });
});
