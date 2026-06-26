"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// Client-side handler for invite / recovery / confirmation links arriving from
// email. Supabase delivers the session either as a `code` query param, a
// `token_hash` + `type`, or tokens in the URL hash — this completes whichever
// it is, sets the session cookie, then sends the user to finish setup.
export default function AuthCallbackPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    const go = (path: string) => {
      if (settled) return;
      settled = true;
      router.replace(path);
    };

    async function run() {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

      // Explicit error from Supabase (e.g. expired link)
      if (url.searchParams.get("error") || hash.get("error")) {
        setFailed(true);
        return;
      }

      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type") as EmailOtpType | null;

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          type,
          token_hash: tokenHash,
        });
        if (!error) return go("/auth/set-password");
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) return go("/auth/set-password");
      }

      // Hash-token (implicit) flow: the client auto-detects it on init.
      const { data } = await supabase.auth.getSession();
      if (data.session) return go("/auth/set-password");
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) go("/auth/set-password");
    });

    run();
    const timer = setTimeout(() => {
      if (!settled) setFailed(true);
    }, 5000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      {failed ? (
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <p className="text-lg font-semibold">This link didn&apos;t work</p>
          <p className="text-sm text-muted-foreground">
            It may have expired or already been used. Ask an admin to send you a
            fresh invite.
          </p>
          <a
            href="/login"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Go to sign in
          </a>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <p className="text-sm">Finishing setup…</p>
        </div>
      )}
    </main>
  );
}
