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
