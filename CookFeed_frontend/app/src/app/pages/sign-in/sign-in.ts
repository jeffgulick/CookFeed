import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, UrlTree } from '@angular/router';
import { map } from 'rxjs';
import { Account, Role } from '../../core/api-types';
import { Session } from '../../core/session';
import { Icon } from '../../ui/icon';

const ROLE_LABELS: Record<Role, string> = { HomeCook: 'Home cook', Creator: 'Creator', Admin: 'Admin' };

interface AccountGroup {
  id: 'homeCooks' | 'creators' | 'admins';
  heading: string;
  about: string;
  accounts: Account[];
}

/**
 * The sign-in page. Until login exists, signing in is picking one of the store's accounts, to see Cookfeed the way
 * that person does. Each account is listed under what it is for, so a first-time visitor can tell them apart.
 */
@Component({
  selector: 'app-sign-in',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './sign-in.html',
})
export class SignInPage {
  protected readonly session = inject(Session);
  private readonly router = inject(Router);

  /**
   * The page the visitor was on when they followed a "Sign in to ..." link (?next=), or null. Only a page of
   * this app counts: a path that starts with one slash. Anything else, such as another site's address someone
   * put in the link, is ignored.
   */
  protected readonly next = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((query) => this.pageOfThisApp(query.get('next')))),
    { requireSync: true },
  );

  /** The admin holds no other role, a creator is also a home cook, and everyone else is a home cook. */
  protected readonly groups = computed<AccountGroup[]>(() => {
    const accounts = this.session.accounts();
    const isAdmin = (a: Account) => a.roles.includes('Admin');
    const isCreator = (a: Account) => !isAdmin(a) && a.roles.includes('Creator');
    return [
      {
        id: 'homeCooks',
        heading: 'Home cooks',
        about: 'Save recipes, plan meals, buy plans and review the plans they bought.',
        accounts: accounts.filter((a) => !isAdmin(a) && !isCreator(a)),
      },
      {
        id: 'creators',
        heading: 'Creators',
        about:
          'Publish recipes and sell plans. Every creator is also a home cook, so they shop like anyone else, but never buy or review their own plans.',
        accounts: accounts.filter(isCreator),
      },
      {
        id: 'admins',
        heading: 'Admin',
        about: 'Runs the site. The admin account holds no other role, so it cannot save, buy or review.',
        accounts: accounts.filter(isAdmin),
      },
    ];
  });

  private pageOfThisApp(next: string | null): UrlTree | null {
    const isOwnPage = next !== null && /^\/[^/\\]/.test(next) && !next.startsWith('/sign-in');
    return isOwnPage ? this.router.parseUrl(next) : null;
  }

  /** "Home cook + Creator". */
  protected roleText(account: Account): string {
    return account.roles.map((role) => ROLE_LABELS[role]).join(' + ');
  }
}
