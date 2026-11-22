import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';

/** A short message about what just happened. "problem" is something that did not work. */
export interface Notice {
  text: string;
  kind: 'done' | 'problem';
}

/**
 * What just happened, said once in a place every page shares (the prototype's showToast): "The Bread Box added to
 * your cart." The app shell draws it in a live region, so a screen reader announces it; it clears itself.
 */
@Injectable({ providedIn: 'root' })
export class Notices {
  /** Long enough to read a sentence, short enough not to sit over the page. */
  private static readonly ShownForMs = 6000;

  private readonly current = signal<Notice | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly message = this.current.asReadonly();

  /** Something was done. */
  say(text: string): void {
    this.show({ text, kind: 'done' });
  }

  /** Something could not be done. */
  problem(text: string): void {
    this.show({ text, kind: 'problem' });
  }

  private show(notice: Notice): void {
    clearTimeout(this.timer);
    this.current.set(notice);
    this.timer = setTimeout(() => this.current.set(null), Notices.ShownForMs);
  }
}

/**
 * The sentence the API gave for refusing a request (the detail of its ProblemDetails body), or the fallback when
 * it gave none, as when the API cannot be reached.
 */
export function problemText(error: unknown, fallback: string): string {
  const detail = error instanceof HttpErrorResponse ? (error.error as { detail?: unknown } | null)?.detail : null;
  return typeof detail === 'string' && detail !== '' ? detail : fallback;
}
