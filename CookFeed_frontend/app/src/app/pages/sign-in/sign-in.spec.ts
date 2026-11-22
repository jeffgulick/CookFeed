import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Account } from '../../core/api-types';
import { Session } from '../../core/session';
import { SignInPage } from './sign-in';

/* The sign-in page (the prototype's signin.html): until login exists, pick one of the store's accounts to see
   Cookfeed as that person does. The accounts are listed by what they are for: the admin, creators, home cooks. */
describe('Sign-in page', () => {
  const accounts: Account[] = [
    { id: 1, displayName: 'Alex Rivera', roles: ['HomeCook'], handle: null },
    { id: 3, displayName: 'Maria Conti', roles: ['HomeCook', 'Creator'], handle: 'maria-cooks' },
    { id: 4, displayName: 'Kenji Watanabe', roles: ['HomeCook', 'Creator'], handle: 'kenji-kitchen' },
    { id: 6, displayName: 'Cookfeed Admin', roles: ['Admin'], handle: null },
    { id: 7, displayName: 'Sam Lee', roles: ['HomeCook'], handle: null },
  ];

  let fixture: ComponentFixture<SignInPage>;
  let page: HTMLElement;
  let session: Session;

  async function show(signedInAs: number | null, reachable = true): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [SignInPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    session = TestBed.inject(Session);
    session.accounts.set(reachable ? accounts : []);
    session.reachable.set(reachable);
    if (signedInAs !== null) {
      session.signIn(signedInAs);
    }
    fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
  }

  const namesIn = (group: string) =>
    Array.from(page.querySelectorAll(`[data-group="${group}"] [data-account-name]`)).map((el) => el.textContent?.trim());

  const button = (text: string) =>
    Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

  it('lists each account under what it is for', async () => {
    await show(null);

    expect(page.querySelector('h1')?.textContent).toContain('Sign in');
    expect(namesIn('homeCooks')).toEqual(['Alex Rivera', 'Sam Lee']);
    expect(namesIn('creators')).toEqual(['Maria Conti', 'Kenji Watanabe']);
    expect(namesIn('admins')).toEqual(['Cookfeed Admin']);
  });

  it('says what each account is, with a creator handle', async () => {
    await show(null);

    const kenji = page.querySelector('[data-account-id="4"]')!;
    expect(kenji.textContent).toContain('Home cook + Creator');
    expect(kenji.textContent).toContain('@kenji-kitchen');
    expect(page.querySelector('[data-account-id="6"]')!.textContent).toContain('Admin');
  });

  it('tells a guest they are browsing as one', async () => {
    await show(null);

    expect(page.querySelector('[role="status"]')?.textContent).toContain('You are browsing as a guest');
  });

  it('signs in as the account picked', async () => {
    await show(null);

    button('Sign in as Alex Rivera').click();
    await fixture.whenStable();

    expect(session.user()?.id).toBe(1);
    expect(page.querySelector('[role="status"]')?.textContent).toContain('You are signed in as Alex Rivera');
    expect(page.querySelector('[data-account-id="1"]')?.textContent).toContain('Signed in now');
    expect(button('Sign in as Alex Rivera')).toBeUndefined();
  });

  it.each([
    [1, 'Continue to Discover', '/'],
    [4, 'Open My studio', '/studio'],
    [6, 'Open the Admin console', '/admin'],
  ])('points account %i to where it would go next: %s', async (id, text, href) => {
    await show(id);

    const next = Array.from(page.querySelectorAll('[role="status"] a')).find((a) => a.textContent?.includes(text));
    expect(next?.getAttribute('href')).toBe(href);
  });

  it('signs out and goes back to browsing as a guest', async () => {
    await show(4);

    button('Sign out and browse as a guest').click();
    await fixture.whenStable();

    expect(session.user()).toBeNull();
    expect(page.querySelector('[role="status"]')?.textContent).toContain('You are browsing as a guest');
  });

  it('says so when the accounts could not be loaded, instead of showing empty lists', async () => {
    await show(null, false);

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
    expect(page.querySelector('[data-group]')).toBeNull();
  });
});

/* "Sign in to buy" on a plan sends the visitor here with the page they were on (the prototype's ?next=). Once they
   have picked an account, the way back is the first thing offered. Only a page of this app counts. */
describe('Sign-in page, reached from another page', () => {
  const alex: Account = { id: 1, displayName: 'Alex Rivera', roles: ['HomeCook'], handle: null };

  async function open(address: string): Promise<HTMLElement> {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'sign-in', component: SignInPage }]), provideHttpClient(), provideHttpClientTesting()],
    });
    const session = TestBed.inject(Session);
    session.accounts.set([alex]);
    session.signIn(alex.id);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(address, SignInPage);
    return harness.routeNativeElement as HTMLElement;
  }

  it('offers the way back to that page first', async () => {
    const page = await open('/sign-in?next=%2Fcreators%2Fkenji-kitchen');

    const first = page.querySelector('[role="status"] a');
    expect(first?.textContent).toContain('Back to the page you were on');
    expect(first?.getAttribute('href')).toBe('/creators/kenji-kitchen');
  });

  it('offers no way back when it was opened on its own', async () => {
    const page = await open('/sign-in');

    expect(page.querySelector('[role="status"]')?.textContent).not.toContain('Back to the page you were on');
  });

  for (const next of ['https://example.com/', '//example.com/', '/sign-in', 'creators/kenji-kitchen']) {
    it(`ignores a way back that is not a page of this app: ${next}`, async () => {
      const page = await open('/sign-in?next=' + encodeURIComponent(next));

      expect(page.querySelector('[role="status"]')?.textContent).not.toContain('Back to the page you were on');
    });
  }
});
