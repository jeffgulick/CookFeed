/* What the buy area of a plan or collection shows a viewer (the prototype's rules.js buyState, design 3.1 and
   3.8). The API enforces the same rules when the cart and checkout are called; this only decides what the screen
   offers. */

/**
 * - noShop: the admin, who holds no shopper role, sees no buying at all
 * - yourOwn: a creator cannot buy their own plan
 * - owned: the viewer has a paid order for it
 * - notForSale: retired, its creator suspended, or a recipe in it was taken down
 * - signIn: a visitor who is not signed in
 * - inCart: already in the cart, which holds one copy of each plan
 * - buy: it can be added to the cart
 */
export type BuyState = 'noShop' | 'yourOwn' | 'owned' | 'notForSale' | 'signIn' | 'inCart' | 'buy';

/** What the rule needs to know: who is looking (from Session) and where they stand with the plan (from the API). */
export interface BuyFacts {
  signedIn: boolean;
  /** The signed-in account holds the HomeCook role. */
  canShop: boolean;
  viewerIsCreator: boolean;
  owned: boolean;
  forSale: boolean;
  inCart: boolean;
}

/** The first check that applies wins, in the prototype's order. */
export function buyState(facts: BuyFacts): BuyState {
  if (facts.signedIn && !facts.canShop) {
    return 'noShop';
  }
  if (facts.viewerIsCreator) {
    return 'yourOwn';
  }
  if (facts.owned) {
    return 'owned';
  }
  if (!facts.forSale) {
    return 'notForSale';
  }
  if (!facts.signedIn) {
    return 'signIn';
  }
  return facts.inCart ? 'inCart' : 'buy';
}
