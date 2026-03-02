"use client";

import { useState } from "react";
import { Loader2, FileText, UserRound } from "lucide-react";

type PersonalDetailsCardProps = {
    user: {
        role: string;
        fullName: string | null;
        phone: string;
        governorate?: string | null;
        city?: string | null;
        address?: string | null;
        carCompany?: string | null;
        carType?: string | null;
        carModel?: string | null;
        carYear?: string | null;
        licensePlate?: string | null;
        bio?: string | null;
        preferredContact?: "CALL" | "WHATSAPP" | null;
        jobTitle?: string | null;
        permissions?: string[];
    };
    onSave: (data: any) => Promise<void>;
};

const GOVERNORATES = [
    "Amman", "Zarqa", "Irbid", "Aqaba", "Mafraq", "Jerash",
    "Madaba", "Balqa", "Karak", "Tafileh", "Maan", "Ajloun"
];

const CAR_YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - i));

export function PersonalDetailsCard({ user, onSave }: PersonalDetailsCardProps): React.ReactElement {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isEmployee = user.role === "EMPLOYEE";
    const isCustomer = user.role === "CUSTOMER";
    const isAdmin = user.role === "ADMIN";
    const canEditProfile = !isEmployee;

    // Form State
    const [formData, setFormData] = useState({
        fullName: user.fullName || "",
        governorate: user.governorate || "",
        city: user.city || "",
        address: user.address || "",
        carCompany: user.carCompany || "",
        carType: user.carType || "",
        carModel: user.carModel || "",
        carYear: user.carYear || "",
        licensePlate: user.licensePlate || "",
        preferredContact: user.preferredContact || "",
        bio: user.bio || "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            await onSave(formData);
        } catch (err) {
            console.error(err);
            alert("Failed to save personal details.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex h-full flex-col">
            <div className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                <UserRound className="text-slate-500" size={20} />
                <h3 className="text-lg font-semibold text-slate-900">Personal Details</h3>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

                    {/* Common Fields */}
                    <div className="sm:col-span-2 md:col-span-1">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
                        <input
                            type="text"
                            name="fullName"
                            value={formData.fullName}
                            onChange={handleChange}
                            disabled={!canEditProfile}
                            className="w-full h-10 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-500"
                        />
                    </div>

                    <div className="sm:col-span-2 md:col-span-1">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                        <input
                            type="text"
                            value={user.phone}
                            disabled
                            className="w-full h-10 rounded-md border border-slate-300 px-3 py-2 text-sm bg-slate-50 text-slate-500"
                        />
                    </div>

                    {/* Customer Specific Fields */}
                    {isCustomer && (
                        <>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Governorate</label>
                                <select
                                    name="governorate"
                                    value={formData.governorate}
                                    onChange={handleChange}
                                    className="w-full h-10 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                >
                                    <option value="">Select Governorate</option>
                                    {GOVERNORATES.map((g) => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">City</label>
                                <input
                                    type="text"
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                    className="w-full h-10 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="mb-1 block text-sm font-medium text-slate-700">Address (Optional)</label>
                                <input
                                    type="text"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    className="w-full h-10 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Car Company (e.g. Toyota)</label>
                                <input
                                    type="text"
                                    name="carCompany"
                                    value={formData.carCompany}
                                    onChange={handleChange}
                                    className="w-full h-10 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Car Type (e.g. Camry)</label>
                                <select
                                    name="carType"
                                    value={formData.carType}
                                    onChange={handleChange}
                                    className="w-full h-10 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                >
                                    <option value="">Select Type</option>
                                    <option value="EV">Electric Vehicle (EV)</option>
                                    <option value="HYBRID">Hybrid</option>
                                    <option value="GAS">Gas / Petrol</option>
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Car Model (e.g. SE)</label>
                                <input
                                    type="text"
                                    name="carModel"
                                    value={formData.carModel}
                                    onChange={handleChange}
                                    className="w-full h-10 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Car Year (e.g. 2018)</label>
                                <select
                                    name="carYear"
                                    value={formData.carYear}
                                    onChange={handleChange}
                                    className="w-full h-10 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                >
                                    <option value="">Select Year</option>
                                    {CAR_YEARS.map((y) => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">License Plate (Optional)</label>
                                <input
                                    type="text"
                                    name="licensePlate"
                                    value={formData.licensePlate}
                                    onChange={handleChange}
                                    className="w-full h-10 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Preferred Contact</label>
                                <select
                                    name="preferredContact"
                                    value={formData.preferredContact}
                                    onChange={handleChange}
                                    className="w-full h-10 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                >
                                    <option value="">Any</option>
                                    <option value="CALL">Call</option>
                                    <option value="WHATSAPP">WhatsApp</option>
                                </select>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="mb-1 block text-sm font-medium text-slate-700">Notes / Bio</label>
                                <textarea
                                    name="bio"
                                    value={formData.bio}
                                    onChange={handleChange}
                                    rows={3}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                                />
                            </div>
                        </>
                    )}

                    {/* Employee Specific Fields */}
                    {(isEmployee || isAdmin) && user.jobTitle && (
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-slate-700">Job Title</label>
                            <input
                                type="text"
                                value={user.jobTitle}
                                disabled
                                className="w-full h-10 rounded-md border border-slate-300 px-3 py-2 text-sm bg-slate-50 text-slate-500"
                            />
                        </div>
                    )}

                    {(isEmployee || isAdmin) && user.permissions && user.permissions.length > 0 && (
                        <div className="sm:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-slate-700">Permissions</label>
                            <div className="flex flex-wrap gap-2">
                                {user.permissions.map((p) => (
                                    <span key={p} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
                                        {p}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Form Actions - Pushed to bottom right */}
                <div className="mt-auto pt-6 flex justify-end">
                    {canEditProfile ? (
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:pointer-events-none disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <FileText size={16} />
                                    <span>Save Profile</span>
                                </>
                            )}
                        </button>
                    ) : (
                        <p className="text-sm text-slate-500">
                            Employee profile information is managed by an admin.
                        </p>
                    )}
                </div>
            </form>
        </article>
    );
}
