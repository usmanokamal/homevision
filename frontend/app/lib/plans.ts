export type MarketingPlan = {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  description: string;
  featured?: boolean;
};

export const marketingPlans: MarketingPlan[] = [
  {
    id: "single",
    name: "Single Render",
    credits: 1,
    priceCents: 200,
    description: "A one-off HD export for a single design decision.",
  },
  {
    id: "starter",
    name: "Starter",
    credits: 10,
    priceCents: 1800,
    description: "For testing a few rooms, finishes, and client-facing options.",
  },
  {
    id: "plus",
    name: "Plus",
    credits: 25,
    priceCents: 4000,
    description: "Better value for active projects and repeat iteration.",
  },
  {
    id: "pro",
    name: "Pro",
    credits: 50,
    priceCents: 7500,
    description: "The main pack for frequent renders and regeneration loops.",
    featured: true,
  },
  {
    id: "studio",
    name: "Studio",
    credits: 100,
    priceCents: 14000,
    description: "A larger pool for agencies, builders, and busy teams.",
  },
];

export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
