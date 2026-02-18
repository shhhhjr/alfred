import crypto from "crypto";

const IV_LENGTH = 16;

function getKey(): Buffer {
  let keyHex = process.env.ENCRYPTION_KEY ?? "";
  keyHex = keyHex.trim().replace(/^["']|["']$/g, "");

  if (!keyHex) {
    throw new Error("ENCRYPTION_KEY is not set.");
  }

  if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) {
    throw new Error("ENCRYPTION_KEY must be exactly 64 hex characters (run: openssl rand -hex 32).");
  }

  return Buffer.from(keyHex, "hex");
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);

  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(payload: string): string {
  const [ivHex, encryptedHex] = payload.split(":");

  if (!ivHex || !encryptedHex) {
    throw new Error("Invalid encrypted payload format.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    getKey(),
    Buffer.from(ivHex, "hex"),
  );
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
