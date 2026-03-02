export function normalizePhone(raw: string | undefined | null): string | null {
    if (!raw) return null;

    // Remove spaces, dashes, and other visual separators usually used in phones
    // Keep '+' for the prefix checks.
    let cleaned = raw.replace(/[^\d+]/g, '');

    if (cleaned.startsWith('+962')) {
        cleaned = '0' + cleaned.substring(4);
    } else if (cleaned.startsWith('00962')) {
        cleaned = '0' + cleaned.substring(5);
    } else if (cleaned.startsWith('962')) {
        cleaned = '0' + cleaned.substring(3);
    }

    // Pure digits only from here on
    cleaned = cleaned.replace(/\D/g, '');

    if (/^07\d{8}$/.test(cleaned)) {
        return cleaned;
    }

    return null;
}
