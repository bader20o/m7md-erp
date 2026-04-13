import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Role } from "@prisma/client";
import { ApiError, fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { requireRoles } from "@/lib/rbac";

const maxImageSizeBytes = Number(process.env.CHAT_MAX_IMAGE_SIZE_BYTES ?? 8 * 1024 * 1024);
const maxVideoSizeBytes = Number(process.env.CHAT_MAX_VIDEO_SIZE_BYTES ?? 35 * 1024 * 1024);
const maxAudioSizeBytes = Number(process.env.CHAT_MAX_AUDIO_SIZE_BYTES ?? 12 * 1024 * 1024);

const mimeMap: Record<string, { extension: string; maxBytes: number }> = {
  "image/jpeg": { extension: "jpg", maxBytes: maxImageSizeBytes },
  "image/png": { extension: "png", maxBytes: maxImageSizeBytes },
  "image/webp": { extension: "webp", maxBytes: maxImageSizeBytes },
  "image/gif": { extension: "gif", maxBytes: maxImageSizeBytes },
  "video/mp4": { extension: "mp4", maxBytes: maxVideoSizeBytes },
  "video/webm": { extension: "webm", maxBytes: maxVideoSizeBytes },
  "video/quicktime": { extension: "mov", maxBytes: maxVideoSizeBytes },
  "audio/webm": { extension: "webm", maxBytes: maxAudioSizeBytes },
  "audio/wav": { extension: "wav", maxBytes: maxAudioSizeBytes },
  "audio/mpeg": { extension: "mp3", maxBytes: maxAudioSizeBytes },
  "audio/mp4": { extension: "m4a", maxBytes: maxAudioSizeBytes },
  "audio/ogg": { extension: "ogg", maxBytes: maxAudioSizeBytes },
  // Browser/recorder aliases
  "audio/wave": { extension: "wav", maxBytes: maxAudioSizeBytes },
  "audio/x-wav": { extension: "wav", maxBytes: maxAudioSizeBytes },
  "audio/x-m4a": { extension: "m4a", maxBytes: maxAudioSizeBytes }
};

export async function POST(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.CUSTOMER, Role.EMPLOYEE, Role.ADMIN]);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "MISSING_FILE", "File is required.");
    }

    const normalizedType = String(file.type || "")
      .toLowerCase()
      .split(";")[0]
      .trim();
    const config = mimeMap[normalizedType];
    if (!config) {
      throw new ApiError(
        400,
        "UNSUPPORTED_FILE_TYPE",
        "Allowed chat uploads: JPG, PNG, WEBP, GIF, MP4, WEBM, MOV, WEBM audio, WAV, MP3, M4A, OGG."
      );
    }

    if (file.size > config.maxBytes) {
      throw new ApiError(400, "FILE_TOO_LARGE", "File exceeds allowed size.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const relativeDir = path.join("uploads", "chat");
    const outputDir = path.join(process.cwd(), "public", relativeDir);

    await fs.mkdir(outputDir, { recursive: true });

    const safeName = `${Date.now()}_${randomUUID()}.${config.extension}`;
    const outputPath = path.join(outputDir, safeName);
    await fs.writeFile(outputPath, bytes);

    return ok({
      fileUrl: `/${relativeDir.replace(/\\/g, "/")}/${safeName}`,
      mimeType: normalizedType || file.type,
      size: file.size
    });
  } catch (error) {
    return fail(error);
  }
}
