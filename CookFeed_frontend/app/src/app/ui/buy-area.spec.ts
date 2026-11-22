import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BuyState } from '../core/buy-state';
import { Notices } from '../core/notices';
import { BuyArea } from './buy-area';

/* The buy area of a plan (the prototype's renderBuyArea): one line that says where the viewer stands with it. */
describe('Buy area', () => {
  /** A page at /plans/3 holding the buy area, as a real page would. */
  @Component({
    imports: [BuyArea],
    template: '<app-buy-area [state]="state()" [noun]="noun()" [productId]="3" title="Three Weeknights in Japan" />',
  })
  class PlanPage {
    readonly state = signal<BuyState>('buy');
    readonly noun = signal<'plan' | 'collection'>('plan');
  }

  let area: HTMLElement;
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  async function show(state: BuyState, noun: 'plan' | 'collection' = 'plan'): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'plans/:id', component: PlanPage }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/plans/3', PlanPage);
    page.state.set(state);
    page.noun.set(noun);
    await harness.fixture.whenStable();
    area = harness.routeNativeElement as HTMLElement;
  }

  const text = () => area.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('asks a visitor to sign in, and remembers the page to come back to', async () => {
    await show('signIn');

    const link = area.querySelector('a');
    expect(link?.textContent?.trim()).toBe('Sign in to buy');
    expect(link?.getAttribute('href')).toBe('/sign-in?next=%2Fplans%2F3');
  });

  it('tells a buyer they own it and where their orders are', async () => {
    await show('owned', 'collection');

    expect(text()).toContain('You own this collection');
    expect(area.querySelector('a')?.getAttribute('href')).toBe('/orders');
    expect(area.querySelector('a')?.textContent?.trim()).toBe('See your orders');
  });

  it('leads to the cart when the plan is already in it', async () => {
    await show('inCart');

    expect(area.querySelector('a')?.textContent).toContain('In your cart');
    expect(area.querySelector('a')?.getAttribute('href')).toBe('/cart');
  });

  it('tells a creator why they cannot buy their own', async () => {
    await show('yourOwn');

    expect(text()).toBe("This is your plan. Creators can't buy their own.");
  });

  it('says so when it is no longer for sale', async () => {
    await show('notForSale');

    expect(text()).toBe('No longer for sale');
  });

  it('offers Add to cart to a cook who can buy it', async () => {
    await show('buy');

    const button = area.querySelector('button');
    expect(button?.textContent?.trim()).toBe('Add to cart');
    expect(button?.getAttribute('type')).toBe('button');
  });

  it('adds the plan to the cart when pressed, and says so', async () => {
    await show('buy');

    area.querySelector('button')!.click();
    const request = http.expectOne('/api/me/cart/3');
    expect(request.request.method).toBe('PUT');
    request.flush({ lines: [], totalCents: 0, currency: 'USD', unavailable: [] });
    await harness.fixture.whenStable();

    expect(TestBed.inject(Notices).message()?.text).toBe('Three Weeknights in Japan added to your cart.');
  });

  it('cannot be pressed twice while the plan is being added', async () => {
    await show('buy');

    area.querySelector('button')!.click();
    await harness.fixture.whenStable();

    expect(area.querySelector('button')?.disabled).toBe(true);
    http.expectOne('/api/me/cart/3').flush({ lines: [], totalCents: 0, currency: 'USD', unavailable: [] });
  });

  it('says what the API said when the plan cannot be added', async () => {
    await show('buy');

    area.querySelector('button')!.click();
    http
      .expectOne('/api/me/cart/3')
      .flush({ detail: 'This plan is no longer for sale.' }, { status: 409, statusText: 'Conflict' });
    await harness.fixture.whenStable();

    const notice = TestBed.inject(Notices).message();
    expect(notice?.text).toBe('This plan is no longer for sale.');
    expect(notice?.kind).toBe('problem');
    expect(area.querySelector('button')?.disabled).toBe(false);
  });

  it('shows the admin nothing', async () => {
    await show('noShop');

    expect(text()).toBe('');
  });
});
