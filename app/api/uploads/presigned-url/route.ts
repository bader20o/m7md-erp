import { Role } from "@prisma/client";
import { z } from "zod";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { requireRoles } from "@/lib/rbac";

const uploadRequestSchema = z.object({
  fileName: z.string().min(1).max(260),
  contentType: z.string().min(3).max(120)
});

export async function POST(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.EMPLOYEE, Role.RECEPTION, Role.MANAGER, Role.ADMIN]);
    const body = await parseJsonBody(request, uploadRequestSchema);

    // Placeholder flow: integrate with S3/R2 presigned URLs later.
    const fakeUploadUrl = `https://example-storage.local/upload/${encodeURIComponent(body.fileName)}`;
    const publicUrl = `https://example-storage.local/public/${encodeURIComponent(body.fileName)}`;

    return ok({
      uploadUrl: fakeUploadUrl,
      fileUrl: publicUrl,
      provider: "placeholder"
    });
  } catch (error) {
    return fail(error);
  }
}

