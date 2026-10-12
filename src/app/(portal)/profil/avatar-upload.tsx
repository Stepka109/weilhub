"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { AVATARS_BUCKET } from "@/lib/supabase/config";
import { setAvatar } from "@/lib/actions/student";

const MAX = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Nahrání avataru přímo do Storage (RLS povolí jen vlastní složku). */
export function AvatarUpload({ userId, hasAvatar }: { userId: string; hasAvatar: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function onFile(file: File) {
    const ext = TYPES[file.type];
    if (!ext) return toast.error("Avatar musí být obrázek PNG, JPG nebo WEBP.");
    if (file.size > MAX) return toast.error("Obrázek může mít nejvýše 2 MB.");
    setUploading(true);
    try {
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const res = await setAvatar(path);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    } catch {
      toast.error("Nahrání avataru se nezdařilo.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Vybrat obrázek avataru"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <Button variant="secondary" size="sm" loading={uploading} onClick={() => input.current?.click()}>
        {!uploading && <Camera aria-hidden />} Změnit avatar
      </Button>
      {hasAvatar && (
        <Button
          variant="ghost"
          size="sm"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await setAvatar(null);
              if (res.ok) toast.success(res.message);
              else toast.error(res.error);
            })
          }
        >
          {!pending && <Trash2 aria-hidden />} Odebrat
        </Button>
      )}
    </div>
  );
}
