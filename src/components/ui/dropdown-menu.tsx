"use client";

import * as React from "react";
import { DropdownMenu as M } from "radix-ui";
import { cn } from "@/lib/utils";

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;

export function DropdownMenuContent({
  className,
  align = "end",
  ...props
}: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={8}
        className={cn(
          "z-50 min-w-52 rounded-[18px] border border-line bg-card p-1.5 shadow-pop data-[state=open]:animate-fade-in",
          className,
        )}
        {...props}
      />
    </M.Portal>
  );
}

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: React.ComponentProps<typeof M.Item> & { destructive?: boolean }) {
  return (
    <M.Item
      className={cn(
        "group flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-ink outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-slate-soft [&_svg]:size-4 [&_svg]:text-muted",
        destructive && "text-rose-ink data-[highlighted]:bg-rose [&_svg]:text-rose-ink",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof M.Label>) {
  return <M.Label className={cn("px-3 pt-2 pb-1.5 text-xs font-medium text-muted", className)} {...props} />;
}

export function DropdownMenuSeparator() {
  return <M.Separator className="my-1.5 h-px bg-line" />;
}
