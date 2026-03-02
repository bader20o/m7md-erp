"use client";

import React, { InputHTMLAttributes, forwardRef, useState, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";

export interface ColorInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
    value?: string;
    onColorChange?: (hex: string) => void;
}

const PRESET_COLORS = [
    "#f87171", "#fb923c", "#fbbf24", "#a3e635", "#4ade80",
    "#34d399", "#2dd4bf", "#38bdf8", "#60a5fa", "#818cf8",
    "#a78bfa", "#c084fc", "#e879f9", "#f472b6", "#fb7185",
    "#64748b", "#78716c", "#0f766e", "#3730a3", "#be123c"
];

export const ColorInput = forwardRef<HTMLInputElement, ColorInputProps>(
    ({ className = "", value = "#3B82F6", onChange, onColorChange, ...props }, ref) => {
        const [hex, setHex] = useState(value);
        const [isValid, setIsValid] = useState(true);
        const [isOpen, setIsOpen] = useState(false);

        useEffect(() => {
            if (value) {
                setHex(String(value));
            }
        }, [value]);

        const validateHex = (v: string) => {
            return /^#([0-9A-F]{3}){1,2}$/i.test(v);
        };

        const handleHexChange = (val: string) => {
            let formatted = val.trim();
            if (formatted.length > 0 && !formatted.startsWith("#")) {
                formatted = "#" + formatted;
            }
            setHex(formatted);

            const valid = validateHex(formatted);
            setIsValid(valid || formatted === "");

            // Simulate event
            if (onChange) {
                const e = {
                    target: { value: formatted, name: props.name }
                } as React.ChangeEvent<HTMLInputElement>;
                onChange(e);
            }
            if (valid && onColorChange) onColorChange(formatted);
        };

        return (
            <div className="relative flex flex-col w-full">
                <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
                    <div className={`flex items-center w-full bg-slate-50 dark:bg-slate-900 border rounded-lg transition-all focus-within:ring-2 focus-within:ring-brand-500/50 ${isValid ? "border-slate-200 dark:border-slate-800" : "border-red-500/50 dark:border-red-500/50"} ${className}`}>
                        <input
                            type="text"
                            ref={ref}
                            value={hex}
                            onChange={(e) => handleHexChange(e.target.value)}
                            placeholder="#RRGGBB"
                            className="flex-1 bg-transparent px-4 py-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none uppercase"
                            {...props}
                        />

                        <Popover.Trigger asChild>
                            <div className="relative flex items-center justify-center p-2 ltr:border-l rtl:border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-r-lg">
                                <div
                                    className="w-6 h-6 rounded-md shadow-sm border border-slate-200/50 dark:border-slate-800/50 overflow-hidden"
                                    style={{ backgroundColor: isValid ? hex : "transparent" }}
                                    title="Pick a color"
                                />
                            </div>
                        </Popover.Trigger>
                    </div>

                    <Popover.Portal>
                        <Popover.Content
                            align="end"
                            sideOffset={4}
                            className="z-50 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-xl outline-none shadow-brand-900/10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
                        >
                            <div className="mb-3">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">
                                    Preset Colors
                                </label>
                                <div className="grid grid-cols-5 gap-2">
                                    {PRESET_COLORS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => {
                                                handleHexChange(c);
                                                setIsOpen(false);
                                            }}
                                            className="w-8 h-8 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 hover:scale-110 transition-transform"
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">
                                    Custom Hex
                                </label>
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-8 h-8 rounded-md shadow-inner border border-slate-200 flex-shrink-0"
                                        style={{ backgroundColor: isValid ? hex : "transparent" }}
                                    />
                                    <input
                                        type="text"
                                        value={hex}
                                        onChange={(e) => handleHexChange(e.target.value)}
                                        className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-1.5 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand-500/50 shadow-sm"
                                    />
                                </div>
                            </div>
                        </Popover.Content>
                    </Popover.Portal>

                </Popover.Root>

                {!isValid && hex.length > 0 && (
                    <span className="text-[10px] text-red-500 mt-1 ltr:ml-1 rtl:mr-1 absolute -bottom-5">Invalid hex color</span>
                )}
            </div>
        );
    }
);
ColorInput.displayName = "ColorInput";
