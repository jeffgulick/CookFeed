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
  { path: 'plans/:id', ...notBuiltYet('Plan') },
  { path: 'recipes', ...notBuiltYet('Recipes') },
  { path: 'recipes/:id', ...notBuiltYet('Recipe') },
  { path: 'creators/:handle', ...notBuiltYet('Creator') },
  { path: 'kitchen', ...notBuiltYet('My kitchen') },
  { path: 'orders', ...notBuiltYet('Your orders') },
  { path: 'cart', ...notBuiltYet('Cart') },
  { path: 'help', ...notBuiltYet('Help') },
  { path: 'studio', ...notBuiltYet('My studio') },
  { path: 'admin', ...notBuiltYet('Admin') },
  { path: '**', ...notBuiltYet('Page not found') },
];
