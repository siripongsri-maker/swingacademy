import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED_BUCKETS = ["training-attachments", "avatars"] as const;
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

async function assertStaff(supabase: any, userId: string) {
  const { data: isStaff } = await supabase.rpc("has_role", { _user_id: userId, _role: "staff" });
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isStaff && !isAdmin) throw new Error("Staff access required");
}

export type StorageEntry = {
  name: string;
  path: string;
  isFolder: boolean;
  size: number | null;
  mimetype: string | null;
  updatedAt: string | null;
  createdAt: string | null;
};

export const listStorageFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        bucket: z.enum(ALLOWED_BUCKETS),
        prefix: z.string().max(500).default(""),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const prefix = data.prefix.replace(/^\/+|\/+$/g, "");
    const { data: items, error } = await supabaseAdmin.storage
      .from(data.bucket)
      .list(prefix || undefined, {
        limit: 200,
        sortBy: { column: "name", order: "asc" },
      });
    if (error) throw new Error(error.message);

    const entries: StorageEntry[] = (items ?? []).map((it: any) => {
      const isFolder = it.id === null;
      const fullPath = prefix ? `${prefix}/${it.name}` : it.name;
      return {
        name: it.name,
        path: fullPath,
        isFolder,
        size: it.metadata?.size ?? null,
        mimetype: it.metadata?.mimetype ?? null,
        updatedAt: it.updated_at ?? null,
        createdAt: it.created_at ?? null,
      };
    });

    return { bucket: data.bucket, prefix, entries };
  });

export const getStorageSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        bucket: z.enum(ALLOWED_BUCKETS),
        path: z.string().min(1).max(500),
        download: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(data.bucket as AllowedBucket)
      .createSignedUrl(data.path, 60 * 60, {
        download: data.download ? data.path.split("/").pop() ?? true : false,
      });
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl, expiresIn: 3600 };
  });
