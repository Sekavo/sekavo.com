export type PlanId = "free" | "starter" | "pro" | "agency";

export interface PlanDef {
  id: PlanId;
  name: string;
  priceMonthly: number;
  tagline: string;
  maxActiveInvoices: number;
  customTemplates: boolean;
  removeBranding: boolean;
  csvImport: boolean;
  apiAccess: boolean;
  replyDetection: boolean;
  stripePriceEnvVar?: string;
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    tagline: "Try it on your worst payer",
    maxActiveInvoices: 3,
    customTemplates: false,
    removeBranding: false,
    csvImport: false,
    apiAccess: false,
    replyDetection: true,
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthly: 19,
    tagline: "For freelancers who hate asking twice",
    maxActiveInvoices: 25,
    customTemplates: true,
    removeBranding: false,
    csvImport: true,
    apiAccess: false,
    replyDetection: true,
    stripePriceEnvVar: "STRIPE_PRICE_STARTER",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 49,
    tagline: "For consultants & micro-agencies",
    maxActiveInvoices: 100,
    customTemplates: true,
    removeBranding: true,
    csvImport: true,
    apiAccess: true,
    replyDetection: true,
    stripePriceEnvVar: "STRIPE_PRICE_PRO",
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceMonthly: 149,
    tagline: "Bookkeepers & firms managing client AR",
    maxActiveInvoices: 500,
    customTemplates: true,
    removeBranding: true,
    csvImport: true,
    apiAccess: true,
    replyDetection: true,
    stripePriceEnvVar: "STRIPE_PRICE_AGENCY",
  },
};

export const TRIAL_DAYS = 14;

/** The plan a user is allowed to use right now (trials map to pro). */
export function effectivePlan(plan: PlanId, status: string, trialEndsAt: Date | null): PlanDef {
  if (status === "trialing" && trialEndsAt && trialEndsAt > new Date()) return PLANS.pro;
  if (status === "past_due") return PLANS.free;
  return PLANS[plan] ?? PLANS.free;
}
