import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptParticipantPrivateData,
  encryptParticipantPrivateData,
} from "./security/health-data.js";

let previousKey: string | undefined;

beforeEach(() => {
  previousKey = process.env.HEALTH_DATA_ENCRYPTION_KEY;
  process.env.HEALTH_DATA_ENCRYPTION_KEY = "11".repeat(32);
});
afterEach(() => {
  if (previousKey === undefined) delete process.env.HEALTH_DATA_ENCRYPTION_KEY;
  else process.env.HEALTH_DATA_ENCRYPTION_KEY = previousKey;
});

describe("chiffrement des informations privées", () => {
  it("chiffre puis déchiffre les informations du participant", () => {
    const data = {
      dietaryRestrictions: "Allergie aux noix",
      medicalInstructions: "Traitement à conserver au frais",
      specialRequests: "Frère inscrit au même départ",
    };
    const encrypted = encryptParticipantPrivateData(data);
    expect(encrypted).not.toContain(data.dietaryRestrictions);
    expect(decryptParticipantPrivateData(encrypted)).toEqual(data);
  });

  it("refuse un contenu altéré", () => {
    const encrypted = encryptParticipantPrivateData({
      dietaryRestrictions: "Allergie",
      medicalInstructions: "",
      specialRequests: "",
    });
    const [iv, tag, data] = encrypted.split(".");
    const alteredTag = `${tag![0] === "A" ? "B" : "A"}${tag!.slice(1)}`;
    expect(() => decryptParticipantPrivateData(`${iv}.${alteredTag}.${data}`)).toThrow();
  });
});
