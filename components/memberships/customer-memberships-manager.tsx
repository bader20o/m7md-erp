"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlanCard,
  type PlanCardBenefit,
  type PlanCardPlan
} from "@/components/memberships/PlanCard";

type SubscriptionBenefit = PlanCardBenefit & {
  usedCount: number;
  remainingCount: number;
  locked: boolean;
};

type CurrentSubscription = {
  id: string;
  status: string;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  expiresAt: string | null;
  startDate: string | null;
  endDate: string | null;
  rejectionReason: string | null;
  priceSnapshot: number;
  plan: PlanCardPlan;
  benefitUsageSummary: {
    used: number;
    total: number;
  };
  benefits: SubscriptionBenefit[];
};

type Props = {
  locale: string;
  plans: PlanCardPlan[];
  currentSubscription: CurrentSubscription | null;
};

type ApiErrorPayload = {
  error?: { message?: string };
};

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

function isArabic(locale: string): boolean {
  return locale.toLowerCase().startsWith("ar");
}

function pickLocalized(locale: string, english: string | null | undefined, arabic: string | null | undefined, fallback: string): string {
  const primary = isArabic(locale) ? arabic : english;
  const secondary = isArabic(locale) ? english : arabic;
  return primary?.trim() || secondary?.trim() || fallback;
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatMoney(value: number, locale: string): string {
  return `${value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} JOD`;
}

function getCopy(locale: string): {
  pageTitle: string;
  pageDescription: string;
  currentTitle: string;
  availableTitle: string;
  noPlans: string;
  subscribe: string;
  currentPlan: string;
  pendingPlan: string;
  status: string;
  requested: string;
  activated: string;
  validUntil: string;
  amount: string;
  usage: string;
  rejectionReason: string;
  noMembership: string;
  noMembershipDetail: string;
  activeBanner: string;
  pendingBanner: string;
  rejectedBanner: string;
  expiredBanner: string;
} {
  if (isArabic(locale)) {
    return {
      pageTitle: "العضويات",
      pageDescription: "نفس بطاقة الخطة تعرض الخطط المتاحة وحالة اشتراكك الحالية.",
      currentTitle: "بطاقتك الحالية",
      availableTitle: "الخطط المتاحة",
      noPlans: "لا توجد خطط متاحة حاليا.",
      subscribe: "اشترك",
      currentPlan: "الخطة الحالية",
      pendingPlan: "قيد المراجعة",
      status: "الحالة",
      requested: "تاريخ الطلب",
      activated: "تاريخ التفعيل",
      validUntil: "صالحة حتى",
      amount: "السعر",
      usage: "الاستخدام",
      rejectionReason: "سبب الرفض",
      noMembership: "لا توجد عضوية نشطة بعد",
      noMembershipDetail: "يمكنك استعراض الخطط المتاحة وإرسال طلب اشتراك من نفس البطاقة.",
      activeBanner: "اشتراكك مفعل حاليا.",
      pendingBanner: "طلب العضوية قيد مراجعة الإدارة.",
      rejectedBanner: "تم رفض آخر طلب عضوية.",
      expiredBanner: "هذه البطاقة تعرض آخر حالة عضوية مسجلة."
    };
  }

  return {
    pageTitle: "Memberships",
    pageDescription: "The same plan card design is used for available plans and your current subscription state.",
    currentTitle: "Your Current Card",
    availableTitle: "Available Plans",
    noPlans: "No membership plans are available right now.",
    subscribe: "Subscribe",
    currentPlan: "Current plan",
    pendingPlan: "Pending review",
    status: "Status",
    requested: "Requested",
    activated: "Activated",
    validUntil: "Valid until",
    amount: "Amount",
    usage: "Usage",
    rejectionReason: "Rejection reason",
    noMembership: "No active membership yet",
    noMembershipDetail: "Browse the available plans and submit a subscription request directly from the card.",
    activeBanner: "Your membership is currently active.",
    pendingBanner: "Your membership request is waiting for admin approval.",
    rejectedBanner: "Your latest membership request was rejected.",
    expiredBanner: "This card shows your most recent membership status."
  };
}

function getStatusPresentation(status: string, locale: string): {
  label: string;
  message: string;
  className: string;
} {
  const copy = getCopy(locale);

  if (status === "ACTIVE") {
    return {
      label: "ACTIVE",
      message: copy.activeBanner,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700"
    };
  }

  if (status === "PENDING") {
    return {
      label: "PENDING",
      message: copy.pendingBanner,
      className: "border-amber-200 bg-amber-50 text-amber-700"
    };
  }

  if (status === "REJECTED") {
    return {
      label: "REJECTED",
      message: copy.rejectedBanner,
      className: "border-rose-200 bg-rose-50 text-rose-700"
    };
  }

  return {
    label: status,
    message: copy.expiredBanner,
    className: "border-slate-200 bg-slate-50 text-slate-700"
  };
}

export function CustomerMembershipsManager({
  locale,
  plans,
  currentSubscription
}: Props): React.ReactElement {
  const router = useRouter();
  const [buyLoadingId, setBuyLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const copy = getCopy(locale);
  const currentPlanId = currentSubscription?.plan.id ?? null;

  async function buyPlan(planId: string): Promise<void> {
    setBuyLoadingId(planId);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/memberships/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId })
    });
    const json = (await response.json()) as unknown;
    setBuyLoadingId(null);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to purchase membership."));
      return;
    }

    setSuccess(isArabic(locale) ? "تم إرسال طلب العضوية." : "Membership request submitted.");
    router.refresh();
  }

  const statusPresentation = currentSubscription
    ? getStatusPresentation(currentSubscription.status, locale)
    : null;

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.28)] md:p-6">
        <h1 className="text-2xl font-semibold text-slate-950">{copy.pageTitle}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">{copy.pageDescription}</p>
      </section>

      {currentSubscription ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.28)] md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">{copy.currentTitle}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {pickLocalized(
                  locale,
                  currentSubscription.plan.nameEn,
                  currentSubscription.plan.nameAr,
                  currentSubscription.plan.tier
                )}
              </p>
            </div>
            {statusPresentation ? (
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusPresentation.className}`}>
                {statusPresentation.label}
              </span>
            ) : null}
          </div>

          {statusPresentation ? (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${statusPresentation.className}`}>
              {statusPresentation.message}
            </div>
          ) : null}

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            <PlanCard
              plan={currentSubscription.plan}
              locale={locale}
              variant="customer"
              highlighted={currentSubscription.status === "ACTIVE"}
              subscribeLabel={
                currentSubscription.status === "ACTIVE" ? copy.currentPlan : copy.pendingPlan
              }
              subscribeDisabled
            />

            <div className="grid gap-3 content-start sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.status}</div>
                <p className="mt-2 text-lg font-semibold text-slate-950">{currentSubscription.status}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.amount}</div>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatMoney(currentSubscription.priceSnapshot, locale)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.requested}</div>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatDate(currentSubscription.requestedAt, locale)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.activated}</div>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatDate(currentSubscription.approvedAt ?? currentSubscription.startDate, locale)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.validUntil}</div>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatDate(currentSubscription.expiresAt ?? currentSubscription.endDate, locale)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.usage}</div>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {currentSubscription.benefitUsageSummary.used}/{currentSubscription.benefitUsageSummary.total}
                </p>
              </div>
              {currentSubscription.rejectionReason ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">{copy.rejectionReason}</div>
                  <p className="mt-2 text-sm text-rose-700">{currentSubscription.rejectionReason}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white px-5 py-8 text-center shadow-[0_24px_70px_-44px_rgba(15,23,42,0.18)] md:px-6">
          <h2 className="text-xl font-semibold text-slate-950">{copy.noMembership}</h2>
          <p className="mt-2 text-sm text-slate-500">{copy.noMembershipDetail}</p>
        </section>
      )}

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.28)] md:p-6">
        <h2 className="text-xl font-semibold text-slate-950">{copy.availableTitle}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlanId === plan.id;
            const isSubmitting = buyLoadingId === plan.id;

            return (
              <PlanCard
                key={plan.id}
                plan={plan}
                locale={locale}
                variant="customer"
                highlighted={currentSubscription?.status === "ACTIVE" && isCurrentPlan}
                subscribeBusy={isSubmitting}
                subscribeDisabled={isCurrentPlan && currentSubscription?.status === "ACTIVE"}
                subscribeLabel={isCurrentPlan && currentSubscription?.status === "ACTIVE" ? copy.currentPlan : copy.subscribe}
                onSubscribe={() => {
                  if (!plan.id) return;
                  void buyPlan(plan.id);
                }}
              />
            );
          })}
        </div>
        {plans.length === 0 ? <p className="mt-4 text-sm text-slate-500">{copy.noPlans}</p> : null}
      </section>
    </div>
  );
}
