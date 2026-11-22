import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, of } from 'rxjs';
import { CookfeedApi } from '../../core/api';
import { ProductDetail, RecipeLocked, RecipeStep } from '../../core/api-types';
import { loadValue } from '../../core/load';
import { PEOPLE_MAX, PEOPLE_MIN, peopleProblem } from '../../core/people';
import { Session } from '../../core/session';
import { amount, clockTime, dayAndMeal, plural, productCounts, productTypeLabel } from '../../ui/format';
import { Icon } from '../../ui/icon';
import { LoadStateMessage } from '../../ui/load-state';

/**
 * The page of one recipe (/recipes/16): what goes in, for however many people, and how to make it, with steps that
 * jump the video to their moment. Opened from a plan (/recipes/5?product=3), it leads back to that plan.
 *
 * A premium recipe opens only for its buyers and its creator. Anyone else is told which plan it comes with; a draft
 * that is not the viewer's looks like an address with no recipe.
 */
@Component({
  selector: 'app-recipe',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, LoadStateMessage],
  templateUrl: './recipe.html',
})
export class RecipePage {
  private readonly api = inject(CookfeedApi);
  private readonly title = inject(Title);
  private readonly route = inject(ActivatedRoute);
  protected readonly session = inject(Session);

  /** The address of this page, for "Sign in to save" to come back to. */
  protected readonly here = inject(Router).url;

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), { requireSync: true });

  /** The plan the recipe was opened from (?product=), or null. */
  private readonly productId = toSignal(this.route.queryParamMap.pipe(map((query) => query.get('product'))), {
    requireSync: true,
  });

  private readonly viewer = computed(() => this.session.user()?.id ?? 'guest');

  /** A 403 is a premium recipe the viewer has not bought; its body says which plans it comes with. */
  protected readonly recipe = loadValue(
    () => this.api.recipe(this.id()),
    computed(() => `${this.id()} ${this.viewer()}`),
  );

  /** The plan the recipe was opened from, read only when the address names one. */
  private readonly plan = loadValue(
    () => {
      const productId = this.productId();
      return productId === null ? of<ProductDetail | null>(null) : this.api.product(productId);
    },
    computed(() => `${this.productId()} ${this.viewer()}`),
  );

  protected readonly locked = computed(() => this.recipe.refusal() as RecipeLocked | null);

  /* ---------- the people being cooked for ---------- */

  /** What is typed in the box. The list follows it only while it is a number of people the recipe can be cooked for. */
  protected readonly servingsText = signal('');
  protected readonly people = signal(1);
  protected readonly servingsProblem = computed(() => peopleProblem(this.servingsText()));
  protected readonly atMin = computed(() => Number(this.servingsText()) <= PEOPLE_MIN);
  protected readonly atMax = computed(() => Number(this.servingsText()) >= PEOPLE_MAX);

  protected readonly ingredients = computed(() => {
    const recipe = this.recipe.value();
    const people = this.people();
    return (recipe?.ingredients ?? []).map((line) => ({
      amount: `${amount((line.quantity * people) / recipe!.servings)} ${line.unit}`,
      // "vegetable oil, for the pan"
      name: line.preparation === null ? line.ingredient : `${line.ingredient}, ${line.preparation}`,
    }));
  });

  /* ---------- the video and the steps ---------- */

  /** The step the video is at; null until Play or a step is pressed. */
  protected readonly playing = signal<RecipeStep | null>(null);

  protected readonly steps = computed(() =>
    (this.recipe.value()?.steps ?? []).map((step) => ({
      step,
      watchAt: step.videoTimestampSeconds === null ? null : `Watch at ${clockTime(step.videoTimestampSeconds)}`,
    })),
  );

  protected readonly player = computed(() => {
    const steps = this.recipe.value()?.steps ?? [];
    const playing = this.playing();
    return {
      time: clockTime(playing?.videoTimestampSeconds ?? 0),
      note: playing === null ? 'Tap a step below to jump to that moment.' : `Step ${playing.stepNumber} of ${steps.length}`,
      // How far through the steps the video is, as a share of the track.
      percent: playing === null || steps.length === 0 ? 0 : Math.round((playing.stepNumber / steps.length) * 100),
    };
  });

  /* ---------- the words around the recipe ---------- */

  protected readonly view = computed(() => {
    const recipe = this.recipe.value();
    if (recipe === null) {
      return null;
    }
    const plan = this.plan.value();
    // Where the recipe sits in the plan it was opened from; null when it was opened on its own.
    const placement = plan?.recipes.find((r) => r.details?.recipeId === recipe.id) ?? null;
    const day = placement === null || placement.dayOffset === null ? '' : dayAndMeal(placement.dayOffset, placement.slot);
    const mine = recipe.viewerIsCreator;
    const premium = recipe.visibility === 'ProductOnly';

    let ownedNote: string | null = null;
    if (!recipe.isPublished && mine) {
      ownedNote = 'A draft. Only you can see it until you publish it.';
    } else if (premium && recipe.ownedThrough !== null) {
      ownedNote = `Yours through ${recipe.ownedThrough}` + (recipe.isPublished ? '' : '. It is no longer in the store; you keep it.');
    } else if (premium && mine) {
      ownedNote = 'Only buyers of your plans can open this recipe.';
    }

    return {
      plan: placement === null || plan === null ? null : { id: plan.id, title: plan.title, day, counts: productCounts(plan.recipeCount, plan.mealCount) },
      pill: placement !== null && plan !== null ? day || productTypeLabel(plan.type) : recipe.isPublished || !mine ? 'Recipe' : 'Draft',
      ownedNote,
      imageUrl: recipe.thumbnailUrl === null ? null : '/' + recipe.thumbnailUrl,
      facts: [
        `Serves ${recipe.servings}`,
        recipe.totalMinutes === null ? null : `${recipe.totalMinutes} min total`,
        `saved by ${plural(recipe.saveCount, 'cook', 'cooks')}`,
      ]
        .filter((part) => part !== null)
        .join(' · '),
    };
  });

  constructor() {
    // A recipe that has just loaded starts at the number of people it is written for, with the video at the start.
    effect(() => {
      const recipe = this.recipe.value();
      if (recipe !== null) {
        this.servingsText.set(String(recipe.servings));
        this.people.set(recipe.servings);
        this.playing.set(null);
      }
    });

    // The tab is named after the recipe once it is known, as the prototype did.
    effect(() => {
      const state = this.recipe.state();
      const name = state === 'missing' ? 'Recipe not found' : state === 'refused' ? this.locked()?.title : this.recipe.value()?.title;
      if (name && state !== 'loading' && state !== 'failed') {
        this.title.setTitle(`${name} | Cookfeed`);
      }
    });
  }

  /** Typing a number rescales the list straight away; anything else says what is wrong and leaves the list as it was. */
  protected typed(text: string): void {
    this.servingsText.set(text);
    if (peopleProblem(text) === '') {
      this.people.set(Number(text));
    }
  }

  /** One more or one fewer person, kept between 1 and 50. From a box that holds no number, it starts at the recipe's own. */
  protected step(change: number): void {
    const typed = Number(this.servingsText());
    const from = this.servingsText().trim() === '' || Number.isNaN(typed) ? (this.recipe.value()?.servings ?? 1) : Math.round(typed);
    this.typed(String(Math.min(PEOPLE_MAX, Math.max(PEOPLE_MIN, from + change))));
  }

  protected reset(): void {
    this.typed(String(this.recipe.value()?.servings ?? 1));
  }

  /** Play starts at the first step that is marked in the video. */
  protected play(): void {
    const steps = this.recipe.value()?.steps ?? [];
    this.playing.set(steps.find((step) => step.videoTimestampSeconds !== null) ?? steps[0] ?? null);
  }
}
