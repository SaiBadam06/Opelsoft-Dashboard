import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** `?site=` preview is allowed on localhost and Cloud Run staging only — not marketing domains. */
function allowsCareerSiteOverride(request: NextRequest): boolean {
  const raw =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const primary = raw.split(",")[0].trim();
  const bare = primary.split(":")[0].trim().toLowerCase();
  const host = bare.startsWith("www.") ? bare.slice(4) : bare;
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
    return true;
  }
  if (host.endsWith(".run.app")) return true;
  return false;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/login" ||
    path.startsWith("/auth") ||
    path === "/careers" ||
    path.startsWith("/careers/") ||
    // These two authenticate themselves (drain secret header / unsubscribe token) and are
    // called by pg_cron / email clients with no browser session — never redirect them to /login.
    path === "/api/campaigns/drain" ||
    path === "/api/unsubscribe";

  // Dev/staging only: pass ?site= override to server components via request header
  const siteOverride = request.nextUrl.searchParams.get("site");
  if (
    siteOverride &&
    (path === "/careers" || path.startsWith("/careers/")) &&
    allowsCareerSiteOverride(request)
  ) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-career-site-slug", siteOverride);
    response = NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
