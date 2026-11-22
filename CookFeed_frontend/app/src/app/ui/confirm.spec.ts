import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Confirm, ConfirmDialog } from './confirm';

/* The one confirmation dialog the app shares (the prototype's confirmDialog): a question, the action's own name on
   the button that goes ahead, and Cancel. It is a modal <dialog>, so focus stays inside and Escape cancels. */
describe('Confirm dialog', () => {
  let fixture: ComponentFixture<ConfirmDialog>;
  let page: HTMLElement;
  let confirm: Confirm;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [ConfirmDialog] });
    confirm = TestBed.inject(Confirm);
    fixture = TestBed.createComponent(ConfirmDialog);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
  });

  const dialog = () => page.querySelector('dialog')!;
  const button = (label: string) =>
    Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!;

  it('is closed until something asks', () => {
    expect(dialog().open).toBe(false);
  });

  it('asks the question, and names the action on the button that goes ahead', async () => {
    void confirm.ask('Place this order for $4.99?', 'Place order');
    await fixture.whenStable();

    expect(dialog().open).toBe(true);
    expect(dialog().textContent).toContain('Place this order for $4.99?');
    expect(button('Place order')).toBeTruthy();
    expect(button('Cancel')).toBeTruthy();
    // The dialog is named by its question, so a screen reader reads it on opening.
    const labelledBy = dialog().getAttribute('aria-labelledby');
    expect(page.querySelector(`#${labelledBy}`)?.textContent).toContain('Place this order for $4.99?');
  });

  it('answers yes when the action is pressed, and closes', async () => {
    const answer = confirm.ask('Take The Bread Box out of your cart?', 'Take it out');
    await fixture.whenStable();

    button('Take it out').click();

    expect(await answer).toBe(true);
    await fixture.whenStable();
    expect(dialog().open).toBe(false);
  });

  it('answers no when Cancel is pressed', async () => {
    const answer = confirm.ask('Remove all 2 items from your cart?', 'Empty cart');
    await fixture.whenStable();

    button('Cancel').click();

    expect(await answer).toBe(false);
  });

  it('answers no when the dialog is closed another way, such as Escape', async () => {
    const answer = confirm.ask('Remove all 2 items from your cart?', 'Empty cart');
    await fixture.whenStable();

    dialog().dispatchEvent(new Event('cancel'));
    dialog().dispatchEvent(new Event('close'));

    expect(await answer).toBe(false);
  });
});
