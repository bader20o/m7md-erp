export function sanitizeServiceText(text: string | null | undefined): string {
  if (!text) return "";

  return text
    .replace(/\[seed-full-test-data\]/gi, "")
    .replace(/seed\s*service/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
