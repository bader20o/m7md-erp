"use client";

import React, { InputHTMLAttributes, forwardRef, useState, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { DayPicker } from "react-day-picker";
import * as Popover from "@radix-ui/react-popover";

export interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
    // We can pass value as a string (YYYY-MM-DD)
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
    ({ className = "", value, onChange, ...props }, ref) => {
        const [date, setDate] = useState<Date | undefined>(
            value && typeof value === 'string' && isValid(parseISO(value)) ? parseISO(value) : undefined
        );
        const [isOpen, setIsOpen] = useState(false);

        useEffect(() => {
            if (value && typeof value === 'string') {
                const parsed = parseISO(value);
                if (isValid(parsed)) {
                    setDate(parsed);
                } else {
                    setDate(undefined);
                }
            } else {
                setDate(undefined);
            }
        }, [value]);

        const handleSelect = (selectedDate: Date | undefined) => {
            setDate(selectedDate);
            if (onChange) {
                // Construct a synthetic event mimicking the native behavior
                const event = {
                    target: {
                        value: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
                        name: props.name
                    }
                } as unknown as React.ChangeEvent<HTMLInputElement>;
                onChange(event);
            }
            setIsOpen(false);
        };

        return (
            <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
                <Popover.Trigger asChild>
                    <div className="relative flex items-center w-full cursor-pointer group">
                        {/* The hidden actual input for form submission if needed */}
                        <input
                            type="hidden"
                            ref={ref}
                            value={date ? format(date, "yyyy-MM-dd") : ""}
                            name={props.name}
                            {...props}
                        />

                        <div
                            className={`flex items-center w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 transition-all outline-none focus-within:ring-2 focus-within:ring-brand-500/50 hover:border-brand-500/50 ${className}`}
                            tabIndex={0}
                        >
                            <span className={`flex-1 text-left ${!date ? "text-slate-400" : "text-slate-900 dark:text-slate-100"}`}>
                                {date ? format(date, "MMM dd, yyyy") : props.placeholder || "Select a date"}
                            </span>
                            <CalendarIcon size={18} className="text-slate-500 dark:text-slate-400 group-hover:text-brand-500 transition-colors ltr:ml-2 rtl:mr-2" />
                        </div>
                    </div>
                </Popover.Trigger>

                <Popover.Portal>
                    <Popover.Content
                        align="start"
                        sideOffset={4}
                        className="z-50 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 shadow-xl outline-none shadow-brand-900/10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                    >
                        <DayPicker
                            mode="single"
                            selected={date}
                            onSelect={handleSelect}
                            showOutsideDays
                            className="p-1"
                            classNames={{
                                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                                month: "space-y-4",
                                caption: "flex justify-center pt-1 relative items-center",
                                caption_label: "text-sm font-semibold text-slate-900 dark:text-slate-100",
                                nav: "space-x-1 flex items-center",
                                nav_button: "h-7 w-7 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md flex items-center justify-center p-0 transition-colors",
                                nav_button_previous: "absolute ltr:left-1 rtl:right-1",
                                nav_button_next: "absolute ltr:right-1 rtl:left-1",
                                table: "w-full border-collapse space-y-1",
                                head_row: "flex",
                                head_cell: "text-slate-500 rounded-md w-9 font-normal text-[0.8rem] dark:text-slate-400",
                                row: "flex w-full mt-2",
                                cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-slate-100/50 sm:[&:has([aria-selected])]:bg-slate-100 [&:has([aria-selected])]:bg-brand-100 dark:[&:has([aria-selected])]:bg-brand-900/20 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                                day: "h-9 w-9 p-0 font-normal hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors aria-selected:opacity-100 text-slate-900 dark:text-slate-100",
                                day_range_end: "day-range-end",
                                day_selected: "bg-brand-600 !text-white hover:bg-brand-600 hover:text-white focus:bg-brand-600 focus:text-white rounded-md",
                                day_today: "bg-slate-100 dark:bg-slate-800 font-semibold",
                                day_outside: "day-outside text-slate-500 opacity-50 aria-selected:bg-slate-100/50 aria-selected:text-slate-500 aria-selected:opacity-30 dark:text-slate-400 dark:aria-selected:bg-slate-800/50",
                                day_disabled: "text-slate-500 opacity-50 dark:text-slate-400",
                                day_range_middle: "aria-selected:bg-slate-100 aria-selected:text-slate-900 dark:aria-selected:bg-slate-800 dark:aria-selected:text-slate-100",
                                day_hidden: "invisible",
                            }}
                        />
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        );
    }
);
DateInput.displayName = "DateInput";
