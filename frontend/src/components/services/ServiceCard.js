export function sanitizeServiceText(text) {
  return String(text || "")
    .replace(/\[seed-full-test-data\]/gi, "")
    .replace(/seed\s*service/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSupportedCarTypes(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim().toUpperCase()).filter(Boolean);
    }
  } catch (_) {
    // Ignore malformed JSON and fall back to comma-separated parsing.
  }

  return String(value)
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

export function formatDuration(minutes) {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function normalizePriceValue(price) {
  if (price === null || price === undefined || price === "") return null;
  const amount = Number(price);
  return Number.isFinite(amount) ? amount : null;
}

export function hasFixedPrice(price) {
  const amount = normalizePriceValue(price);
  return amount !== null && amount > 0;
}

export function renderPriceBadge(price) {
  if (!hasFixedPrice(price)) {
    return '<span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Price after inspection</span>';
  }

  return `<span class="text-sm font-semibold text-primary">JOD ${Number(price).toFixed(2)}</span>`;
}

export function getPriceText(price) {
  return hasFixedPrice(price) ? `JOD ${Number(price).toFixed(2)}` : "Price after inspection";
}

function getCategoryIcon(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("ev") || value.includes("electric")) {
    return `
      <svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
      </svg>
    `;
  }

  if (value.includes("maintenance") || value.includes("oil") || value.includes("engine") || value.includes("service")) {
    return `
      <svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"></path>
      </svg>
    `;
  }

  if (value.includes("diagnostic") || value.includes("inspect") || value.includes("scan") || value.includes("search")) {
    return `
      <svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="7"></circle>
        <path d="m21 21-4.35-4.35"></path>
        <path d="M11 8v6M8 11h6"></path>
      </svg>
    `;
  }

  return `
    <svg aria-hidden="true" viewBox="0 0 64 64" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M37 13l6 6-8 8 4 4 8-8 6 6v10L41 51H31l-6-6 8-8-4-4-8 8-6-6V25L27 13h10Z"></path>
      <path d="M17 47l-4 4"></path>
    </svg>
  `;
}

function renderVisual({ imageUrl, title, badgeLabel, duration, category, dark }) {
  const textTone = dark ? "text-white" : "text-text";
  const overlay = dark
    ? '<div class="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10"></div>'
    : '<div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"></div>';

  const media = imageUrl
    ? `<img src="${imageUrl}" alt="${title}" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />`
    : `<div class="h-full w-full bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.28),_transparent_40%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.92)_65%,_rgba(12,74,110,0.7))]"></div>
       <div class="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-white/90 backdrop-blur-sm">
         ${getCategoryIcon(category)}
       </div>`;

  return `
    <div class="relative aspect-[16/9] w-full overflow-hidden rounded-t-xl bg-bg">
      ${media}
      ${overlay}
      <div class="absolute left-4 top-4 inline-flex items-center rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
        ${badgeLabel}
      </div>
      <div class="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
        <div class="min-w-0">
          <div class="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
            <span class="h-1.5 w-1.5 rounded-full bg-sky-300"></span>
            ${duration}
          </div>
          <h4 class="card-title font-heading leading-tight whitespace-normal break-words ${textTone}">${title}</h4>
        </div>
      </div>
    </div>
  `;
}

export function renderServiceCard({
  service,
  title,
  description,
  badgeLabel,
  selected = false,
  selectedLabel = "Selected",
  onClick,
  className = "",
  dark = true
}) {
  const cleanTitle = sanitizeServiceText(title);
  const cleanDescription = sanitizeServiceText(description);
  const showDescription = Boolean(cleanDescription);
  const duration = formatDuration(service.durationMinutes);
  const selectedClasses = selected
    ? "border-sky-300 bg-surface ring-2 ring-sky-500 shadow-[0_24px_70px_-34px_rgba(14,116,144,0.75)]"
    : "border-border bg-surface hover:scale-[1.02] hover:border-primary/40 hover:shadow-[0_24px_70px_-34px_rgba(14,116,144,0.55)]";
  const selectedBadge = selected
    ? `<div class="absolute right-4 top-4 z-10 inline-flex items-center rounded-full bg-sky-500 px-2.5 py-1 text-xs font-semibold text-white shadow-md">${selectedLabel}</div>`
    : "";

  return `
    <button
      type="button"
      class="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border text-left transition-all duration-300 ${selectedClasses} ${className}"
      onclick="${onClick}"
      aria-pressed="${selected ? "true" : "false"}"
    >
      ${selectedBadge}
      ${renderVisual({
        imageUrl: service.imageUrl || service.image,
        title: cleanTitle,
        badgeLabel,
        duration,
        category: service.category,
        dark
      })}
      <div class="flex flex-1 flex-col px-4 py-4">
        ${showDescription ? `<p class="card-description whitespace-normal break-words">${cleanDescription}</p>` : '<div class="card-description"> </div>'}
        <div class="mt-4">
          ${renderPriceBadge(service.basePrice ?? service.price)}
        </div>
      </div>
    </button>
  `;
}
