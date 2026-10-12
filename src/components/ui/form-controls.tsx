import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const controlBase =
  "w-full rounded-control border border-line bg-card px-4 text-[0.95rem] text-ink placeholder:text-[#8d96a6] transition-[border-color,box-shadow] duration-150 outline-none hover:border-[#cfd7e4] focus:border-primary focus:ring-4 focus:ring-primary/12 disabled:cursor-not-allowed disabled:bg-bg disabled:opacity-70 aria-[invalid=true]:border-rose-ink aria-[invalid=true]:focus:ring-rose-ink/12";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlBase, "h-11", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(controlBase, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select ref={ref} className={cn(controlBase, "h-11 cursor-pointer appearance-none pr-10", className)} {...props}>
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
      </div>
    );
  },
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-ink", className)} {...props} />;
}

/** Popisek + ovládací prvek + nápověda + chybová hláška. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-0.5 text-rose-ink" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm text-rose-ink" role="alert" id={htmlFor ? `${htmlFor}-error` : undefined}>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn("size-[18px] cursor-pointer rounded-md border-line accent-primary", className)}
      {...props}
    />
  );
}
