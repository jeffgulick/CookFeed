import { PEOPLE_MAX, PEOPLE_MIN, peopleProblem } from './people';

/* How many people a recipe is cooked for (the prototype's peopleProblem): a whole number from 1 to 50. Every place
   that takes a number of people asks this, so they all say the same thing. */
describe('peopleProblem', () => {
  it('accepts a whole number of people from 1 to 50', () => {
    expect(peopleProblem('1')).toBe('');
    expect(peopleProblem(' 4 ')).toBe('');
    expect(peopleProblem('50')).toBe('');
    expect([PEOPLE_MIN, PEOPLE_MAX]).toEqual([1, 50]);
  });

  it('asks for a number when the box is empty', () => {
    expect(peopleProblem('')).toBe('Enter how many people you are cooking for.');
    expect(peopleProblem('   ')).toBe('Enter how many people you are cooking for.');
  });

  it('asks for a whole number', () => {
    expect(peopleProblem('2.5')).toBe('Use a whole number of people.');
    expect(peopleProblem('four')).toBe('Use a whole number of people.');
    expect(peopleProblem('-2')).toBe('Use a whole number of people.');
    expect(peopleProblem('1e1')).toBe('Use a whole number of people.');
  });

  it('keeps the number within what one recipe is cooked for', () => {
    expect(peopleProblem('0')).toBe('Choose between 1 and 50 people.');
    expect(peopleProblem('51')).toBe('Choose between 1 and 50 people.');
  });
});
