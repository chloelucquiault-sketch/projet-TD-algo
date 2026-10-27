import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La date doit être au format AAAA-MM-JJ.");

const stayDatesBaseSchema = z.object({
  checkIn: isoDate,
  checkOut: isoDate,
});

function todayInParis() {
  const parts = new Intl.DateTimeFormat("en-GB", {
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

export const dayDateSchema = isoDate.refine(
  (value) => isValidDate(value) && value >= todayInParis(),
  "Choisis une date valide, aujourd'hui ou ultérieure.",
);

function refineStayDates(
  { checkIn, checkOut }: { checkIn: string; checkOut: string },
  context: z.RefinementCtx,
) {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  const validStart = isValidDate(checkIn);
  const validEnd = isValidDate(checkOut);
  if (!validStart) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["checkIn"], message: "Date d'arrivée invalide." });
  }
  if (!validEnd) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["checkOut"], message: "Date de départ invalide." });
  }
  if (validStart && checkIn < todayInParis()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkIn"],
      message: "La date d'arrivée ne peut pas être dans le passé.",
    });
  }
  if (validStart && validEnd && end - start < 2 * 86_400_000) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkOut"],
      message: "Un séjour doit durer au moins deux nuits.",
    });
  }
  if (validStart && validEnd && end <= start) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkOut"],
      message: "La date de départ doit être après la date d'arrivée.",
    });
  }
}

export const stayDatesSchema = stayDatesBaseSchema.superRefine(refineStayDates);

export const registerSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(200),
  fullName: z.string().trim().min(2).max(120),
  organizationName: z.string().trim().max(160).optional(),
});

const stayBookingSchema = stayDatesBaseSchema.extend({
  bookingType: z.literal("stay"),
  complexId: z.string().uuid(),
  groupSize: z.number().int().min(1).max(500),
  groupType: z.string().trim().min(2).max(80),
  facilityIds: z.array(z.string().uuid()).min(1).max(20),
  dormitories: z.array(z.object({
    dormitoryId: z.string().uuid(),
    bedsReserved: z.number().int().min(1).max(500),
  })).min(1).max(20),
  mealOptionId: z.string().uuid().nullable(),
}).superRefine((value, context) => {
  refineStayDates(value, context);
  const totalBeds = value.dormitories.reduce((total, dormitory) => total + dormitory.bedsReserved, 0);
  if (totalBeds < value.groupSize) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dormitories"],
      message: "Le nombre de couchages doit couvrir tout le groupe.",
    });
  }
  if (new Set(value.facilityIds).size !== value.facilityIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["facilityIds"], message: "Un équipement est sélectionné plusieurs fois." });
  }
  if (new Set(value.dormitories.map((entry) => entry.dormitoryId)).size !== value.dormitories.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["dormitories"], message: "Un dortoir est sélectionné plusieurs fois." });
  }
});

const dayStartTime = z.string().regex(
  /^(?:(?:08|09|1[0-6]):(?:00|30)|17:00)$/,
  "Les créneaux doivent commencer entre 8 h et 17 h, par demi-heure.",
);

function timeToMinutes(value: string) {
  const hours = Number(value.slice(0, 2));
  const minutes = Number(value.slice(3, 5));
  return hours * 60 + minutes;
}

export const dayBookingSchema = z.object({
  bookingType: z.literal("day"),
  complexId: z.string().uuid(),
  checkIn: dayDateSchema,
  facilityId: z.string().uuid(),
  startTimes: z.array(dayStartTime).min(1).max(3),
  groupSize: z.number().int().min(1).max(500),
  groupType: z.string().trim().min(2).max(80),
}).superRefine((value, context) => {
  if (new Set(value.startTimes).size !== value.startTimes.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startTimes"],
      message: "Un créneau ne peut être sélectionné qu'une seule fois.",
    });
  }
  const sorted = value.startTimes.map(timeToMinutes).sort((a, b) => a - b);
  if (sorted.some((start, index) => index > 0 && start - (sorted[index - 1]! + 180) < 30)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startTimes"],
      message: "Laisse au moins 30 minutes entre deux créneaux réservés par ton équipe.",
    });
  }
});

export const bookingSchema = z.union([stayBookingSchema, dayBookingSchema]);
