"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <label className="flex flex-col gap-1.5">
        {label ? (
          <span className="text-sm font-medium text-slate-700">{label}</span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-coral-400 focus:ring-2 focus:ring-coral-200",
            error && "border-rose-400 focus:border-rose-400 focus:ring-rose-200",
            className,
          )}
          {...props}
        />
        {error ? <span className="text-sm text-rose-600">{error}</span> : null}
      </label>
    );
  },
);
Input.displayName = "Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <label className="flex flex-col gap-1.5">
        {label ? (
          <span className="text-sm font-medium text-slate-700">{label}</span>
        ) : null}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "min-h-[96px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-coral-400 focus:ring-2 focus:ring-coral-200",
            error && "border-rose-400",
            className,
          )}
          {...props}
        />
        {error ? <span className="text-sm text-rose-600">{error}</span> : null}
      </label>
    );
  },
);
Textarea.displayName = "Textarea";

export interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <label className="flex flex-col gap-1.5">
        {label ? (
          <span className="text-sm font-medium text-slate-700">{label}</span>
        ) : null}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-coral-400 focus:ring-2 focus:ring-coral-200",
            className,
          )}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  },
);
Select.displayName = "Select";
