import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RecipeCard, RecipeCardData } from './recipe-card';

/* The recipe card takes a page's own controls under its facts, such as My kitchen's Unsave. The whole card is one
   link, so those controls have to sit above it to be pressed. */
describe('Recipe card', () => {
  const caprese: RecipeCardData = {
    id: 15,
    title: 'Caprese Salad',
    thumbnailUrl: 'images/recipes/15.svg',
    servings: 2,
    totalMinutes: 10,
    saveCount: 5,
    creatorHandle: 'maria-cooks',
    creatorIsVerified: true,
  };

  @Component({
    imports: [RecipeCard],
    template: `
      <app-recipe-card [recipe]="recipe"><button type="button">Unsave</button></app-recipe-card>
      <app-recipe-card [recipe]="recipe" />
    `,
  })
  class Host {
    readonly recipe = caprese;
  }

  it('shows a page\'s own controls above the card\'s link, and nothing extra without them', async () => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('app-recipe-card');

    const controls = cards[0].querySelector('[data-card-controls]');
    expect(controls?.querySelector('button')?.textContent).toBe('Unsave');
    // Above the link that covers the card, so a press reaches the button.
    expect(controls?.className).toContain('relative');
    expect(controls?.className).toContain('z-10');
    expect(cards[0].querySelector('h3 a')?.getAttribute('href')).toBe('/recipes/15');
    expect(cards[1].querySelector('[data-card-controls]')?.children.length).toBe(0);
  });
});
