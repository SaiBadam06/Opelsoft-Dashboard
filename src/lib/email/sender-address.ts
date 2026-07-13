const SENDER_DOMAIN = "@opelsoft.com";

/**
 * The From address is derived from the logged-in user, never from the form:
 * - admins send from the shared outreach mailbox (EMAIL_SENDER_ADDRESSES[0]);
 * - other users send as their own @opelsoft.com mailbox;
 * - non-opelsoft logins fall back to the shared mailbox.
 * Every address used here must also be allowed by the Exchange Application
 * Access Policy, or Graph rejects the send with 403.
 */
export function senderFor(me: { email: string; role: string }): string | null {
  const fallback =
    (process.env.EMAIL_SENDER_ADDRESSES ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)[0] ?? null;
  if (me.role === "admin") return fallback;
  const email = me.email.trim().toLowerCase();
  return email.endsWith(SENDER_DOMAIN) ? email : fallback;
}
