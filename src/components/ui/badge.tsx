import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium leading-none whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        blue: "bg-light-blue text-primary",
        mint: "bg-mint text-mint-ink",
        yellow: "bg-yellow text-yellow-ink",
        lavender: "bg-lavender text-lavender-ink",
        red: "bg-rose text-rose-ink",
        sky: "bg-sky text-sky-ink",
        orange: "bg-orange text-orange-ink",
        slate: "bg-slate-soft text-slate-ink",
        outline: "border border-line bg-card text-muted",
        solid: "bg-primary text-white",
      },
    },
    defaultVariants: { tone: "slate" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
