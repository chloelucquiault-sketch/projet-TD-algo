import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface ParticipantPrivateData {
  dietaryRestrictions: string;
  medicalInstructions: string;
  specialRequests: string;
}

function demoMode() {
  return process.env.DEMO_MODE === "true";
}

function encryptionKey() {
  const value = process.env.HEALTH_DATA_ENCRYPTION_KEY;
  if (!value || !/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error("HEALTH_DATA_ENCRYPTION_KEY doit contenir 64 caractères hexadécimaux.");
  }
  return Buffer.from(value, "hex");
}

export function assertHealthDataEncryptionKey() {
  if (!demoMode()) encryptionKey();
}

export function encryptParticipantPrivateData(data: ParticipantPrivateData) {
  if (demoMode()) return `demo:${JSON.stringify(data)}`;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptParticipantPrivateData(value: string | null): ParticipantPrivateData {
  if (!value) {
    return { dietaryRestrictions: "", medicalInstructions: "", specialRequests: "" };
  }
  if (value.startsWith("demo:")) {
    if (!demoMode()) throw new Error("Les données de démonstration ne sont lisibles qu'en mode démo.");
    return JSON.parse(value.slice("demo:".length)) as ParticipantPrivateData;
  }
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Les données privées d'un participant sont illisibles.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as ParticipantPrivateData;
}
