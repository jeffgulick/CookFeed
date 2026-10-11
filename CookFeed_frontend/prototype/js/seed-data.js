/* GENERATED from the seeded database by CookFeed_frontend/tools/export-seed-data.sh.
   Do not edit by hand: change the seed data, then run the script again.
   One array per table, rows in primary-key order, column names in camelCase. */
window.COOKFEED_SEED = {
    "roles": [
        {
            "id": 1,
            "name": "HomeCook"
        },
        {
            "id": 2,
            "name": "Creator"
        },
        {
            "id": 3,
            "name": "Admin"
        }
    ],
    "units": [
        {
            "id": 1,
            "name": "teaspoon",
            "category": "Volume",
            "isMetric": false,
            "abbreviation": "tsp",
            "toBaseFactor": 4.928920
        },
        {
            "id": 2,
            "name": "tablespoon",
            "category": "Volume",
            "isMetric": false,
            "abbreviation": "tbsp",
            "toBaseFactor": 14.786800
        },
        {
            "id": 3,
            "name": "cup",
            "category": "Volume",
            "isMetric": false,
            "abbreviation": "c",
            "toBaseFactor": 236.588000
        },
        {
            "id": 4,
            "name": "fluid ounce",
            "category": "Volume",
            "isMetric": false,
            "abbreviation": "fl oz",
            "toBaseFactor": 29.573500
        },
        {
            "id": 5,
            "name": "millilitre",
            "category": "Volume",
            "isMetric": true,
            "abbreviation": "ml",
            "toBaseFactor": 1.000000
        },
        {
            "id": 6,
            "name": "litre",
            "category": "Volume",
            "isMetric": true,
            "abbreviation": "L",
            "toBaseFactor": 1000.000000
        },
        {
            "id": 7,
            "name": "gram",
            "category": "Mass",
            "isMetric": true,
            "abbreviation": "g",
            "toBaseFactor": 1.000000
        },
        {
            "id": 8,
            "name": "kilogram",
            "category": "Mass",
            "isMetric": true,
            "abbreviation": "kg",
            "toBaseFactor": 1000.000000
        },
        {
            "id": 9,
            "name": "ounce",
            "category": "Mass",
            "isMetric": false,
            "abbreviation": "oz",
            "toBaseFactor": 28.349500
        },
        {
            "id": 10,
            "name": "pound",
            "category": "Mass",
            "isMetric": false,
            "abbreviation": "lb",
            "toBaseFactor": 453.592000
        },
        {
            "id": 11,
            "name": "each",
            "category": "Count",
            "isMetric": true,
            "abbreviation": "ea",
            "toBaseFactor": 1.000000
        },
        {
            "id": 12,
            "name": "clove",
            "category": "Count",
            "isMetric": true,
            "abbreviation": "clove",
            "toBaseFactor": 1.000000
        },
        {
            "id": 13,
            "name": "can",
            "category": "Count",
            "isMetric": true,
            "abbreviation": "can",
            "toBaseFactor": 1.000000
        },
        {
            "id": 14,
            "name": "bunch",
            "category": "Count",
            "isMetric": true,
            "abbreviation": "bunch",
            "toBaseFactor": 1.000000
        }
    ],
    "users": [
        {
            "id": 1,
            "createdAt": "2026-08-01T12:00:00+00:00",
            "displayName": "Alex Rivera"
        },
        {
            "id": 2,
            "createdAt": "2026-08-04T12:00:00+00:00",
            "displayName": "Priya Shah"
        },
        {
            "id": 3,
            "createdAt": "2026-07-02T12:00:00+00:00",
            "displayName": "Maria Conti"
        },
        {
            "id": 4,
            "createdAt": "2026-07-07T12:00:00+00:00",
            "displayName": "Kenji Watanabe"
        },
        {
            "id": 5,
            "createdAt": "2026-07-22T12:00:00+00:00",
            "displayName": "Dan Okafor"
        },
        {
            "id": 6,
            "createdAt": "2026-06-02T12:00:00+00:00",
            "displayName": "Cookfeed Admin"
        },
        {
            "id": 7,
            "createdAt": "2026-08-06T12:00:00+00:00",
            "displayName": "Sam Lee"
        },
        {
            "id": 8,
            "createdAt": "2026-08-08T12:00:00+00:00",
            "displayName": "Noor Haddad"
        },
        {
            "id": 9,
            "createdAt": "2026-08-10T12:00:00+00:00",
            "displayName": "Tom\u00e1s Reyes"
        },
        {
            "id": 10,
            "createdAt": "2026-08-12T12:00:00+00:00",
            "displayName": "Grace Kim"
        }
    ],
    "orders": [
        {
            "id": 1,
            "paidAt": "2026-08-11T12:01:00+00:00",
            "status": "Paid",
            "userId": 1,
            "currency": "USD",
            "placedAt": "2026-08-11T12:00:00+00:00",
            "totalCents": 2098,
            "paymentReference": "pi_seed_0001"
        },
        {
            "id": 2,
            "paidAt": "2026-08-31T12:02:00+00:00",
            "status": "Paid",
            "userId": 1,
            "currency": "USD",
            "placedAt": "2026-08-31T12:00:00+00:00",
            "totalCents": 999,
            "paymentReference": "pi_seed_0002"
        },
        {
            "id": 3,
            "paidAt": null,
            "status": "Cancelled",
            "userId": 1,
            "currency": "USD",
            "placedAt": "2026-09-05T12:00:00+00:00",
            "totalCents": 499,
            "paymentReference": null
        },
        {
            "id": 4,
            "paidAt": "2026-08-21T12:00:00+00:00",
            "status": "Paid",
            "userId": 2,
            "currency": "USD",
            "placedAt": "2026-08-21T12:00:00+00:00",
            "totalCents": 999,
            "paymentReference": "pi_seed_0003"
        },
        {
            "id": 5,
            "paidAt": "2026-08-08T12:00:00+00:00",
            "status": "Paid",
            "userId": 2,
            "currency": "USD",
            "placedAt": "2026-08-08T12:00:00+00:00",
            "totalCents": 1299,
            "paymentReference": "pi_seed_0004"
        },
        {
            "id": 6,
            "paidAt": "2026-08-01T12:00:00+00:00",
            "status": "Paid",
            "userId": 5,
            "currency": "USD",
            "placedAt": "2026-08-01T12:00:00+00:00",
            "totalCents": 1299,
            "paymentReference": "pi_seed_0005"
        }
    ],
    "recipes": [
        {
            "id": 1,
            "title": "15-Minute Spaghetti Carbonara",
            "servings": 4,
            "videoUrl": "https://cdn.cookfeed.app/videos/001.mp4",
            "createdAt": "2026-07-12T12:00:00+00:00",
            "creatorId": 3,
            "saveCount": 4,
            "visibility": "Public",
            "cookMinutes": 12,
            "description": "No cream. Ever. Eggs, cheese, pancetta, pepper, and the pasta water does the rest.",
            "isPublished": true,
            "prepMinutes": 5,
            "publishedAt": "2026-07-12T12:00:00+00:00",
            "thumbnailUrl": "images/recipes/1.svg"
        },
        {
            "id": 2,
            "title": "Sunday Marinara from Scratch",
            "servings": 6,
            "videoUrl": "https://cdn.cookfeed.app/videos/002.mp4",
            "createdAt": "2026-07-14T12:00:00+00:00",
            "creatorId": 3,
            "saveCount": 3,
            "visibility": "Public",
            "cookMinutes": 60,
            "description": "One can of tomatoes, one onion, one hour. Freezes beautifully.",
            "isPublished": true,
            "prepMinutes": 10,
            "publishedAt": "2026-07-14T12:00:00+00:00",
            "thumbnailUrl": "images/recipes/2.svg"
        },
        {
            "id": 3,
            "title": "No-Knead Focaccia",
            "servings": 8,
            "videoUrl": "https://cdn.cookfeed.app/videos/003.mp4",
            "createdAt": "2026-07-20T12:00:00+00:00",
            "creatorId": 3,
            "saveCount": 6,
            "visibility": "Public",
            "cookMinutes": 25,
            "description": "Mix tonight, bake tomorrow. Dimples optional but strongly encouraged.",
            "isPublished": true,
            "prepMinutes": 15,
            "publishedAt": "2026-07-20T12:00:00+00:00",
            "thumbnailUrl": "images/recipes/3.svg"
        },
        {
            "id": 4,
            "title": "Weeknight Chicken Parm",
            "servings": 4,
            "videoUrl": "https://cdn.cookfeed.app/videos/004.mp4",
            "createdAt": "2026-07-26T12:00:00+00:00",
            "creatorId": 3,
            "saveCount": 0,
            "visibility": "ProductOnly",
            "cookMinutes": 20,
            "description": "Thin cutlets, quick fry, broiled with marinara and mozzarella.",
            "isPublished": true,
            "prepMinutes": 15,
            "publishedAt": "2026-07-26T12:00:00+00:00",
            "thumbnailUrl": "images/recipes/4.svg"
        },
        {
            "id": 5,
            "title": "Chicken Teriyaki, the Real Way",
            "servings": 2,
            "videoUrl": "https://cdn.cookfeed.app/videos/005.mp4",
            "createdAt": "2026-07-13T12:00:00+00:00",
            "creatorId": 4,
            "saveCount": 7,
            "visibility": "Public",
            "cookMinutes": 15,
            "description": "Four ingredients in the sauce. Skin-on thighs. That's the whole secret.",
            "isPublished": true,
            "prepMinutes": 5,
            "publishedAt": "2026-07-13T12:00:00+00:00",
            "thumbnailUrl": "images/recipes/5.svg"
        },
        {
            "id": 6,
            "title": "Onigiri Three Ways",
            "servings": 4,
            "videoUrl": "https://cdn.cookfeed.app/videos/006.mp4",
            "createdAt": "2026-07-17T12:00:00+00:00",
            "creatorId": 4,
            "saveCount": 0,
            "visibility": "ProductOnly",
            "cookMinutes": 20,
            "description": "Salmon, umeboshi, and tuna-mayo. Rice, salt, and a wet hand.",
            "isPublished": true,
            "prepMinutes": 20,
            "publishedAt": "2026-07-17T12:00:00+00:00",
            "thumbnailUrl": "images/recipes/6.svg"
        },
        {
            "id": 7,
            "title": "10-Minute Ginger Garlic Stir-Fry",
            "servings": 2,
            "videoUrl": "https://cdn.cookfeed.app/videos/007.mp4",
            "createdAt": "2026-07-23T12:00:00+00:00",
            "creatorId": 4,
            "saveCount": 2,
            "visibility": "Public",
            "cookMinutes": 8,
            "description": "The one-pan dinner I make when I have nothing planned.",
            "isPublished": true,
            "prepMinutes": 5,
            "publishedAt": "2026-07-23T12:00:00+00:00",
            "thumbnailUrl": "images/recipes/7.svg"
        },
        {
            "id": 8,
            "title": "Saturday Buttermilk-Style Pancakes",
            "servings": 4,
            "videoUrl": "https://cdn.cookfeed.app/videos/008.mp4",
            "createdAt": "2026-07-24T12:00:00+00:00",
            "creatorId": 5,
            "saveCount": 3,
            "visibility": "Public",
            "cookMinutes": 15,
            "description": "Fluffy, forgiving, and the kids can help. Milk plus a little vinegar stands in for buttermilk.",
            "isPublished": true,
            "prepMinutes": 10,
            "publishedAt": "2026-07-24T12:00:00+00:00",
            "thumbnailUrl": "images/recipes/8.svg"
        },
        {
            "id": 9,
            "title": "Five-Day Overnight Oats",
            "servings": 5,
            "videoUrl": "https://cdn.cookfeed.app/videos/009.mp4",
            "createdAt": "2026-07-25T12:00:00+00:00",
            "creatorId": 5,
            "saveCount": 3,
            "visibility": "Public",
            "cookMinutes": 0,
            "description": "One mixing bowl on Sunday, five breakfasts done.",
            "isPublished": true,
            "prepMinutes": 10,
            "publishedAt": "2026-07-25T12:00:00+00:00",
            "thumbnailUrl": "images/recipes/9.svg"
        },
        {
            "id": 10,
            "title": "Weeknight Beef Tacos",
            "servings": 4,
            "videoUrl": "https://cdn.cookfeed.app/videos/010.mp4",
            "createdAt": "2026-07-28T12:00:00+00:00",
            "creatorId": 5,
            "saveCount": 1,
            "visibility": "Public",
            "cookMinutes": 15,
            "description": "Skip the packet. Cumin, chili powder, and a squeeze of lime.",
            "isPublished": true,
            "prepMinutes": 10,
            "publishedAt": "2026-07-28T12:00:00+00:00",
            "thumbnailUrl": "images/recipes/10.svg"
        },
        {
            "id": 11,
            "title": "Smooth Hummus",
            "servings": 6,
            "videoUrl": "https://cdn.cookfeed.app/videos/011.mp4",
            "createdAt": "2026-07-29T12:00:00+00:00",
            "creatorId": 5,
            "saveCount": 1,
            "visibility": "Public",
            "cookMinutes": 0,
            "description": "Peel the chickpeas. Yes, really. It's worth it.",
            "isPublished": true,
            "prepMinutes": 15,
            "publishedAt": "2026-07-29T12:00:00+00:00",
            "thumbnailUrl": "images/recipes/11.svg"
        },
        {
            "id": 12,
            "title": "Brown Butter Chocolate Chip Cookies",
            "servings": 24,
            "videoUrl": "https://cdn.cookfeed.app/videos/012.mp4",
            "createdAt": "2026-07-30T12:00:00+00:00",
            "creatorId": 5,
            "saveCount": 8,
            "visibility": "Public",
            "cookMinutes": 12,
            "description": "Brown the butter. Chill the dough. Thank me later.",
            "isPublished": true,
            "prepMinutes": 20,
            "publishedAt": "2026-07-30T12:00:00+00:00",
            "thumbnailUrl": "images/recipes/12.svg"
        },
        {
            "id": 13,
            "title": "Miso Soup (draft)",
            "servings": 2,
            "videoUrl": "https://cdn.cookfeed.app/videos/draft-miso.mp4",
            "createdAt": "2026-07-31T12:00:00+00:00",
            "creatorId": 4,
            "saveCount": 0,
            "visibility": "Public",
            "cookMinutes": null,
            "description": null,
            "isPublished": false,
            "prepMinutes": null,
            "publishedAt": null,
            "thumbnailUrl": null
        }
    ],
    "reviews": [
        {
            "id": 1,
            "body": "I bought this on a Sunday and had all three dinners on the table by Wednesday. The shopping list is the whole reason it worked. One trip, nothing left over.",
            "rating": 5,
            "userId": 1,
            "createdAt": "2026-08-12T12:00:00+00:00",
            "productId": 3,
            "recommends": true
        },
        {
            "id": 2,
            "body": "Teriyaki alone was worth the price. I scaled the plan to six for my family and the quantities came out right. Taking one star off because I wanted a fourth night.",
            "rating": 4,
            "userId": 2,
            "createdAt": "2026-08-09T12:00:00+00:00",
            "productId": 3,
            "recommends": true
        },
        {
            "id": 3,
            "body": "Good recipes, but I already cook Japanese food most weeks so there was not much here I did not know. Better suited to someone just starting out.",
            "rating": 3,
            "userId": 5,
            "createdAt": "2026-08-02T12:00:00+00:00",
            "productId": 3,
            "recommends": false
        }
    ],
    "products": [
        {
            "id": 1,
            "type": "RecipeCollection",
            "title": "Roman Pasta Collection",
            "currency": "USD",
            "isActive": true,
            "createdAt": "2026-07-18T12:00:00+00:00",
            "creatorId": 3,
            "priceCents": 799,
            "description": "Carbonara, marinara, and the techniques behind them, with shopping lists built in.",
            "coverImageUrl": "images/products/1.svg"
        },
        {
            "id": 2,
            "type": "RecipeCollection",
            "title": "The Bread Box",
            "currency": "USD",
            "isActive": true,
            "createdAt": "2026-07-21T12:00:00+00:00",
            "creatorId": 3,
            "priceCents": 499,
            "description": "Focaccia and friends.",
            "coverImageUrl": "images/products/2.svg"
        },
        {
            "id": 3,
            "type": "MealPlan",
            "title": "Three Weeknights in Japan",
            "currency": "USD",
            "isActive": true,
            "createdAt": "2026-07-19T12:00:00+00:00",
            "creatorId": 4,
            "priceCents": 1299,
            "description": "Monday, Tuesday, Wednesday dinners, each ready in 40 minutes or less.",
            "coverImageUrl": "images/products/3.svg"
        },
        {
            "id": 4,
            "type": "MealPlan",
            "title": "Family Week on a Budget",
            "currency": "USD",
            "isActive": true,
            "createdAt": "2026-07-27T12:00:00+00:00",
            "creatorId": 5,
            "priceCents": 999,
            "description": "Seven dinners, two breakfasts, one grocery trip.",
            "coverImageUrl": "images/products/4.svg"
        },
        {
            "id": 5,
            "type": "RecipeCollection",
            "title": "Summer Grilling (retired)",
            "currency": "USD",
            "isActive": false,
            "createdAt": "2026-06-22T12:00:00+00:00",
            "creatorId": 5,
            "priceCents": 599,
            "description": null,
            "coverImageUrl": "images/products/5.svg"
        }
    ],
    "cartItems": [
        {
            "userId": 1,
            "addedAt": "2026-09-06T12:00:00+00:00",
            "productId": 2
        }
    ],
    "mealPlans": [
        {
            "id": 1,
            "name": "Week of Sept 21",
            "userId": 1,
            "createdAt": "2026-09-19T12:00:00+00:00",
            "weekStart": "2026-09-21"
        }
    ],
    "userRoles": [
        {
            "roleId": 1,
            "userId": 1,
            "grantedAt": "2026-08-01T12:00:00+00:00"
        },
        {
            "roleId": 1,
            "userId": 2,
            "grantedAt": "2026-08-04T12:00:00+00:00"
        },
        {
            "roleId": 1,
            "userId": 3,
            "grantedAt": "2026-07-02T12:00:00+00:00"
        },
        {
            "roleId": 2,
            "userId": 3,
            "grantedAt": "2026-07-02T12:00:00+00:00"
        },
        {
            "roleId": 1,
            "userId": 4,
            "grantedAt": "2026-07-07T12:00:00+00:00"
        },
        {
            "roleId": 2,
            "userId": 4,
            "grantedAt": "2026-07-07T12:00:00+00:00"
        },
        {
            "roleId": 1,
            "userId": 5,
            "grantedAt": "2026-07-22T12:00:00+00:00"
        },
        {
            "roleId": 2,
            "userId": 5,
            "grantedAt": "2026-07-22T12:00:00+00:00"
        },
        {
            "roleId": 3,
            "userId": 6,
            "grantedAt": "2026-06-02T12:00:00+00:00"
        },
        {
            "roleId": 1,
            "userId": 7,
            "grantedAt": "2026-08-06T12:00:00+00:00"
        },
        {
            "roleId": 1,
            "userId": 8,
            "grantedAt": "2026-08-08T12:00:00+00:00"
        },
        {
            "roleId": 1,
            "userId": 9,
            "grantedAt": "2026-08-10T12:00:00+00:00"
        },
        {
            "roleId": 1,
            "userId": 10,
            "grantedAt": "2026-08-12T12:00:00+00:00"
        }
    ],
    "orderItems": [
        {
            "id": 1,
            "orderId": 1,
            "creatorId": 3,
            "productId": 1,
            "productTitle": "Roman Pasta Collection",
            "unitPriceCents": 799
        },
        {
            "id": 2,
            "orderId": 1,
            "creatorId": 4,
            "productId": 3,
            "productTitle": "Three Weeknights in Japan",
            "unitPriceCents": 1299
        },
        {
            "id": 3,
            "orderId": 2,
            "creatorId": 5,
            "productId": 4,
            "productTitle": "Family Week on a Budget",
            "unitPriceCents": 999
        },
        {
            "id": 4,
            "orderId": 3,
            "creatorId": 3,
            "productId": 2,
            "productTitle": "The Bread Box",
            "unitPriceCents": 499
        },
        {
            "id": 5,
            "orderId": 4,
            "creatorId": 5,
            "productId": 4,
            "productTitle": "Family Week on a Budget",
            "unitPriceCents": 999
        },
        {
            "id": 6,
            "orderId": 5,
            "creatorId": 4,
            "productId": 3,
            "productTitle": "Three Weeknights in Japan",
            "unitPriceCents": 1299
        },
        {
            "id": 7,
            "orderId": 6,
            "creatorId": 4,
            "productId": 3,
            "productTitle": "Three Weeknights in Japan",
            "unitPriceCents": 1299
        }
    ],
    "ingredients": [
        {
            "id": 1,
            "name": "all-purpose flour",
            "category": "Pantry",
            "densityGPerMl": 0.5300,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 2,
            "name": "granulated sugar",
            "category": "Pantry",
            "densityGPerMl": 0.8500,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 3,
            "name": "brown sugar",
            "category": "Pantry",
            "densityGPerMl": 0.8200,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 4,
            "name": "unsalted butter",
            "category": "Dairy",
            "densityGPerMl": 0.9110,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 5,
            "name": "egg",
            "category": "Dairy",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 11
        },
        {
            "id": 6,
            "name": "whole milk",
            "category": "Dairy",
            "densityGPerMl": 1.0300,
            "preferredShoppingUnitId": 5
        },
        {
            "id": 7,
            "name": "parmesan cheese",
            "category": "Dairy",
            "densityGPerMl": 0.4500,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 8,
            "name": "mozzarella cheese",
            "category": "Dairy",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 9,
            "name": "heavy cream",
            "category": "Dairy",
            "densityGPerMl": 1.0000,
            "preferredShoppingUnitId": 5
        },
        {
            "id": 10,
            "name": "olive oil",
            "category": "Pantry",
            "densityGPerMl": 0.9200,
            "preferredShoppingUnitId": 5
        },
        {
            "id": 11,
            "name": "kosher salt",
            "category": "Spices",
            "densityGPerMl": 1.2000,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 12,
            "name": "black pepper",
            "category": "Spices",
            "densityGPerMl": 0.5000,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 13,
            "name": "garlic",
            "category": "Produce",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 12
        },
        {
            "id": 14,
            "name": "yellow onion",
            "category": "Produce",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 11
        },
        {
            "id": 15,
            "name": "crushed tomatoes",
            "category": "Pantry",
            "densityGPerMl": 1.0200,
            "preferredShoppingUnitId": 13
        },
        {
            "id": 16,
            "name": "fresh basil",
            "category": "Produce",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 14
        },
        {
            "id": 17,
            "name": "spaghetti",
            "category": "Pantry",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 18,
            "name": "pancetta",
            "category": "Meat",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 19,
            "name": "boneless chicken thigh",
            "category": "Meat",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 20,
            "name": "chicken breast",
            "category": "Meat",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 21,
            "name": "ground beef",
            "category": "Meat",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 22,
            "name": "soy sauce",
            "category": "Pantry",
            "densityGPerMl": 1.0700,
            "preferredShoppingUnitId": 5
        },
        {
            "id": 23,
            "name": "mirin",
            "category": "Pantry",
            "densityGPerMl": 1.1000,
            "preferredShoppingUnitId": 5
        },
        {
            "id": 24,
            "name": "sake",
            "category": "Beverages",
            "densityGPerMl": 0.9900,
            "preferredShoppingUnitId": 5
        },
        {
            "id": 25,
            "name": "fresh ginger",
            "category": "Produce",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 26,
            "name": "scallion",
            "category": "Produce",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 14
        },
        {
            "id": 27,
            "name": "short-grain rice",
            "category": "Pantry",
            "densityGPerMl": 0.8500,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 28,
            "name": "rice vinegar",
            "category": "Pantry",
            "densityGPerMl": 1.0100,
            "preferredShoppingUnitId": 5
        },
        {
            "id": 29,
            "name": "sesame oil",
            "category": "Pantry",
            "densityGPerMl": 0.9200,
            "preferredShoppingUnitId": 5
        },
        {
            "id": 30,
            "name": "vegetable oil",
            "category": "Pantry",
            "densityGPerMl": 0.9200,
            "preferredShoppingUnitId": 5
        },
        {
            "id": 31,
            "name": "lime",
            "category": "Produce",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 11
        },
        {
            "id": 32,
            "name": "cilantro",
            "category": "Produce",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 14
        },
        {
            "id": 33,
            "name": "flour tortilla",
            "category": "Bakery",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 11
        },
        {
            "id": 34,
            "name": "chickpeas",
            "category": "Pantry",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 13
        },
        {
            "id": 35,
            "name": "tahini",
            "category": "Pantry",
            "densityGPerMl": 1.1000,
            "preferredShoppingUnitId": 5
        },
        {
            "id": 36,
            "name": "lemon",
            "category": "Produce",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 11
        },
        {
            "id": 37,
            "name": "ground cumin",
            "category": "Spices",
            "densityGPerMl": 0.5500,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 38,
            "name": "chili powder",
            "category": "Spices",
            "densityGPerMl": 0.5000,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 39,
            "name": "baking powder",
            "category": "Pantry",
            "densityGPerMl": 0.9000,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 40,
            "name": "vanilla extract",
            "category": "Pantry",
            "densityGPerMl": 0.8800,
            "preferredShoppingUnitId": 5
        },
        {
            "id": 41,
            "name": "chocolate chips",
            "category": "Pantry",
            "densityGPerMl": 0.6500,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 42,
            "name": "rolled oats",
            "category": "Pantry",
            "densityGPerMl": 0.4100,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 43,
            "name": "banana",
            "category": "Produce",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 11
        },
        {
            "id": 44,
            "name": "honey",
            "category": "Pantry",
            "densityGPerMl": 1.4200,
            "preferredShoppingUnitId": 5
        },
        {
            "id": 45,
            "name": "greek yogurt",
            "category": "Dairy",
            "densityGPerMl": 1.0500,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 46,
            "name": "blueberries",
            "category": "Produce",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 47,
            "name": "baby spinach",
            "category": "Produce",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 48,
            "name": "bell pepper",
            "category": "Produce",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 11
        },
        {
            "id": 49,
            "name": "broccoli",
            "category": "Produce",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 11
        },
        {
            "id": 50,
            "name": "cornstarch",
            "category": "Pantry",
            "densityGPerMl": 0.5400,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 51,
            "name": "salmon fillet",
            "category": "Seafood",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 52,
            "name": "umeboshi",
            "category": "Pantry",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 11
        },
        {
            "id": 53,
            "name": "canned tuna",
            "category": "Pantry",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 13
        },
        {
            "id": 54,
            "name": "mayonnaise",
            "category": "Pantry",
            "densityGPerMl": 0.9100,
            "preferredShoppingUnitId": 7
        },
        {
            "id": 55,
            "name": "nori",
            "category": "Pantry",
            "densityGPerMl": null,
            "preferredShoppingUnitId": 11
        }
    ],
    "recipeSteps": [
        {
            "id": 1,
            "recipeId": 1,
            "stepNumber": 1,
            "instruction": "Boil a large pot of salted water and cook the spaghetti until just shy of al dente.",
            "durationMinutes": null,
            "videoTimestampSeconds": 8
        },
        {
            "id": 2,
            "recipeId": 1,
            "stepNumber": 2,
            "instruction": "Render the pancetta in a cold pan over medium heat until crisp.",
            "durationMinutes": null,
            "videoTimestampSeconds": 16
        },
        {
            "id": 3,
            "recipeId": 1,
            "stepNumber": 3,
            "instruction": "Whisk the eggs, cheese, and pepper in a bowl.",
            "durationMinutes": null,
            "videoTimestampSeconds": 24
        },
        {
            "id": 4,
            "recipeId": 1,
            "stepNumber": 4,
            "instruction": "Off the heat, toss the pasta with the pancetta, then add the egg mixture and a splash of pasta water, stirring fast until glossy.",
            "durationMinutes": null,
            "videoTimestampSeconds": 32
        },
        {
            "id": 5,
            "recipeId": 1,
            "stepNumber": 5,
            "instruction": "Serve immediately with more cheese and pepper.",
            "durationMinutes": null,
            "videoTimestampSeconds": 40
        },
        {
            "id": 6,
            "recipeId": 2,
            "stepNumber": 1,
            "instruction": "Sweat the onion in olive oil over low heat until translucent, about 8 minutes.",
            "durationMinutes": null,
            "videoTimestampSeconds": 8
        },
        {
            "id": 7,
            "recipeId": 2,
            "stepNumber": 2,
            "instruction": "Add garlic and cook 1 minute, until fragrant.",
            "durationMinutes": null,
            "videoTimestampSeconds": 16
        },
        {
            "id": 8,
            "recipeId": 2,
            "stepNumber": 3,
            "instruction": "Add tomatoes, salt, and sugar. Simmer uncovered for 45 minutes, stirring now and then.",
            "durationMinutes": null,
            "videoTimestampSeconds": 24
        },
        {
            "id": 9,
            "recipeId": 2,
            "stepNumber": 4,
            "instruction": "Stir in basil off the heat.",
            "durationMinutes": null,
            "videoTimestampSeconds": 32
        },
        {
            "id": 10,
            "recipeId": 3,
            "stepNumber": 1,
            "instruction": "Stir flour, salt, sugar, and 400 ml of water into a shaggy dough. Cover and refrigerate overnight.",
            "durationMinutes": null,
            "videoTimestampSeconds": 8
        },
        {
            "id": 11,
            "recipeId": 3,
            "stepNumber": 2,
            "instruction": "Pour the dough into a well-oiled pan and let it rise at room temperature for 2 hours.",
            "durationMinutes": null,
            "videoTimestampSeconds": 16
        },
        {
            "id": 12,
            "recipeId": 3,
            "stepNumber": 3,
            "instruction": "Dimple with oiled fingers, top with flaky salt, and bake at 230\u00b0C for 25 minutes.",
            "durationMinutes": null,
            "videoTimestampSeconds": 24
        },
        {
            "id": 13,
            "recipeId": 4,
            "stepNumber": 1,
            "instruction": "Season the chicken and dredge in flour, then egg, then parmesan.",
            "durationMinutes": null,
            "videoTimestampSeconds": 8
        },
        {
            "id": 14,
            "recipeId": 4,
            "stepNumber": 2,
            "instruction": "Shallow-fry in vegetable oil until golden on both sides.",
            "durationMinutes": null,
            "videoTimestampSeconds": 16
        },
        {
            "id": 15,
            "recipeId": 4,
            "stepNumber": 3,
            "instruction": "Top with marinara and mozzarella and broil until bubbling.",
            "durationMinutes": null,
            "videoTimestampSeconds": 24
        },
        {
            "id": 16,
            "recipeId": 5,
            "stepNumber": 1,
            "instruction": "Sear the thighs skin-side down in oil until deeply browned, about 6 minutes.",
            "durationMinutes": null,
            "videoTimestampSeconds": 8
        },
        {
            "id": 17,
            "recipeId": 5,
            "stepNumber": 2,
            "instruction": "Flip, add soy, mirin, sake, and sugar, and simmer until the sauce reduces to a glaze.",
            "durationMinutes": null,
            "videoTimestampSeconds": 16
        },
        {
            "id": 18,
            "recipeId": 5,
            "stepNumber": 3,
            "instruction": "Slice and spoon the glaze over. Garnish with scallions.",
            "durationMinutes": null,
            "videoTimestampSeconds": 24
        },
        {
            "id": 19,
            "recipeId": 6,
            "stepNumber": 1,
            "instruction": "Cook the rice and let it cool until you can handle it.",
            "durationMinutes": null,
            "videoTimestampSeconds": 8
        },
        {
            "id": 20,
            "recipeId": 6,
            "stepNumber": 2,
            "instruction": "Wet and salt your hands, scoop a handful of rice, press in a filling, and shape into a triangle.",
            "durationMinutes": null,
            "videoTimestampSeconds": 16
        },
        {
            "id": 21,
            "recipeId": 6,
            "stepNumber": 3,
            "instruction": "Wrap with nori just before eating so it stays crisp.",
            "durationMinutes": null,
            "videoTimestampSeconds": 24
        },
        {
            "id": 22,
            "recipeId": 7,
            "stepNumber": 1,
            "instruction": "Toss the chicken with cornstarch and 1 tbsp soy sauce.",
            "durationMinutes": null,
            "videoTimestampSeconds": 8
        },
        {
            "id": 23,
            "recipeId": 7,
            "stepNumber": 2,
            "instruction": "Stir-fry the chicken in vegetable oil over high heat until just cooked, then remove.",
            "durationMinutes": null,
            "videoTimestampSeconds": 16
        },
        {
            "id": 24,
            "recipeId": 7,
            "stepNumber": 3,
            "instruction": "Stir-fry the vegetables, garlic, and ginger for 3 minutes, return the chicken, add the remaining soy, vinegar, and sesame oil, and toss.",
            "durationMinutes": null,
            "videoTimestampSeconds": 24
        },
        {
            "id": 25,
            "recipeId": 8,
            "stepNumber": 1,
            "instruction": "Whisk the dry ingredients together in one bowl and the wet in another.",
            "durationMinutes": null,
            "videoTimestampSeconds": 8
        },
        {
            "id": 26,
            "recipeId": 8,
            "stepNumber": 2,
            "instruction": "Combine and stir just until no dry streaks remain. Lumps are fine.",
            "durationMinutes": null,
            "videoTimestampSeconds": 16
        },
        {
            "id": 27,
            "recipeId": 8,
            "stepNumber": 3,
            "instruction": "Cook on a medium griddle until bubbles form, flip, and cook 1 more minute.",
            "durationMinutes": null,
            "videoTimestampSeconds": 24
        },
        {
            "id": 28,
            "recipeId": 9,
            "stepNumber": 1,
            "instruction": "Mash the bananas in a large bowl and whisk in milk, yogurt, honey, and vanilla.",
            "durationMinutes": null,
            "videoTimestampSeconds": 8
        },
        {
            "id": 29,
            "recipeId": 9,
            "stepNumber": 2,
            "instruction": "Stir in the oats and blueberries.",
            "durationMinutes": null,
            "videoTimestampSeconds": 16
        },
        {
            "id": 30,
            "recipeId": 9,
            "stepNumber": 3,
            "instruction": "Portion into five jars and refrigerate overnight.",
            "durationMinutes": null,
            "videoTimestampSeconds": 24
        },
        {
            "id": 31,
            "recipeId": 10,
            "stepNumber": 1,
            "instruction": "Brown the beef with the onion, breaking it up as it cooks.",
            "durationMinutes": null,
            "videoTimestampSeconds": 8
        },
        {
            "id": 32,
            "recipeId": 10,
            "stepNumber": 2,
            "instruction": "Add garlic and spices and cook 2 minutes more.",
            "durationMinutes": null,
            "videoTimestampSeconds": 16
        },
        {
            "id": 33,
            "recipeId": 10,
            "stepNumber": 3,
            "instruction": "Serve in warm tortillas with lime and cilantro.",
            "durationMinutes": null,
            "videoTimestampSeconds": 24
        },
        {
            "id": 34,
            "recipeId": 11,
            "stepNumber": 1,
            "instruction": "Blend tahini and lemon juice for a minute until pale and whipped.",
            "durationMinutes": null,
            "videoTimestampSeconds": 8
        },
        {
            "id": 35,
            "recipeId": 11,
            "stepNumber": 2,
            "instruction": "Add chickpeas, garlic, cumin, salt, and olive oil and blend, adding cold water a tablespoon at a time until silky.",
            "durationMinutes": null,
            "videoTimestampSeconds": 16
        },
        {
            "id": 36,
            "recipeId": 12,
            "stepNumber": 1,
            "instruction": "Brown the butter in a light-colored pan until it smells nutty, then cool 10 minutes.",
            "durationMinutes": null,
            "videoTimestampSeconds": 8
        },
        {
            "id": 37,
            "recipeId": 12,
            "stepNumber": 2,
            "instruction": "Beat the butter with both sugars, then the eggs and vanilla.",
            "durationMinutes": null,
            "videoTimestampSeconds": 16
        },
        {
            "id": 38,
            "recipeId": 12,
            "stepNumber": 3,
            "instruction": "Fold in flour, baking powder, salt, and chocolate chips. Chill the dough at least 1 hour.",
            "durationMinutes": null,
            "videoTimestampSeconds": 24
        },
        {
            "id": 39,
            "recipeId": 12,
            "stepNumber": 4,
            "instruction": "Bake at 180\u00b0C for 11\u201312 minutes until the edges are set and the centers look underdone.",
            "durationMinutes": null,
            "videoTimestampSeconds": 32
        },
        {
            "id": 40,
            "recipeId": 13,
            "stepNumber": 1,
            "instruction": "TODO",
            "durationMinutes": null,
            "videoTimestampSeconds": null
        }
    ],
    "savedRecipes": [
        {
            "userId": 1,
            "savedAt": "2026-08-02T12:00:00+00:00",
            "recipeId": 1
        },
        {
            "userId": 1,
            "savedAt": "2026-08-03T12:00:00+00:00",
            "recipeId": 3
        },
        {
            "userId": 1,
            "savedAt": "2026-08-05T12:00:00+00:00",
            "recipeId": 5
        },
        {
            "userId": 1,
            "savedAt": "2026-08-07T12:00:00+00:00",
            "recipeId": 7
        },
        {
            "userId": 1,
            "savedAt": "2026-08-04T12:00:00+00:00",
            "recipeId": 8
        },
        {
            "userId": 1,
            "savedAt": "2026-08-06T12:00:00+00:00",
            "recipeId": 12
        },
        {
            "userId": 2,
            "savedAt": "2026-08-10T12:00:00+00:00",
            "recipeId": 3
        },
        {
            "userId": 2,
            "savedAt": "2026-08-09T12:00:00+00:00",
            "recipeId": 5
        },
        {
            "userId": 2,
            "savedAt": "2026-08-22T12:00:00+00:00",
            "recipeId": 9
        },
        {
            "userId": 2,
            "savedAt": "2026-08-05T12:00:00+00:00",
            "recipeId": 12
        },
        {
            "userId": 3,
            "savedAt": "2026-08-03T12:00:00+00:00",
            "recipeId": 5
        },
        {
            "userId": 3,
            "savedAt": "2026-08-15T12:00:00+00:00",
            "recipeId": 7
        },
        {
            "userId": 3,
            "savedAt": "2026-08-14T12:00:00+00:00",
            "recipeId": 12
        },
        {
            "userId": 4,
            "savedAt": "2026-08-12T12:00:00+00:00",
            "recipeId": 1
        },
        {
            "userId": 4,
            "savedAt": "2026-08-11T12:00:00+00:00",
            "recipeId": 3
        },
        {
            "userId": 4,
            "savedAt": "2026-08-04T12:00:00+00:00",
            "recipeId": 12
        },
        {
            "userId": 5,
            "savedAt": "2026-08-13T12:00:00+00:00",
            "recipeId": 1
        },
        {
            "userId": 5,
            "savedAt": "2026-08-20T12:00:00+00:00",
            "recipeId": 2
        },
        {
            "userId": 5,
            "savedAt": "2026-08-13T12:00:00+00:00",
            "recipeId": 3
        },
        {
            "userId": 5,
            "savedAt": "2026-08-01T12:00:00+00:00",
            "recipeId": 5
        },
        {
            "userId": 7,
            "savedAt": "2026-08-17T12:00:00+00:00",
            "recipeId": 1
        },
        {
            "userId": 7,
            "savedAt": "2026-08-08T12:00:00+00:00",
            "recipeId": 3
        },
        {
            "userId": 7,
            "savedAt": "2026-08-07T12:00:00+00:00",
            "recipeId": 5
        },
        {
            "userId": 7,
            "savedAt": "2026-08-16T12:00:00+00:00",
            "recipeId": 9
        },
        {
            "userId": 7,
            "savedAt": "2026-08-07T12:00:00+00:00",
            "recipeId": 12
        },
        {
            "userId": 8,
            "savedAt": "2026-08-19T12:00:00+00:00",
            "recipeId": 2
        },
        {
            "userId": 8,
            "savedAt": "2026-08-09T12:00:00+00:00",
            "recipeId": 5
        },
        {
            "userId": 8,
            "savedAt": "2026-08-18T12:00:00+00:00",
            "recipeId": 8
        },
        {
            "userId": 8,
            "savedAt": "2026-08-09T12:00:00+00:00",
            "recipeId": 12
        },
        {
            "userId": 9,
            "savedAt": "2026-08-12T12:00:00+00:00",
            "recipeId": 3
        },
        {
            "userId": 9,
            "savedAt": "2026-08-11T12:00:00+00:00",
            "recipeId": 5
        },
        {
            "userId": 9,
            "savedAt": "2026-08-23T12:00:00+00:00",
            "recipeId": 10
        },
        {
            "userId": 9,
            "savedAt": "2026-08-24T12:00:00+00:00",
            "recipeId": 11
        },
        {
            "userId": 9,
            "savedAt": "2026-08-11T12:00:00+00:00",
            "recipeId": 12
        },
        {
            "userId": 10,
            "savedAt": "2026-08-25T12:00:00+00:00",
            "recipeId": 2
        },
        {
            "userId": 10,
            "savedAt": "2026-08-26T12:00:00+00:00",
            "recipeId": 8
        },
        {
            "userId": 10,
            "savedAt": "2026-08-13T12:00:00+00:00",
            "recipeId": 9
        },
        {
            "userId": 10,
            "savedAt": "2026-08-13T12:00:00+00:00",
            "recipeId": 12
        }
    ],
    "productRecipes": [
        {
            "id": 1,
            "slot": null,
            "recipeId": 1,
            "dayOffset": null,
            "productId": 1,
            "sortOrder": 1
        },
        {
            "id": 2,
            "slot": null,
            "recipeId": 2,
            "dayOffset": null,
            "productId": 1,
            "sortOrder": 2
        },
        {
            "id": 3,
            "slot": null,
            "recipeId": 4,
            "dayOffset": null,
            "productId": 1,
            "sortOrder": 3
        },
        {
            "id": 4,
            "slot": null,
            "recipeId": 3,
            "dayOffset": null,
            "productId": 2,
            "sortOrder": 1
        },
        {
            "id": 5,
            "slot": "Dinner",
            "recipeId": 5,
            "dayOffset": 0,
            "productId": 3,
            "sortOrder": 1
        },
        {
            "id": 6,
            "slot": "Dinner",
            "recipeId": 7,
            "dayOffset": 1,
            "productId": 3,
            "sortOrder": 2
        },
        {
            "id": 7,
            "slot": "Dinner",
            "recipeId": 6,
            "dayOffset": 2,
            "productId": 3,
            "sortOrder": 3
        },
        {
            "id": 8,
            "slot": "Breakfast",
            "recipeId": 9,
            "dayOffset": 0,
            "productId": 4,
            "sortOrder": 1
        },
        {
            "id": 9,
            "slot": "Dinner",
            "recipeId": 10,
            "dayOffset": 0,
            "productId": 4,
            "sortOrder": 2
        },
        {
            "id": 10,
            "slot": "Snack",
            "recipeId": 11,
            "dayOffset": 2,
            "productId": 4,
            "sortOrder": 3
        },
        {
            "id": 11,
            "slot": "Breakfast",
            "recipeId": 9,
            "dayOffset": 3,
            "productId": 4,
            "sortOrder": 4
        },
        {
            "id": 12,
            "slot": "Breakfast",
            "recipeId": 8,
            "dayOffset": 5,
            "productId": 4,
            "sortOrder": 5
        },
        {
            "id": 13,
            "slot": "Snack",
            "recipeId": 12,
            "dayOffset": 6,
            "productId": 4,
            "sortOrder": 6
        }
    ],
    "creatorProfiles": [
        {
            "bio": "Roman trattoria classics, filmed in a tiny Chicago kitchen. Weeknight pasta is a right, not a privilege.",
            "handle": "maria-cooks",
            "userId": 3,
            "avatarUrl": "images/creators/maria-cooks.svg",
            "isVerified": true
        },
        {
            "bio": "Japanese home cooking with a weeknight clock. Most dinners under 30 minutes, everything shoppable.",
            "handle": "kenji-kitchen",
            "userId": 4,
            "avatarUrl": "images/creators/kenji-kitchen.svg",
            "isVerified": true
        },
        {
            "bio": "Dad of three. I cook on Sunday so we eat all week. No fancy gear.",
            "handle": "dan-meal-preps",
            "userId": 5,
            "avatarUrl": "images/creators/dan-meal-preps.svg",
            "isVerified": false
        }
    ],
    "mealPlanEntries": [
        {
            "id": 1,
            "slot": "Dinner",
            "recipeId": 5,
            "mealPlanId": 1,
            "plannedDate": "2026-09-21",
            "servingsOverride": 4
        },
        {
            "id": 2,
            "slot": "Dinner",
            "recipeId": 10,
            "mealPlanId": 1,
            "plannedDate": "2026-09-22",
            "servingsOverride": null
        },
        {
            "id": 3,
            "slot": "Dinner",
            "recipeId": 1,
            "mealPlanId": 1,
            "plannedDate": "2026-09-23",
            "servingsOverride": null
        },
        {
            "id": 4,
            "slot": "Breakfast",
            "recipeId": 9,
            "mealPlanId": 1,
            "plannedDate": "2026-09-21",
            "servingsOverride": null
        }
    ],
    "orderItemRecipes": [
        {
            "id": 1,
            "slot": null,
            "recipeId": 1,
            "dayOffset": null,
            "sortOrder": 1,
            "orderItemId": 1
        },
        {
            "id": 2,
            "slot": null,
            "recipeId": 2,
            "dayOffset": null,
            "sortOrder": 2,
            "orderItemId": 1
        },
        {
            "id": 3,
            "slot": null,
            "recipeId": 3,
            "dayOffset": null,
            "sortOrder": 3,
            "orderItemId": 1
        },
        {
            "id": 4,
            "slot": null,
            "recipeId": 4,
            "dayOffset": null,
            "sortOrder": 4,
            "orderItemId": 1
        },
        {
            "id": 5,
            "slot": "Dinner",
            "recipeId": 5,
            "dayOffset": 0,
            "sortOrder": 1,
            "orderItemId": 2
        },
        {
            "id": 6,
            "slot": "Dinner",
            "recipeId": 7,
            "dayOffset": 1,
            "sortOrder": 2,
            "orderItemId": 2
        },
        {
            "id": 7,
            "slot": "Dinner",
            "recipeId": 6,
            "dayOffset": 2,
            "sortOrder": 3,
            "orderItemId": 2
        },
        {
            "id": 8,
            "slot": "Breakfast",
            "recipeId": 9,
            "dayOffset": 0,
            "sortOrder": 1,
            "orderItemId": 3
        },
        {
            "id": 9,
            "slot": "Dinner",
            "recipeId": 10,
            "dayOffset": 0,
            "sortOrder": 2,
            "orderItemId": 3
        },
        {
            "id": 10,
            "slot": "Snack",
            "recipeId": 11,
            "dayOffset": 2,
            "sortOrder": 3,
            "orderItemId": 3
        },
        {
            "id": 11,
            "slot": "Breakfast",
            "recipeId": 9,
            "dayOffset": 3,
            "sortOrder": 4,
            "orderItemId": 3
        },
        {
            "id": 12,
            "slot": "Breakfast",
            "recipeId": 8,
            "dayOffset": 5,
            "sortOrder": 5,
            "orderItemId": 3
        },
        {
            "id": 13,
            "slot": "Snack",
            "recipeId": 12,
            "dayOffset": 6,
            "sortOrder": 6,
            "orderItemId": 3
        },
        {
            "id": 14,
            "slot": null,
            "recipeId": 3,
            "dayOffset": null,
            "sortOrder": 1,
            "orderItemId": 4
        },
        {
            "id": 15,
            "slot": "Breakfast",
            "recipeId": 9,
            "dayOffset": 0,
            "sortOrder": 1,
            "orderItemId": 5
        },
        {
            "id": 16,
            "slot": "Dinner",
            "recipeId": 10,
            "dayOffset": 0,
            "sortOrder": 2,
            "orderItemId": 5
        },
        {
            "id": 17,
            "slot": "Snack",
            "recipeId": 11,
            "dayOffset": 2,
            "sortOrder": 3,
            "orderItemId": 5
        },
        {
            "id": 18,
            "slot": "Breakfast",
            "recipeId": 9,
            "dayOffset": 3,
            "sortOrder": 4,
            "orderItemId": 5
        },
        {
            "id": 19,
            "slot": "Breakfast",
            "recipeId": 8,
            "dayOffset": 5,
            "sortOrder": 5,
            "orderItemId": 5
        },
        {
            "id": 20,
            "slot": "Snack",
            "recipeId": 12,
            "dayOffset": 6,
            "sortOrder": 6,
            "orderItemId": 5
        },
        {
            "id": 21,
            "slot": "Dinner",
            "recipeId": 5,
            "dayOffset": 0,
            "sortOrder": 1,
            "orderItemId": 6
        },
        {
            "id": 22,
            "slot": "Dinner",
            "recipeId": 7,
            "dayOffset": 1,
            "sortOrder": 2,
            "orderItemId": 6
        },
        {
            "id": 23,
            "slot": "Dinner",
            "recipeId": 6,
            "dayOffset": 2,
            "sortOrder": 3,
            "orderItemId": 6
        },
        {
            "id": 24,
            "slot": "Dinner",
            "recipeId": 5,
            "dayOffset": 0,
            "sortOrder": 1,
            "orderItemId": 7
        },
        {
            "id": 25,
            "slot": "Dinner",
            "recipeId": 7,
            "dayOffset": 1,
            "sortOrder": 2,
            "orderItemId": 7
        },
        {
            "id": 26,
            "slot": "Dinner",
            "recipeId": 6,
            "dayOffset": 2,
            "sortOrder": 3,
            "orderItemId": 7
        }
    ],
    "recipeIngredients": [
        {
            "id": 1,
            "unitId": 7,
            "quantity": 400.000,
            "recipeId": 1,
            "sortOrder": 1,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 17
        },
        {
            "id": 2,
            "unitId": 7,
            "quantity": 150.000,
            "recipeId": 1,
            "sortOrder": 2,
            "isOptional": false,
            "displayText": null,
            "preparation": "diced",
            "ingredientId": 18
        },
        {
            "id": 3,
            "unitId": 11,
            "quantity": 3.000,
            "recipeId": 1,
            "sortOrder": 3,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 5
        },
        {
            "id": 4,
            "unitId": 3,
            "quantity": 1.000,
            "recipeId": 1,
            "sortOrder": 4,
            "isOptional": false,
            "displayText": "Parmigiano-Reggiano",
            "preparation": "finely grated",
            "ingredientId": 7
        },
        {
            "id": 5,
            "unitId": 1,
            "quantity": 1.000,
            "recipeId": 1,
            "sortOrder": 5,
            "isOptional": false,
            "displayText": "freshly cracked black pepper",
            "preparation": null,
            "ingredientId": 12
        },
        {
            "id": 6,
            "unitId": 2,
            "quantity": 1.000,
            "recipeId": 1,
            "sortOrder": 6,
            "isOptional": false,
            "displayText": null,
            "preparation": "for the pasta water",
            "ingredientId": 11
        },
        {
            "id": 7,
            "unitId": 13,
            "quantity": 1.000,
            "recipeId": 2,
            "sortOrder": 1,
            "isOptional": false,
            "displayText": "28 oz crushed tomatoes",
            "preparation": null,
            "ingredientId": 15
        },
        {
            "id": 8,
            "unitId": 11,
            "quantity": 1.000,
            "recipeId": 2,
            "sortOrder": 2,
            "isOptional": false,
            "displayText": null,
            "preparation": "finely diced",
            "ingredientId": 14
        },
        {
            "id": 9,
            "unitId": 12,
            "quantity": 4.000,
            "recipeId": 2,
            "sortOrder": 3,
            "isOptional": false,
            "displayText": null,
            "preparation": "minced",
            "ingredientId": 13
        },
        {
            "id": 10,
            "unitId": 2,
            "quantity": 3.000,
            "recipeId": 2,
            "sortOrder": 4,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 10
        },
        {
            "id": 11,
            "unitId": 14,
            "quantity": 1.000,
            "recipeId": 2,
            "sortOrder": 5,
            "isOptional": false,
            "displayText": null,
            "preparation": "torn",
            "ingredientId": 16
        },
        {
            "id": 12,
            "unitId": 1,
            "quantity": 1.000,
            "recipeId": 2,
            "sortOrder": 6,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 11
        },
        {
            "id": 13,
            "unitId": 1,
            "quantity": 1.000,
            "recipeId": 2,
            "sortOrder": 7,
            "isOptional": false,
            "displayText": null,
            "preparation": "optional, to balance",
            "ingredientId": 2
        },
        {
            "id": 14,
            "unitId": 7,
            "quantity": 500.000,
            "recipeId": 3,
            "sortOrder": 1,
            "isOptional": false,
            "displayText": "all-purpose flour",
            "preparation": null,
            "ingredientId": 1
        },
        {
            "id": 15,
            "unitId": 1,
            "quantity": 2.000,
            "recipeId": 3,
            "sortOrder": 2,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 11
        },
        {
            "id": 16,
            "unitId": 5,
            "quantity": 60.000,
            "recipeId": 3,
            "sortOrder": 3,
            "isOptional": false,
            "displayText": "plus more for the pan",
            "preparation": null,
            "ingredientId": 10
        },
        {
            "id": 17,
            "unitId": 1,
            "quantity": 1.000,
            "recipeId": 3,
            "sortOrder": 4,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 2
        },
        {
            "id": 18,
            "unitId": 7,
            "quantity": 600.000,
            "recipeId": 4,
            "sortOrder": 1,
            "isOptional": false,
            "displayText": null,
            "preparation": "butterflied and pounded thin",
            "ingredientId": 20
        },
        {
            "id": 19,
            "unitId": 3,
            "quantity": 1.000,
            "recipeId": 4,
            "sortOrder": 2,
            "isOptional": false,
            "displayText": "all-purpose flour",
            "preparation": "for dredging",
            "ingredientId": 1
        },
        {
            "id": 20,
            "unitId": 11,
            "quantity": 2.000,
            "recipeId": 4,
            "sortOrder": 3,
            "isOptional": false,
            "displayText": null,
            "preparation": "beaten",
            "ingredientId": 5
        },
        {
            "id": 21,
            "unitId": 3,
            "quantity": 0.500,
            "recipeId": 4,
            "sortOrder": 4,
            "isOptional": false,
            "displayText": null,
            "preparation": "grated",
            "ingredientId": 7
        },
        {
            "id": 22,
            "unitId": 7,
            "quantity": 200.000,
            "recipeId": 4,
            "sortOrder": 5,
            "isOptional": false,
            "displayText": null,
            "preparation": "sliced",
            "ingredientId": 8
        },
        {
            "id": 23,
            "unitId": 3,
            "quantity": 0.500,
            "recipeId": 4,
            "sortOrder": 6,
            "isOptional": false,
            "displayText": null,
            "preparation": "for frying",
            "ingredientId": 30
        },
        {
            "id": 24,
            "unitId": 1,
            "quantity": 1.000,
            "recipeId": 4,
            "sortOrder": 7,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 11
        },
        {
            "id": 25,
            "unitId": 7,
            "quantity": 500.000,
            "recipeId": 5,
            "sortOrder": 1,
            "isOptional": false,
            "displayText": "boneless skin-on chicken thighs",
            "preparation": null,
            "ingredientId": 19
        },
        {
            "id": 26,
            "unitId": 2,
            "quantity": 3.000,
            "recipeId": 5,
            "sortOrder": 2,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 22
        },
        {
            "id": 27,
            "unitId": 2,
            "quantity": 3.000,
            "recipeId": 5,
            "sortOrder": 3,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 23
        },
        {
            "id": 28,
            "unitId": 2,
            "quantity": 2.000,
            "recipeId": 5,
            "sortOrder": 4,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 24
        },
        {
            "id": 29,
            "unitId": 2,
            "quantity": 1.000,
            "recipeId": 5,
            "sortOrder": 5,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 2
        },
        {
            "id": 30,
            "unitId": 2,
            "quantity": 1.000,
            "recipeId": 5,
            "sortOrder": 6,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 30
        },
        {
            "id": 31,
            "unitId": 14,
            "quantity": 1.000,
            "recipeId": 5,
            "sortOrder": 7,
            "isOptional": false,
            "displayText": null,
            "preparation": "sliced, to garnish",
            "ingredientId": 26
        },
        {
            "id": 32,
            "unitId": 3,
            "quantity": 2.000,
            "recipeId": 6,
            "sortOrder": 1,
            "isOptional": false,
            "displayText": "short-grain (sushi) rice",
            "preparation": "rinsed",
            "ingredientId": 27
        },
        {
            "id": 33,
            "unitId": 1,
            "quantity": 1.000,
            "recipeId": 6,
            "sortOrder": 2,
            "isOptional": false,
            "displayText": null,
            "preparation": "for the hands",
            "ingredientId": 11
        },
        {
            "id": 34,
            "unitId": 1,
            "quantity": 1.000,
            "recipeId": 6,
            "sortOrder": 3,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 29
        },
        {
            "id": 35,
            "unitId": 7,
            "quantity": 300.000,
            "recipeId": 7,
            "sortOrder": 1,
            "isOptional": false,
            "displayText": null,
            "preparation": "sliced thin",
            "ingredientId": 20
        },
        {
            "id": 36,
            "unitId": 11,
            "quantity": 1.000,
            "recipeId": 7,
            "sortOrder": 2,
            "isOptional": false,
            "displayText": "head of broccoli",
            "preparation": "cut into florets",
            "ingredientId": 49
        },
        {
            "id": 37,
            "unitId": 11,
            "quantity": 1.000,
            "recipeId": 7,
            "sortOrder": 3,
            "isOptional": false,
            "displayText": null,
            "preparation": "sliced",
            "ingredientId": 48
        },
        {
            "id": 38,
            "unitId": 12,
            "quantity": 3.000,
            "recipeId": 7,
            "sortOrder": 4,
            "isOptional": false,
            "displayText": null,
            "preparation": "minced",
            "ingredientId": 13
        },
        {
            "id": 39,
            "unitId": 7,
            "quantity": 15.000,
            "recipeId": 7,
            "sortOrder": 5,
            "isOptional": false,
            "displayText": null,
            "preparation": "grated",
            "ingredientId": 25
        },
        {
            "id": 40,
            "unitId": 2,
            "quantity": 2.000,
            "recipeId": 7,
            "sortOrder": 6,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 22
        },
        {
            "id": 41,
            "unitId": 2,
            "quantity": 1.000,
            "recipeId": 7,
            "sortOrder": 7,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 50
        },
        {
            "id": 42,
            "unitId": 1,
            "quantity": 1.000,
            "recipeId": 7,
            "sortOrder": 8,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 29
        },
        {
            "id": 43,
            "unitId": 2,
            "quantity": 2.000,
            "recipeId": 7,
            "sortOrder": 9,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 30
        },
        {
            "id": 44,
            "unitId": 2,
            "quantity": 1.000,
            "recipeId": 7,
            "sortOrder": 10,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 28
        },
        {
            "id": 45,
            "unitId": 3,
            "quantity": 2.000,
            "recipeId": 8,
            "sortOrder": 1,
            "isOptional": false,
            "displayText": "all-purpose flour",
            "preparation": null,
            "ingredientId": 1
        },
        {
            "id": 46,
            "unitId": 2,
            "quantity": 2.000,
            "recipeId": 8,
            "sortOrder": 2,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 2
        },
        {
            "id": 47,
            "unitId": 1,
            "quantity": 2.000,
            "recipeId": 8,
            "sortOrder": 3,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 39
        },
        {
            "id": 48,
            "unitId": 1,
            "quantity": 0.500,
            "recipeId": 8,
            "sortOrder": 4,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 11
        },
        {
            "id": 49,
            "unitId": 3,
            "quantity": 1.500,
            "recipeId": 8,
            "sortOrder": 5,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 6
        },
        {
            "id": 50,
            "unitId": 11,
            "quantity": 2.000,
            "recipeId": 8,
            "sortOrder": 6,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 5
        },
        {
            "id": 51,
            "unitId": 2,
            "quantity": 3.000,
            "recipeId": 8,
            "sortOrder": 7,
            "isOptional": false,
            "displayText": null,
            "preparation": "melted",
            "ingredientId": 4
        },
        {
            "id": 52,
            "unitId": 1,
            "quantity": 1.000,
            "recipeId": 8,
            "sortOrder": 8,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 40
        },
        {
            "id": 53,
            "unitId": 3,
            "quantity": 2.500,
            "recipeId": 9,
            "sortOrder": 1,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 42
        },
        {
            "id": 54,
            "unitId": 3,
            "quantity": 2.500,
            "recipeId": 9,
            "sortOrder": 2,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 6
        },
        {
            "id": 55,
            "unitId": 3,
            "quantity": 1.000,
            "recipeId": 9,
            "sortOrder": 3,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 45
        },
        {
            "id": 56,
            "unitId": 2,
            "quantity": 3.000,
            "recipeId": 9,
            "sortOrder": 4,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 44
        },
        {
            "id": 57,
            "unitId": 11,
            "quantity": 2.000,
            "recipeId": 9,
            "sortOrder": 5,
            "isOptional": false,
            "displayText": null,
            "preparation": "mashed",
            "ingredientId": 43
        },
        {
            "id": 58,
            "unitId": 7,
            "quantity": 150.000,
            "recipeId": 9,
            "sortOrder": 6,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 46
        },
        {
            "id": 59,
            "unitId": 1,
            "quantity": 1.000,
            "recipeId": 9,
            "sortOrder": 7,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 40
        },
        {
            "id": 60,
            "unitId": 7,
            "quantity": 500.000,
            "recipeId": 10,
            "sortOrder": 1,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 21
        },
        {
            "id": 61,
            "unitId": 11,
            "quantity": 1.000,
            "recipeId": 10,
            "sortOrder": 2,
            "isOptional": false,
            "displayText": null,
            "preparation": "diced",
            "ingredientId": 14
        },
        {
            "id": 62,
            "unitId": 12,
            "quantity": 2.000,
            "recipeId": 10,
            "sortOrder": 3,
            "isOptional": false,
            "displayText": null,
            "preparation": "minced",
            "ingredientId": 13
        },
        {
            "id": 63,
            "unitId": 1,
            "quantity": 2.000,
            "recipeId": 10,
            "sortOrder": 4,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 37
        },
        {
            "id": 64,
            "unitId": 2,
            "quantity": 1.000,
            "recipeId": 10,
            "sortOrder": 5,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 38
        },
        {
            "id": 65,
            "unitId": 1,
            "quantity": 1.000,
            "recipeId": 10,
            "sortOrder": 6,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 11
        },
        {
            "id": 66,
            "unitId": 11,
            "quantity": 8.000,
            "recipeId": 10,
            "sortOrder": 7,
            "isOptional": false,
            "displayText": null,
            "preparation": "warmed",
            "ingredientId": 33
        },
        {
            "id": 67,
            "unitId": 11,
            "quantity": 2.000,
            "recipeId": 10,
            "sortOrder": 8,
            "isOptional": false,
            "displayText": null,
            "preparation": "cut in wedges",
            "ingredientId": 31
        },
        {
            "id": 68,
            "unitId": 14,
            "quantity": 1.000,
            "recipeId": 10,
            "sortOrder": 9,
            "isOptional": false,
            "displayText": null,
            "preparation": "chopped",
            "ingredientId": 32
        },
        {
            "id": 69,
            "unitId": 13,
            "quantity": 1.000,
            "recipeId": 11,
            "sortOrder": 1,
            "isOptional": false,
            "displayText": "15 oz can chickpeas",
            "preparation": "drained, skins removed",
            "ingredientId": 34
        },
        {
            "id": 70,
            "unitId": 3,
            "quantity": 0.250,
            "recipeId": 11,
            "sortOrder": 2,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 35
        },
        {
            "id": 71,
            "unitId": 11,
            "quantity": 1.000,
            "recipeId": 11,
            "sortOrder": 3,
            "isOptional": false,
            "displayText": null,
            "preparation": "juiced",
            "ingredientId": 36
        },
        {
            "id": 72,
            "unitId": 12,
            "quantity": 1.000,
            "recipeId": 11,
            "sortOrder": 4,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 13
        },
        {
            "id": 73,
            "unitId": 2,
            "quantity": 2.000,
            "recipeId": 11,
            "sortOrder": 5,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 10
        },
        {
            "id": 74,
            "unitId": 1,
            "quantity": 0.500,
            "recipeId": 11,
            "sortOrder": 6,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 37
        },
        {
            "id": 75,
            "unitId": 1,
            "quantity": 0.500,
            "recipeId": 11,
            "sortOrder": 7,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 11
        },
        {
            "id": 76,
            "unitId": 3,
            "quantity": 1.000,
            "recipeId": 12,
            "sortOrder": 1,
            "isOptional": false,
            "displayText": null,
            "preparation": "browned and cooled",
            "ingredientId": 4
        },
        {
            "id": 77,
            "unitId": 3,
            "quantity": 1.000,
            "recipeId": 12,
            "sortOrder": 2,
            "isOptional": false,
            "displayText": null,
            "preparation": "packed",
            "ingredientId": 3
        },
        {
            "id": 78,
            "unitId": 3,
            "quantity": 0.500,
            "recipeId": 12,
            "sortOrder": 3,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 2
        },
        {
            "id": 79,
            "unitId": 11,
            "quantity": 2.000,
            "recipeId": 12,
            "sortOrder": 4,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 5
        },
        {
            "id": 80,
            "unitId": 1,
            "quantity": 2.000,
            "recipeId": 12,
            "sortOrder": 5,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 40
        },
        {
            "id": 81,
            "unitId": 3,
            "quantity": 2.250,
            "recipeId": 12,
            "sortOrder": 6,
            "isOptional": false,
            "displayText": "all-purpose flour",
            "preparation": null,
            "ingredientId": 1
        },
        {
            "id": 82,
            "unitId": 1,
            "quantity": 1.000,
            "recipeId": 12,
            "sortOrder": 7,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 39
        },
        {
            "id": 83,
            "unitId": 1,
            "quantity": 1.000,
            "recipeId": 12,
            "sortOrder": 8,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 11
        },
        {
            "id": 84,
            "unitId": 7,
            "quantity": 340.000,
            "recipeId": 12,
            "sortOrder": 9,
            "isOptional": false,
            "displayText": null,
            "preparation": null,
            "ingredientId": 41
        },
        {
            "id": 85,
            "unitId": 7,
            "quantity": 150.000,
            "recipeId": 6,
            "sortOrder": 4,
            "isOptional": false,
            "displayText": null,
            "preparation": "cooked and flaked",
            "ingredientId": 51
        },
        {
            "id": 86,
            "unitId": 11,
            "quantity": 4.000,
            "recipeId": 6,
            "sortOrder": 5,
            "isOptional": false,
            "displayText": null,
            "preparation": "pitted",
            "ingredientId": 52
        },
        {
            "id": 87,
            "unitId": 13,
            "quantity": 1.000,
            "recipeId": 6,
            "sortOrder": 6,
            "isOptional": false,
            "displayText": "5 oz can tuna",
            "preparation": "drained",
            "ingredientId": 53
        },
        {
            "id": 88,
            "unitId": 2,
            "quantity": 2.000,
            "recipeId": 6,
            "sortOrder": 7,
            "isOptional": false,
            "displayText": "Japanese mayonnaise",
            "preparation": "mixed into the tuna",
            "ingredientId": 54
        },
        {
            "id": 89,
            "unitId": 11,
            "quantity": 4.000,
            "recipeId": 6,
            "sortOrder": 8,
            "isOptional": false,
            "displayText": "nori sheets",
            "preparation": "cut into strips",
            "ingredientId": 55
        }
    ]
};
