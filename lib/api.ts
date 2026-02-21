import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data
    },
    { status }
  );
}

export function fail(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      },
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: error.issues
        }
      },
      { status: 400 }
    );
  }

  console.error(error);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error"
      }
    },
    { status: 500 }
  );
}

export async function parseJsonBody<T>(
  request: Request,
  schema: { parseAsync: (value: unknown) => Promise<T> }
): Promise<T> {
  const body = await request.json();
  return schema.parseAsync(body);
}

