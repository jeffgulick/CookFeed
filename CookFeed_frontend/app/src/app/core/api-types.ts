/* The shapes the Cookfeed API sends, as the app reads them. Each mirrors a record in the API's Cookfeed.Contracts
   project; the API's OpenAPI document (/openapi/v1.json in Development) describes the same shapes. */

/** The three roles of DesignDocument 3.1. Every creator is also a home cook; the admin holds no other role. */
export type Role = 'HomeCook' | 'Creator' | 'Admin';

/** One account the sign-in picker offers (GET /api/accounts). */
export interface Account {
  id: number;
  displayName: string;
  roles: Role[];
  /** The creator's storefront handle; null for an account that is not a creator. */
  handle: string | null;
}

export type FeedSort = 'Newest' | 'Trending';

/** One recipe card in the feed (GET /api/feed). */
export interface FeedItem {
  id: number;
  title: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  servings: number;
  /** Prep plus cook time; null when the recipe gives neither. */
  totalMinutes: number | null;
  saveCount: number;
  publishedAt: string;
  creatorHandle: string;
  creatorDisplayName: string;
  creatorIsVerified: boolean;
  /** False when the request names no viewer. */
  savedByViewer: boolean;
}

export interface FeedPage {
  items: FeedItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export type ProductType = 'MealPlan' | 'RecipeCollection';

/** The three orders the Plans page offers. */
export type ProductSort = 'Newest' | 'Price' | 'Rating';

/** A product's reviews in three numbers. Hidden reviews, and those of refunded buyers, are left out. */
export interface ProductRating {
  reviewCount: number;
  /** The mean rating to one decimal; null with no reviews. */
  average: number | null;
  /** The share of reviewers who recommend it, as a whole percent; null with no reviews. */
  percentRecommend: number | null;
}

/** One meal plan or collection for sale, as a tile (GET /api/products). */
export interface ProductTile {
  id: number;
  type: ProductType;
  title: string;
  coverImageUrl: string | null;
  priceCents: number;
  currency: string;
  creatorHandle: string;
  /** Distinct recipes in the product. */
  recipeCount: number;
  /** Scheduled meals, for a meal plan, which may serve a recipe more than once; null for a collection. */
  mealCount: number | null;
  rating: ProductRating;
  /** True when the viewer has a paid order for it. False when the request names no viewer. */
  ownedByViewer: boolean;
}

/** One creator, as a tile (GET /api/creators). */
export interface CreatorTile {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
}

/** One free recipe on a creator's storefront. */
export interface StorefrontRecipe {
  id: number;
  title: string;
  thumbnailUrl: string | null;
  servings: number;
  /** Prep plus cook time; null when the recipe gives neither. */
  totalMinutes: number | null;
  saveCount: number;
  publishedAt: string;
}

/** One plan or collection a creator has for sale. */
export interface StorefrontProduct {
  id: number;
  type: ProductType;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  priceCents: number;
  currency: string;
  recipeCount: number;
  /** Scheduled meals, for a meal plan; null for a collection. */
  mealCount: number | null;
  /** True when the viewer has a paid order for it. */
  ownedByViewer: boolean;
  inCart: boolean;
}

/** A creator's storefront (GET /api/creators/{handle}). */
export interface Storefront {
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  /** True while Cookfeed has the creator suspended: the page says so, and nothing is for sale. */
  isSuspended: boolean;
  recipeCount: number;
  totalSaves: number;
  /** True when the viewer is this creator. */
  viewerIsCreator: boolean;
  /** Published free recipes, newest first. */
  recipes: StorefrontRecipe[];
  /** For sale only. */
  products: StorefrontProduct[];
}

export type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

/** What a viewer who may open a recipe also gets on a plan's page: its id (the link) and a quick look. */
export interface ProductRecipeDetails {
  recipeId: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredientCount: number;
  stepCount: number;
  /** How the recipe starts; null when it has no steps yet. */
  firstStep: string | null;
  saveCount: number;
  savedByViewer: boolean;
  /** The title of the viewer's purchase that holds this recipe, for "Yours through ..."; null when none does. */
  ownedThrough: string | null;
}

/** One recipe on a plan's page: the card every viewer sees, and its details for a viewer who may open it. */
export interface ProductRecipe {
  sortOrder: number;
  /** For a meal plan, the day (0 is Monday); null in a collection. */
  dayOffset: number | null;
  /** For a meal plan, the meal; null in a collection. */
  slot: MealSlot | null;
  title: string;
  thumbnailUrl: string | null;
  servings: number;
  totalMinutes: number | null;
  visibility: 'Public' | 'ProductOnly';
  /** False for a premium recipe the viewer has not bought: a card with no link. */
  canOpen: boolean;
  /** Null when canOpen is false, so a locked recipe gives nothing else away. */
  details: ProductRecipeDetails | null;
}

/** The page of one meal plan or collection, as one viewer sees it (GET /api/products/{id}). */
export interface ProductDetail {
  id: number;
  type: ProductType;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  priceCents: number;
  currency: string;
  creator: { handle: string; displayName: string; isVerified: boolean };
  recipeCount: number;
  mealCount: number | null;
  rating: ProductRating;
  /** False once it is retired, its creator is suspended, or a recipe in it was taken down. */
  isForSale: boolean;
  ownedByViewer: boolean;
  viewerIsCreator: boolean;
  inCart: boolean;
  /** In plan order. A buyer sees the recipes they bought; everyone else, the plan as it is today. */
  recipes: ProductRecipe[];
}

/** One line of a shopping list: 2 tbsp sake, in the Beverages aisle. */
export interface ShoppingListLine {
  ingredientId: number;
  ingredient: string;
  aisle: string;
  quantity: number;
  unit: string;
}

/** "What you'll buy" on a plan's page (GET /api/products/{id}/shopping-list). */
export interface ProductShoppingList {
  /** Sorted by aisle, then ingredient; amounts as each recipe is written. */
  lines: ShoppingListLine[];
  /** The recipes on the list, by title, in plan order. */
  fromRecipes: string[];
  /** The recipes left off because the viewer may not open them yet. */
  lockedRecipes: string[];
}

/** One ingredient line of a recipe, as the creator wrote it. */
export interface RecipeIngredient {
  sortOrder: number;
  quantity: number;
  /** The unit's abbreviation: "g", "tbsp". */
  unit: string;
  ingredient: string;
  displayText: string | null;
  /** How it is prepared ("for the pan"); null when the recipe does not say. */
  preparation: string | null;
  isOptional: boolean;
}

/** One numbered step of a recipe. */
export interface RecipeStep {
  stepNumber: number;
  instruction: string;
  /** Where the step starts in the video, for "Watch at 0:16"; null when it is not marked. */
  videoTimestampSeconds: number | null;
}

/** One place a recipe appears in a product a cook can buy. */
export interface RecipePlacement {
  productId: number;
  productTitle: string;
  productType: ProductType;
  dayOffset: number | null;
  slot: MealSlot | null;
  ownedByViewer: boolean;
}

/** One recipe in full (GET /api/recipes/{id}). */
export interface RecipeDetail {
  id: number;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  saveCount: number;
  /** False for a draft, or a recipe taken out of the store; only its creator or its buyers see it then. */
  isPublished: boolean;
  visibility: 'Public' | 'ProductOnly';
  publishedAt: string | null;
  creator: { handle: string; displayName: string; avatarUrl: string | null; isVerified: boolean };
  savedByViewer: boolean;
  viewerIsCreator: boolean;
  /** The title of the viewer's purchase that holds this recipe, for "Yours through ..."; null when none does. */
  ownedThrough: string | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  includedIn: RecipePlacement[];
}

/** What the API says about a premium recipe the viewer has not bought: the body of its 403. */
export interface RecipeLocked {
  title: string;
  /** The products for sale that hold the recipe; empty when none is for sale any more. */
  availableIn: { productId: number; title: string; type: ProductType }[];
}

/** Where a viewer stands with reviewing a product; the API works it out (the prototype's reviewState). */
export type ReviewFormState =
  | 'SignIn'
  | 'NoShop'
  | 'YourOwn'
  | 'AlreadyReviewed'
  | 'HiddenReview'
  | 'RefundedReview'
  | 'MustBuy'
  | 'CanReview';

/** One review of a product. */
export interface Review {
  id: number;
  reviewerName: string;
  /** 1 to 5 stars. */
  rating: number;
  recommends: boolean;
  body: string;
  createdAt: string;
  isMine: boolean;
  /** Hidden by the admin: sent only to the admin and to its author. */
  isHidden: boolean;
  /** False when it is hidden or its author's order was refunded: it is not in the rating. */
  counts: boolean;
  reviewerIsCreator: boolean;
}

/** A product's reviews, as one viewer sees them (GET /api/products/{id}/reviews). */
export interface ProductReviews {
  productId: number;
  type: ProductType;
  title: string;
  creator: { handle: string; displayName: string; isVerified: boolean };
  /** Over the reviews that count. starCounts[0] is the number of one-star reviews. */
  summary: { reviewCount: number; average: number | null; percentRecommend: number | null; starCounts: number[] };
  formState: ReviewFormState;
  /** Newest first. */
  reviews: Review[];
}

/** One plan or collection in the cart, as the product is today. */
export interface CartLine {
  productId: number;
  type: ProductType;
  title: string;
  coverImageUrl: string | null;
  creatorHandle: string;
  recipeCount: number;
  /** Scheduled meals, for a meal plan; null for a collection. */
  mealCount: number | null;
  priceCents: number;
}

/** The signed-in cook's cart (GET /api/me/cart). Every change to the cart answers with it too. */
export interface CartData {
  /** The lines that can be bought now, in the order they were added. */
  lines: CartLine[];
  totalCents: number;
  currency: string;
  /** Titles of plans that are in the cart but can no longer be bought; checkout leaves them out. */
  unavailable: string[];
}

export type OrderStatus = 'Pending' | 'Paid' | 'Refunded' | 'Cancelled';

/** A plan bought in an order, as it was at checkout: the title and price are the ones paid then. */
export interface OrderItem {
  productId: number;
  productTitle: string;
  unitPriceCents: number;
  /** Null if that creator no longer has a storefront. */
  sellerHandle: string | null;
  type: ProductType;
  /** Counted from what this purchase holds, not from the plan today. */
  recipeCount: number;
  mealCount: number | null;
}

/** One order (GET /api/me/orders, and the answer to POST /api/me/checkout). */
export interface Order {
  id: number;
  status: OrderStatus;
  placedAt: string;
  paidAt: string | null;
  totalCents: number;
  currency: string;
  items: OrderItem[];
}

/** One recipe the signed-in cook saved, as a card in My kitchen (GET /api/me/saves). */
export interface SavedRecipe {
  id: number;
  title: string;
  thumbnailUrl: string | null;
  servings: number;
  totalMinutes: number | null;
  saveCount: number;
  creatorHandle: string;
  creatorIsVerified: boolean;
  visibility: 'Public' | 'ProductOnly';
  savedAt: string;
}

/** The answer to saving or unsaving a recipe: whether it is saved now, and how many cooks have it saved. */
export interface SaveState {
  recipeId: number;
  saved: boolean;
  saveCount: number;
}

/** One plan or collection the signed-in cook owns, as it was when they bought it (GET /api/me/purchases). */
export interface Purchase {
  productId: number;
  type: ProductType;
  /** The title at checkout; a later rename does not change it. */
  title: string;
  coverImageUrl: string | null;
  purchasedAt: string;
  recipeCount: number;
  mealCount: number | null;
  /** What the purchase holds. My kitchen lists the plan, not its recipes, so their shape is not spelled out here. */
  recipes: unknown[];
}

export type TripStatus = 'Building' | 'Shopping' | 'Sent' | 'Done';

/** One shopping list in a few words, for My kitchen. */
export interface TripSummary {
  id: number;
  name: string;
  status: TripStatus;
  createdAt: string;
  completedAt: string | null;
  recipeCount: number;
}

/** The signed-in cook's shopping lists (GET /api/me/trips): the one in use, if any, and the finished ones. */
export interface Trips {
  active: TripSummary | null;
  /** Newest first. */
  past: TripSummary[];
}

/** One shopping list in full (GET /api/me/trips/{id}). Every change to a list answers with it too. */
export interface Trip {
  id: number;
  name: string;
  status: TripStatus;
  createdAt: string;
  completedAt: string | null;
  /** True while the list is being built or shopped; a finished list is read-only. */
  canChange: boolean;
  /** The recipes the list cooks, each for a number of people. */
  items: { recipeId: number; title: string; servings: number }[];
  /** What to buy, by aisle then name. */
  lines: ShoppingListLine[];
  /** Ingredients already at home, taken off the list with "Have it". */
  skipped: { ingredientId: number; ingredient: string }[];
}

/** What "Shop this recipe" or "Shop this plan" did (POST /api/me/trips/items). */
export interface ShopResult {
  tripId: number;
  tripName: string;
  /** True when the list was made just now. */
  created: boolean;
  added: number;
  /** Recipes asked for that were on the list already; a recipe is never on it twice. */
  alreadyOnList: number;
}
