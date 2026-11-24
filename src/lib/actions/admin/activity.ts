"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import { idSchema, withRole } from "./helpers";

export interface ActivityPerson {
  person: string;
  seen_at: string | null;
}

/** Kdo konkrétně přečetl oznámení / otevřel materiál / hlasoval (jen redaktor). */
export async function getActivityPeople(kind: "announcement" | "material" | "poll", id: string): Promise<ActionResult<ActivityPerson[]>> {
  return withRole("staff", async ({ supabase }) => {
    if (!z.enum(["announcement", "material", "poll"]).safeParse(kind).success || !idSchema.safeParse(id).success) {
      return { ok: false, error: "Neplatný požadavek." };
    }
    const { data, error } = await supabase.rpc("activity_people", { p_kind: kind, p_id: id });
    if (error) return { ok: false, error: error.code === "P0001" ? error.message : "Přehled se nepodařilo načíst." };
    return { ok: true, data: (data ?? []) as ActivityPerson[] };
  });
}
