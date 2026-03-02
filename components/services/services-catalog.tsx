"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ServiceItem = {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  durationMinutes: number;
  category: string | null;
  imageUrl: string | null;
  _count?: { bookings: number };
};

type Props = {
  locale: string;
  services: ServiceItem[];
};

type SortOption = "POPULARITY" | "DURATION_ASC" | "DURATION_DESC";
type DurationFilter = "ALL" | "SHORT" | "MEDIUM" | "LONG";

const fallbackImage =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450'><rect width='800' height='450' fill='%23d8ecff'/><rect x='40' y='40' width='720' height='370' rx='24' fill='%23b6d8ff'/><path d='M120 300h560' stroke='%23205ea8' stroke-width='20' stroke-linecap='round'/><circle cx='240' cy='320' r='46' fill='%23205ea8'/><circle cx='560' cy='320' r='46' fill='%23205ea8'/></svg>";

function normalizeCategory(category: string | null): "EV" | "HYBRID" | "GENERAL" {
  const value = category?.toUpperCase() ?? "";
  if (value.includes("EV") || value.includes("ELECTRIC")) {
    return "EV";
  }
  if (value.includes("HYBRID")) {
    return "HYBRID";
  }
  return "GENERAL";
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function ServicesCatalog({ locale, services }: Props): React.ReactElement {
  const [search, setSearch] = useState("");
  const [carType, setCarType] = useState<"ALL" | "EV" | "HYBRID" | "GENERAL">("ALL");
  const [durationRange, setDurationRange] = useState<DurationFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("POPULARITY");

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    const items = services.filter((service) => {
      const category = normalizeCategory(service.category);
      const name = locale === "ar" ? service.nameAr : service.nameEn;
      const description = locale === "ar" ? service.descriptionAr : service.descriptionEn;

      if (carType !== "ALL" && category !== carType) {
        return false;
      }

      if (durationRange === "SHORT" && service.durationMinutes >= 45) {
        return false;
      }
      if (durationRange === "MEDIUM" && (service.durationMinutes < 45 || service.durationMinutes > 90)) {
        return false;
      }
      if (durationRange === "LONG" && service.durationMinutes <= 90) {
        return false;
      }

      if (!query) {
        return true;
      }

      return `${name} ${description ?? ""} ${category}`.toLowerCase().includes(query);
    });

    return items.sort((a, b) => {
      if (sortBy === "DURATION_ASC") {
        return a.durationMinutes - b.durationMinutes;
      }
      if (sortBy === "DURATION_DESC") {
        return b.durationMinutes - a.durationMinutes;
      }
      return (b._count?.bookings ?? 0) - (a._count?.bookings ?? 0) || a.nameEn.localeCompare(b.nameEn);
    });
  }, [carType, durationRange, locale, search, services, sortBy]);

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-[24px] border border-sky-100 bg-white/90 p-4 shadow-[0_24px_80px_-40px_rgba(20,83,136,0.45)] backdrop-blur md:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_0.8fr_0.8fr_0.8fr]">
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Search services</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by service, issue, or vehicle type"
              className="h-12 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-300 focus:bg-white"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Car type</span>
            <select
              value={carType}
              onChange={(event) => setCarType(event.target.value as typeof carType)}
              className="h-12 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-300 focus:bg-white"
            >
              <option value="ALL">All vehicles</option>
              <option value="EV">EV</option>
              <option value="HYBRID">Hybrid</option>
              <option value="GENERAL">General</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Duration</span>
            <select
              value={durationRange}
              onChange={(event) => setDurationRange(event.target.value as DurationFilter)}
              className="h-12 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-300 focus:bg-white"
            >
              <option value="ALL">Any duration</option>
              <option value="SHORT">Under 45 min</option>
              <option value="MEDIUM">45 to 90 min</option>
              <option value="LONG">Over 90 min</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Sort by</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              className="h-12 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-300 focus:bg-white"
            >
              <option value="POPULARITY">Popularity</option>
              <option value="DURATION_ASC">Duration: shortest</option>
              <option value="DURATION_DESC">Duration: longest</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredServices.map((service) => {
          const category = normalizeCategory(service.category);
          const serviceName = locale === "ar" ? service.nameAr : service.nameEn;
          const description =
            (locale === "ar" ? service.descriptionAr : service.descriptionEn)?.trim() ||
            "Inspection-focused servicing with final pricing reviewed by the admin team.";

          return (
            <article
              key={service.id}
              className="group overflow-hidden rounded-[14px] border border-sky-100 bg-white shadow-[0_18px_40px_-28px_rgba(17,94,169,0.45)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_28px_60px_-26px_rgba(17,94,169,0.55)]"
            >
              <div className="relative h-40 overflow-hidden md:h-[180px]">
                <img
                  src={service.imageUrl || fallbackImage}
                  alt={serviceName}
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/65 via-slate-900/15 to-transparent" />
                <span className="absolute left-4 top-4 rounded-full border border-white/40 bg-white/18 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-white backdrop-blur">
                  {category}
                </span>
              </div>

              <div className="grid gap-4 p-5">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-slate-900">{serviceName}</h2>
                  <p className="line-clamp-1 text-sm text-slate-600">{description}</p>
                </div>

                <div className="flex items-center gap-2 text-sm font-medium text-sky-900">
                  <span aria-hidden="true">⏱</span>
                  <span>{formatDuration(service.durationMinutes)}</span>
                </div>

                <p className="text-sm text-slate-500">Price determined after inspection</p>

                <Link
                  href={`/${locale}/bookings/new?serviceId=${service.id}`}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white transition duration-200 hover:bg-sky-800"
                >
                  Book Now
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {!filteredServices.length ? (
        <div className="rounded-[20px] border border-dashed border-sky-200 bg-white/70 p-8 text-center text-sm text-slate-600">
          No services match the current filters.
        </div>
      ) : null}
    </div>
  );
}
