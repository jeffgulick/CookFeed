import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CreatorTile as CreatorTileData } from '../core/api-types';
import { Icon } from './icon';

/**
 * One creator as a tile: their picture, name, the verified mark and their handle. The whole tile leads to their
 * storefront; the name is the link a keyboard or screen reader lands on.
 */
@Component({
  selector: 'app-creator-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  host: {
    class: 'card relative flex items-center gap-4 p-4 transition-shadow focus-within:shadow-lift hover:shadow-lift',
    '[attr.data-creator-handle]': 'creator().handle',
  },
  template: `
    @if (creator().avatarUrl; as avatar) {
      <!-- Decorative: the name beside it says who this is. -->
      <img
        [src]="'/' + avatar"
        alt=""
        width="56"
        height="56"
        loading="lazy"
        class="size-14 shrink-0 rounded-full bg-fill object-cover"
      />
    } @else {
      <span
        data-initial
        aria-hidden="true"
        class="grid size-14 shrink-0 place-items-center rounded-full bg-brand-soft text-xl font-bold text-brand-dark"
        >{{ initial() }}</span
      >
    }
    <div class="min-w-0">
      <h3 class="text-lg leading-snug font-bold">
        <!-- after:absolute stretches the link over the whole tile, so the tile is one target. -->
        <a [routerLink]="['/creators', creator().handle]" class="text-ink no-underline after:absolute after:inset-0">{{
          creator().displayName
        }}</a>
      </h3>
      <p class="meta flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>&#64;{{ creator().handle }}</span>
        @if (creator().isVerified) {
          <span class="tag-good"><app-icon name="check" [size]="14" /> Verified</span>
        }
      </p>
    </div>
  `,
})
export class CreatorTile {
  readonly creator = input.required<CreatorTileData>();

  /** The first letter of the name, shown in a circle when the creator has no picture. */
  protected readonly initial = computed(() => this.creator().displayName.trim().charAt(0).toUpperCase());
}
