import type { MoneyType } from "@/lib/store/flow-store";

export interface PartnerProfile {
  id: string;
  name: string;
  moneyType: MoneyType;
}

export interface CompatibilityInsight {
  summary: string;
  strengths: string[];
  watchOuts: string[];
  tips: string[];
}

export interface VisionOverlap {
  shared: string[];
  partnerAUnique: string[];
  partnerBUnique: string[];
}

export interface CouplesOnboardingStep {
  id: number;
  path: string;
  label: string;
  description: string;
  requiresBothPartners: boolean;
}

export const COUPLES_STEPS: CouplesOnboardingStep[] = [
  { id: 0, path: "/partner/onboarding/types", label: "Money Types", description: "Share and compare your money personalities", requiresBothPartners: true },
  { id: 1, path: "/partner/onboarding/vision", label: "Rich Life Vision", description: "Design your shared vision for the future", requiresBothPartners: true },
  { id: 2, path: "/partner/onboarding/rules", label: "Money Rules", description: "Negotiate your shared financial agreements", requiresBothPartners: true },
  { id: 3, path: "/partner/onboarding/shared-debts", label: "Shared Debts", description: "Map which debts you share", requiresBothPartners: false },
  { id: 4, path: "/partner/onboarding/joint-plan", label: "Joint Plan", description: "Build your household spending plan", requiresBothPartners: true },
  { id: 5, path: "/partner/onboarding/summary", label: "Summary", description: "Your complete household financial plan", requiresBothPartners: true },
];
