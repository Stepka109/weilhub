"use client";

import * as React from "react";
import { AlertDialog as A } from "radix-ui";
import { TriangleAlert } from "lucide-react";
import { Button } from "./button";

/**
 * Potvrzení nevratné akce. `onConfirm` může vracet Promise – dialog
 * zůstane otevřený s indikátorem průběhu, dokud akce nedoběhne.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Potvrdit",
  destructive = true,
  onConfirm,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<unknown> | unknown;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [innerOpen, setInnerOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;

  async function handleConfirm(e: React.MouseEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <A.Root open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      {trigger && <A.Trigger asChild>{trigger}</A.Trigger>}
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-50 bg-navy/35 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <A.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-24px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-dialog bg-card p-6 shadow-pop data-[state=open]:animate-pop-in">
          <div className="flex gap-4">
            {destructive && (
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-rose text-rose-ink">
                <TriangleAlert className="size-5" aria-hidden />
              </div>
            )}
            <div>
              <A.Title className="font-display text-lg font-semibold text-ink">{title}</A.Title>
              <A.Description className="mt-1.5 text-sm leading-relaxed text-muted">{description}</A.Description>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <A.Cancel asChild>
              <Button variant="outline" disabled={pending}>
                Zrušit
              </Button>
            </A.Cancel>
            <Button variant={destructive ? "danger" : "primary"} loading={pending} onClick={handleConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}

interface ConfirmRequest {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<unknown> | unknown;
}

/**
 * Potvrzení vyvolané z menu (dropdown se po výběru zavře, proto dialog
 * nesmí být jeho potomkem). Vrací [dialog, ask].
 */
export function useConfirm() {
  const [request, setRequest] = React.useState<ConfirmRequest | null>(null);
  const dialog = request ? (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && setRequest(null)}
      title={request.title}
      description={request.description}
      confirmLabel={request.confirmLabel}
      destructive={request.destructive}
      onConfirm={request.onConfirm}
    />
  ) : null;
  return [dialog, setRequest] as const;
}
