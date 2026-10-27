import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La date doit être au format AAAA-MM-JJ.");

export const campSeasonSchema = z.enum(["summer", "winter"]);
export const campAgeGroupSchema = z.enum(["little", "middle", "teen", "adult"]);

export function currentDateInParis() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isValidDate(value: string) {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

const campStartDate = isoDate.refine(isValidDate, "Choisis une date valide.");
const durationDaysByAgeGroup = { little: 4, middle: 7, teen: 7, adult: 7 } as const;

function addDays(date: string, days: number) {
  const timestamp = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function isCampSeasonDateRangeValid(season: "summer" | "winter", startDate: string, endDate: string) {
  const monthDay = (value: string) => Number(value.slice(5, 7)) * 100 + Number(value.slice(8, 10));
  const startMonthDay = monthDay(startDate);
  const endMonthDay = monthDay(endDate);
  if (season === "summer") {
    return startDate.slice(0, 4) === endDate.slice(0, 4)
      && startMonthDay >= 510 && startMonthDay <= 930
      && endMonthDay >= 510 && endMonthDay <= 930;
  }
  const winterCycle = (value: string) => {
    const year = Number(value.slice(0, 4));
    return monthDay(value) >= 1215 ? year + 1 : year;
  };
  const inWinter = (value: string) => monthDay(value) >= 1215 || monthDay(value) <= 331;
  return inWinter(startDate)
    && inWinter(endDate)
    && winterCycle(startDate) === winterCycle(endDate);
}

function seasonDateIssue(season: "summer" | "winter", startDate: string, durationDays: number) {
  const endDate = addDays(startDate, durationDays - 1);
  return isCampSeasonDateRangeValid(season, startDate, endDate)
    ? null
    : season === "summer"
      ? "Un séjour d'été doit se dérouler entre le 10 mai et le 30 septembre."
      : "Un séjour d'hiver doit se dérouler entre le 15 décembre et le 31 mars.";
}

export const createCampSessionSchema = z.object({
  season: campSeasonSchema,
  ageGroup: campAgeGroupSchema,
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(3000).default(""),
  activities: z.string().trim().max(3000).default(""),
  startDate: campStartDate,
  registrationOpen: z.boolean().default(false),
}).superRefine((value, context) => {
  const today = currentDateInParis();
  if (value.startDate < today) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startDate"],
      message: "La date de début ne peut pas être dans le passé.",
    });
  }
  const windowIssue = seasonDateIssue(
    value.season,
    value.startDate,
    durationDaysByAgeGroup[value.ageGroup],
  );
  if (windowIssue) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["startDate"], message: windowIssue });
  }
});

export const updateCampSessionSchema = z.object({
  season: campSeasonSchema.optional(),
  ageGroup: campAgeGroupSchema.optional(),
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(3000).optional(),
  activities: z.string().trim().max(3000).optional(),
  startDate: campStartDate.optional(),
  registrationOpen: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "Renseigne au moins un champ à modifier.");

const participantSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  birthDate: isoDate.refine(isValidDate, "La date de naissance est invalide."),
  dietaryRestrictions: z.string().trim().max(2000).default(""),
  medicalInstructions: z.string().trim().max(2000).default(""),
  specialRequests: z.string().trim().max(2000).default(""),
});

export const campEnrollmentSchema = z.object({
  healthDataConsent: z.literal(true, {
    error: "Le consentement au traitement des informations de santé est requis.",
  }),
  participants: z.array(participantSchema).min(1).max(20),
});

export type CampEnrollmentInput = z.infer<typeof campEnrollmentSchema>;
