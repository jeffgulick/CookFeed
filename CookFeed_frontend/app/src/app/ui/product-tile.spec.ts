import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProductTile as ProductTileData } from '../core/api-types';
import { ProductTile } from './product-tile';

/* One meal plan or collection for sale, as a tile (the prototype's productTileHtml): what it is, who sells it, what
   is in it, how it is rated, and its price, or that the viewer already owns it. */
describe('Product tile', () => {
  const familyWeek: ProductTileData = {
    id: 4,
    type: 'MealPlan',
    title: 'Family Meal-Prep Week',
    coverImageUrl: 'images/products/4.svg',
    priceCents: 1499,
    currency: 'USD',
    creatorHandle: 'dan-meal-preps',
    recipeCount: 5,
    mealCount: 6,
    rating: { reviewCount: 0, average: null, percentRecommend: null },
    ownedByViewer: false,
  };

  let fixture: ComponentFixture<ProductTile>;
  let tile: HTMLElement;

  async function show(product: ProductTileData): Promise<void> {
    TestBed.configureTestingModule({ imports: [ProductTile], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(ProductTile);
    fixture.componentRef.setInput('product', product);
    await fixture.whenStable();
    tile = fixture.nativeElement as HTMLElement;
  }

  const text = () => tile.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('says what it is, names it, and links the title to its page', async () => {
    await show(familyWeek);

    expect(tile.getAttribute('data-product-id')).toBe('4');
    expect(tile.querySelector('.pill')?.textContent?.trim()).toBe('Meal plan');
    expect(tile.querySelector('h3 a')?.textContent?.trim()).toBe('Family Meal-Prep Week');
    expect(tile.querySelector('h3 a')?.getAttribute('href')).toBe('/plans/4');
    expect(tile.querySelector('img')?.getAttribute('src')).toBe('/images/products/4.svg');
    expect(tile.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(text()).toContain('by dan-meal-preps');
  });

  it('calls a collection a recipe collection', async () => {
    await show({ ...familyWeek, type: 'RecipeCollection', mealCount: null });

    expect(tile.querySelector('.pill')?.textContent?.trim()).toBe('Recipe collection');
  });

  it('counts recipes, and meals too when a plan serves a recipe more than once', async () => {
    await show(familyWeek);
    expect(text()).toContain('5 recipes, 6 meals');
  });

  it('counts only recipes when every meal is a different recipe, and for a collection', async () => {
    await show({ ...familyWeek, recipeCount: 3, mealCount: 3 });
    expect(text()).toContain('3 recipes');
    expect(text()).not.toContain('meals');

    TestBed.resetTestingModule();
    await show({ ...familyWeek, type: 'RecipeCollection', recipeCount: 1, mealCount: null });
    expect(text()).toContain('1 recipe');
    expect(text()).not.toContain('1 recipes');
  });

  it('says there are no reviews yet rather than showing an empty rating', async () => {
    await show(familyWeek);

    expect(text()).toContain('no reviews yet');
  });

  it('shows the average to one decimal and how many reviews it comes from', async () => {
    await show({ ...familyWeek, rating: { reviewCount: 2, average: 4.5, percentRecommend: 100 } });
    expect(tile.querySelector('[data-rating]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Rated ★ 4.5 out of 5 (2 reviews)',
    );

    TestBed.resetTestingModule();
    await show({ ...familyWeek, rating: { reviewCount: 1, average: 4, percentRecommend: 100 } });
    expect(text()).toContain('4.0');
    expect(text()).toContain('(1 review)');
  });

  it('shows the price to a viewer who does not own it', async () => {
    await show(familyWeek);

    expect(tile.querySelector('[data-price]')?.textContent?.trim()).toBe('$14.99');
    expect(text()).not.toContain('You own this');
  });

  it('says the viewer owns it instead of showing a price', async () => {
    await show({ ...familyWeek, ownedByViewer: true });

    expect(tile.querySelector('[data-owned]')?.textContent?.trim()).toBe('You own this');
    expect(tile.querySelector('[data-price]')).toBeNull();
  });

  it('uses the stand-in picture when the product has no cover', async () => {
    await show({ ...familyWeek, coverImageUrl: null });

    expect(tile.querySelector('img')?.getAttribute('src')).toBe('/images/products/new.svg');
  });
});
