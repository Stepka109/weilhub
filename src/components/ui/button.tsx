import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "group inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium select-none transition-[background-color,color,box-shadow,transform,border-color] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white shadow-[0_6px_16px_-6px_rgba(47,104,255,0.6)] hover:bg-primary-hover",
        secondary: "bg-light-blue text-primary hover:bg-[#cfe0ff]",
        outline: "border border-line bg-card text-ink hover:border-[#cdd6e4] hover:bg-bg",
        ghost: "text-ink hover:bg-slate-soft",
        danger: "bg-rose-ink text-white hover:bg-[#9b1c37]",
        "danger-soft": "bg-rose text-rose-ink hover:bg-[#ffd5dc]",
        link: "text-primary underline-offset-4 hover:underline px-0! h-auto!",
      },
      size: {
        sm: "h-9 rounded-full px-3.5 text-sm [&_svg]:size-4",
        md: "h-11 rounded-full px-5 text-[0.95rem] [&_svg]:size-[18px]",
        lg: "h-12 rounded-full px-6 text-base [&_svg]:size-5",
        icon: "size-10 rounded-full [&_svg]:size-5",
        "icon-sm": "size-8 rounded-full [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      type={type ?? "button"}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
