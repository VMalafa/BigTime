"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MoneyType, DebtEntry, SpendingPlanData } from "./flow-store";

export interface MoneyRuleEntry {
  id: string;
  ruleText: string;
  ruleType:
    | "SPENDING_THRESHOLD"
    | "REVIEW_CADENCE"
    | "PERSONAL_ALLOWANCE"
    | "PRIORITY"
    | "CREDIT_USAGE"
    | "CUSTOM";
  agreedByA: boolean;
  agreedByB: boolean;
}

export interface RichLifeVisionEntry {
  year1: string;
  year5: string;
  year10: string;
  values: string[];
}

export interface JointSpendingPlanData {
  totalHouseholdIncome: number;
  partnerAPersonalAmount: number;
  partnerBPersonalAmount: number;
  jointFixedCostsPercent: number;
  jointSavingsPercent: number;
  jointInvestmentsPercent: number;
  jointGuiltFreePercent: number;
}

interface PartnerState {
  partnershipId: string | null;
  partnerId: string | null;
  partnerMoneyType: MoneyType | null;
  onboardingStep: number;
  sharedDebts: string[]; // debt IDs flagged as shared
  partnerAVision: RichLifeVisionEntry | null;
  partnerBVision: RichLifeVisionEntry | null;
  sharedVision: string | null;
  moneyRules: MoneyRuleEntry[];
  jointPlan: JointSpendingPlanData | null;

  // Actions
  setPartnership: (id: string, partnerId: string) => void;
  setPartnerMoneyType: (type: MoneyType) => void;
  setOnboardingStep: (step: number) => void;
  toggleSharedDebt: (debtId: string) => void;
  setPartnerAVision: (vision: RichLifeVisionEntry) => void;
  setPartnerBVision: (vision: RichLifeVisionEntry) => void;
  setSharedVision: (vision: string) => void;
  addMoneyRule: (rule: MoneyRuleEntry) => void;
  updateMoneyRule: (id: string, updates: Partial<MoneyRuleEntry>) => void;
  removeMoneyRule: (id: string) => void;
  setJointPlan: (plan: JointSpendingPlanData) => void;
  reset: () => void;
}

export const usePartnerStore = create<PartnerState>()(
  persist(
    (set) => ({
      partnershipId: null,
      partnerId: null,
      partnerMoneyType: null,
      onboardingStep: 0,
      sharedDebts: [],
      partnerAVision: null,
      partnerBVision: null,
      sharedVision: null,
      moneyRules: [],
      jointPlan: null,

      setPartnership: (id, partnerId) =>
        set({ partnershipId: id, partnerId }),
      setPartnerMoneyType: (type) => set({ partnerMoneyType: type }),
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      toggleSharedDebt: (debtId) =>
        set((state) => ({
          sharedDebts: state.sharedDebts.includes(debtId)
            ? state.sharedDebts.filter((id) => id !== debtId)
            : [...state.sharedDebts, debtId],
        })),
      setPartnerAVision: (vision) => set({ partnerAVision: vision }),
      setPartnerBVision: (vision) => set({ partnerBVision: vision }),
      setSharedVision: (vision) => set({ sharedVision: vision }),
      addMoneyRule: (rule) =>
        set((state) => ({
          moneyRules: [...state.moneyRules, rule],
        })),
      updateMoneyRule: (id, updates) =>
        set((state) => ({
          moneyRules: state.moneyRules.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),
      removeMoneyRule: (id) =>
        set((state) => ({
          moneyRules: state.moneyRules.filter((r) => r.id !== id),
        })),
      setJointPlan: (plan) => set({ jointPlan: plan }),
      reset: () =>
        set({
          partnershipId: null,
          partnerId: null,
          partnerMoneyType: null,
          onboardingStep: 0,
          sharedDebts: [],
          partnerAVision: null,
          partnerBVision: null,
          sharedVision: null,
          moneyRules: [],
          jointPlan: null,
        }),
    }),
    {
      name: "rich-life-partner",
    }
  )
);
