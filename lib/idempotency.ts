import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const IDEMPOTENCY_TTL_HOURS = 24;

interface BeginIdempotencyInput {
  request: Request;
  actorId: string;
  payload: unknown;
}

interface IdempotencyState {
  key: string;
  endpoint: string;
  actorId: string;
  requestHash: string;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  const objectValue = value as Record<string, unknown>;
  const keys = Object.keys(objectValue).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(objectValue[key])}`).join(",")}}`;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function toErrorPayload(code: string, message: string) {
  return {
    success: false,
    error: {
      code,
      message
    }
  };
}

async function findOrCreateRecord(
  state: IdempotencyState,
  expiresAt: Date
): Promise<{ replay: boolean; response?: unknown; statusCode?: number }> {
  const existing = await prisma.requestIdempotency.findUnique({
    where: { key: state.key }
  });

  if (existing) {
    if (
      existing.actorId !== state.actorId ||
      existing.endpoint !== state.endpoint ||
      existing.requestHash !== state.requestHash
    ) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "Idempotency key was already used with a different request."
      );
    }
    return {
      replay: true,
      response: existing.responseJson,
      statusCode: existing.statusCode
    };
  }

  try {
    await prisma.requestIdempotency.create({
      data: {
        key: state.key,
        endpoint: state.endpoint,
        actorId: state.actorId,
        requestHash: state.requestHash,
        responseJson: { success: false, error: { code: "PENDING", message: "Request is processing." } },
        statusCode: 425,
        expiresAt
      }
    });
    return { replay: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const concurrent = await prisma.requestIdempotency.findUnique({
        where: { key: state.key }
      });
      if (
        concurrent &&
        concurrent.actorId === state.actorId &&
        concurrent.endpoint === state.endpoint &&
        concurrent.requestHash === state.requestHash
      ) {
        return {
          replay: true,
          response: concurrent.responseJson,
          statusCode: concurrent.statusCode
        };
      }
      throw new ApiError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "Idempotency key was already used with a different request."
      );
    }
    throw error;
  }
}

export async function beginIdempotency(input: BeginIdempotencyInput): Promise<{
  state: IdempotencyState | null;
  replayResponse?: NextResponse;
}> {
  const key = input.request.headers.get("Idempotency-Key")?.trim() ?? "";
  if (!key) {
    return { state: null };
  }
  if (key.length > 160) {
    throw new ApiError(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency key is too long.");
  }

  const endpoint = new URL(input.request.url).pathname;
  const requestHash = sha256(stableSerialize(input.payload));
  const state: IdempotencyState = {
    key,
    endpoint,
    actorId: input.actorId,
    requestHash
  };

  await prisma.requestIdempotency.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  });
  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);
  const match = await findOrCreateRecord(state, expiresAt);
  if (match.replay) {
    return {
      state,
      replayResponse: NextResponse.json(match.response, { status: match.statusCode ?? 200 })
    };
  }
  return { state };
}

export async function finalizeIdempotencySuccess(
  state: IdempotencyState | null,
  responsePayload: unknown,
  statusCode: number
): Promise<void> {
  if (!state) return;
  await prisma.requestIdempotency.update({
    where: { key: state.key },
    data: {
      responseJson: responsePayload as Prisma.InputJsonValue,
      statusCode
    }
  });
}

export async function finalizeIdempotencyFailure(
  state: IdempotencyState | null,
  error: unknown
): Promise<void> {
  if (!state) return;
  const status =
    error instanceof ApiError
      ? error.status
      : 500;
  const payload =
    error instanceof ApiError
      ? toErrorPayload(error.code, error.message)
      : toErrorPayload("INTERNAL_SERVER_ERROR", "Unexpected server error");
  await prisma.requestIdempotency.update({
    where: { key: state.key },
    data: {
      responseJson: payload as Prisma.InputJsonValue,
      statusCode: status
    }
  });
}
