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
