import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Role } from "@prisma/client";
import { ApiError, fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { requireRoles } from "@/lib/rbac";

const maxFileSizeBytes = 5 * 1024 * 1024;
const contentTypeToExtension: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export async function POST(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.EMPLOYEE, Role.RECEPTION, Role.MANAGER, Role.ADMIN]);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "MISSING_FILE", "Image file is required.");
    }

    const extension = contentTypeToExtension[file.type];
    if (!extension) {
      throw new ApiError(400, "UNSUPPORTED_FILE_TYPE", "Only JPG, PNG, WEBP, and GIF files are allowed.");
    }

    if (file.size > maxFileSizeBytes) {
      throw new ApiError(400, "FILE_TOO_LARGE", "Image exceeds maximum size of 5MB.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const relativeDir = path.join("uploads", "offers");
    const outputDir = path.join(process.cwd(), "public", relativeDir);

    await fs.mkdir(outputDir, { recursive: true });

    const safeName = `${Date.now()}_${randomUUID()}.${extension}`;
    const outputPath = path.join(outputDir, safeName);
    await fs.writeFile(outputPath, bytes);

    return ok({
      fileUrl: `/${relativeDir.replace(/\\/g, "/")}/${safeName}`,
      contentType: file.type,
      size: file.size
    });
  } catch (error) {
    return fail(error);
  }
}

