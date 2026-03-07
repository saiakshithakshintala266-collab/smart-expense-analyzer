// File: services/categorization-service/src/domain/rules.engine.ts

export type Category =
  | "Groceries"
  | "Dining"
  | "Transport"
  | "Shopping"
  | "Entertainment"
  | "Healthcare"
  | "Utilities"
  | "Travel"
  | "Subscriptions"
  | "Other";

export type RuleMatch = {
  category: Category;
  confidence: number;
};

/**
 * Keyword-based rules engine.
 * Returns the best matching category or null if no rule matches confidently.
 *
 * Rules are ordered by specificity — more specific keywords = higher confidence.
 * If no rule matches above MIN_CONFIDENCE, returns null → triggers LLM fallback.
 */
const MIN_CONFIDENCE = 0.75;

type Rule = {
  category: Category;
  keywords: string[];
  confidence: number;
};

const RULES: Rule[] = [
  // ── Groceries ─────────────────────────────────────────────────────────────
  {
    category: "Groceries",
    confidence: 0.95,
    keywords: [
      "whole foods", "trader joe", "kroger", "safeway", "publix", "aldi",
      "wegmans", "costco", "walmart grocery", "target grocery", "sprouts",
      "fresh market", "giant", "stop & shop", "food lion", "meijer",
      "heb", "winco", "market", "grocery", "supermarket", "food store"
    ]
  },

  // ── Dining ────────────────────────────────────────────────────────────────
  {
    category: "Dining",
    confidence: 0.92,
    keywords: [
      "mcdonald", "starbucks", "subway", "chipotle", "domino", "pizza hut",
      "taco bell", "burger king", "wendy", "chick-fil-a", "dunkin",
      "panera", "olive garden", "applebee", "chili", "ihop", "denny",
      "doordash", "ubereats", "grubhub", "postmates", "instacart food",
      "restaurant", "cafe", "coffee", "diner", "bistro", "sushi", "grill",
      "kitchen", "eatery", "bakery", "bar & grill", "steakhouse", "pizzeria"
    ]
  },

  // ── Transport ─────────────────────────────────────────────────────────────
  {
    category: "Transport",
    confidence: 0.93,
    keywords: [
      "uber", "lyft", "taxi", "metro", "subway transit", "bus pass",
      "shell", "exxon", "bp", "chevron", "sunoco", "valero", "mobil",
      "gas station", "fuel", "parking", "toll", "zipcar", "enterprise rent",
      "hertz", "avis", "budget car", "transit", "train", "amtrak"
    ]
  },

  // ── Travel ────────────────────────────────────────────────────────────────
  {
    category: "Travel",
    confidence: 0.92,
    keywords: [
      "airbnb", "booking.com", "expedia", "hotels.com", "marriott",
      "hilton", "hyatt", "ihg", "wyndham", "delta", "united airlines",
      "american airlines", "southwest", "jetblue", "spirit airlines",
      "alaska airlines", "kayak", "priceline", "trivago", "hotel",
      "resort", "motel", "inn", "airport", "airline", "flight"
    ]
  },

  // ── Subscriptions ─────────────────────────────────────────────────────────
  {
    category: "Subscriptions",
    confidence: 0.95,
    keywords: [
      "netflix", "spotify", "hulu", "disney+", "apple music", "apple tv",
      "amazon prime", "youtube premium", "hbo max", "paramount+",
      "peacock", "adobe", "microsoft 365", "google one", "dropbox",
      "icloud", "notion", "slack", "zoom", "github", "subscription",
      "monthly plan", "annual plan", "auto-renew", "membership"
    ]
  },

  // ── Entertainment ─────────────────────────────────────────────────────────
  {
    category: "Entertainment",
    confidence: 0.90,
    keywords: [
      "amc theatre", "regal cinema", "cinemark", "ticketmaster", "stubhub",
      "eventbrite", "steam", "playstation", "xbox", "nintendo", "apple arcade",
      "google play games", "bowling", "mini golf", "escape room",
      "movie", "cinema", "theatre", "concert", "museum", "zoo", "aquarium",
      "amusement park", "arcade", "gaming"
    ]
  },

  // ── Healthcare ────────────────────────────────────────────────────────────
  {
    category: "Healthcare",
    confidence: 0.93,
    keywords: [
      "cvs pharmacy", "walgreens", "rite aid", "walmart pharmacy",
      "cigna", "aetna", "bcbs", "united health", "kaiser",
      "doctor", "dentist", "optometrist", "clinic", "hospital",
      "urgent care", "pharmacy", "prescription", "medical", "health",
      "vision center", "dental", "therapy", "lab corp", "quest diagnostics"
    ]
  },

  // ── Utilities ─────────────────────────────────────────────────────────────
  {
    category: "Utilities",
    confidence: 0.94,
    keywords: [
      "at&t", "verizon", "t-mobile", "comcast", "xfinity", "spectrum",
      "cox communications", "dish network", "directv", "electric",
      "water bill", "gas bill", "internet", "phone bill", "utility",
      "pg&e", "con edison", "duke energy", "national grid",
      "waste management", "trash", "sewage"
    ]
  },

  // ── Shopping ──────────────────────────────────────────────────────────────
  {
    category: "Shopping",
    confidence: 0.88,
    keywords: [
      "amazon", "ebay", "etsy", "walmart", "target", "best buy",
      "home depot", "lowe", "ikea", "macy", "nordstrom", "gap",
      "h&m", "zara", "old navy", "tj maxx", "marshalls", "ross",
      "dollar tree", "dollar general", "five below", "bath & body",
      "sephora", "ulta", "apple store", "shop", "store", "retail"
    ]
  }
];

/**
 * Attempts to match a merchant name against keyword rules.
 * Returns the best match above MIN_CONFIDENCE, or null.
 */
export function applyRules(merchant: string): RuleMatch | null {
  const normalized = merchant.toLowerCase().trim();

  let bestMatch: RuleMatch | null = null;

  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        if (!bestMatch || rule.confidence > bestMatch.confidence) {
          bestMatch = { category: rule.category, confidence: rule.confidence };
        }
        break; // Found a match for this rule, move to next rule
      }
    }
  }

  if (bestMatch && bestMatch.confidence >= MIN_CONFIDENCE) {
    return bestMatch;
  }

  return null;
}

export const ALL_CATEGORIES: Category[] = [
  "Groceries", "Dining", "Transport", "Shopping",
  "Entertainment", "Healthcare", "Utilities", "Travel",
  "Subscriptions", "Other"
];