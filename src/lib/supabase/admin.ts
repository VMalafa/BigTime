// Service-role Supabase client for server-side jobs that act outside a
// user session (the inbound email webhook). Never imported by client code.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service-role env vars are not set (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
  if (!client) {
    client = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

const INBOUND_BUCKET = "inbound-email";

/**
 * Store an inbound email's raw webhook payload (attachments ride inside,
 * base64). Creates the private bucket lazily on first use.
 */
export async function storeInboundEmailRaw(
  path: string,
  payloadJson: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = getServiceRoleClient();
  const body = new Blob([payloadJson], { type: "application/json" });

  const upload = () =>
    supabase.storage
      .from(INBOUND_BUCKET)
      .upload(path, body, { contentType: "application/json", upsert: true });

  let { error } = await upload();
  if (error && /bucket.*not.*found/i.test(error.message)) {
    await supabase.storage.createBucket(INBOUND_BUCKET, { public: false });
    ({ error } = await upload());
  }
  return error ? { error: error.message } : { ok: true };
}
