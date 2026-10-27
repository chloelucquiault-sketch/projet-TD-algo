import { describe, expect, it } from "vitest";
import { bookingSchema, registerSchema, stayDatesSchema } from "./validation.js";

function dateIn(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe("validation des dates de séjour", () => {
  it("accepte un séjour futur de deux nuits", () => {
    expect(stayDatesSchema.safeParse({ checkIn: dateIn(10), checkOut: dateIn(12) }).success).toBe(true);
  });

  it("refuse un séjour inférieur à deux nuits", () => {
    const result = stayDatesSchema.safeParse({ checkIn: dateIn(10), checkOut: dateIn(11) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("deux nuits"))).toBe(true);
    }
  });

  it("refuse une date impossible ou passée", () => {
    expect(stayDatesSchema.safeParse({ checkIn: "2026-02-30", checkOut: "2026-03-04" }).success).toBe(false);
    expect(stayDatesSchema.safeParse({ checkIn: dateIn(-1), checkOut: dateIn(2) }).success).toBe(false);
  });
});

describe("validation des comptes et demandes", () => {
  it("normalise l'adresse e-mail lors de l'inscription", () => {
    const result = registerSchema.parse({
      email: "  CLUB@EXEMPLE.FR ",
      password: "un-mot-de-passe-securise",
      fullName: "Camille Martin",
    });
    expect(result.email).toBe("club@exemple.fr");
  });

  it("refuse une réservation dont les couchages sont insuffisants", () => {
    const result = bookingSchema.safeParse({
      complexId: "1c7d9a72-40db-4d2e-aadf-0e8ce1b10f80",
      checkIn: dateIn(10),
      checkOut: dateIn(12),
      groupSize: 11,
      groupType: "Club sportif",
      facilityIds: ["cdacb303-27f7-47f6-bac5-c8e5c21fba68"],
      dormitories: [{ dormitoryId: "9e40ae15-ae50-4de0-a54d-419a6d93d1e2", bedsReserved: 10 }],
      mealOptionId: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "dormitories")).toBe(true);
    }
  });
});
