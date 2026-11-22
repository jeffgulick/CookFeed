/* How many people a recipe is cooked for. Every place that takes a number of people (the recipe page now; the week
   and the shopping list later) asks peopleProblem, so they all accept the same numbers and say the same thing. */

export const PEOPLE_MIN = 1;

/** People for one recipe; a plan's repeated meal can double a recipe written for 24. */
export const PEOPLE_MAX = 50;

/** "" when the text is a whole number of people from 1 to 50; otherwise what to tell the cook. */
export function peopleProblem(value: string): string {
  const text = value.trim();
  if (text === '') {
    return 'Enter how many people you are cooking for.';
  }
  if (!/^[0-9]+$/.test(text)) {
    return 'Use a whole number of people.';
  }
  const people = Number(text);
  if (people < PEOPLE_MIN || people > PEOPLE_MAX) {
    return `Choose between ${PEOPLE_MIN} and ${PEOPLE_MAX} people.`;
  }
  return '';
}
