"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  locale: string;
  className?: string;
  label?: string;
};

export function LogoutButton({ locale, className, label }: Props): React.ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout(): Promise<void> {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
    } finally {
      router.refresh();
      router.replace(`/${locale}/login`);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => {
        void handleLogout();
      }}
      disabled={loading}
      className={className}
    >
      {loading ? "..." : label ?? "Logout"}
    </button>
  );
}
