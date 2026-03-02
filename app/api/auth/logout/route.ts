import { fail, ok } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(): Promise<Response> {
  try {
    const session = await getSession();
    await clearSessionCookie();

    if (session) {
      await logAudit({
        action: "LOGOUT",
        entity: "User",
        entityId: session.sub,
        actorId: session.sub
      });

      await prisma.user.update({
        where: { id: session.sub },
        data: {
          lastLogoutAt: new Date()
        }
      });
    }

    return ok({ loggedOut: true });
  } catch (error) {
    return fail(error);
  }
}
