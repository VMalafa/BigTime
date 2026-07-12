import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test, { beforeEach } from "node:test";

// Extension required: these tests run directly under `node --test` (see the
// `test` script), which strips types but does not resolve extensionless paths.
import { openSecret, sealSecret } from "./secret-box.ts";

beforeEach(() => {
  process.env.AGGREGATOR_TOKEN_KEY = randomBytes(32).toString("base64");
});

test("roundtrips a secret", () => {
  const secret = "https://user:pass@bridge.simplefin.org/simplefin";
  const sealed = sealSecret(secret);
  assert.notEqual(sealed, secret);
  assert.equal(openSecret(sealed), secret);
});

test("produces a fresh IV per encryption", () => {
  const secret = "same input";
  assert.notEqual(sealSecret(secret), sealSecret(secret));
});

test("rejects tampered ciphertext", () => {
  const sealed = sealSecret("original secret");
  const [iv, tag, ciphertext] = sealed.split(".");
  const bytes = Buffer.from(ciphertext, "base64");
  bytes[0] ^= 0xff;
  const tampered = [iv, tag, bytes.toString("base64")].join(".");
  assert.throws(() => openSecret(tampered));
});

test("rejects a tampered auth tag", () => {
  const sealed = sealSecret("original secret");
  const [iv, tag, ciphertext] = sealed.split(".");
  const tagBytes = Buffer.from(tag, "base64");
  tagBytes[0] ^= 0xff;
  const tampered = [iv, tagBytes.toString("base64"), ciphertext].join(".");
  assert.throws(() => openSecret(tampered));
});

test("rejects ciphertext sealed under a different key", () => {
  const sealed = sealSecret("original secret");
  process.env.AGGREGATOR_TOKEN_KEY = randomBytes(32).toString("base64");
  assert.throws(() => openSecret(sealed));
});

test("rejects malformed input", () => {
  assert.throws(() => openSecret("not-a-sealed-secret"));
});

test("requires a configured 32-byte key", () => {
  delete process.env.AGGREGATOR_TOKEN_KEY;
  assert.throws(() => sealSecret("x"), /AGGREGATOR_TOKEN_KEY is not set/);
  process.env.AGGREGATOR_TOKEN_KEY = "dG9vLXNob3J0";
  assert.throws(() => sealSecret("x"), /32 bytes/);
});
