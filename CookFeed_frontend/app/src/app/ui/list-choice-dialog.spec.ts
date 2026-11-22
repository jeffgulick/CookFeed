import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TripSummary } from '../core/api-types';
import { ShopLists } from '../core/shop-lists';
import { ListChoiceDialog } from './list-choice-dialog';

/* The dialog that asks which shopping list a recipe or a plan goes on: one of the lists in use, or a new one. */
describe('ListChoiceDialog', () => {
  const first: TripSummary = {
    id: 7,
    name: 'Shopping list, November 21',
    status: 'Shopping',
    createdAt: '2026-11-21T12:00:00+00:00',
    completedAt: null,
    recipeCount: 2,
  };
  const second: TripSummary = { ...first, id: 8, name: 'Shopping list, November 21 (2)', status: 'Building', recipeCount: 1 };

  let fixture: ComponentFixture<ListChoiceDialog>;
  let page: HTMLElement;
  let lists: ShopLists;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ListChoiceDialog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    lists = TestBed.inject(ShopLists);
    fixture = TestBed.createComponent(ListChoiceDialog);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
  });

  const dialog = () => page.querySelector('dialog')!;
  const radios = () => Array.from(page.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
  const labels = () =>
    Array.from(page.querySelectorAll('label')).map((label) =>
      Array.from(label.querySelectorAll('strong, .meta')).map((part) => part.textContent?.trim()),
    );
  const button = (name: string) => Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.trim() === name)!;

  /** Asks, and waits for the dialog to open. The answer comes wrapped, so awaiting this does not wait for it. */
  async function ask(): Promise<{ answer: Promise<number | 'new' | null> }> {
    const answer = lists.ask([second, first]);
    await fixture.whenStable();
    return { answer };
  }

  it('is closed until a page asks', () => {
    expect(dialog().hasAttribute('open')).toBe(false);
  });

  it('lists the lists in use with the newest picked, and the way to start another', async () => {
    await ask();

    expect(dialog().hasAttribute('open')).toBe(true);
    expect(page.querySelector('h2')?.textContent?.trim()).toBe('Add to which shopping list?');
    expect(dialog().getAttribute('aria-labelledby')).toBe(page.querySelector('h2')?.id);
    expect(labels()).toEqual([
      ['Shopping list, November 21 (2)', '1 recipe · Building'],
      ['Shopping list, November 21', '2 recipes · Shopping'],
      ['A new list', 'Start another list and keep the others.'],
    ]);
    expect(radios().map((radio) => radio.checked)).toEqual([true, false, false]);
    // One group, so the arrow keys move between the choices.
    expect(new Set(radios().map((radio) => radio.name)).size).toBe(1);
  });

  it('answers with the list picked, and closes', async () => {
    const { answer } = await ask();

    radios()[1].click();
    await fixture.whenStable();
    button('Add to list').click();
    await fixture.whenStable();

    expect(await answer).toBe(7);
    expect(dialog().hasAttribute('open')).toBe(false);
  });

  it('answers with the newest list when nothing else is picked', async () => {
    const { answer } = await ask();

    button('Add to list').click();

    expect(await answer).toBe(8);
  });

  it('answers "new" for a new list', async () => {
    const { answer } = await ask();

    radios()[2].click();
    await fixture.whenStable();
    button('Add to list').click();

    expect(await answer).toBe('new');
  });

  it('answers nothing on Cancel', async () => {
    const { answer } = await ask();

    button('Cancel').click();
    await fixture.whenStable();

    expect(await answer).toBeNull();
    expect(dialog().hasAttribute('open')).toBe(false);
  });

  it('starts from the newest list again the next time it is asked', async () => {
    const { answer } = await ask();
    // Each press is its own event, with the page redrawn in between, as in a browser.
    radios()[2].click();
    await fixture.whenStable();
    button('Cancel').click();
    await fixture.whenStable();
    await answer;

    await ask();

    expect(radios().map((radio) => radio.checked)).toEqual([true, false, false]);
  });
});
