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
