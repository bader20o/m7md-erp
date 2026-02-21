"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PlanItem = {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  price: string;
  durationDays: number;
  entitlements: Array<{
    serviceId: string;
    serviceNameEn: string;
    serviceNameAr: string;
    totalUses: number;
  }>;
};

type OrderServiceUsage = {
  serviceId: string;
  serviceNameEn: string;
  serviceNameAr: string;
  totalUses: number;
  usedCount: number;
};

type OrderItem = {
  id: string;
  status: string;
  planNameEn: string;
  planNameAr: string;
  priceSnapshot: string;
  startDate: string | null;
  endDate: string | null;
  services: OrderServiceUsage[];
};

type Props = {
  locale: string;
  plans: PlanItem[];
  orders: OrderItem[];
};

type ApiErrorPayload = {
  error?: { message?: string };
};

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

export function CustomerMembershipsManager({ locale, plans, orders }: Props): React.ReactElement {
  const router = useRouter();
  const [buyLoadingId, setBuyLoadingId] = useState<string | null>(null);
  const activeOrders = useMemo(() => orders.filter((order) => order.status === "ACTIVE"), [orders]);
  const [orderId, setOrderId] = useState(activeOrders[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(activeOrders[0]?.services[0]?.serviceId ?? "");
  const [bookingId, setBookingId] = useState("");
  const [note, setNote] = useState("");
  const [usingEntitlement, setUsingEntitlement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedOrder = activeOrders.find((order) => order.id === orderId);

  function onOrderChange(nextOrderId: string): void {
    setOrderId(nextOrderId);
    const nextOrder = activeOrders.find((item) => item.id === nextOrderId);
    setServiceId(nextOrder?.services[0]?.serviceId ?? "");
  }

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

    setSuccess("Membership purchased.");
    router.refresh();
  }

  async function useEntitlement(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!orderId || !serviceId) {
      setError("Select an active order and service.");
      return;
    }

    setUsingEntitlement(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = { serviceId };
    if (bookingId.trim()) payload.bookingId = bookingId.trim();
    if (note.trim()) payload.note = note.trim();

    const response = await fetch(`/api/memberships/orders/${orderId}/use-entitlement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = (await response.json()) as unknown;
    setUsingEntitlement(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to use entitlement."));
      return;
    }

    setBookingId("");
    setNote("");
    setSuccess("Entitlement usage recorded.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-semibold">{locale === "ar" ? "Membership Plans" : "Membership Plans"}</h1>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {plans.map((plan) => (
            <article key={plan.id} className="rounded-lg border border-slate-200 p-3">
              <h2 className="font-semibold">{locale === "ar" ? plan.nameAr : plan.nameEn}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {locale === "ar" ? plan.descriptionAr : plan.descriptionEn}
              </p>
              <p className="mt-1 text-sm text-brand-700">
                ${plan.price} • {plan.durationDays} days
              </p>
              <ul className="mt-2 grid gap-1 text-xs text-slate-600">
                {plan.entitlements.map((entitlement) => (
                  <li key={`${plan.id}_${entitlement.serviceId}`}>
                    {locale === "ar" ? entitlement.serviceNameAr : entitlement.serviceNameEn}: {entitlement.totalUses} uses
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => buyPlan(plan.id)}
                disabled={buyLoadingId === plan.id}
                className="mt-3 rounded-md bg-brand-700 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-70"
              >
                {buyLoadingId === plan.id ? "Purchasing..." : "Purchase"}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{locale === "ar" ? "My Membership Orders" : "My Membership Orders"}</h2>
        <div className="mt-3 grid gap-3">
          {orders.map((order) => (
            <article key={order.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{locale === "ar" ? order.planNameAr : order.planNameEn}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{order.status}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">Order: {order.id}</p>
              <p className="text-xs text-slate-600">Price Snapshot: ${order.priceSnapshot}</p>
              <p className="text-xs text-slate-600">
                Period: {order.startDate ? new Date(order.startDate).toLocaleDateString() : "-"} -{" "}
                {order.endDate ? new Date(order.endDate).toLocaleDateString() : "-"}
              </p>
              <ul className="mt-2 grid gap-1 text-xs text-slate-600">
                {order.services.map((service) => (
                  <li key={`${order.id}_${service.serviceId}`}>
                    {locale === "ar" ? service.serviceNameAr : service.serviceNameEn}: {service.usedCount}/{service.totalUses}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Use Entitlement</h2>
        {activeOrders.length ? (
          <form onSubmit={useEntitlement} className="mt-3 grid gap-3 md:grid-cols-2">
            <select
              value={orderId}
              onChange={(event) => onOrderChange(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {activeOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {locale === "ar" ? order.planNameAr : order.planNameEn} ({order.id})
                </option>
              ))}
            </select>
            <select
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {(selectedOrder?.services ?? []).map((service) => (
                <option key={`${selectedOrder?.id}_${service.serviceId}`} value={service.serviceId}>
                  {locale === "ar" ? service.serviceNameAr : service.serviceNameEn} ({service.usedCount}/{service.totalUses})
                </option>
              ))}
            </select>
            <input
              value={bookingId}
              onChange={(event) => setBookingId(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Booking ID (optional)"
            />
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Note (optional)"
            />
            <button
              type="submit"
              disabled={usingEntitlement}
              className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70 md:col-span-2"
            >
              {usingEntitlement ? "Submitting..." : "Use Entitlement"}
            </button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No active membership orders found.</p>
        )}
      </section>
    </div>
  );
}

