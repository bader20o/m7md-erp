import { ApiError } from "./api.js";

export async function uploadLocalFile(file, { folder = "general" } = {}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const response = await fetch("/api/uploads/local", {
    method: "POST",
    credentials: "include",
    body: formData
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("UPLOAD_FAILED", "Upload failed.");
  }

  if (!response.ok || !payload?.success) {
    const message = payload?.error?.message || "Upload failed.";
    throw new ApiError(payload?.error?.code || "UPLOAD_FAILED", message, payload?.error?.details || null);
  }

  return payload.data.fileUrl;
}

