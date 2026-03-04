"use client";

import type { CSSProperties } from "react";

export type PlanCardBenefit = {
  id?: string;
  code: string;
  titleEn: string;
  titleAr: string;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  limitCount: number;
  isActive?: boolean;
};

export type PlanCardPlan = {
  id?: string;
  tier: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  priceJod: number;
  durationMonths: number;
  themeColor?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  benefits: PlanCardBenefit[];
};

type Props = {
  plan: PlanCardPlan;
  locale: string;
  variant: "customer" | "admin" | "preview";
  highlighted?: boolean;
  subscribeLabel?: string;
  subscribeDisabled?: boolean;
  subscribeBusy?: boolean;
  toggleBusy?: boolean;
  onSubscribe?: () => void;
  onEdit?: () => void;
  onToggleActive?: () => void;
};

const FALLBACK_THEME = "#3B82F6";

function sanitizeHexColor(value: string | null | undefined, fallback = FALLBACK_THEME): string {
  const trimmed = value?.trim();
  if (trimmed && /^#([0-9A-F]{3}){1,2}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return fallback;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = sanitizeHexColor(hex).replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  const value = Number.parseInt(expanded, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isArabic(locale: string): boolean {
  return locale.toLowerCase().startsWith("ar");
}

function pickLocalized(
  locale: string,
  english: string | null | undefined,
  arabic: string | null | undefined,
  fallback: string
): string {
  const primary = isArabic(locale) ? arabic : english;
  const secondary = isArabic(locale) ? english : arabic;
  return primary?.trim() || secondary?.trim() || fallback;
}

function formatPrice(priceJod: number, locale: string): string {
  const safeValue = Number.isFinite(priceJod) ? priceJod : 0;
  return `${safeValue.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} JOD`;
}

function formatPeriod(durationMonths: number, locale: string): string {
  if (durationMonths === 12) {
    return isArabic(locale) ? "/\u0633\u0646\u0629" : "/year";
  }

  return isArabic(locale)
    ? `/${durationMonths} \u0623\u0634\u0647\u0631`
    : `/${durationMonths} months`;
}

function formatDurationLabel(durationMonths: number, locale: string): string {
  if (durationMonths === 1) {
    return isArabic(locale) ? "\u0634\u0647\u0631 \u0648\u0627\u062d\u062f" : "1 month";
  }

  if (durationMonths === 12) {
    return isArabic(locale) ? "12 \u0634\u0647\u0631\u0627" : "12 months";
  }

  return isArabic(locale)
    ? `${durationMonths} \u0623\u0634\u0647\u0631`
    : `${durationMonths} months`;
}

function getCopy(locale: string): {
  label: string;
  benefitsTitle: string;
  emptyBenefits: string;
  moreBenefits: (count: number) => string;
  descriptionPlaceholder: string;
  subscribe: string;
  subscribing: string;
  currentPlan: string;
  edit: string;
  disable: string;
  enable: string;
  updating: string;
} {
  if (isArabic(locale)) {
    return {
      label: "\u062e\u0637\u0629 \u0639\u0636\u0648\u064a\u0629",
      benefitsTitle: "\u0627\u0644\u0645\u0632\u0627\u064a\u0627 \u0627\u0644\u0645\u0634\u0645\u0648\u0644\u0629",
      emptyBenefits: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0632\u0627\u064a\u0627 \u0645\u0636\u0627\u0641\u0629 \u0628\u0639\u062f.",
      moreBenefits: (count) => `+${count} \u0627\u0644\u0645\u0632\u064a\u062f`,
      descriptionPlaceholder:
        "\u0623\u0636\u0641 \u0648\u0635\u0641\u0627 \u0642\u0635\u064a\u0631\u0627 \u0644\u0644\u062e\u0637\u0629 \u0644\u0645\u0633\u0627\u0639\u062f\u0629 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0639\u0644\u0649 \u0641\u0647\u0645 \u0627\u0644\u0639\u0631\u0636.",
      subscribe: "\u0627\u0634\u062a\u0631\u0643",
      subscribing: "\u062c\u0627\u0631\u064d \u0627\u0644\u0625\u0631\u0633\u0627\u0644...",
      currentPlan: "\u0627\u0644\u062e\u0637\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629",
      edit: "\u062a\u0639\u062f\u064a\u0644",
      disable: "\u062a\u0639\u0637\u064a\u0644",
      enable: "\u062a\u0641\u0639\u064a\u0644",
      updating: "\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u062f\u064a\u062b..."
    };
  }

  return {
    label: "MEMBERSHIP PLAN",
    benefitsTitle: "INCLUDED BENEFITS",
    emptyBenefits: "No benefits configured yet.",
    moreBenefits: (count) => `+${count} more`,
    descriptionPlaceholder: "Add a short plan description to help customers understand the offer.",
    subscribe: "Subscribe",
    subscribing: "Submitting...",
    currentPlan: "Current plan",
    edit: "Edit",
    disable: "Disable",
    enable: "Enable",
    updating: "Updating..."
  };
}

export function PlanCard({
  plan,
  locale,
  variant,
  highlighted = false,
  subscribeLabel,
  subscribeDisabled = false,
  subscribeBusy = false,
  toggleBusy = false,
  onSubscribe,
  onEdit,
  onToggleActive
}: Props): React.ReactElement {
  const themeColor = sanitizeHexColor(plan.themeColor);
  const copy = getCopy(locale);
  const activeBenefits = plan.benefits.filter((benefit) => benefit.isActive !== false);
  const visibleBenefits = activeBenefits.slice(0, 3);
  const hiddenBenefitsCount = Math.max(activeBenefits.length - visibleBenefits.length, 0);
  const description = pickLocalized(
    locale,
    plan.descriptionEn,
    plan.descriptionAr,
    copy.descriptionPlaceholder
  );
  const name = pickLocalized(locale, plan.nameEn, plan.nameAr, plan.tier);

  const cardStyle: CSSProperties = {
    borderColor: highlighted ? hexToRgba(themeColor, 0.38) : "rgba(148, 163, 184, 0.18)",
    boxShadow: highlighted
      ? `0 0 0 1px ${hexToRgba(themeColor, 0.18)}, 0 24px 70px -38px rgba(15, 23, 42, 0.38)`
      : "0 24px 70px -38px rgba(15, 23, 42, 0.24)"
  };

  const headerStyle: CSSProperties = {
    background: `
      radial-gradient(circle at top left, ${hexToRgba(themeColor, 0.34)}, transparent 38%),
      linear-gradient(145deg, ${hexToRgba(themeColor, 0.16)}, rgba(15, 23, 42, 0.92) 60%)
    `
  };

  const badgeStyle: CSSProperties = {
    background: hexToRgba(themeColor, 0.16),
    borderColor: hexToRgba(themeColor, 0.45),
    color: themeColor
  };

  const benefitIconStyle: CSSProperties = {
    background: hexToRgba(themeColor, 0.18),
    color: themeColor
  };

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-[28px] border bg-white transition duration-200 ${
        variant === "preview" ? "" : "hover:-translate-y-1"
      }`}
      style={cardStyle}
    >
      <div className="relative overflow-hidden p-5" style={headerStyle}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_42%)]" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <span
              className="inline-flex rounded-full border px-3 py-1 text-[11px] font-bold tracking-[0.24em]"
              style={badgeStyle}
            >
              {plan.tier}
            </span>
            <span className="text-xs font-semibold text-white/70">
              {formatDurationLabel(plan.durationMonths, locale)}
            </span>
          </div>

          <div className="mt-6">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/60">
              {copy.label}
            </div>
            <div className="mt-2 font-heading text-2xl font-bold text-white">{name}</div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="text-white">
                <span className="text-3xl font-bold">{formatPrice(plan.priceJod, locale)}</span>
                <span className="ml-2 text-sm font-medium text-white/70">
                  {formatPeriod(plan.durationMonths, locale)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="min-h-[72px] text-sm leading-relaxed text-slate-500">{description}</div>

        <div className="mt-5 flex-1 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            {copy.benefitsTitle}
          </div>
          <div className="mt-3 space-y-3">
            {visibleBenefits.length ? (
              visibleBenefits.map((benefit, index) => (
                <div key={benefit.id ?? `${benefit.code}-${index}`} className="flex items-start gap-3">
                  <span
                    className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
                    style={benefitIconStyle}
                  >
                    {"\u2713"}
                  </span>
                  <div className="text-sm font-semibold text-slate-900">
                    {pickLocalized(locale, benefit.titleEn, benefit.titleAr, `Benefit ${index + 1}`)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">{copy.emptyBenefits}</div>
            )}

            {hiddenBenefitsCount > 0 ? (
              <div className="pl-8 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {copy.moreBenefits(hiddenBenefitsCount)}
              </div>
            ) : null}
          </div>
        </div>

        {variant === "customer" ? (
          <div className="mt-5">
            <button
              type="button"
              onClick={onSubscribe}
              disabled={subscribeDisabled || subscribeBusy}
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {subscribeBusy ? copy.subscribing : subscribeLabel ?? copy.subscribe}
            </button>
          </div>
        ) : null}

        {variant === "admin" ? (
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {copy.edit}
            </button>
            <button
              type="button"
              onClick={onToggleActive}
              disabled={toggleBusy}
              className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {toggleBusy ? copy.updating : plan.isActive === false ? copy.enable : copy.disable}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
