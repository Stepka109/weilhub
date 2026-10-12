"use client";

import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  wide,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-navy/35 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <D.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[min(88dvh,860px)] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-dialog bg-card shadow-pop data-[state=open]:animate-pop-in",
          wide ? "max-w-3xl" : "max-w-lg",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <D.Title className="font-display text-xl font-semibold text-ink">{title}</D.Title>
            {description ? (
              <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</D.Description>
            )}
          </div>
          <D.Close
            className="-mt-1 -mr-2 grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-slate-soft hover:text-ink"
            aria-label="Zavřít"
          >
            <X className="size-5" />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}>{children}</div>;
}
