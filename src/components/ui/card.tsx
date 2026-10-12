import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, interactive, ...props }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card border border-line/80 bg-card shadow-card",
        interactive && "transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#d6deeb] hover:shadow-hover",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
  as: Heading = "h2",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <Heading className="truncate text-[1.05rem] font-semibold text-ink">{title}</Heading>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-5 sm:px-6", className)} {...props} />;
}
