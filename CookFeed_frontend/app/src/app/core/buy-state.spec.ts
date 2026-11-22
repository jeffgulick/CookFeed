import { BuyFacts, buyState } from './buy-state';

/* What the buy area of a plan shows (the prototype's rules.js buyState). The order of the checks is the rule: the
   first that applies wins. */
describe('buyState', () => {
  const shopper: BuyFacts = {
    signedIn: true,
    canShop: true,
    viewerIsCreator: false,
    owned: false,
    forSale: true,
    inCart: false,
  };

  it('lets a signed-in cook who does not have it yet add it to the cart', () => {
    expect(buyState(shopper)).toBe('buy');
  });

  it('says it is already in the cart, which holds one copy of each plan', () => {
    expect(buyState({ ...shopper, inCart: true })).toBe('inCart');
  });

  it('asks a visitor to sign in', () => {
    expect(buyState({ ...shopper, signedIn: false, canShop: false })).toBe('signIn');
  });

  it('says a plan is no longer for sale, to a visitor too', () => {
    expect(buyState({ ...shopper, forSale: false })).toBe('notForSale');
    expect(buyState({ ...shopper, signedIn: false, canShop: false, forSale: false })).toBe('notForSale');
  });

  it('tells a buyer they own it, even after it left the store', () => {
    expect(buyState({ ...shopper, owned: true })).toBe('owned');
    expect(buyState({ ...shopper, owned: true, forSale: false })).toBe('owned');
  });

  it('tells a creator the plan is their own before anything else a shopper would see', () => {
    expect(buyState({ ...shopper, viewerIsCreator: true })).toBe('yourOwn');
    expect(buyState({ ...shopper, viewerIsCreator: true, forSale: false })).toBe('yourOwn');
  });

  it('shows the admin, who cannot shop, no buying at all', () => {
    expect(buyState({ ...shopper, canShop: false })).toBe('noShop');
    expect(buyState({ ...shopper, canShop: false, forSale: false })).toBe('noShop');
  });
});
