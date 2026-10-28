export interface User {
  id: string;
  email: string;
  fullName: string;
  role: "customer" | "admin";
}

export interface ComplexSummary {
  id: string;
  name: string;
  description: string;
  region: string;
  address: string;
  image_url: string | null;
  available_beds: number;
  facility_count: number;
}

export interface Facility {
  id: string;
  name: string;
  facilityType: string;
  description: string;
  sportIds: string[];
  sportNames: string[];
  sportSlugs: string[];
}

export interface Dormitory {
  id: string;
  name: string;
  description: string;
  bedCount: number;
}

export interface MealOption {
  id: string;
  name: string;
  description: string;
}

export interface ComplexDetails {
  complex: {
    id: string;
    name: string;
    description: string;
    region: string;
    address: string;
    image_url: string | null;
  };
  facilities: Facility[];
  dormitories: Dormitory[];
  mealOptions: MealOption[];
}

interface ApiErrorBody {
  error?: {
    message?: string;
    details?: { field: string; message: string }[];
  };
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    const message = body.error?.message ?? `La requête a échoué (${response.status}).`;
    const details = body.error?.details
      ?.map((detail) => `${detail.field}: ${detail.message}`)
      .join(" ");
    throw new Error(details ? `${message} ${details}` : message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${date}T12:00:00`),
  );
}
