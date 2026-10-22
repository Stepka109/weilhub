import { cn } from "@/lib/utils";

/** Malý štítek skupiny u materiálu, úkolu nebo testu. */
export function GroupBadge({ group, className }: { group: "S1" | "S2" | null | undefined; className?: string }) {
  if (!group) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-extrabold",
        group === "S1" ? "bg-[#e2f5f2] text-[#0b7d73]" : "bg-[#ebe8ff] text-[#4b3fd1]",
        className,
      )}
      title={`Jen pro skupinu ${group}`}
    >
      {group}
    </span>
  );
}
