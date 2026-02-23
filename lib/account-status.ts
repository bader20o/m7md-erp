import { UserStatus } from "@prisma/client";

export type BanEvaluation = {
  isBanned: boolean;
  remainingMs: number | null;
  isPermanent: boolean;
};

export function evaluateBan(status: UserStatus, bannedUntil: Date | null | undefined): BanEvaluation {
  if (status !== UserStatus.BANNED) {
    return {
      isBanned: false,
      remainingMs: null,
      isPermanent: false
    };
  }

  if (!bannedUntil) {
    return {
      isBanned: true,
      remainingMs: null,
      isPermanent: true
    };
  }

  const remainingMs = bannedUntil.getTime() - Date.now();
  if (remainingMs <= 0) {
    return {
      isBanned: false,
      remainingMs: 0,
      isPermanent: false
    };
  }

  return {
    isBanned: true,
    remainingMs,
    isPermanent: false
  };
}

export function toRemainingDurationLabel(remainingMs: number | null): string {
  if (remainingMs === null) {
    return "Permanent";
  }

  const totalMinutes = Math.ceil(remainingMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}m`;
}

