import { NextFunction, Request, Response } from "express";
import { ZodError, ZodType } from "zod";
import { sanitizeForValidation } from "../utils/sanitize.js";

type ParsedRequestShape = {
  body: unknown;
  query: unknown;
  params: unknown;
};

export function validate(schema: ZodType<ParsedRequestShape>) {
  return (request: Request, response: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: sanitizeForValidation(request.body),
        query: sanitizeForValidation(request.query),
        params: sanitizeForValidation(request.params)
      });

      request.body = parsed.body;
      response.locals.validated = parsed;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return response.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.flatten(),
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        });
      }

      next(error);
    }
  };
}
