import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/* Line icons, drawn here so nothing is downloaded. Each is a 24 by 24 outline in the current text color. */
const ICONS = {
  discover: ['M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z', 'M15.5 8.5l-2 5-5 2 2-5z'],
  plans: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  recipes: ['M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z', 'M5 17a3 3 0 0 1 3-3h11'],
  kitchen: ['M5 10h14v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z', 'M3 10h18', 'M9 6c0-1.2 1-1.2 1-2.4', 'M14 6c0-1.2 1-1.2 1-2.4'],
  more: ['M4 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0', 'M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0', 'M18 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0'],
  cart: ['M3 4h2l2.4 11h10.2L20 7H6.2', 'M8 20a1 1 0 1 0 2 0a1 1 0 1 0-2 0', 'M16 20a1 1 0 1 0 2 0a1 1 0 1 0-2 0'],
  user: ['M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8z', 'M4 20a8 8 0 0 1 16 0'],
  admin: ['M12 3l8 3v6c0 5-3.5 8-8 9c-4.5-1-8-4-8-9V6z', 'M9 12l2 2 4-4'],
  orders: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M9 8h6', 'M9 12h6'],
  help: ['M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z', 'M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.5-1.2 1-1.2 1.8', 'M12 17h.01'],
  studio: ['M4 6h11v12H4z', 'M15 10l5-3v10l-5-3z'],
  clock: ['M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  servings: ['M9 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6z', 'M3 20a6 6 0 0 1 12 0', 'M16 5.2a3 3 0 0 1 0 5.6', 'M17.5 14.3A6 6 0 0 1 21 20'],
  saved: ['M6 4h12v17l-6-4-6 4z'],
  check: ['M5 12l5 5L20 7'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  chevron: ['M6 9l6 6 6-6'],
  play: ['M8 5v14l11-7z'],
  list: ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
  signOut: ['M15 4h4v16h-4', 'M10 8l-4 4 4 4', 'M6 12h10'],
} as const;

export type IconName = keyof typeof ICONS;

/** A decorative icon. It is hidden from screen readers, so the control it sits in always carries its own text. */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      [attr.width]="size()"
      [attr.height]="size()"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      @for (d of paths(); track d) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(24);
  protected readonly paths = computed(() => ICONS[this.name()]);
}
