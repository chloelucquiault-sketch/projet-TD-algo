export interface User {
  id: string;
  email: string;
  fullName: string;
  role: "customer" | "manager" | "admin";
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
  sportId: string;
  sportName: string;
  sportSlug: string;
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
  error?: { message?: string };
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error?.message ?? `La requête a échoué (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${date}T12:00:00`),
  );
}
