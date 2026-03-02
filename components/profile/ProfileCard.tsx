"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { AvatarCropperModal } from "./AvatarCropperModal";
import { getInitials } from "@/lib/utils/string";

type ProfileCardProps = {
    user: {
        fullName: string | null;
        phone: string;
        role: string;
        avatarUrl: string | null;
    };
    onAvatarSave: (fileUrl: string) => Promise<void>;
    canEditAvatar?: boolean;
};

export function ProfileCard({ user, onAvatarSave, canEditAvatar = true }: ProfileCardProps): React.ReactElement {
    const [isCropperOpen, setCropperOpen] = useState(false);
    const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const displayName = user.fullName || user.phone;
    const initials = getInitials(user.fullName, user.phone);
    const displayAvatar = user.avatarUrl;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener("load", () => {
                setTempImageSrc(reader.result?.toString() || null);
                setCropperOpen(true);
            });
            reader.readAsDataURL(file);

            // Reset input so choosing the same file again triggers onChange
            e.target.value = "";
        }
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        try {
            setIsUploading(true);

            const formData = new FormData();
            formData.append("file", croppedBlob, "avatar.jpg");

            const response = await fetch("/api/uploads/local", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();
            if (data.url) {
                await onAvatarSave(data.url);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to upload avatar");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col items-center">
                    <div className="group relative">
                        <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-3xl font-bold text-brand-800 ring-4 ring-white shadow-md">
                            {displayAvatar ? (
                                <img
                                    src={displayAvatar}
                                    alt={`${displayName}'s avatar`}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                initials
                            )}
                            {isUploading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white backdrop-blur-sm">
                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                </div>
                            )}
                        </div>

                        {canEditAvatar ? (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                aria-label="Upload profile photo"
                                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg ring-2 ring-white transition hover:bg-slate-800 hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                            >
                                <Camera size={14} />
                            </button>
                        ) : null}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                    </div>

                    <h2 className="mt-4 text-xl font-bold text-slate-900">{displayName}</h2>
                    <span className="mt-1 inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
                        {user.role}
                    </span>
                    <p className="mt-2 text-sm text-slate-500" dir="ltr">{user.phone}</p>
                    {!canEditAvatar ? (
                        <p className="mt-2 text-center text-xs text-slate-500">
                            Profile photo changes are managed by an admin.
                        </p>
                    ) : null}
                </div>
            </article>

            <AvatarCropperModal
                isOpen={isCropperOpen}
                onClose={() => {
                    setCropperOpen(false);
                    setTempImageSrc(null);
                }}
                imageSrc={tempImageSrc}
                onCropComplete={handleCropComplete}
            />
        </>
    );
}
