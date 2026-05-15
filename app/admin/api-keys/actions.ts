"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getServerClient, getServiceRoleClient } from "@/lib/supabase/server";

/**
 * Verify the current session is an admin. Throws otherwise. The middleware
 * already gates /admin/* but we re-check inside the server action because
 * actions can be invoked from anywhere if the bundle is reused (defense in
 * depth).
 */
async function requireAdmin(): Promise<{ adminUserId: string }> {
  const supabase = await getServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("not_authenticated");
  type AppMeta = { role?: string };
  const appMeta = (data.user.app_metadata ?? {}) as AppMeta;
  if (appMeta.role !== "admin") throw new Error("forbidden_not_admin");
  return { adminUserId: data.user.id };
}

export type CreateKeyResult =
  | { ok: true; secret: string; prefix: string; id: string; email: string }
  | { ok: false; error: string };

export async function createApiKey(input: {
  email: string;
  name: string;
}): Promise<CreateKeyResult> {
  try {
    await requireAdmin();
  } catch (err) {
    return { ok: false, error: String(err) };
  }

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !name) {
    return { ok: false, error: "Email and name are both required." };
  }

  const admin = getServiceRoleClient();

  // Resolve email -> auth.users.id via listUsers + filter. v1 scale only.
  const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) return { ok: false, error: listErr.message };
  const user = (usersPage?.users ?? []).find((u) => u.email === email);
  if (!user) {
    return {
      ok: false,
      error:
        `No Supabase user with email ${email}. The user must sign in once ` +
        `(magic link) before a key can be issued.`,
    };
  }

  // Generate ssk_ + 8 url-safe random chars (prefix) + 32 random chars (body).
  // Total cleartext length: 4 + 8 + 32 = 44 chars. 32 chars at 6 bits each
  // is ~192 bits of entropy; collision-safe.
  const prefixSuffix = base64urlRandom(6); // 8 chars
  const bodyChars = base64urlRandom(24); // 32 chars
  const secret = `ssk_${prefixSuffix}${bodyChars}`;
  const prefix = `ssk_${prefixSuffix}`;
  const keyHash = createHash("sha256").update(secret).digest("hex");

  const { data: insertData, error: insErr } = await admin
    .from("api_keys")
    .insert({
      user_id: user.id,
      name,
      prefix,
      key_hash: keyHash,
    })
    .select("id")
    .single();
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/admin/api-keys");
  return {
    ok: true,
    secret,
    prefix,
    id: insertData.id,
    email,
  };
}

export async function revokeApiKey(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
  const admin = getServiceRoleClient();
  const { error } = await admin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/api-keys");
  return { ok: true };
}

function base64urlRandom(byteLen: number): string {
  return randomBytes(byteLen)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
