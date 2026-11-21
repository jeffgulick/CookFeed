import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LoadState } from '../core/load-list';

/**
 * What a list says while it is being read, and when the read failed, so a page never shows an empty space with no
 * explanation. It shows nothing once the list is ready; the page draws the list itself.
 */
@Component({
  selector: 'app-load-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('loading') {
        <p role="status" class="meta mt-5">Loading {{ what() }}&hellip;</p>
      }
      @case ('failed') {
        <p role="alert" class="card mt-5 border-bad bg-bad-soft p-4 text-ink">
          The {{ what() }} could not be loaded. Check that the Cookfeed API is running, then reload this page.
        </p>
      }
    }
  `,
})
export class LoadStateMessage {
  readonly state = input.required<LoadState>();

  /** What is being read, as the sentence names it: "recipes", "plans", "creators". */
  readonly what = input.required<string>();
}
