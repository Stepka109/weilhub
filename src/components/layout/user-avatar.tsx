import { cn, initials } from "@/lib/utils";
import { AVATARS_BUCKET, supabaseUrl } from "@/lib/supabase/config";

export function avatarUrl(path: string | null | undefined): string | null {
  if (!path || !/^[0-9a-f-]{36}\/[a-z0-9._-]+$/i.test(path)) return null;
  return `${supabaseUrl}/storage/v1/object/public/${AVATARS_BUCKET}/${path}`;
}

export function UserAvatar({
  name,
  path,
  className,
}: {
  name: string;
  path?: string | null;
  className?: string;
}) {
  const url = avatarUrl(path);
  return (
    <span
      className={cn(
        "relative inline-grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-light-blue font-display text-sm font-bold text-primary",
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar z veřejného bucketu, bez optimalizace
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initials(name) || "?"}</span>
      )}
    </span>
  );
}
