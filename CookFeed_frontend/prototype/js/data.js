/* Cookfeed prototype - the store's data, in one place.

   Every page reads from here instead of keeping its own copy, so the product page,
   the recipe pages, the creator page, the cart and the reviews all describe the
   same store. The objects are shaped like the rows in the project database
   (CookFeed_api/docs/schema.sql): each property is the camelCase form of a column,
   so products.price_cents becomes priceCents and reviews.created_at becomes createdAt.

   Data types follow the database:
     strings  - titles, descriptions, handles, review text, ISO dates
     numbers  - ids, prices in whole cents, servings, minutes, quantities, ratings
     Booleans - isActive, isPublished, isVerified, recommends
     null     - optional values that are not filled in (a recipe with no prep time)

   A few properties exist only for the prototype and have no column, because the
   real application will get them another way. Those are marked "prototype only". */

var CREATOR = {
  userId: 4,
  handle: "kenji-kitchen",
  displayName: "Kenji Watanabe",
  bio: "Japanese home cooking with a weeknight clock. Most dinners under 30 minutes, everything shoppable.",
  avatarUrl: "images/avatar-kenji.svg",
  isVerified: true,
  followerCount: 18400            // prototype only - there is no followers table yet
};

/* products row 3, with its product_recipes rows nested inside. */
var PRODUCT = {
  id: 3,
  creatorId: 4,
  type: "MealPlan",
  title: "Three Weeknights in Japan",
  description: "Monday, Tuesday, Wednesday dinners, each ready in 40 minutes or less.",
  coverImageUrl: "images/plan-hero.svg",
  priceCents: 1299,
  currency: "USD",
  isActive: true,
  recipes: [
    { recipeId: 5, sortOrder: 1, dayOffset: 0, slot: "Dinner" },
    { recipeId: 7, sortOrder: 2, dayOffset: 1, slot: "Dinner" },
    { recipeId: 6, sortOrder: 3, dayOffset: 2, slot: "Dinner" }
  ]
};

/* day_offset 0 is the first night of the plan. */
var DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/* recipes rows 5, 6 and 7 with their recipe_ingredients and recipe_steps.
   Each ingredient carries its aisle (ingredients.category) so the product page
   can build the shopping list straight from the recipes. */
var RECIPES = {
  5: {
    id: 5,
    creatorId: 4,
    title: "Chicken Teriyaki, the Real Way",
    description: "Four ingredients in the sauce. Skin-on thighs. That's the whole secret.",
    thumbnailUrl: "images/recipe-teriyaki.svg",
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 15,
    isPublished: true,
    publishedAt: "2026-07-13T12:00:00Z",
    saveCount: 733,
    pageUrl: "recipe-teriyaki.html",  // prototype only
    videoSeconds: 32,                 // prototype only - length of the mock video
    ingredients: [
      { quantity: 500, unit: "g",     name: "boneless chicken thigh", preparation: "skin on",       aisle: "Meat" },
      { quantity: 3,   unit: "tbsp",  name: "soy sauce",              preparation: null,            aisle: "Pantry" },
      { quantity: 3,   unit: "tbsp",  name: "mirin",                  preparation: null,            aisle: "Pantry" },
      { quantity: 2,   unit: "tbsp",  name: "sake",                   preparation: null,            aisle: "Beverages" },
      { quantity: 1,   unit: "tbsp",  name: "granulated sugar",       preparation: null,            aisle: "Pantry" },
      { quantity: 1,   unit: "tbsp",  name: "vegetable oil",          preparation: null,            aisle: "Pantry" },
      { quantity: 1,   unit: "bunch", name: "scallion",               preparation: "thinly sliced", aisle: "Produce" }
    ],
    steps: [
      { stepNumber: 1, videoTimestampSeconds: 8,  instruction: "Sear the thighs skin-side down in oil until deeply browned, about 6 minutes." },
      { stepNumber: 2, videoTimestampSeconds: 16, instruction: "Flip, add soy, mirin, sake, and sugar, and simmer until the sauce reduces to a glaze." },
      { stepNumber: 3, videoTimestampSeconds: 24, instruction: "Slice and spoon the glaze over. Garnish with scallions." }
    ]
  },
  6: {
    id: 6,
    creatorId: 4,
    title: "Onigiri Three Ways",
    description: "Salmon, umeboshi, and tuna-mayo. Rice, salt, and a wet hand.",
    thumbnailUrl: "images/recipe-onigiri.svg",
    servings: 4,
    prepMinutes: 20,
    cookMinutes: 20,
    isPublished: true,
    publishedAt: "2026-07-17T12:00:00Z",
    saveCount: 504,
    pageUrl: "recipe-onigiri.html",
    videoSeconds: 32,
    ingredients: [
      { quantity: 2, unit: "c",   name: "short-grain rice", preparation: "rinsed until the water runs clear", aisle: "Pantry" },
      { quantity: 1, unit: "tsp", name: "kosher salt",      preparation: "for your hands",                    aisle: "Spices" },
      { quantity: 1, unit: "tsp", name: "sesame oil",       preparation: null,                                aisle: "Pantry" }
    ],
    steps: [
      { stepNumber: 1, videoTimestampSeconds: 8,  instruction: "Cook the rice and let it cool until you can handle it." },
      { stepNumber: 2, videoTimestampSeconds: 16, instruction: "Wet and salt your hands, scoop a handful of rice, press in a filling, and shape into a triangle." },
      { stepNumber: 3, videoTimestampSeconds: 24, instruction: "Wrap with nori just before eating so it stays crisp." }
    ]
  },
  7: {
    id: 7,
    creatorId: 4,
    title: "10-Minute Ginger Garlic Stir-Fry",
    description: "The one-pan dinner I make when I have nothing planned.",
    thumbnailUrl: "images/recipe-stirfry.svg",
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 8,
    isPublished: true,
    publishedAt: "2026-07-23T12:00:00Z",
    saveCount: 387,
    pageUrl: "recipe-stirfry.html",
    videoSeconds: 32,
    ingredients: [
      { quantity: 300, unit: "g",     name: "chicken breast", preparation: "sliced thin",      aisle: "Meat" },
      { quantity: 1,   unit: "ea",    name: "broccoli",       preparation: "cut into florets", aisle: "Produce" },
      { quantity: 1,   unit: "ea",    name: "bell pepper",    preparation: "sliced",           aisle: "Produce" },
      { quantity: 3,   unit: "clove", name: "garlic",         preparation: "minced",           aisle: "Produce" },
      { quantity: 15,  unit: "g",     name: "fresh ginger",   preparation: "minced",           aisle: "Produce" },
      { quantity: 2,   unit: "tbsp",  name: "soy sauce",      preparation: null,               aisle: "Pantry" },
      { quantity: 1,   unit: "tbsp",  name: "cornstarch",     preparation: null,               aisle: "Pantry" },
      { quantity: 2,   unit: "tbsp",  name: "vegetable oil",  preparation: null,               aisle: "Pantry" },
      { quantity: 1,   unit: "tbsp",  name: "rice vinegar",   preparation: null,               aisle: "Pantry" },
      { quantity: 1,   unit: "tsp",   name: "sesame oil",     preparation: null,               aisle: "Pantry" }
    ],
    steps: [
      { stepNumber: 1, videoTimestampSeconds: 8,  instruction: "Toss the chicken with cornstarch and 1 tbsp soy sauce." },
      { stepNumber: 2, videoTimestampSeconds: 16, instruction: "Stir-fry the chicken in vegetable oil over high heat until just cooked, then remove." },
      { stepNumber: 3, videoTimestampSeconds: 24, instruction: "Stir-fry the vegetables, garlic, and ginger for 3 minutes, return the chicken, add the remaining soy, vinegar, and sesame oil, and toss." }
    ]
  }
};

/* reviews rows for product 3. reviewerName is users.display_name, joined in;
   the reviews table stores user_id, not a copy of the name. */
var SEED_REVIEWS = [
  {
    id: 1,
    productId: 3,
    userId: 1,
    reviewerName: "Alex Rivera",
    rating: 5,
    recommends: true,
    body: "I bought this on a Sunday and had all three dinners on the table by Wednesday. " +
          "The shopping list is the whole reason it worked. One trip, nothing left over.",
    createdAt: "2026-08-12T12:00:00Z"
  },
  {
    id: 2,
    productId: 3,
    userId: 2,
    reviewerName: "Priya Shah",
    rating: 4,
    recommends: true,
    body: "Teriyaki alone was worth the price. I scaled the plan to six for my family and " +
          "the quantities came out right. Taking one star off because I wanted a fourth night.",
    createdAt: "2026-08-09T12:00:00Z"
  },
  {
    id: 3,
    productId: 3,
    userId: 5,
    reviewerName: "Dan Okafor",
    rating: 3,
    recommends: false,
    body: "Good recipes, but I already cook Japanese food most weeks so there was not much " +
          "here I did not know. Better suited to someone just starting out.",
    createdAt: "2026-08-02T12:00:00Z"
  }
];

/* Field limits copied from the column sizes in schema.sql, so the forms refuse
   anything the database would refuse. */
var LIMITS = {
  reviewBodyMin: 15,
  reviewBodyMax: 2000,     // reviews.body varchar(2000)
  displayNameMax: 80,      // users.display_name varchar(80)
  servingsMin: 1,
  servingsMax: 20
};
