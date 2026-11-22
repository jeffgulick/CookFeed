import { ChangeDetectionStrategy, Component, ElementRef, Injectable, effect, inject, signal, viewChild } from '@angular/core';

interface Question {
  message: string;
  /** The words on the button that goes ahead: the action's own name, such as "Place order". */
  action: string;
  settle: (answer: boolean) => void;
}

/**
 * Asks before something that cannot be undone with one press: placing an order, emptying the cart (the prototype's
 * confirmDialog). A page calls ask() and waits for yes or no; the app shell holds the one dialog that shows it.
 */
@Injectable({ providedIn: 'root' })
export class Confirm {
  /** The question being asked, or null. Read by the dialog. */
  readonly question = signal<Question | null>(null);

  /** Resolves true when the action's button is pressed; false for Cancel, Escape or a click outside. */
  ask(message: string, action: string): Promise<boolean> {
    // A second question while one is open answers the first with no.
    this.question()?.settle(false);
    return new Promise((settle) => this.question.set({ message, action, settle }));
  }
}

/**
 * The dialog that shows a Confirm question. A native modal dialog: focus moves into it and stays there, Escape
 * closes it, the page behind cannot be used, and focus returns to the button that asked.
 */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      aria-labelledby="confirmQuestion"
      class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-6 text-ink shadow-lift backdrop:bg-ink/50"
      (close)="answer(false)"
      (click)="onBackdrop($event)"
    >
      <p id="confirmQuestion" class="text-lg font-semibold">{{ confirm.question()?.message }}</p>
      <div class="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" class="btn btn-secondary" (click)="answer(false)">Cancel</button>
        <button type="button" class="btn btn-primary" (click)="answer(true)">{{ confirm.question()?.action }}</button>
      </div>
    </dialog>
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(Confirm);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // Open while there is a question; closed when there is none.
    effect(() => {
      const asking = this.confirm.question() !== null;
      const dialog = this.dialog().nativeElement;
      if (asking && !dialog.open) {
        // showModal is missing only in the unit tests' stand-in for a browser.
        if (dialog.showModal) {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
      } else if (!asking && dialog.open) {
        if (dialog.close) {
          dialog.close();
        } else {
          dialog.removeAttribute('open');
        }
      }
    });
  }

  /** Settles the question once; closing the dialog afterwards finds none left to answer. */
  protected answer(yes: boolean): void {
    const question = this.confirm.question();
    if (question !== null) {
      this.confirm.question.set(null);
      question.settle(yes);
    }
  }

  /** A click on the dimmed area around the box, which is the dialog element itself, is a no. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.answer(false);
    }
  }
}
