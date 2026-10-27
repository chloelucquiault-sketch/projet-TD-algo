import type { NextFunction, Request, Response } from "express";
import { pool } from "../db/pool.js";
import { HttpError } from "../errors.js";
import type { UserRole } from "../types.js";

export async function loadUser(request: Request, _response: Response, next: NextFunction) {
  try {
    if (!request.session.userId) {
      next();
      return;
    }
    const result = await pool.query<{
      id: string;
      email: string;
      full_name: string;
      role: UserRole;
    }>(
      "SELECT id, email, full_name, role FROM users WHERE id = $1",
      [request.session.userId],
    );
    const user = result.rows[0];
    if (!user) {
      request.session.destroy((error) => {
        if (error) next(error);
        else next();
      });
      return;
    }
    request.user = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(request: Request, _response: Response, next: NextFunction) {
  if (!request.user) {
    next(new HttpError(401, "Connecte-toi pour accéder à cette page."));
    return;
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.user) {
      next(new HttpError(401, "Connecte-toi pour accéder à cette page."));
      return;
    }
    if (!roles.includes(request.user.role)) {
      next(new HttpError(403, "Tu n'as pas les droits nécessaires."));
      return;
    }
    next();
  };
}
