import { fail, ok } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { clearSessionCookie, getSession } from "@/lib/auth";

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
    }

    return ok({ loggedOut: true });
  } catch (error) {
    return fail(error);
  }
}

