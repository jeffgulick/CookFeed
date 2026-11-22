import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { CookfeedApi } from '../../core/api';
import { Studio, StudioProduct, StudioRecipe } from '../../core/api-types';
import { loadValue } from '../../core/load';
import { Notices, problemText } from '../../core/notices';
import { Session } from '../../core/session';
import { Confirm } from '../../ui/confirm';
import { longDate, plural, price, productCounts, productTypeLabel } from '../../ui/format';
import { LoadStateMessage } from '../../ui/load-state';

/* A status in words, with a color that only repeats it. */
const GOOD = 'tag-good';
const ACCENT = 'pill';
const QUIET = 'rounded-full border border-line-strong bg-fill px-2.5 py-0.5 text-[0.8125rem] font-semibold text-ink-soft';

/**
 * My studio (/studio), for creators: what they publish, what they sell, and what it has earned. A recipe is
 * published or made a draft again, and a plan is retired or put back on sale, each after a confirmation.
 *
 * The API decides what is allowed (the rules are its Domain's StudioRules) and sends, with each row, the sentence
 * that says why its button is off; the page shows that sentence as text beside the button. Every change answers
 * with the whole studio, which the page then shows. A visitor is asked to sign in; an account that is not a
 * creator is told who has a studio.
 */
@Component({
  selector: 'app-studio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LoadStateMessage],
  templateUrl: './studio.html',
})
export class StudioPage {
  private readonly api = inject(CookfeedApi);
  private readonly notices = inject(Notices);
  private readonly confirm = inject(Confirm);
  protected readonly session = inject(Session);

  /** Whose studio this is: read again when the account changes. Only a creator has one, so nothing is asked for anyone else. */
  private readonly creator = computed(() => (this.session.isCreator() ? (this.session.user()?.id ?? null) : null));

  private readonly loaded = loadValue(() => (this.creator() === null ? of(null) : this.api.studio()), this.creator);
  protected readonly state = this.loaded.state;

  /** The studio on screen: what was read, then whatever the last change answered with. */
  protected readonly studio = signal<Studio | null>(null);

  /** True while a change is on its way, so a second press does nothing. */
  protected readonly busy = signal(false);

  protected readonly view = computed(() => {
    const studio = this.studio();
    if (studio === null) {
      return null;
    }
    const { stats } = studio;
    const paid = studio.sales.filter((sale) => sale.status === 'Paid');

    return {
      storefront: ['/creators', studio.handle],
      isSuspended: studio.isSuspended,
      // Five figures, each a number and the words that say what it counts.
      stats: [
        {
          value: String(stats.publishedRecipes),
          label:
            `published ${stats.publishedRecipes === 1 ? 'recipe' : 'recipes'}, free and premium` +
            (stats.drafts > 0 ? `, plus ${plural(stats.drafts, 'draft', 'drafts')}` : ''),
        },
        { value: String(stats.plansForSale), label: `${stats.plansForSale === 1 ? 'plan' : 'plans'} for sale` },
        { value: String(stats.sales), label: stats.sales === 1 ? 'sale' : 'sales' },
        { value: price(stats.earnedCents), label: 'earned' },
        { value: String(stats.saves), label: `${stats.saves === 1 ? 'save' : 'saves'} of your recipes` },
      ],
      recipes: studio.recipes.map((recipe) => ({
        recipe,
        serves: `Serves ${recipe.servings}`,
        status: recipe.isPublished ? 'Published' : 'Draft',
        statusClass: recipe.isPublished ? GOOD : QUIET,
        access: recipe.visibility === 'Public' ? 'Free' : 'Premium',
        accessClass: recipe.visibility === 'Public' ? QUIET : ACCENT,
        savedBy: plural(recipe.saveCount, 'cook', 'cooks'),
        inPlans: recipe.inPlans.join(', '),
        action: recipe.isPublished ? 'Unpublish' : 'Publish',
        whyNot: recipe.publishProblem,
        whyNotId: `whyNotRecipe${recipe.id}`,
      })),
      products: studio.products.map((product) => {
        // Retired by the creator; or active but off the store, because of the account or a draft inside it.
        const status = !product.isActive
          ? 'Retired'
          : product.isForSale
            ? 'For sale'
            : studio.isSuspended
              ? 'Not for sale: account suspended'
              : 'Not for sale: a recipe in it is a draft';
        return {
          product,
          type: productTypeLabel(product.type),
          price: price(product.priceCents),
          contents: productCounts(product.recipeCount, product.mealCount),
          status,
          statusClass: status === 'For sale' ? GOOD : QUIET,
          action: product.isActive ? 'Retire' : 'Restore',
          // Only Restore can be refused beforehand: retiring is always allowed.
          whyNot: product.isActive ? null : product.restoreProblem,
          whyNotId: `whyNotProduct${product.id}`,
        };
      }),
      salesSummary:
        paid.length === 0
          ? 'No sales yet.'
          : `${plural(stats.sales, 'sale', 'sales')}, ${price(stats.earnedCents)} earned. Each line is the price at the time of purchase.`,
      sales: studio.sales.map((sale) => ({
        date: longDate(sale.placedAt),
        buyer: sale.buyerName,
        plan: sale.productTitle,
        paid: price(sale.unitPriceCents),
        status: sale.status,
        statusClass: sale.status === 'Paid' ? GOOD : QUIET,
      })),
      reviews: studio.reviews.map((review) => ({
        id: review.id,
        reviewer: review.reviewerName,
        stars: '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating),
        starsLabel: `${review.rating} out of 5 stars`,
        on: `on ${review.productTitle}`,
        date: longDate(review.createdAt),
        body: review.body,
      })),
    };
  });

  constructor() {
    // What was read becomes the studio on screen.
    effect(() => this.studio.set(this.loaded.value()));
  }

  /** Publish a draft, or make a published recipe a draft again, after asking. */
  protected async togglePublished(recipe: StudioRecipe): Promise<void> {
    const publishing = !recipe.isPublished;
    const question = publishing
      ? `Publish "${recipe.title}"? ` +
        (recipe.visibility === 'Public' ? 'Anyone will be able to open and save it.' : 'Only buyers of a plan it is in will open it.')
      : `Unpublish "${recipe.title}"? Only you will see it.`;
    if (!(await this.confirm.ask(question, publishing ? 'Publish' : 'Unpublish'))) {
      return;
    }
    await this.change(
      this.api.setRecipePublished(recipe.id, publishing),
      publishing ? `"${recipe.title}" is published.` : `"${recipe.title}" is a draft again.`,
    );
  }

  /** Retire a plan, which takes it off the store, or put a retired one back on sale, after asking. */
  protected async toggleActive(product: StudioProduct): Promise<void> {
    const retiring = product.isActive;
    const question = retiring
      ? `Retire "${product.title}"? It leaves the store; everyone who bought it keeps it.`
      : `Put "${product.title}" back on sale?`;
    if (!(await this.confirm.ask(question, retiring ? 'Retire' : 'Restore'))) {
      return;
    }
    await this.change(
      this.api.setProductActive(product.id, !retiring),
      retiring ? `"${product.title}" is retired.` : `"${product.title}" is for sale again.`,
    );
  }

  /** Sends one change, shows the studio the API answers with, and says what happened, or why it did not. */
  private async change(send: Observable<Studio>, done: string): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      this.studio.set(await firstValueFrom(send));
      this.notices.say(done);
    } catch (error) {
      this.notices.problem(problemText(error, 'That could not be changed. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }
}
