import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, skip } from 'rxjs';
import { Session } from './core/session';
import { Icon, IconName } from './ui/icon';

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

/**
 * The app shell: the navigation every page shares, and the place each page is drawn. A wide screen gets a bar of
 * links across the top. A phone gets a row of tabs along the bottom, where a thumb reaches, with the remaining pages
 * and the account behind More. Which links appear follows who is signed in (Session).
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CdkMenuTrigger, CdkMenu, CdkMenuItem, Icon],
  templateUrl: './app.html',
})
export class App {
  protected readonly session = inject(Session);
  private readonly router = inject(Router);
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
