function escapeCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const raw = String(value);
  if (/["\n,]/.test(raw)) {
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }
  return raw;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map((cell) => escapeCell(cell)).join(",")).join("\n");
}

