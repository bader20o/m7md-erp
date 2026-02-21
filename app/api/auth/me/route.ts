import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) {
      return ok({ user: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        phone: true,
        role: true,
        fullName: true,
        locale: true,
        isActive: true
      }
    });

    return ok({ user });
  } catch (error) {
    return fail(error);
  }
}

