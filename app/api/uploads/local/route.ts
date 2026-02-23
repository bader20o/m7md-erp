import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Role } from "@prisma/client";
import { ApiError, fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { requireRoles } from "@/lib/rbac";

const maxImageSizeBytes = 8 * 1024 * 1024;
const maxVideoSizeBytes = 35 * 1024 * 1024;
const maxAudioSizeBytes = 15 * 1024 * 1024;

const contentTypeToExtension: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav"
};

function getUploadLimit(contentType: string): number {
  if (contentType.startsWith("image/")) {
    return maxImageSizeBytes;
  }

  if (contentType.startsWith("video/")) {
    return maxVideoSizeBytes;
  }

  if (contentType.startsWith("audio/")) {
    return maxAudioSizeBytes;
  }

  return 0;
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.CUSTOMER, Role.EMPLOYEE, Role.ADMIN]);

    const formData = await request.formData();
    const file = formData.get("file");
    const folderInput = String(formData.get("folder") ?? "general").trim().toLowerCase();

    if (!(file instanceof File)) {
      throw new ApiError(400, "MISSING_FILE", "File is required.");
    }

    const extension = contentTypeToExtension[file.type];
    if (!extension) {
      throw new ApiError(
        400,
        "UNSUPPORTED_FILE_TYPE",
        "Allowed types: JPG, PNG, WEBP, GIF, MP4, WEBM, MOV, OGG, MP3, M4A, WAV."
      );
    }

    const maxSize = getUploadLimit(file.type);
    if (!maxSize || file.size > maxSize) {
      throw new ApiError(400, "FILE_TOO_LARGE", "File exceeds allowed size.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const safeFolder = folderInput.replace(/[^a-z0-9_-]/g, "") || "general";
    const relativeDir = path.join("uploads", safeFolder);
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

