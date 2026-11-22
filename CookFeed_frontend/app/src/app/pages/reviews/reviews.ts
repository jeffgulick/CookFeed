import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { CookfeedApi } from '../../core/api';
import { ReviewFormState } from '../../core/api-types';
import { loadValue } from '../../core/load';
import { Notices, problemText } from '../../core/notices';
import { Session } from '../../core/session';
import { Confirm } from '../../ui/confirm';
import { longDate, plural, productNoun } from '../../ui/format';
import { LoadStateMessage } from '../../ui/load-state';

type Sort = 'newest' | 'highest' | 'lowest';

/**
 * Why there is no review form, for every state but "can review" (the form) and "sign in" (a link). %noun% is "plan"
 * or "collection".
 */
const GATES: Partial<Record<ReviewFormState, string>> = {
  NoShop: 'Admin accounts do not write reviews. Hidden reviews show only to admins.',
  YourOwn: 'This is your own %noun%. Creators cannot review their own.',
  AlreadyReviewed: 'You have reviewed this %noun%. Thank you!',
  HiddenReview: 'Cookfeed hid your review, so other cooks do not see it and it is not counted in the rating.',
  RefundedReview: 'Your order for this %noun% was refunded, so your review is not counted.',
  MustBuy: 'Only cooks who bought this %noun% can review it, so every review comes from someone who cooked it.',
};

/**
 * The reviews of one plan or collection (/plans/3/reviews): the rating in three numbers with a bar per star, the
 * reviews with a sort and two filters, and a line that says who may review. The API sends the reviews this viewer
 * may see (the admin also sees hidden ones; an author always sees their own) and where they stand with reviewing.
 */
@Component({
  selector: 'app-reviews',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LoadStateMessage],
  templateUrl: './reviews.html',
})
export class ReviewsPage {
  private readonly api = inject(CookfeedApi);
  private readonly session = inject(Session);
  private readonly title = inject(Title);
  private readonly notices = inject(Notices);
  private readonly confirm = inject(Confirm);

  /** The address of this page, for "Sign in to write a review" to come back to. */
  protected readonly here = inject(Router).url;

  private readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')), {
    requireSync: true,
  });

  /** Read again when the account changes: who is looking decides which reviews are sent and what the form may do. */
  protected readonly reviews = loadValue(
    () => this.api.productReviews(this.id()),
    computed(() => `${this.id()} ${this.session.user()?.id ?? 'guest'} ${this.written()}`),
  );

  /** Goes up after a review is posted or deleted, so the page is read again and shows the reviews as they are now. */
  private readonly written = signal(0);

  /* ---------- the review form ---------- */

  /** A review needs at least this many characters, not counting spaces around it (the API checks the same). */
  private static readonly MinBodyLength = 15;

  protected readonly starChoices = [1, 2, 3, 4, 5];

  /** The reviewer is the signed-in account, under its own name; nobody types one. */
  protected readonly postingAs = computed(() => this.session.user()?.displayName ?? '');

  /** 0 until a star is chosen. */
  protected readonly rating = signal(0);
  protected readonly recommends = signal(true);
  protected readonly body = signal('');

  /** True once Post review has been pressed: only then does the form say what is missing. */
  private readonly submitted = signal(false);

  /** True while the review is being posted, so a second press does nothing. */
  protected readonly posting = signal(false);

  protected readonly ratingError = computed(() => (this.submitted() && this.rating() === 0 ? 'Choose a rating.' : ''));
  protected readonly bodyError = computed(() =>
    this.submitted() && this.body().trim().length < ReviewsPage.MinBodyLength
      ? `Write at least ${ReviewsPage.MinBodyLength} characters.`
      : '',
  );

  /** 0 shows every rating; 1 to 5 shows only the reviews with that many stars. */
  protected readonly starFilter = signal(0);
  protected readonly recommendOnly = signal(false);
  protected readonly sortBy = signal<Sort>('newest');

  protected readonly view = computed(() => {
    const data = this.reviews.value();
    if (data === null) {
      return null;
    }
    const noun = productNoun(data.type);
    const { reviewCount, average, percentRecommend, starCounts } = data.summary;
    return {
      noun,
      hasReviews: reviewCount > 0,
      average: average?.toFixed(1) ?? null,
      // Filled stars for the average, rounded to a whole star.
      averageStars: stars(Math.round(average ?? 0)),
      reviewCount: plural(reviewCount, 'review', 'reviews'),
      percent: percentRecommend,
      // One bar per number of stars, five first; starCounts[0] is the one-star count.
      bars: [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: starCounts[star - 1] ?? 0,
        width: reviewCount === 0 ? 0 : Math.round(((starCounts[star - 1] ?? 0) / reviewCount) * 100),
      })),
      gate: GATES[data.formState]?.replace('%noun%', noun) ?? null,
    };
  });

  /** The reviews after the star filter, the "recommends only" box and the sort. */
  protected readonly shown = computed(() => {
    const all = this.reviews.value()?.reviews ?? [];
    const star = this.starFilter();
    const sortBy = this.sortBy();
    const kept = all.filter((r) => (star === 0 || r.rating === star) && (!this.recommendOnly() || r.recommends));
    // The API sends them newest first, and the sort keeps equal ratings in that order.
    const sorted = sortBy === 'newest' ? kept : [...kept].sort((a, b) => (sortBy === 'highest' ? b.rating - a.rating : a.rating - b.rating));
    return sorted.map((r) => ({
      review: r,
      stars: stars(r.rating),
      starsLabel: `${r.rating} out of 5 stars`,
      date: longDate(r.createdAt),
      // A hidden review says so; one whose order was refunded says it no longer counts.
      note: r.isHidden ? 'Hidden by Cookfeed' : r.counts ? null : 'Not counted: order refunded',
    }));
  });

  protected readonly filtered = computed(() => this.shown().length !== (this.reviews.value()?.reviews.length ?? 0));

  /** "Showing all 3 reviews", or "Showing 1 of 3 reviews", and how many are not in the rating. */
  protected readonly showing = computed(() => {
    const all = this.reviews.value()?.reviews ?? [];
    const notCounted = all.filter((r) => !r.counts).length;
    const lead = this.filtered() ? `Showing ${this.shown().length} of ${all.length} reviews` : `Showing all ${all.length} reviews`;
    return notCounted === 0 ? lead : `${lead} (${notCounted} not counted in the rating)`;
  });

  constructor() {
    effect(() => {
      const state = this.reviews.state();
      const data = this.reviews.value();
      if (state === 'missing') {
        this.title.setTitle('Plan not found | Cookfeed');
      } else if (state === 'ready' && data !== null) {
        this.title.setTitle(`Reviews of ${data.title} | Cookfeed`);
      }
    });
  }

  /** Posts the review when it has a rating and enough words; otherwise says what is missing. */
  protected async post(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    const data = this.reviews.value();
    if (data === null || this.ratingError() !== '' || this.bodyError() !== '') {
      return;
    }

    this.posting.set(true);
    try {
      await firstValueFrom(
        this.api.postReview(data.productId, { rating: this.rating(), recommends: this.recommends(), body: this.body().trim() }),
      );
      this.notices.say(`Thanks, ${this.postingAs()}. Your review is at the top of the list.`);
      this.rating.set(0);
      this.recommends.set(true);
      this.body.set('');
      this.submitted.set(false);
      // Newest first with no filter, so the new review really is at the top.
      this.clearFilters();
      this.written.update((count) => count + 1);
    } catch (error) {
      this.notices.problem(problemText(error, 'Your review could not be posted. Please try again.'));
    } finally {
      this.posting.set(false);
    }
  }

  /** Deletes the viewer's own review, after asking. They may then write another. */
  protected async deleteMine(): Promise<void> {
    const data = this.reviews.value();
    if (data === null || !(await this.confirm.ask(`Delete your review of ${data.title}?`, 'Delete review'))) {
      return;
    }
    try {
      await firstValueFrom(this.api.deleteMyReview(data.productId));
      this.notices.say('Your review is deleted.');
      this.written.update((count) => count + 1);
    } catch (error) {
      this.notices.problem(problemText(error, 'Your review could not be deleted. Please try again.'));
    }
  }

  /** Pressing a bar shows only that rating; pressing it again shows every rating. */
  protected toggleStar(star: number): void {
    this.starFilter.update((current) => (current === star ? 0 : star));
  }

  protected setSort(value: string): void {
    this.sortBy.set(value === 'highest' || value === 'lowest' ? value : 'newest');
  }

  protected clearFilters(): void {
    this.starFilter.set(0);
    this.recommendOnly.set(false);
    this.sortBy.set('newest');
  }
}

/** Five stars, the first `count` filled: "★★★★☆". */
function stars(count: number): string {
  return '★'.repeat(count) + '☆'.repeat(5 - count);
}
