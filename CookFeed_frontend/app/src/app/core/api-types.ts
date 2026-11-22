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
