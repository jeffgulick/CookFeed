/* The small wordings every page shares, so "1 recipe" and "$12.99" are written one way everywhere. */

/** "1 recipe", "5 recipes": the count with the right form of the word. */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** A price held in whole cents, as dollars and cents: 1299 is "$12.99". */
export function price(cents: number): string {
  return '$' + (cents / 100).toFixed(2);
}

/** A date written out in full, in the reader's own time zone: "August 20, 2026". */
export function longDate(isoText: string): string {
  return new Date(isoText).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** What a product is called on a card. */
export function productTypeLabel(type: 'MealPlan' | 'RecipeCollection'): string {
  return type === 'MealPlan' ? 'Meal plan' : 'Recipe collection';
}

/** "plan" or "collection", for sentences such as "You own this plan". */
export function productNoun(type: 'MealPlan' | 'RecipeCollection'): 'plan' | 'collection' {
  return type === 'MealPlan' ? 'plan' : 'collection';
}

/** "5 recipes, 6 meals" for a plan that serves a recipe more than once; otherwise just "3 recipes". */
export function productCounts(recipeCount: number, mealCount: number | null): string {
  const recipes = plural(recipeCount, 'recipe', 'recipes');
  return mealCount !== null && mealCount !== recipeCount ? `${recipes}, ${plural(mealCount, 'meal', 'meals')}` : recipes;
}

/** "A", "A and B", "A, B and C": a list of names the way a sentence joins them. */
export function joinWithAnd(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items.join('');
}

/** An amount to at most two decimals, with no trailing zeros: 2, 2.5, 0.67. */
export function amount(quantity: number): string {
  return String(Math.round(quantity * 100) / 100);
}

/** Seconds the way a video player shows them: 76 is "1:16". */
export function clockTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The day of a meal plan, counted from Monday as day 0. */
export function dayName(dayOffset: number): string {
  return DAY_NAMES[dayOffset] ?? '';
}

/** "Monday dinner": the day and meal a plan puts a recipe on. A placement with no meal named is a dinner. */
export function dayAndMeal(dayOffset: number, slot: string | null): string {
  return `${dayName(dayOffset)} ${(slot ?? 'Dinner').toLowerCase()}`;
}
