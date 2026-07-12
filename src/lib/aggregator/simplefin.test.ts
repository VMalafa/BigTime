import assert from "node:assert/strict";
import { test } from "vitest";

import { extractMaskedNumber, inferAccountType } from "./simplefin.ts";

test("infers liability types from account names", () => {
  assert.equal(inferAccountType("Chase Sapphire Card", 1200), "CREDIT_CARD");
  assert.equal(inferAccountType("Home Mortgage", 250000), "LOAN");
  assert.equal(inferAccountType("Auto Loan", 9000), "LOAN");
});

test("infers depository and investment types", () => {
  assert.equal(inferAccountType("Everyday Checking", 400), "CHECKING");
  assert.equal(inferAccountType("High-Yield Savings", 5000), "SAVINGS");
  assert.equal(inferAccountType("Brokerage", 5000), "INVESTMENT");
  assert.equal(inferAccountType("Roth IRA", 5000), "INVESTMENT");
});

test("falls back to CREDIT_CARD for unnamed negative-balance accounts", () => {
  assert.equal(inferAccountType("Account 1", -350), "CREDIT_CARD");
  assert.equal(inferAccountType("Account 1", 350), "OTHER");
});

test("extracts only unambiguously masked numbers", () => {
  assert.equal(extractMaskedNumber("Checking ****1234"), "···1234");
  assert.equal(extractMaskedNumber("Savings xx88"), "···88");
  assert.equal(extractMaskedNumber("Visa …4321"), "···4321");
  // Plain digits are NOT treated as a mask — could be part of the name.
  assert.equal(extractMaskedNumber("Card 2024"), null);
  assert.equal(extractMaskedNumber("Everyday Checking"), null);
});
