import { describe, expect, it } from "vitest";
import { ageOnDate, campEnrollmentSchema, createCampSessionSchema } from "./camp-validation.js";

describe("validation des colonies", () => {
  it("n'accepte que les dates réelles pour créer un départ", () => {
    const valid = {
      season: "summer",
      ageGroup: "little",
      title: "Colonie des Petits",
      startDate: "2030-07-10",
      registrationOpen: true,
    };
    expect(createCampSessionSchema.safeParse(valid).success).toBe(true);
    expect(createCampSessionSchema.safeParse({ ...valid, startDate: "2030-02-30" }).success).toBe(false);
    expect(createCampSessionSchema.safeParse({ ...valid, startDate: "2030-05-09" }).success).toBe(false);
    expect(createCampSessionSchema.safeParse({ ...valid, startDate: "2030-05-10" }).success).toBe(true);
    expect(createCampSessionSchema.safeParse({ ...valid, startDate: "2030-09-27" }).success).toBe(true);
    expect(createCampSessionSchema.safeParse({ ...valid, startDate: "2030-09-28" }).success).toBe(false);
    expect(createCampSessionSchema.safeParse({
      ...valid,
      season: "winter",
      startDate: "2030-12-29",
    }).success).toBe(true);
    expect(createCampSessionSchema.safeParse({
      ...valid,
      season: "winter",
      startDate: "2030-03-29",
    }).success).toBe(false);
    expect(createCampSessionSchema.safeParse({
      ...valid,
      ageGroup: "middle",
      startDate: "2030-03-25",
      season: "winter",
    }).success).toBe(true);
    expect(createCampSessionSchema.safeParse({
      ...valid,
      ageGroup: "middle",
      startDate: "2030-03-26",
      season: "winter",
    }).success).toBe(false);
  });

  it("exige un consentement explicite et limite une demande à 20 participants", () => {
    const participant = {
      firstName: "Lou",
      lastName: "Martin",
      birthDate: "2020-06-01",
    };
    expect(campEnrollmentSchema.safeParse({ healthDataConsent: true, participants: [participant] }).success).toBe(true);
    expect(campEnrollmentSchema.safeParse({ healthDataConsent: false, participants: [participant] }).success).toBe(false);
    expect(campEnrollmentSchema.safeParse({
      healthDataConsent: true,
      participants: Array.from({ length: 21 }, () => participant),
    }).success).toBe(false);
  });

  it("calcule l'âge au début du séjour pour imposer le minimum de 5 ans", () => {
    expect(ageOnDate("2021-07-10", "2026-07-10")).toBe(5);
    expect(ageOnDate("2021-07-11", "2026-07-10")).toBe(4);
    expect(ageOnDate("2020-02-29", "2025-02-28")).toBe(4);
    expect(ageOnDate("2020-02-29", "2025-03-01")).toBe(5);
  });
});
