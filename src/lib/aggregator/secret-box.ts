import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

// AES-256-GCM sealing for the aggregator access secret (ADR-0002).
//
// The key lives ONLY in the AGGREGATOR_TOKEN_KEY environment variable
// (base64, 32 bytes) — never in the database or the client bundle, so a
// database leak alone yields unusable ciphertext. Format on the wire:
// `iv.authTag.ciphertext`, each segment base64.

const IV_BYTES = 12; // GCM-recommended nonce length
const KEY_BYTES = 32;

function loadKey(): Buffer {
  const raw = process.env.AGGREGATOR_TOKEN_KEY;
  if (!raw) {
    throw new Error(
      "AGGREGATOR_TOKEN_KEY is not set. Generate one with `openssl rand -base64 32` and add it to the environment."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      "AGGREGATOR_TOKEN_KEY must be 32 bytes of base64 (generate with `openssl rand -base64 32`)."
    );
  }
  return key;
}

export function sealSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext]
    .map((part) => part.toString("base64"))
    .join(".");
}

export function openSecret(sealed: string): string {
  const key = loadKey();
  const segments = sealed.split(".");
  if (segments.length !== 3) {
    throw new Error("Sealed secret is malformed.");
  }
  const [iv, authTag, ciphertext] = segments.map((s) =>
    Buffer.from(s, "base64")
  );
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  // Throws on tampering: GCM authenticates both ciphertext and tag.
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
