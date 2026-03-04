"use client";

import { useEffect, useState } from "react";
import { PlanCard, type PlanCardPlan } from "@/components/memberships/PlanCard";

type Props = {
  locale: string;
  initialPlans: PlanCardPlan[];
};

type ApiErrorPayload = {
  error?: { message?: string };
};

type PlanForm = {
  tier: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  priceJod: string;
  durationMonths: string;
  themeColor: string;
  imageUrl: string;
  benefits: Array<{
    id?: string;
    code: string;
    titleEn: string;
    titleAr: string;
    descriptionEn: string;
    descriptionAr: string;
    limitCount: string;
    isActive: boolean;
  }>;
};

const TIER_SUGGESTIONS = ["Bronze", "Silver", "Gold", "Platinum", "VIP", "Elite"] as const;
const DURATION_OPTIONS = [1, 3, 6, 12, 24] as const;
const DEFAULT_THEME = "#3B82F6";

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

function createEmptyBenefit(index: number): PlanForm["benefits"][number] {
  return {
    code: `benefit_${index + 1}`,
    titleEn: "",
    titleAr: "",
    descriptionEn: "",
    descriptionAr: "",
    limitCount: "1",
    isActive: true
  };
}

function createEmptyPlanForm(): PlanForm {
  return {
    tier: "",
    nameEn: "",
    nameAr: "",
    descriptionEn: "",
    descriptionAr: "",
    priceJod: "",
    durationMonths: "12",
    themeColor: DEFAULT_THEME,
    imageUrl: "",
    benefits: []
  };
}

function createPlanForm(plan: PlanCardPlan): PlanForm {
  return {
    tier: plan.tier,
    nameEn: plan.nameEn,
    nameAr: plan.nameAr,
    descriptionEn: plan.descriptionEn ?? "",
    descriptionAr: plan.descriptionAr ?? "",
    priceJod: String(plan.priceJod),
    durationMonths: String(plan.durationMonths),
    themeColor: plan.themeColor ?? DEFAULT_THEME,
    imageUrl: plan.imageUrl ?? "",
    benefits: plan.benefits.map((benefit) => ({
      id: benefit.id,
      code: benefit.code,
      titleEn: benefit.titleEn,
      titleAr: benefit.titleAr,
      descriptionEn: benefit.descriptionEn ?? "",
      descriptionAr: benefit.descriptionAr ?? "",
      limitCount: String(benefit.limitCount),
      isActive: benefit.isActive !== false
    }))
  };
}

function createPreviewPlan(form: PlanForm, original?: PlanCardPlan | null): PlanCardPlan {
  return {
    id: original?.id,
    tier: form.tier,
    nameEn: form.nameEn,
    nameAr: form.nameAr,
    descriptionEn: form.descriptionEn || null,
    descriptionAr: form.descriptionAr || null,
    priceJod: Number(form.priceJod) || 0,
    durationMonths: Number(form.durationMonths) || 12,
    themeColor: form.themeColor || DEFAULT_THEME,
    imageUrl: form.imageUrl || null,
    isActive: original?.isActive ?? true,
    benefits: form.benefits.map((benefit) => ({
      id: benefit.id,
      code: benefit.code,
      titleEn: benefit.titleEn,
      titleAr: benefit.titleAr,
      descriptionEn: benefit.descriptionEn || null,
      descriptionAr: benefit.descriptionAr || null,
      limitCount: Number(benefit.limitCount) || 1,
      isActive: benefit.isActive
    }))
  };
}

export function MembershipPlanManager({ locale, initialPlans }: Props): React.ReactElement {
  const [plans, setPlans] = useState(initialPlans);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [form, setForm] = useState<PlanForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setPlans(initialPlans);
  }, [initialPlans]);

  const editingPlan = editingPlanId
    ? plans.find((plan) => plan.id === editingPlanId) ?? null
    : null;

  function openCreate(): void {
    setEditingPlanId(null);
    setIsCreateMode(true);
    setForm(createEmptyPlanForm());
    setError(null);
    setSuccess(null);
  }

  function openEditor(plan: PlanCardPlan): void {
    setEditingPlanId(plan.id ?? null);
    setIsCreateMode(false);
    setForm(createPlanForm(plan));
    setError(null);
    setSuccess(null);
  }

  function closeEditor(): void {
    if (saving) return;
    setEditingPlanId(null);
    setIsCreateMode(false);
    setForm(null);
  }

  function updateForm<K extends keyof PlanForm>(key: K, value: PlanForm[K]): void {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateBenefit(index: number, patch: Partial<PlanForm["benefits"][number]>): void {
    setForm((current) => {
      if (!current) return current;
      const benefits = [...current.benefits];
      benefits[index] = { ...benefits[index], ...patch };
      return { ...current, benefits };
    });
  }

  function addBenefit(): void {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        benefits: [...current.benefits, createEmptyBenefit(current.benefits.length)]
      };
    });
  }

  function removeBenefit(index: number): void {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        benefits: current.benefits.filter((_, currentIndex) => currentIndex !== index)
      };
    });
  }

  async function onToggle(plan: PlanCardPlan): Promise<void> {
    if (!plan.id) return;
    setTogglingId(plan.id);
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/memberships/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !plan.isActive })
    });
    const json = (await response.json()) as { data?: { item?: PlanCardPlan } };
    setTogglingId(null);

    if (!response.ok || !json.data?.item) {
      setError(getErrorMessage(json, "Failed to update plan."));
      return;
    }

    setPlans((current) => current.map((item) => (item.id === plan.id ? json.data!.item! : item)));
    setSuccess(plan.isActive === false ? "Plan enabled." : "Plan disabled.");
  }

  async function onSave(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!form || (!isCreateMode && !editingPlanId)) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      tier: form.tier.trim(),
      nameEn: form.nameEn.trim(),
      nameAr: form.nameAr.trim(),
      descriptionEn: form.descriptionEn.trim() || null,
      descriptionAr: form.descriptionAr.trim() || null,
      price: Number(form.priceJod),
      durationMonths: Number(form.durationMonths),
      color: form.themeColor.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
      benefits: form.benefits.map((benefit) => ({
        id: benefit.id,
        code: benefit.code.trim(),
        titleEn: benefit.titleEn.trim(),
        titleAr: benefit.titleAr.trim(),
        descriptionEn: benefit.descriptionEn.trim() || null,
        descriptionAr: benefit.descriptionAr.trim() || null,
        limitCount: Number(benefit.limitCount),
        isActive: benefit.isActive
      }))
    };

    const response = await fetch(
      isCreateMode ? "/api/memberships/plans" : `/api/memberships/plans/${editingPlanId}`,
      {
        method: isCreateMode ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );
    const json = (await response.json()) as { data?: { item?: PlanCardPlan } };
    setSaving(false);

    if (!response.ok || !json.data?.item) {
      setError(getErrorMessage(json, "Failed to save plan."));
      return;
    }

    setPlans((current) => {
      if (isCreateMode) {
        return [json.data!.item!, ...current.filter((item) => item.id !== json.data!.item!.id)];
      }

      return current.map((item) => (item.id === editingPlanId ? json.data!.item! : item));
    });
    setSuccess(isCreateMode ? "Plan created." : "Plan updated.");
    setEditingPlanId(null);
    setIsCreateMode(false);
    setForm(null);
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.28)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Membership Plans</h2>
            <p className="mt-1 text-sm text-slate-500">
              Edit pricing, copy, colors, and benefits while keeping the same card design used by customers.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              {plans.length} plans
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Create plan
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              locale={locale}
              variant="admin"
              toggleBusy={togglingId === plan.id}
              onEdit={() => openEditor(plan)}
              onToggleActive={() => void onToggle(plan)}
            />
          ))}
        </div>
      </section>

      {form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Plan Editor
                </div>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">
                  {isCreateMode ? "Create membership plan" : "Update membership plan"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={onSave} className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
              <div className="space-y-6">
                <section className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Tier
                    </span>
                    <input
                      value={form.tier}
                      onChange={(event) => updateForm("tier", event.target.value)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                      placeholder="e.g. Elite"
                      required
                    />
                    <div className="flex flex-wrap gap-2">
                      {TIER_SUGGESTIONS.map((tier) => (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => updateForm("tier", tier)}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          {tier}
                        </button>
                      ))}
                    </div>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Theme color
                    </span>
                    <input
                      value={form.themeColor}
                      onChange={(event) => updateForm("themeColor", event.target.value)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                      placeholder="#3B82F6"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Name (EN)
                    </span>
                    <input
                      value={form.nameEn}
                      onChange={(event) => updateForm("nameEn", event.target.value)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                      required
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Name (AR)
                    </span>
                    <input
                      value={form.nameAr}
                      onChange={(event) => updateForm("nameAr", event.target.value)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                      required
                    />
                  </label>

                  <label className="grid gap-2 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Image URL
                    </span>
                    <input
                      value={form.imageUrl}
                      onChange={(event) => updateForm("imageUrl", event.target.value)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                      placeholder="Optional"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Price (JOD)
                    </span>
                    <input
                      value={form.priceJod}
                      onChange={(event) => updateForm("priceJod", event.target.value)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                      inputMode="decimal"
                      min="0"
                      required
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Duration
                    </span>
                    <select
                      value={form.durationMonths}
                      onChange={(event) => updateForm("durationMonths", event.target.value)}
                      className="rounded-2xl border border-slate-300 px-4 py-3"
                    >
                      {DURATION_OPTIONS.map((months) => (
                        <option key={months} value={months}>
                          {months} months
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Description (EN)
                    </span>
                    <textarea
                      value={form.descriptionEn}
                      onChange={(event) => updateForm("descriptionEn", event.target.value)}
                      className="min-h-28 rounded-2xl border border-slate-300 px-4 py-3"
                    />
                  </label>

                  <label className="grid gap-2 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Description (AR)
                    </span>
                    <textarea
                      value={form.descriptionAr}
                      onChange={(event) => updateForm("descriptionAr", event.target.value)}
                      className="min-h-28 rounded-2xl border border-slate-300 px-4 py-3"
                    />
                  </label>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold text-slate-950">Benefits</h4>
                      <p className="mt-1 text-sm text-slate-500">
                        The card shows the first three active benefits and a +N more line when needed.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addBenefit}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Add benefit
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    {form.benefits.map((benefit, index) => (
                      <div
                        key={benefit.id ?? `${benefit.code}-${index}`}
                        className="rounded-[22px] border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">Benefit {index + 1}</p>
                          <button
                            type="button"
                            onClick={() => removeBenefit(index)}
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <label className="grid gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Code
                            </span>
                            <input
                              value={benefit.code}
                              onChange={(event) => updateBenefit(index, { code: event.target.value })}
                              className="rounded-2xl border border-slate-300 px-4 py-3"
                              required
                            />
                          </label>

                          <label className="grid gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Limit count
                            </span>
                            <input
                              value={benefit.limitCount}
                              onChange={(event) =>
                                updateBenefit(index, { limitCount: event.target.value })
                              }
                              className="rounded-2xl border border-slate-300 px-4 py-3"
                              inputMode="numeric"
                              min="1"
                              required
                            />
                          </label>

                          <label className="grid gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Title (EN)
                            </span>
                            <input
                              value={benefit.titleEn}
                              onChange={(event) =>
                                updateBenefit(index, { titleEn: event.target.value })
                              }
                              className="rounded-2xl border border-slate-300 px-4 py-3"
                              required
                            />
                          </label>

                          <label className="grid gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Title (AR)
                            </span>
                            <input
                              value={benefit.titleAr}
                              onChange={(event) =>
                                updateBenefit(index, { titleAr: event.target.value })
                              }
                              className="rounded-2xl border border-slate-300 px-4 py-3"
                              required
                            />
                          </label>

                          <label className="grid gap-2 md:col-span-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Description (EN)
                            </span>
                            <textarea
                              value={benefit.descriptionEn}
                              onChange={(event) =>
                                updateBenefit(index, { descriptionEn: event.target.value })
                              }
                              className="min-h-24 rounded-2xl border border-slate-300 px-4 py-3"
                            />
                          </label>

                          <label className="grid gap-2 md:col-span-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Description (AR)
                            </span>
                            <textarea
                              value={benefit.descriptionAr}
                              onChange={(event) =>
                                updateBenefit(index, { descriptionAr: event.target.value })
                              }
                              className="min-h-24 rounded-2xl border border-slate-300 px-4 py-3"
                            />
                          </label>

                          <label className="inline-flex items-center gap-3 md:col-span-2">
                            <input
                              type="checkbox"
                              checked={benefit.isActive}
                              onChange={(event) =>
                                updateBenefit(index, { isActive: event.target.checked })
                              }
                            />
                            <span className="text-sm font-medium text-slate-700">
                              Benefit is active
                            </span>
                          </label>
                        </div>
                      </div>
                    ))}

                    {form.benefits.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                        No benefits configured yet.
                      </div>
                    ) : null}
                  </div>
                </section>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {saving ? "Saving..." : isCreateMode ? "Create plan" : "Save changes"}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Plan Preview
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    This preview is the same shared card used on the customer and admin memberships pages.
                  </p>
                </div>
                <PlanCard
                  plan={createPreviewPlan(form, editingPlan)}
                  locale={locale}
                  variant="preview"
                  highlighted={(editingPlan?.isActive ?? true) !== false}
                />
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
