"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { SecurityCard } from "@/components/profile/SecurityCard";
import { PersonalDetailsCard } from "@/components/profile/PersonalDetailsCard";

export default function ProfileClientPage() {
    const t = useTranslations();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const canEmployeeEditProfile = user?.role !== "EMPLOYEE";

    const fetchProfile = async () => {
        try {
            const res = await fetch("/api/profile", { credentials: "include" });
            if (!res.ok) throw new Error("Failed to load profile");
            const data = await res.json();
            setUser(data.data?.user || data.user);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const handleAvatarSave = async (avatarUrl: string) => {
        if (!canEmployeeEditProfile) {
            return;
        }

        try {
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ action: "update_profile", avatarUrl }),
            });
            if (!res.ok) throw new Error("Failed to update avatar");
            // Update local state to show new avatar instantly
            setUser((prev: any) => ({ ...prev, avatarUrl }));
            // Optional: Dispatch a custom event to notify other components (e.g., AppShell)
            window.dispatchEvent(new CustomEvent("profile-updated", { detail: { avatarUrl } }));
        } catch (err) {
            console.error(err);
            alert("Failed to save avatar.");
        }
    };

    const handlePersonalDetailsSave = async (formData: any) => {
        if (!canEmployeeEditProfile) {
            throw new Error("Employee profile information is managed by an admin.");
        }

        try {
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ action: "update_profile", ...formData }),
            });
            if (!res.ok) throw new Error("Failed to update profile");
            await fetchProfile(); // Reload full profile to ensure consistency
        } catch (err) {
            console.error(err);
            throw err; // Let the card handle the error display
        }
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-700"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
                Failed to load profile data.
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">{t("menuProfile")}</h1>

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                {/* Left Column - Fixed Width */}
                <div className="flex w-full shrink-0 flex-col gap-6 lg:w-[340px]">
                    <ProfileCard user={user} onAvatarSave={handleAvatarSave} canEditAvatar={canEmployeeEditProfile} />
                    <SecurityCard />
                </div>

                {/* Right Column - Flex */}
                <div className="flex min-w-0 flex-1 flex-col">
                    <PersonalDetailsCard user={user} onSave={handlePersonalDetailsSave} />
                </div>
            </div>
        </div>
    );
}
