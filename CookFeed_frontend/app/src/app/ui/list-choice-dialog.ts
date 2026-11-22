import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, linkedSignal, viewChild } from '@angular/core';
import { ListPick, ShopLists } from '../core/shop-lists';
import { plural } from './format';

/**
 * The dialog that asks which shopping list a recipe or a plan goes on (ShopLists): one of the lists in use, the
 * newest picked to begin with, or a new list. A native modal dialog, like the confirmation: focus moves into it and
 * stays there, Escape closes it, and focus returns to the button that asked.
 */
@Component({
  selector: 'app-list-choice-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      aria-labelledby="listChoiceTitle"
      class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-6 text-ink shadow-lift backdrop:bg-ink/50"
      (close)="answer(null)"
      (click)="onBackdrop($event)"
    >
      <h2 id="listChoiceTitle" class="text-xl font-bold">Add to which shopping list?</h2>
      <!-- One radio group: Tab reaches it, the arrow keys move between the choices. -->
      <div role="radiogroup" aria-labelledby="listChoiceTitle" class="mt-4 grid gap-2">
        @for (list of choices(); track list.id) {
          <label
            class="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line-strong p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
          >
            <input
              type="radio"
              name="listChoice"
              class="size-5 shrink-0 accent-brand"
              [checked]="picked() === list.id"
              (change)="picked.set(list.id)"
            />
            <span class="min-w-0">
              <strong class="block">{{ list.name }}</strong>
              <span class="meta block text-sm">{{ list.about }}</span>
            </span>
          </label>
        }
        <label
          class="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line-strong p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
        >
          <input
            type="radio"
            name="listChoice"
            class="size-5 shrink-0 accent-brand"
            [checked]="picked() === 'new'"
            (change)="picked.set('new')"
          />
          <span class="min-w-0">
            <strong class="block">A new list</strong>
            <span class="meta block text-sm">Start another list and keep the others.</span>
          </span>
        </label>
      </div>
      <div class="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" class="btn btn-secondary" (click)="answer(null)">Cancel</button>
        <button type="button" class="btn btn-primary" (click)="answer(picked())">Add to list</button>
      </div>
    </dialog>
  `,
})
export class ListChoiceDialog {
  private readonly lists = inject(ShopLists);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** The choice marked: a list's id, or 'new'. It starts at the newest list each time the question is asked. */
  protected readonly picked = linkedSignal<ListPick>(() => this.lists.question()?.lists[0]?.id ?? 'new');

  /** Each list in use in two lines: its name, then "2 recipes · Shopping". */
  protected readonly choices = computed(() =>
    (this.lists.question()?.lists ?? []).map((list) => ({
      id: list.id,
      name: list.name,
      about: `${plural(list.recipeCount, 'recipe', 'recipes')} · ${list.status}`,
    })),
  );

  constructor() {
    // Open while there is a question; closed when there is none.
    effect(() => {
      const question = this.lists.question();
      const dialog = this.dialog().nativeElement;
      if (question !== null && !dialog.open) {
        // showModal is missing only in the unit tests' stand-in for a browser.
        if (dialog.showModal) {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
      } else if (question === null && dialog.open) {
        if (dialog.close) {
          dialog.close();
        } else {
          dialog.removeAttribute('open');
        }
      }
    });
  }

  /** Settles the question once; closing the dialog afterwards finds none left to answer. */
  protected answer(pick: ListPick | null): void {
    const question = this.lists.question();
    if (question !== null) {
      this.lists.question.set(null);
      question.settle(pick);
    }
  }

  /** A click on the dimmed area around the box, which is the dialog element itself, cancels. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.answer(null);
    }
  }
}
