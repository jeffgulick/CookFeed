import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Account } from './api-types';
import { SESSION_STORAGE_KEY, Session } from './session';

/* Session: who is signed in, and what that account may be offered (the prototype's rules.js, sections 3.1 and 3.8). */
describe('Session', () => {
  const alex: Account = { id: 1, displayName: 'Alex Rivera', roles: ['HomeCook'], handle: null };
  const kenji: Account = { id: 4, displayName: 'Kenji Watanabe', roles: ['HomeCook', 'Creator'], handle: 'kenji-kitchen' };
  const admin: Account = { id: 6, displayName: 'Cookfeed Admin', roles: ['Admin'], handle: null };

  let http: HttpTestingController;

  function start(storedId?: string): Session {
    localStorage.clear();
    if (storedId !== undefined) {
      localStorage.setItem(SESSION_STORAGE_KEY, storedId);
    }
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(Session);
  }

  async function loaded(session: Session): Promise<Session> {
    const loading = session.load();
    http.expectOne('/api/accounts').flush([alex, kenji, admin]);
    await loading;
    return session;
  }

  afterEach(() => http.verify());

  it('starts as a guest when nothing is stored', async () => {
    const session = await loaded(start());

    expect(session.user()).toBeNull();
    expect(session.accounts().length).toBe(3);
  });

  it('restores the account chosen on an earlier visit', async () => {
    const session = await loaded(start('4'));

    expect(session.user()).toEqual(kenji);
  });

  it.each(['99', '0', '-1', 'alex', '1.5'])('treats a stored id of %s that names no account as a guest', async (stored) => {
    const session = await loaded(start(stored));

    expect(session.user()).toBeNull();
  });

  it('signs in, and remembers the choice', async () => {
    const session = await loaded(start());

    session.signIn(1);

    expect(session.user()).toEqual(alex);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBe('1');
  });

  it('signs out, and forgets the choice', async () => {
    const session = await loaded(start('1'));

    session.signOut();

    expect(session.user()).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('lets a home cook shop, and nothing more', async () => {
    const session = await loaded(start('1'));

    expect([session.canShop(), session.isCreator(), session.isAdmin()]).toEqual([true, false, false]);
  });

  it('lets a creator shop and run a studio', async () => {
    const session = await loaded(start('4'));

    expect([session.canShop(), session.isCreator(), session.isAdmin()]).toEqual([true, true, false]);
  });

  it('gives the admin the console and no shopping', async () => {
    const session = await loaded(start('6'));

    expect([session.canShop(), session.isCreator(), session.isAdmin()]).toEqual([false, false, true]);
  });

  it('shows the shopper links to a guest and a cook, and leaves them out for the admin', async () => {
    const session = await loaded(start());
    expect(session.showShopLinks()).toBe(true);

    session.signIn(1);
    expect(session.showShopLinks()).toBe(true);

    session.signIn(6);
    expect(session.showShopLinks()).toBe(false);
  });

  it('browses as a guest, and says so, when the accounts cannot be read', async () => {
    const session = start('1');
    const loading = session.load();
    http.expectOne('/api/accounts').flush('down', { status: 503, statusText: 'Service Unavailable' });
    await loading;

    expect(session.user()).toBeNull();
    expect(session.reachable()).toBe(false);
  });
});
