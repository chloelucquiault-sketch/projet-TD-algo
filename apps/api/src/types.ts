export type UserRole = "customer" | "admin";
export type BookingStatus = "pending" | "confirmed" | "cancelled";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}
