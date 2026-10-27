export type UserRole = "customer" | "manager" | "admin";
export type BookingStatus = "pending" | "confirmed" | "cancelled";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}
