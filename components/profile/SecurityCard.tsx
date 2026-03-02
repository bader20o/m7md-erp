"use client";

import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";

export function SecurityCard(): React.ReactElement {
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);

        if (newPassword !== confirmPassword) {
            setErrorMsg("New password and confirm password do not match");
            return;
        }

        if (newPassword.length < 8) {
            setErrorMsg("New password must be at least 8 characters long");
            return;
        }

        try {
            setIsSubmitting(true);
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "change_password",
                    oldPassword,
                    newPassword,
                    confirmPassword,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || "Failed to change password");
            }

            setSuccessMsg("Password updated successfully!");
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                <ShieldCheck className="text-slate-500" size={20} />
                <h3 className="text-lg font-semibold text-slate-900">Security</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                    <div className="rounded-md bg-red-50 p-3 text-sm font-medium text-red-800">
                        {errorMsg}
                    </div>
                )}
                {successMsg && (
                    <div className="rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                        {successMsg}
                    </div>
                )}

                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Current Password</label>
                    <input
                        type="password"
                        required
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="w-full h-10 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">New Password</label>
                    <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full h-10 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Confirm Password</label>
                    <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full h-10 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || !oldPassword || !newPassword || !confirmPassword}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:pointer-events-none disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="animate-spin" size={16} />
                            <span>Updating...</span>
                        </>
                    ) : (
                        <span>Change Password</span>
                    )}
                </button>
            </form>
        </article>
    );
}
