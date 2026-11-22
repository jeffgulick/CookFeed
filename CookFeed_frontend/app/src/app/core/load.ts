import { HttpErrorResponse } from '@angular/common/http';
import { Signal, computed, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, distinctUntilChanged, map, of, switchMap } from 'rxjs';

/**
 * Where the reading of something from the API stands. "missing" is the API's 404: the address names nothing, which
 * a page says differently from "could not be loaded". "refused" is its 403: the thing exists and this viewer may not
 * have it; what the API said about it is in <code>refusal</code>.
 */
export type LoadState = 'loading' | 'ready' | 'failed' | 'missing' | 'refused';

/** One thing read from the API, and where the reading stands. The value is null until the first read succeeds. */
export interface LoadedValue<T> {
  readonly value: Signal<T | null>;
  readonly state: Signal<LoadState>;
  /** The body of the API's 403 when the state is "refused"; null otherwise. */
  readonly refusal: Signal<unknown>;
}

/** A list read from the API, and where the reading stands. The list is empty until the first read succeeds. */
export interface LoadedList<T> {
  readonly items: Signal<T[]>;
  readonly state: Signal<LoadState>;
}

type Outcome<T> = { state: 'ready'; value: T } | { state: 'failed' | 'missing' } | { state: 'refused'; refusal: unknown };

/**
 * Reads one thing from the API for a page, and reports whether it is still loading, ready, missing (404), refused
 * (403) or failed, so the page can say which. Give it <code>reloadWhen</code> to read again each time that value changes:
 * a page that depends on who is signed in, or on the address, passes those. A failed read does not stop a later
 * one, and the last value stays until a newer one arrives.
 *
 * Call it while the page is being created (a field initializer or the constructor): the read stops by itself
 * when the page is closed.
 */
export function loadValue<T>(read: () => Observable<T>, reloadWhen?: Signal<unknown>): LoadedValue<T> {
  const value = signal<T | null>(null);
  const state = signal<LoadState>('loading');
  const refusal = signal<unknown>(null);
  const when = reloadWhen === undefined ? of(null) : toObservable(reloadWhen).pipe(distinctUntilChanged());

  when
    .pipe(
      // switchMap drops the answer to an older read when a newer one starts, so the page never shows stale data.
      switchMap(() =>
        read().pipe(
          map((result): Outcome<T> => ({ state: 'ready', value: result })),
          catchError((error: unknown) => of(outcomeOf<T>(error))),
        ),
      ),
      takeUntilDestroyed(),
    )
    .subscribe((outcome) => {
      if (outcome.state === 'ready') {
        value.set(outcome.value);
      }
      refusal.set(outcome.state === 'refused' ? outcome.refusal : null);
      state.set(outcome.state);
    });

  return { value: value.asReadonly(), state: state.asReadonly(), refusal: refusal.asReadonly() };
}

/** What a failed read means: the API's 404 and 403 are answers; anything else is a failure. */
function outcomeOf<T>(error: unknown): Outcome<T> {
  if (error instanceof HttpErrorResponse && error.status === 404) {
    return { state: 'missing' };
  }
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return { state: 'refused', refusal: error.error };
  }
  return { state: 'failed' };
}

/** loadValue for a list: the same states, with an empty list until the first read succeeds. */
export function loadList<T>(read: () => Observable<T[]>, reloadWhen?: Signal<unknown>): LoadedList<T> {
  const loaded = loadValue(read, reloadWhen);
  return { items: computed(() => loaded.value() ?? []), state: loaded.state };
}
