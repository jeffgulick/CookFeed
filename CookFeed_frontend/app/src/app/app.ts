import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, skip } from 'rxjs';
import { Cart } from './core/cart';
import { Notices } from './core/notices';
import { Session } from './core/session';
import { ConfirmDialog } from './ui/confirm';
import { plural } from './ui/format';
import { Icon, IconName } from './ui/icon';
import { ListChoiceDialog } from './ui/list-choice-dialog';

interface NavLink {
  path: string;
  label: string;
  /** The shorter label a phone's tab shows. */
  short?: string;
  icon: IconName;
  /** True for a link that is current only on exactly its own path (Discover, at "/"). */
  exact?: boolean;
}

const DISCOVER: NavLink = { path: '/', label: 'Discover', icon: 'discover', exact: true };
const PLANS: NavLink = { path: '/plans', label: 'Plans & collections', short: 'Plans', icon: 'plans' };
const RECIPES: NavLink = { path: '/recipes', label: 'Recipes', icon: 'recipes' };
const KITCHEN: NavLink = { path: '/kitchen', label: 'My kitchen', short: 'Kitchen', icon: 'kitchen' };
const ORDERS: NavLink = { path: '/orders', label: 'Your orders', icon: 'orders' };
const HELP: NavLink = { path: '/help', label: 'Help', icon: 'help' };
const STUDIO: NavLink = { path: '/studio', label: 'My studio', icon: 'studio' };
const ADMIN: NavLink = { path: '/admin', label: 'Admin', icon: 'admin' };

/** The pages the navigation leads to directly. Every other page is inside one of them, and gets a Back button. */
const TOP_PAGES = new Set([DISCOVER, PLANS, RECIPES, KITCHEN, ORDERS, HELP, STUDIO, ADMIN].map((link) => link.path));

/**
 * The page one level above an address: where Back goes when the page was opened by its address, so there is no
 * earlier page to return to. A recipe opened from a plan (?product=3) is under that plan; a shopping list is under
 * My kitchen; a creator's storefront, the cart and the sign-in page are under Discover.
 */
export function upFrom(address: string): string {
  const [path, query = ''] = address.split('#')[0].split('?');
  const product = new URLSearchParams(query).get('product');
  if (path.startsWith('/recipes/') && product !== null && /^\d+$/.test(product)) {
    return `/plans/${product}`;
  }
  if (path === '/list') {
    return KITCHEN.path;
  }
  const above = path.slice(0, path.lastIndexOf('/'));
  return above === '' || above === '/creators' ? DISCOVER.path : above;
}

/**
 * The app shell: the navigation every page shares, and the place each page is drawn. A wide screen gets a bar of
 * links across the top. A phone gets a row of tabs along the bottom, where a thumb reaches, with the remaining pages
 * and the account behind More. Which links appear follows who is signed in (Session).
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CdkMenuTrigger, CdkMenu, CdkMenuItem, Icon, ConfirmDialog, ListChoiceDialog],
  templateUrl: './app.html',
})
export class App {
  protected readonly session = inject(Session);
  protected readonly cart = inject(Cart);
  protected readonly notices = inject(Notices);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');
  private readonly moreSheet = viewChild.required<ElementRef<HTMLDialogElement>>('moreSheet');

  /** The top bar's links: shopper pages unless the admin is signed in, then the studio or the console. */
  protected readonly topLinks = computed<NavLink[]>(() => [
    DISCOVER,
    PLANS,
    RECIPES,
    ...(this.session.showShopLinks() ? [KITCHEN, ORDERS] : []),
    HELP,
    ...(this.session.isCreator() ? [STUDIO] : []),
    ...(this.session.isAdmin() ? [ADMIN] : []),
  ]);

  /** The four tabs a phone shows beside More: the admin's fourth is the console, everyone else's the kitchen. */
  protected readonly tabs = computed<NavLink[]>(() => [
    DISCOVER,
    PLANS,
    RECIPES,
    this.session.isAdmin() ? ADMIN : KITCHEN,
  ]);

  /** What More holds on a phone: the pages that did not fit in the tabs. */
  protected readonly moreLinks = computed<NavLink[]>(() => [
    ...(this.session.showShopLinks() ? [ORDERS] : []),
    ...(this.session.isCreator() ? [STUDIO] : []),
    HELP,
  ]);

  /** The address being shown, kept up to date as the cook moves between pages. */
  private readonly address = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** How many pages the browser's Back could return through inside the app: 0 on the first page opened here. */
  private pagesBefore = 0;

  /** pagesBefore as it was when each move between pages finished, so a move through the browser's history finds its place again. */
  private readonly pagesBeforeAt = new Map<number, number>();

  /** A phone shows Back on every page the navigation does not lead to directly. */
  protected readonly showBack = computed(() => !TOP_PAGES.has(this.address().split(/[?#]/)[0]));

  /** What a screen reader says for the cart link: "Cart, 2 items", or just "Cart" when it is empty. */
  protected readonly cartLabel = computed(() => {
    const count = this.cart.count();
    return count === 0 ? 'Cart' : `Cart, ${plural(count, 'item', 'items')}`;
  });

  /** "AR" for Alex Rivera: the account's badge in the top bar. */
  protected readonly initials = computed(() =>
    (this.session.user()?.displayName ?? '')
      .split(/\s+/)
      .map((word) => word.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );

  constructor() {
    this.trackPagesBefore();

    // After each move to another page, focus goes to the page's content, so a keyboard or screen-reader user
    // starts at the new page rather than back in the navigation. Not on the first load: nothing was navigated from.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        skip(1),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.closeMore();
        this.main().nativeElement.focus({ preventScroll: true });
      });
  }

  /** The skip link: move focus to the content without changing the address. */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.main().nativeElement.focus();
  }

  /**
   * Back: to the page the cook came from. On the first page opened here there is none (the page was reached by its
   * address or a reload), so Back goes up a level instead, in place of the page being left, so that a second Back
   * goes up again rather than returning to it.
   */
  protected goBack(): void {
    if (this.pagesBefore > 0) {
      this.location.back();
    } else {
      void this.router.navigateByUrl(upFrom(this.address()), { replaceUrl: true });
    }
  }

  /**
   * Keeps pagesBefore right as the cook moves: a link adds a page, a move that replaces the page adds none, and the
   * browser's own Back or Forward lands on a page whose count was noted when it was first shown.
   */
  private trackPagesBefore(): void {
    let next: { id: number; pagesBefore: number } | null = null;
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        const first = this.pagesBeforeAt.size === 0;
        const replaces = this.router.currentNavigation()?.extras.replaceUrl === true;
        const pagesBefore =
          event.navigationTrigger === 'popstate'
            ? (this.pagesBeforeAt.get(event.restoredState?.navigationId ?? -1) ?? 0)
            : first || replaces
              ? this.pagesBefore
              : this.pagesBefore + 1;
        next = { id: event.id, pagesBefore };
      } else if (event instanceof NavigationEnd && next?.id === event.id) {
        this.pagesBefore = next.pagesBefore;
        this.pagesBeforeAt.set(event.id, this.pagesBefore);
      }
    });
  }

  /** Opens More as a modal dialog: focus stays inside it, Escape closes it, and focus returns to the tab. */
  protected openMore(): void {
    this.moreSheet().nativeElement.showModal?.();
  }

  protected closeMore(): void {
    const sheet = this.moreSheet().nativeElement;
    if (sheet.open) {
      sheet.close();
    }
  }

  /** A click on the dimmed area around the sheet, which is the dialog element itself, closes it. */
  protected closeMoreOnBackdrop(event: MouseEvent): void {
    if (event.target === this.moreSheet().nativeElement) {
      this.closeMore();
    }
  }

  protected signOut(): void {
    this.session.signOut();
    this.closeMore();
  }
}
