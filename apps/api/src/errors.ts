import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function diagnosticDetails(error: unknown) {
  if (!(error instanceof Error)) return "Erreur de type inconnu.";
  const code = "code" in error && typeof error.code === "string" ? ` [${error.code}]` : "";
  return `${error.name}${code}: ${error.message}`.slice(0, 240);
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Certaines informations sont invalides.",
        details: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: {
        code: error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "REQUEST_ERROR",
        message: error.message,
      },
    });
    return;
  }

  console.error("Erreur API non gérée.", error);
  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Une erreur interne est survenue.",
      ...(process.env.DEMO_MODE === "true" ? { diagnostic: diagnosticDetails(error) } : {}),
    },
  });
};
