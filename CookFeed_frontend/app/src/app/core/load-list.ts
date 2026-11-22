import { Signal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, distinctUntilChanged, map, of, switchMap } from 'rxjs';

/** Where the reading of a list stands. */
export type LoadState = 'loading' | 'ready' | 'failed';

/** A list read from the API, and where the reading stands. */
export interface LoadedList<T> {
  readonly items: Signal<T[]>;
  readonly state: Signal<LoadState>;
}

/**
 * Reads a list from the API for a page, and reports whether it is still loading, ready, or failed, so the page can
 * say which. Give it <code>reloadWhen</code> to read the list again each time that value changes: a list that
 * depends on who is signed in passes the account's id. A failed read does not stop a later one.
 *
 * Call it while the page is being created (a field initializer or the constructor): the read stops by itself
 * when the page is closed.
 */
export function loadList<T>(read: () => Observable<T[]>, reloadWhen?: Signal<unknown>): LoadedList<T> {
  const items = signal<T[]>([]);
  const state = signal<LoadState>('loading');
  const when = reloadWhen === undefined ? of(null) : toObservable(reloadWhen).pipe(distinctUntilChanged());

  when
    .pipe(
      // switchMap drops the answer to an older read when a newer one starts, so the list never shows stale rows.
      switchMap(() =>
        read().pipe(
          map((list) => ({ list })),
          catchError(() => of(null)),
        ),
      ),
      takeUntilDestroyed(),
    )
    .subscribe((result) => {
      if (result === null) {
        state.set('failed');
      } else {
        items.set(result.list);
        state.set('ready');
      }
    });

  return { items: items.asReadonly(), state: state.asReadonly() };
}
