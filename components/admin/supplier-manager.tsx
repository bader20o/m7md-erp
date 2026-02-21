"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SupplierItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
};

type Props = {
  suppliers: SupplierItem[];
};

type ApiErrorPayload = {
  error?: { message?: string };
};

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

export function SupplierManager({ suppliers }: Props): React.ReactElement {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onCreate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = { name };
    if (phone.trim()) payload.phone = phone.trim();
    if (email.trim()) payload.email = email.trim();
    if (address.trim()) payload.address = address.trim();

    const response = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = (await response.json()) as unknown;
    setLoading(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to create supplier."));
      return;
    }

    setName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setSuccess("Supplier created.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Create Supplier</h2>
        <form onSubmit={onCreate} className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Supplier Name"
            required
          />
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Phone"
          />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Email"
            type="email"
          />
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Address"
          />
          <button
            disabled={loading}
            type="submit"
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70 md:col-span-2"
          >
            {loading ? "Saving..." : "Create"}
          </button>
        </form>
      </section>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Suppliers</h2>
        <div className="mt-3 grid gap-3">
          {suppliers.map((supplier) => (
            <article key={supplier.id} className="rounded-lg border border-slate-200 p-3">
              <h3 className="font-semibold">{supplier.name}</h3>
              <p className="text-xs text-slate-500">{supplier.id}</p>
              <p className="mt-1 text-sm text-slate-600">
                {supplier.phone || "-"} • {supplier.email || "-"}
              </p>
              <p className="text-xs text-slate-600">{supplier.address || "-"}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

