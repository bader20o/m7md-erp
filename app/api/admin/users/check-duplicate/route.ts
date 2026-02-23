import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createLookupHash } from "@/lib/security";

function normalizeName(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function similarityScore(a: string, b: string): number {
  const aTokens = new Set(normalizeName(a));
  const bTokens = new Set(normalizeName(b));
  if (!aTokens.size || !bTokens.size) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...aTokens, ...bTokens]).size;
  return intersection / union;
}

export async function GET(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN]);
    const url = new URL(request.url);
    const phone = url.searchParams.get("phone")?.trim();
    const nationalId = url.searchParams.get("nationalId")?.trim();
    const fullName = url.searchParams.get("fullName")?.trim();

    const [phoneMatch, nationalIdMatch, possibleNameMatches] = await Promise.all([
      phone
        ? prisma.user.findUnique({
            where: { phone },
            select: { id: true, fullName: true, phone: true, role: true, createdAt: true }
          })
        : Promise.resolve(null),
      nationalId
        ? prisma.employee.findUnique({
            where: { nationalIdHash: createLookupHash(nationalId) },
            select: {
              id: true,
              user: {
                select: { id: true, fullName: true, phone: true, role: true, createdAt: true }
              }
            }
          })
        : Promise.resolve(null),
      fullName
        ? prisma.user.findMany({
            where: {
              fullName: {
                contains: normalizeName(fullName)[0] || fullName,
                mode: "insensitive"
              }
            },
            select: {
              id: true,
              fullName: true,
              phone: true,
              role: true,
              createdAt: true
            },
            take: 15
          })
        : Promise.resolve([])
    ]);

    const nameWarnings = fullName
      ? possibleNameMatches
          .map((item) => ({
            ...item,
            similarity: similarityScore(fullName, item.fullName || "")
          }))
          .filter((item) => item.similarity >= 0.5)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5)
      : [];

    return ok({
      phone: phoneMatch
        ? {
            exists: true,
            profile: {
              id: phoneMatch.id,
              fullName: phoneMatch.fullName,
              phone: phoneMatch.phone,
              role: phoneMatch.role,
              profilePath: phoneMatch.role === Role.CUSTOMER ? `/admin/customers` : `/admin/employees`
            }
          }
        : { exists: false },
      nationalId: nationalIdMatch
        ? {
            exists: true,
            profile: {
              id: nationalIdMatch.id,
              userId: nationalIdMatch.user.id,
              fullName: nationalIdMatch.user.fullName,
              phone: nationalIdMatch.user.phone,
              role: nationalIdMatch.user.role,
              profilePath: "/admin/employees"
            }
          }
        : { exists: false },
      nameWarnings: nameWarnings.map((item) => ({
        id: item.id,
        fullName: item.fullName,
        phone: item.phone,
        role: item.role,
        similarity: Number(item.similarity.toFixed(2)),
        profilePath: item.role === Role.CUSTOMER ? "/admin/customers" : "/admin/employees"
      }))
    });
  } catch (error) {
    return fail(error);
  }
}

