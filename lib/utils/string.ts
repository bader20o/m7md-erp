export function getInitials(fullName: string | null, phone: string): string {
    if (fullName) {
        const words = fullName
            .split(" ")
            .map((word) => word.trim())
            .filter(Boolean);
        if (words.length >= 2) {
            return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
        }
        if (words.length === 1) {
            return (words[0][0] ?? "U").toUpperCase();
        }
    }

    const digits = phone.replace(/\D/g, "");
    return digits.slice(-2).padStart(2, "0");
}
