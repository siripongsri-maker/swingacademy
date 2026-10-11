import { supabase } from "@/integrations/supabase/client";

/** Bearer header for plain fetch() calls to our own API routes (server fns get it automatically). */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
