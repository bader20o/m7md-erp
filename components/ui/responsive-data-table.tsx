import React from "react";

type TableColumn<T> = {
  key: string;
  header: React.ReactNode;
  cell: (item: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
};

type CardField<T> = {
  key: string;
  label: React.ReactNode;
  value: (item: T) => React.ReactNode;
  className?: string;
};

type ResponsiveDataTableProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  columns: TableColumn<T>[];
  cardTitle: (item: T) => React.ReactNode;
  cardBadge?: (item: T) => React.ReactNode;
  cardSubtitle?: (item: T) => React.ReactNode;
  cardFields: CardField<T>[];
  cardActions?: (item: T) => React.ReactNode;
  emptyState: React.ReactNode;
  appearance?: "light" | "dark";
  tableClassName?: string;
  cardClassName?: string;
  rowClassName?: (item: T) => string;
  cardItemClassName?: (item: T) => string;
};

export function ResponsiveDataTable<T>({
  items,
  getKey,
  columns,
  cardTitle,
  cardBadge,
  cardSubtitle,
  cardFields,
  cardActions,
  emptyState,
  appearance = "light",
  tableClassName,
  cardClassName,
  rowClassName,
  cardItemClassName
}: ResponsiveDataTableProps<T>): React.ReactElement {
  const isDark = appearance === "dark";

  return (
    <>
      <div className={`hidden overflow-hidden rounded-xl md:block ${tableClassName ?? ""}`.trim()}>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={`px-3 py-3 ${column.headerClassName ?? ""}`.trim()}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item) => (
                <tr
                  key={getKey(item)}
                  className={`align-top ${isDark ? "border-t border-white/10" : "border-t border-slate-100"} ${rowClassName ? rowClassName(item) : ""}`.trim()}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={`px-3 py-3 ${column.className ?? ""}`.trim()}>
                      {column.cell(item)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-3 py-4 text-center text-sm text-slate-500">
                  {emptyState}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {items.length > 0 ? (
          items.map((item) => (
            <article
              key={getKey(item)}
              className={`rounded-2xl border p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.28)] ${
                isDark ? "border-white/10 bg-slate-950" : "border-slate-200 bg-white"
              } ${cardClassName ?? ""} ${cardItemClassName ? cardItemClassName(item) : ""}`.trim()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold leading-6 break-words ${isDark ? "text-slate-100" : "text-slate-950"}`}>
                    {cardTitle(item)}
                  </div>
                  {cardSubtitle ? (
                    <div className={`mt-1 text-sm break-words ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {cardSubtitle(item)}
                    </div>
                  ) : null}
                </div>
                {cardBadge ? <div className="shrink-0">{cardBadge(item)}</div> : null}
              </div>

              <dl className="mt-4 space-y-2">
                {cardFields.map((field) => (
                  <div key={field.key} className={`flex items-start justify-between gap-3 ${field.className ?? ""}`.trim()}>
                    <dt className={`min-w-0 text-xs font-semibold uppercase tracking-[0.16em] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                      {field.label}
                    </dt>
                    <dd className={`min-w-0 flex-1 text-right text-sm break-words ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      {field.value(item)}
                    </dd>
                  </div>
                ))}
              </dl>

              {cardActions ? <div className="mt-4">{cardActions(item)}</div> : null}
            </article>
          ))
        ) : (
          <div className={`rounded-2xl border border-dashed px-4 py-10 text-center text-sm ${isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>
            {emptyState}
          </div>
        )}
      </div>
    </>
  );
}
