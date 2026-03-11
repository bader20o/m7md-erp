"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm({ locale }: { locale: string }): React.ReactElement {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password })
    });

    const json = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(json?.error?.message ?? "Login failed.");
      return;
    }

    router.push(`/${locale}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border border-brand-100 bg-white p-4 shadow-[0_20px_60px_-36px_rgba(12,100,74,0.28)] sm:p-6">
      <label className="grid gap-2">
        <span className="text-sm font-medium">Phone</span>
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-3"
          placeholder="0780000000"
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium">Password</span>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          className="rounded-xl border border-slate-300 px-3 py-3"
          required
        />
      </label>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70"
      >
        {loading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
