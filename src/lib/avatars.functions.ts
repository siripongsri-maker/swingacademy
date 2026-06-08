import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PROJECT_REF = "zgwhpgalzgdrnwzoykng";
const PUBLIC_BASE = `https://${PROJECT_REF}.supabase.co/storage/v1/object/public/avatars/`;

export const listAvatars = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("person_avatars")
    .select("person_id, storage_path, updated_at");
  if (error) throw new Error(error.message);
  // Use signed URLs (bucket is private)
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    const { data: signed } = await supabaseAdmin.storage
      .from("avatars")
      .createSignedUrl(row.storage_path, 60 * 60 * 6);
    if (signed?.signedUrl) map[row.person_id] = signed.signedUrl;
  }
  return { avatars: map };
});

export const createAvatarUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((i: { personId: string; filename: string }) =>
    z.object({
      personId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/),
      filename: z.string().min(1).max(200),
    }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const path = `${data.personId}/${Date.now()}-${safe}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("avatars").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const setAvatar = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    person_id: z.string().min(1).max(100),
    storage_path: z.string().min(1),
    mime_type: z.string().nullable().optional(),
    size_bytes: z.number().nullable().optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Remove previous file if any
    const { data: prev } = await supabaseAdmin
      .from("person_avatars").select("storage_path").eq("person_id", data.person_id).maybeSingle();
    if (prev?.storage_path && prev.storage_path !== data.storage_path) {
      await supabaseAdmin.storage.from("avatars").remove([prev.storage_path]);
    }
    const { error } = await supabaseAdmin
      .from("person_avatars")
      .upsert({
        person_id: data.person_id,
        storage_path: data.storage_path,
        mime_type: data.mime_type ?? null,
        size_bytes: data.size_bytes ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "person_id" });
    if (error) throw new Error(error.message);
    const { data: signed } = await supabaseAdmin.storage
      .from("avatars").createSignedUrl(data.storage_path, 60 * 60 * 6);
    return { ok: true, url: signed?.signedUrl ?? null };
  });

export const deleteAvatar = createServerFn({ method: "POST" })
  .inputValidator((i: { personId: string }) =>
    z.object({ personId: z.string().min(1).max(100) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin
      .from("person_avatars").select("storage_path").eq("person_id", data.personId).maybeSingle();
    if (prev?.storage_path) {
      await supabaseAdmin.storage.from("avatars").remove([prev.storage_path]);
    }
    const { error } = await supabaseAdmin
      .from("person_avatars").delete().eq("person_id", data.personId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const _PUBLIC_BASE = PUBLIC_BASE;
