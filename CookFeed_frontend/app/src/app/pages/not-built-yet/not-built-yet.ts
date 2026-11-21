import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

/** Stands in for a page that is still to be converted from the prototype. It is removed when the last one is built. */
@Component({
  selector: 'app-not-built-yet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <span class="pill">Coming soon</span>
    <h1 class="mt-3 text-3xl font-bold md:text-4xl">{{ name }}</h1>
    <p class="meta mt-3 max-w-prose">This page is still being built.</p>
    <p class="mt-6"><a routerLink="/" class="btn btn-secondary">Back to Discover</a></p>
  `,
})
export class NotBuiltYetPage {
  protected readonly name: string = inject(ActivatedRoute).snapshot.data['name'] ?? 'This page';
}
