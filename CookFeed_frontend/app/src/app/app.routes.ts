import { Routes } from '@angular/router';

/* One route per page of the prototype. A page's code is loaded the first time it is opened. The pages still to be
   converted share one placeholder, which says so, until each is built. */
const notBuiltYet = (name: string) => ({
  title: `${name} | Cookfeed`,
  data: { name },
  loadComponent: () => import('./pages/not-built-yet/not-built-yet').then((m) => m.NotBuiltYetPage),
});

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Discover | Cookfeed',
    loadComponent: () => import('./pages/discover/discover').then((m) => m.DiscoverPage),
  },
  {
    path: 'sign-in',
    title: 'Sign in | Cookfeed',
    loadComponent: () => import('./pages/sign-in/sign-in').then((m) => m.SignInPage),
  },
  { path: 'plans', ...notBuiltYet('Plans & collections') },
  {
    // The page renames the tab after the plan once it has loaded.
    path: 'plans/:id',
    title: 'Plan | Cookfeed',
    loadComponent: () => import('./pages/plan/plan').then((m) => m.PlanPage),
  },
  {
    // The page renames the tab after the plan once the reviews have loaded.
    path: 'plans/:id/reviews',
    title: 'Reviews | Cookfeed',
    loadComponent: () => import('./pages/reviews/reviews').then((m) => m.ReviewsPage),
  },
  { path: 'recipes', ...notBuiltYet('Recipes') },
  {
    // The page renames the tab after the recipe once it has loaded.
    path: 'recipes/:id',
    title: 'Recipe | Cookfeed',
    loadComponent: () => import('./pages/recipe/recipe').then((m) => m.RecipePage),
  },
  {
    // The page renames the tab after the creator once the storefront has loaded.
    path: 'creators/:handle',
    title: 'Creator | Cookfeed',
    loadComponent: () => import('./pages/creator/creator').then((m) => m.CreatorPage),
  },
  { path: 'kitchen', ...notBuiltYet('My kitchen') },
  { path: 'orders', ...notBuiltYet('Your orders') },
  { path: 'cart', ...notBuiltYet('Cart') },
  { path: 'help', ...notBuiltYet('Help') },
  { path: 'studio', ...notBuiltYet('My studio') },
  { path: 'admin', ...notBuiltYet('Admin') },
  { path: '**', ...notBuiltYet('Page not found') },
];
