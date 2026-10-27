import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La date doit être au format AAAA-MM-JJ.");

const stayDatesBaseSchema = z.object({
  checkIn: isoDate,
  checkOut: isoDate,
});

function refineStayDates(
  { checkIn, checkOut }: { checkIn: string; checkOut: string },
  context: z.RefinementCtx,
) {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  const validStart = Number.isFinite(start) && new Date(start).toISOString().slice(0, 10) === checkIn;
  const validEnd = Number.isFinite(end) && new Date(end).toISOString().slice(0, 10) === checkOut;
  if (!validStart) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["checkIn"], message: "Date d'arrivée invalide." });
  }
  if (!validEnd) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["checkOut"], message: "Date de départ invalide." });
  }
  if (validStart && checkIn < new Date().toISOString().slice(0, 10)) {
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

export const bookingSchema = stayDatesBaseSchema.extend({
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
