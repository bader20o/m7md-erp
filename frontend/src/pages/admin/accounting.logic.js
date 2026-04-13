function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function toDateStart(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateEnd(value) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function applyProfitTrendRangeToSeries(series, range) {
  if (!Array.isArray(series) || !series.length || range === "ALL") {
    return Array.isArray(series) ? series : [];
  }
  if (range === "7D") return series.slice(-7);
  if (range === "30D") return series.slice(-30);
  if (range === "90D") return series.slice(-90);
  return series;
}

export function filterTransactionsByState(transactions, filterState, options = {}) {
  const list = Array.isArray(transactions) ? transactions : [];
  const state = filterState || {};
  const getSellingBucket = options.getSellingBucket || (() => "GENERAL");
  const buildSearchBlob =
    options.buildSearchBlob ||
    ((tx, sellingBucket) =>
      normalizeText(
        [
          tx?.itemName || "",
          tx?.note || "",
          tx?.description || "",
          tx?.type || "",
          tx?.incomeSource || "",
          tx?.expenseCategory || "",
          sellingBucket
        ].join(" ")
      ));

  const q = normalizeText(state.q);
  const fromDate = toDateStart(state.fromDate);
  const toDate = toDateEnd(state.toDate);

  const filtered = list.filter((tx) => {
    const occurredAt = new Date(tx.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) return false;

    const sellingBucket = getSellingBucket(tx);
    if (state.type && state.type !== "ALL" && tx.type !== state.type) return false;
    if (state.sellingType && state.sellingType !== "ALL" && sellingBucket !== state.sellingType) return false;
    if (fromDate && occurredAt < fromDate) return false;
    if (toDate && occurredAt > toDate) return false;
    if (!q) return true;

    return buildSearchBlob(tx, sellingBucket).includes(q);
  });

  filtered.sort((a, b) => {
    const sort = state.sort || "NEWEST";
    if (sort === "OLDEST") return new Date(a.occurredAt) - new Date(b.occurredAt);
    if (sort === "AMOUNT_HIGH") return Number(b.amount || 0) - Number(a.amount || 0);
    if (sort === "AMOUNT_LOW") return Number(a.amount || 0) - Number(b.amount || 0);
    return new Date(b.occurredAt) - new Date(a.occurredAt);
  });

  return filtered;
}
