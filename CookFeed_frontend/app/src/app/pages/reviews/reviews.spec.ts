import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import axe from 'axe-core';
import { Account, ProductReviews, Review, ReviewFormState } from '../../core/api-types';
import { Notices } from '../../core/notices';
import { Session } from '../../core/session';
import { Confirm } from '../../ui/confirm';
import { ReviewsPage } from './reviews';

/* A plan's reviews (the prototype's reviews.html?product=): the rating in three numbers with a bar per star, the
   reviews with a sort and two filters, and a line that says who may review. From GET /api/products/{id}/reviews,
   which sends the reviews this viewer may see and where they stand with reviewing (formState). */
describe('Reviews page', () => {
  const review = (id: number, reviewerName: string, rating: number, recommends: boolean, createdAt: string): Review => ({
    id,
    reviewerName,
    rating,
    recommends,
    body: `What ${reviewerName} thought.`,
    createdAt,
    isMine: false,
    isHidden: false,
    counts: true,
    reviewerIsCreator: false,
  });

  // Newest first, as the API sends them.
  const alex = review(1, 'Alex Rivera', 5, true, '2026-08-12T12:00:00+00:00');
  const priya = review(2, 'Priya Shah', 4, true, '2026-08-09T12:00:00+00:00');
  const dan = review(3, 'Dan Okafor', 3, false, '2026-08-02T12:00:00+00:00');

  const weeknights: ProductReviews = {
    productId: 3,
    type: 'MealPlan',
    title: 'Three Weeknights in Japan',
    creator: { handle: 'kenji-kitchen', displayName: 'Kenji Watanabe', isVerified: true },
    summary: { reviewCount: 3, average: 4, percentRecommend: 67, starCounts: [0, 0, 1, 1, 1] },
    formState: 'SignIn',
    reviews: [alex, priya, dan],
  };

  const unreviewed: ProductReviews = {
    ...weeknights,
    summary: { reviewCount: 0, average: null, percentRecommend: null, starCounts: [0, 0, 0, 0, 0] },
    reviews: [],
  };

  let harness: RouterTestingHarness;
  let page: HTMLElement;
  let http: HttpTestingController;

  async function openPage(): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'plans/:id/reviews', component: ReviewsPage }]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/plans/3/reviews', ReviewsPage);
    page = harness.routeNativeElement as HTMLElement;
  }

  async function show(reviews: ProductReviews): Promise<void> {
    await openPage();
    http.expectOne('/api/products/3/reviews').flush(reviews);
    await harness.fixture.whenStable();
  }

  const priyaShah: Account = { id: 2, displayName: 'Priya Shah', roles: ['HomeCook'], handle: null };

  /** Opens the page signed in as Priya, a buyer. */
  async function showAsBuyer(reviews: ProductReviews): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'plans/:id/reviews', component: ReviewsPage }]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(Session);
    session.accounts.set([priyaShah]);
    session.signIn(priyaShah.id);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/plans/3/reviews', ReviewsPage);
    page = harness.routeNativeElement as HTMLElement;
    http.expectOne('/api/products/3/reviews').flush(reviews);
    await harness.fixture.whenStable();
  }

  /** Lets a press, the request it sends and the redraw after it all finish. */
  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    await new Promise((done) => setTimeout(done));
    await harness.fixture.whenStable();
  }

  function fillForm(rating: number, words: string): void {
    const star = page.querySelector<HTMLInputElement>(`[data-review-form] input[name="rating"][value="${rating}"]`)!;
    star.checked = true;
    star.dispatchEvent(new Event('change'));
    const box = page.querySelector<HTMLTextAreaElement>('#reviewBody')!;
    box.value = words;
    box.dispatchEvent(new Event('input'));
  }

  const submit = () =>
    page.querySelector<HTMLFormElement>('[data-review-form]')!.dispatchEvent(new Event('submit', { cancelable: true }));

  const text = (selector: string) => page.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const texts = (selector: string) =>
    Array.from(page.querySelectorAll(selector)).map((el) => el.textContent?.replace(/\s+/g, ' ').trim());
  const names = () => texts('[data-review] [data-reviewer]');
  const bar = (stars: number) => page.querySelector(`[data-star-bar="${stars}"]`) as HTMLButtonElement;

  async function click(element: HTMLElement): Promise<void> {
    element.click();
    await harness.fixture.whenStable();
  }

  async function choose(selector: string, change: (el: HTMLInputElement & HTMLSelectElement) => void): Promise<void> {
    const element = page.querySelector(selector) as HTMLInputElement & HTMLSelectElement;
    change(element);
    element.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();
  }

  it('names the plan and leads back to it', async () => {
    await show(weeknights);

    expect(text('h1')).toBe('Three Weeknights in Japan');
    expect(page.querySelectorAll('h1').length).toBe(1);
    expect(text('[data-byline]')).toContain('by kenji-kitchen');
    expect(page.querySelector('[data-byline] a')?.getAttribute('href')).toBe('/creators/kenji-kitchen');
    expect(page.querySelector('[data-back] a')?.getAttribute('href')).toBe('/plans/3');
    expect(text('[data-back]')).toContain('Back to Three Weeknights in Japan');
    expect(TestBed.inject(Title).getTitle()).toBe('Reviews of Three Weeknights in Japan | Cookfeed');
  });

  it('sums the rating up in three numbers', async () => {
    await show(weeknights);

    expect(text('[data-average]')).toBe('4.0');
    expect(page.querySelector('[data-average-stars]')?.getAttribute('aria-label')).toBe('4.0 out of 5 stars');
    expect(text('[data-review-count]')).toBe('3 reviews');
    expect(text('[data-recommend]')).toBe('67% would recommend this plan');
  });

  it('counts the reviews for each number of stars, five first', async () => {
    await show(weeknights);

    expect(texts('[data-star-bar] [data-bar-count]')).toEqual(['1', '1', '1', '0', '0']);
    // Named by what it shows, so the spoken name matches the screen (WCAG 2.5.3).
    expect(bar(5).textContent?.replace(/\s+/g, ' ').trim()).toBe('5 ★ 1 review. Show only these.');
    expect(bar(2).textContent?.replace(/\s+/g, ' ').trim()).toBe('2 ★ 0 reviews. Show only these.');
    expect(bar(5).getAttribute('aria-label')).toBeNull();
    expect(bar(5).getAttribute('title')).toBe('Show only 5-star reviews');
    expect(bar(5).getAttribute('aria-pressed')).toBe('false');
  });

  it('says so when nobody has reviewed the plan, with nothing to sort', async () => {
    await show(unreviewed);

    expect(text('[data-summary]')).toBe('No reviews yet. Cooks who buy this plan can review it here.');
    expect(page.querySelector('[data-review-tools]')).toBeNull();
    expect(text('[data-review-list]')).toBe('No reviews yet.');
  });

  it('lists each review: who, how many stars, whether they recommend it, when, and what they said', async () => {
    await show(weeknights);

    expect(names()).toEqual(['Alex Rivera', 'Priya Shah', 'Dan Okafor']);
    const first = page.querySelector('[data-review]') as HTMLElement;
    expect(first.querySelector('[data-stars]')?.getAttribute('aria-label')).toBe('5 out of 5 stars');
    expect(first.textContent).toContain('Recommends');
    expect(first.textContent).toContain('August 12, 2026');
    expect(first.textContent).toContain('What Alex Rivera thought.');
    expect(page.querySelectorAll('[data-review]')[2].textContent).toContain('Does not recommend');
    expect(text('[data-showing]')).toBe('Showing all 3 reviews');
    expect(page.querySelector('[data-clear]')).toBeNull();
  });

  it('marks a review that is hidden or no longer counted, and says how many are not in the rating', async () => {
    await show({
      ...weeknights,
      reviews: [{ ...alex, isHidden: true, counts: false }, { ...priya, counts: false }, dan],
    });

    expect(page.querySelectorAll('[data-review]')[0].textContent).toContain('Hidden by Cookfeed');
    expect(page.querySelectorAll('[data-review]')[1].textContent).toContain('Not counted: order refunded');
    expect(page.querySelectorAll('[data-review]')[2].textContent).not.toContain('Not counted');
    expect(text('[data-showing]')).toBe('Showing all 3 reviews (2 not counted in the rating)');
  });

  it('shows only the reviews with the stars of the bar pressed, until it is pressed again', async () => {
    await show(weeknights);

    await click(bar(3));
    expect(names()).toEqual(['Dan Okafor']);
    expect(bar(3).getAttribute('aria-pressed')).toBe('true');
    expect(text('[data-showing]')).toBe('Showing 1 of 3 reviews');

    await click(bar(3));
    expect(names().length).toBe(3);
    expect(bar(3).getAttribute('aria-pressed')).toBe('false');
  });

  it('shows only the reviews that recommend it when asked', async () => {
    await show(weeknights);

    await choose('#recommendOnly', (box) => (box.checked = true));

    expect(names()).toEqual(['Alex Rivera', 'Priya Shah']);
  });

  it('sorts by rating either way, newest first among equals', async () => {
    await show({ ...weeknights, reviews: [alex, { ...priya, rating: 5 }, dan] });

    await choose('#sortReviews', (select) => (select.value = 'lowest'));
    expect(names()).toEqual(['Dan Okafor', 'Alex Rivera', 'Priya Shah']);

    await choose('#sortReviews', (select) => (select.value = 'highest'));
    expect(names()).toEqual(['Alex Rivera', 'Priya Shah', 'Dan Okafor']);
  });

  it('says when no review matches, and clears the filters in one press', async () => {
    await show(weeknights);

    await click(bar(1));
    expect(text('[data-review-list]')).toBe('No reviews match these filters.');

    await click(page.querySelector('[data-clear]') as HTMLElement);
    expect(names().length).toBe(3);
    expect(page.querySelector('[data-clear]')).toBeNull();
  });

  it('asks a visitor to sign in to write a review', async () => {
    await show(weeknights);

    expect(text('[data-review-gate]')).toBe('Sign in to write a review. Only cooks who bought this plan can review it.');
    expect(page.querySelector('[data-review-gate] a')?.getAttribute('href')).toBe('/sign-in?next=%2Fplans%2F3%2Freviews');
  });

  const gates: [ReviewFormState, string][] = [
    ['NoShop', 'Admin accounts do not write reviews. Hidden reviews show only to admins.'],
    ['YourOwn', 'This is your own plan. Creators cannot review their own.'],
    ['AlreadyReviewed', 'You have reviewed this plan. Thank you!'],
    ['HiddenReview', 'Cookfeed hid your review, so other cooks do not see it and it is not counted in the rating.'],
    ['RefundedReview', 'Your order for this plan was refunded, so your review is not counted.'],
    ['MustBuy', 'Only cooks who bought this plan can review it, so every review comes from someone who cooked it.'],
  ];
  for (const [formState, says] of gates) {
    it(`says why there is no review form: ${formState}`, async () => {
      await show({ ...weeknights, formState });

      expect(text('[data-review-gate]')).toBe(says);
    });
  }

  it('words the page for a collection', async () => {
    await show({ ...unreviewed, type: 'RecipeCollection', formState: 'MustBuy' });

    expect(text('[data-summary]')).toContain('Cooks who buy this collection can review it here.');
    expect(text('[data-review-gate]')).toContain('Only cooks who bought this collection can review it');
  });

  it('says there is no such plan at an address that names none', async () => {
    await openPage();
    http.expectOne('/api/products/3/reviews').flush('', { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();

    expect(text('h1')).toBe('Plan not found');
    expect(page.querySelector('a[href="/plans"]')).not.toBeNull();
  });

  it('says it is loading, then that it could not be loaded, rather than showing nothing', async () => {
    await openPage();
    expect(text('[role="status"]')).toContain('Loading');

    http.expectOne('/api/products/3/reviews').flush('down', { status: 503, statusText: 'Service Unavailable' });
    await harness.fixture.whenStable();

    expect(text('[role="alert"]')).toContain('could not be loaded');
    expect(page.querySelectorAll('h1').length).toBe(1);
  });

  it('has no accessibility violations a structural check can find', async () => {
    await show({ ...weeknights, reviews: [{ ...alex, isHidden: true, counts: false }, priya, dan] });
    await click(bar(4));

    // Color contrast needs a real browser's rendering; the browser tests check it.
    const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });

  /* ---------- writing a review ---------- */

  const canReview: ProductReviews = { ...unreviewed, formState: 'CanReview' };

  it('offers a buyer the form under their account name, with Yes chosen', async () => {
    await showAsBuyer(canReview);

    expect(text('[data-review-form]')).toContain('Posting as Priya Shah');
    expect(text('[data-review-form] legend')).toBe('Rating');
    expect(texts('[data-review-form] legend')[1]).toBe('Would you recommend this plan to another home cook?');
    const stars = Array.from(page.querySelectorAll('[data-review-form] input[name="rating"]')) as HTMLInputElement[];
    expect(stars.map((star) => star.closest('label')?.textContent?.trim())).toEqual([
      '1 star',
      '2 stars',
      '3 stars',
      '4 stars',
      '5 stars',
    ]);
    expect(stars.some((star) => star.checked)).toBe(false);
    expect((page.querySelector('[data-review-form] input[name="recommend"][value="yes"]') as HTMLInputElement).checked).toBe(true);
    expect(page.querySelector('label[for="reviewBody"]')?.textContent?.trim()).toBe('Your review');
    expect(page.querySelector('#reviewBody')?.getAttribute('maxlength')).toBe('2000');
    expect(text('[data-review-count-typed]')).toBe('0 / 2000');
    expect(page.querySelector('[data-review-gate]')).toBeNull();
  });

  it('shows no form to someone who may not review', async () => {
    await show({ ...unreviewed, formState: 'MustBuy' });

    expect(page.querySelector('[data-review-form]')).toBeNull();
  });

  it('says what is missing when Post review is pressed too soon, and posts nothing', async () => {
    await showAsBuyer(canReview);

    submit();
    await harness.fixture.whenStable();

    expect(text('#ratingError')).toBe('Choose a rating.');
    expect(text('#reviewBodyError')).toBe('Write at least 15 characters.');
    expect(page.querySelector('#reviewBody')?.getAttribute('aria-invalid')).toBe('true');
    http.expectNone((request) => request.method === 'POST');
  });

  it('counts the characters as they are typed, and does not count spaces around the text toward the 15', async () => {
    await showAsBuyer(canReview);

    fillForm(5, '      short      ');
    submit();
    await harness.fixture.whenStable();

    expect(text('[data-review-count-typed]')).toBe('17 / 2000');
    expect(text('#reviewBodyError')).toBe('Write at least 15 characters.');
    expect(text('#ratingError')).toBe('');
  });

  it('posts the review, thanks the reviewer, and reads the page again', async () => {
    await showAsBuyer(canReview);
    fillForm(4, '  One trip covered the week.  ');
    const no = page.querySelector<HTMLInputElement>('[data-review-form] input[name="recommend"][value="no"]')!;
    no.checked = true;
    no.dispatchEvent(new Event('change'));

    submit();
    const request = http.expectOne((r) => r.method === 'POST' && r.url === '/api/products/3/reviews');
    expect(request.request.body).toEqual({ rating: 4, recommends: false, body: 'One trip covered the week.' });
    const mine = { ...review(9, 'Priya Shah', 4, false, '2026-11-21T18:00:00+00:00'), isMine: true };
    const after: ProductReviews = {
      ...unreviewed,
      formState: 'AlreadyReviewed',
      summary: { reviewCount: 1, average: 4, percentRecommend: 0, starCounts: [0, 0, 0, 1, 0] },
      reviews: [mine],
    };
    request.flush(after, { status: 201, statusText: 'Created' });
    await settle();
    http.expectOne('/api/products/3/reviews').flush(after);
    await harness.fixture.whenStable();

    expect(names()).toEqual(['Priya Shah']);
    expect(page.querySelector('[data-review-form]')).toBeNull();
    expect(text('[data-review-gate]')).toBe('You have reviewed this plan. Thank you!');
    expect(TestBed.inject(Notices).message()?.text).toBe('Thanks, Priya Shah. Your review is at the top of the list.');
  });

  it('says what the API said when the review is refused, and keeps what was typed', async () => {
    await showAsBuyer(canReview);
    fillForm(5, 'One trip covered the week.');

    submit();
    http
      .expectOne((r) => r.method === 'POST')
      .flush({ detail: 'You have already reviewed this plan. An account reviews a plan once.' }, { status: 409, statusText: 'Conflict' });
    await settle();

    const notice = TestBed.inject(Notices).message();
    expect(notice?.kind).toBe('problem');
    expect(notice?.text).toBe('You have already reviewed this plan. An account reviews a plan once.');
    expect((page.querySelector('#reviewBody') as HTMLTextAreaElement).value).toBe('One trip covered the week.');
  });

  it('offers Delete my review on the viewer\'s own review only, and not on one Cookfeed hid', async () => {
    const mine = { ...priya, isMine: true };
    await showAsBuyer({ ...weeknights, formState: 'AlreadyReviewed', reviews: [alex, mine, dan] });

    const cards = Array.from(page.querySelectorAll('[data-review]'));
    expect(cards.map((card) => card.querySelector('button')?.textContent?.trim())).toEqual([
      undefined,
      'Delete my review',
      undefined,
    ]);

    TestBed.resetTestingModule();
    await showAsBuyer({ ...weeknights, formState: 'HiddenReview', reviews: [{ ...mine, isHidden: true, counts: false }] });
    expect(page.querySelector('[data-review] button')).toBeNull();
  });

  it('deletes the viewer\'s review after asking, says so, and reads the page again', async () => {
    const mine = { ...priya, isMine: true };
    await showAsBuyer({ ...weeknights, formState: 'AlreadyReviewed', reviews: [alex, mine, dan] });

    page.querySelector<HTMLButtonElement>('[data-review] button')!.click();
    await harness.fixture.whenStable();
    const question = TestBed.inject(Confirm).question();
    expect(question?.message).toBe('Delete your review of Three Weeknights in Japan?');
    expect(question?.action).toBe('Delete review');
    question!.settle(true);
    await settle();

    const request = http.expectOne((r) => r.method === 'DELETE');
    expect(request.request.url).toBe('/api/products/3/reviews/mine');
    const after: ProductReviews = { ...weeknights, formState: 'CanReview', reviews: [alex, dan] };
    request.flush(after);
    await settle();
    http.expectOne('/api/products/3/reviews').flush(after);
    await harness.fixture.whenStable();

    expect(names()).toEqual(['Alex Rivera', 'Dan Okafor']);
    expect(TestBed.inject(Notices).message()?.text).toBe('Your review is deleted.');
    expect(page.querySelector('[data-review-form]')).not.toBeNull();
  });

  it('keeps the review when the question is answered no', async () => {
    const mine = { ...priya, isMine: true };
    await showAsBuyer({ ...weeknights, formState: 'AlreadyReviewed', reviews: [alex, mine, dan] });

    page.querySelector<HTMLButtonElement>('[data-review] button')!.click();
    await harness.fixture.whenStable();
    TestBed.inject(Confirm).question()!.settle(false);
    await settle();

    http.expectNone((r) => r.method === 'DELETE');
    expect(names().length).toBe(3);
  });

  it('has no accessibility violations in the form that a structural check can find', async () => {
    await showAsBuyer(canReview);
    submit();
    await harness.fixture.whenStable();

    const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
