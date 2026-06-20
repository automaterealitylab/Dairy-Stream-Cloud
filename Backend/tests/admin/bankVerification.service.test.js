import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL ||= "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";

const {
  buildVerificationDecision,
  calculateNameMatchScore,
  extractUpiIdFromProviderPayload,
  isValidIfscFormat,
  mapCashfreeAccountVerificationResponse,
  validateBankAccountInput,
} = await import("../../services/admin/bankVerification.service.js");
const {
  buildVerificationResetFields,
  maskAccountNumber,
  normalizeAccountNumber,
} = await import("../../utils/bankAccountSecurity.js");

test("isValidIfscFormat accepts valid IFSC codes", () => {
  assert.equal(isValidIfscFormat("MAHB0002233"), true);
  assert.equal(isValidIfscFormat("hdfc0001234"), true);
});

test("isValidIfscFormat rejects invalid IFSC codes", () => {
  assert.equal(isValidIfscFormat("MAHB2233"), false);
  assert.equal(isValidIfscFormat("12340002233"), false);
  assert.equal(isValidIfscFormat("MAHB1002233"), false);
});

test("validateBankAccountInput enforces account length and IFSC", () => {
  const invalid = validateBankAccountInput({
    accountNumber: "1234",
    ifsc: "bad",
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((item) => item.includes("8 and 20")));
  assert.ok(invalid.errors.some((item) => item.includes("IFSC")));

  const valid = validateBankAccountInput({
    accountNumber: " 1234-5678-9012 ",
    ifsc: "MAHB0002233",
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.accountNumber, "123456789012");
  assert.equal(valid.ifsc, "MAHB0002233");
});

test("calculateNameMatchScore identifies exact, partial and mismatch names", () => {
  assert.equal(calculateNameMatchScore("Swapnil Patil", "Swapnil Patil"), 100);
  assert.ok(calculateNameMatchScore("Swapnil V Patil", "Swapnil Patil") >= 60);
  assert.ok(calculateNameMatchScore("Swapnil Patil", "Rahul Sharma") < 60);
});

test("mapCashfreeAccountVerificationResponse maps verified account and holder name", () => {
  const mapped = mapCashfreeAccountVerificationResponse({
    account_status: "VALID",
    ref_id: "cf_123",
    name_at_bank: "Swapnil Patil",
  });

  assert.equal(mapped.status, "VERIFIED");
  assert.equal(mapped.accountExists, true);
  assert.equal(mapped.accountActive, true);
  assert.equal(mapped.accountHolderName, "Swapnil Patil");
  assert.equal(mapped.referenceId, "cf_123");
});

test("mapCashfreeAccountVerificationResponse maps invalid account failure", () => {
  const mapped = mapCashfreeAccountVerificationResponse({
    account_status: "INVALID",
    message: "Invalid account number",
  });

  assert.equal(mapped.status, "INVALID");
  assert.equal(mapped.accountExists, false);
  assert.equal(mapped.accountActive, false);
  assert.equal(mapped.reason, "Invalid account number");
});

test("extractUpiIdFromProviderPayload detects linked VPA when provider returns it", () => {
  assert.equal(extractUpiIdFromProviderPayload({ data: { vpa: "owner@okhdfcbank" } }), "owner@okhdfcbank");
  assert.equal(extractUpiIdFromProviderPayload({ data: { vpa: "not-a-vpa" } }), null);
});

test("buildVerificationDecision handles verified, mismatch and provider-not-configured states", () => {
  const verified = buildVerificationDecision({
    providerResult: {
      configured: true,
      status: "VERIFIED",
      accountActive: true,
      accountHolderName: "Swapnil Patil",
    },
    submittedAccountHolderName: "Swapnil Patil",
    ownerName: "Swapnil Patil",
  });
  assert.equal(verified.status, "VERIFIED");
  assert.equal(verified.verified, true);
  assert.equal(verified.nameMatchStatus, "MATCH");

  const mismatch = buildVerificationDecision({
    providerResult: {
      configured: true,
      status: "VERIFIED",
      accountActive: true,
      accountHolderName: "Rahul Sharma",
    },
    submittedAccountHolderName: "Swapnil Patil",
    ownerName: "Swapnil Patil",
  });
  assert.equal(mismatch.status, "NAME_MISMATCH");
  assert.equal(mismatch.verified, false);
  assert.equal(mismatch.nameMatchStatus, "MISMATCH");

  const unavailable = buildVerificationDecision({
    providerResult: { configured: false },
    submittedAccountHolderName: "Swapnil Patil",
    ownerName: "Swapnil Patil",
  });
  assert.equal(unavailable.status, "PROVIDER_NOT_CONFIGURED");
  assert.equal(unavailable.verified, false);
});

test("maskAccountNumber exposes only last four digits", () => {
  assert.equal(maskAccountNumber("1234567893946"), "XXXXXXXXX3946");
  assert.equal(maskAccountNumber(" 1234-5678 "), "XXXX5678");
  assert.equal(normalizeAccountNumber("XXXXXX3946"), "3946");
});

test("buildVerificationResetFields marks changed bank details for re-verification", () => {
  const reset = buildVerificationResetFields({
    hasBankDetails: true,
    timestamp: "2026-05-12T00:00:00.000Z",
  });

  assert.equal(reset.bank_verified, false);
  assert.equal(reset.payments_enabled, false);
  assert.equal(reset.bank_verification_status, "PENDING_REVERIFY");
  assert.equal(reset.verification_required, true);
  assert.equal(reset.bank_verification_reset_at, "2026-05-12T00:00:00.000Z");
});
