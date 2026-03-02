import ExcelJS from "exceljs";

export function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true };
}

export function autoFitColumns(worksheet: ExcelJS.Worksheet): void {
  worksheet.columns.forEach((column) => {
    if (!column || typeof column.eachCell !== "function") {
      return;
    }
    let maxLength = 10;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      const text =
        value === null || value === undefined
          ? ""
          : typeof value === "object" && "text" in value
            ? String(value.text ?? "")
            : String(value);
      maxLength = Math.max(maxLength, text.length + 2);
    });
    column.width = Math.min(60, maxLength);
  });
}

export async function workbookToResponse(
  workbook: ExcelJS.Workbook,
  filename: string
): Promise<Response> {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
