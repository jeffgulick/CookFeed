/* The small wordings every page shares, so "1 recipe" and "$12.99" are written one way everywhere. */

/** "1 recipe", "5 recipes": the count with the right form of the word. */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** A price held in whole cents, as dollars and cents: 1299 is "$12.99". */
export function price(cents: number): string {
  return '$' + (cents / 100).toFixed(2);
}
