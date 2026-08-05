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

// STAF-116: top-level segments that are real app sections. A path whose first
// segment isn't here cannot resolve to a page, so redirecting it to /login
// would be wrong — it should 404 like any other nonexistent route. Kept in
// sync with src/app/(app)/* and the top-level routes under src/app/.
const KNOWN_TOP_LEVEL_SEGMENTS = new Set([
  // Route handlers, not pages — kept here so /api/* keeps going through the
  // exact same isPublic/auth branch it already did; this set only changes
  // behavior for segments that are neither a page nor an API route.
  "api",
  "applications",
  "auth",
  "campaigns",
  "candidates",
  "careers",
  "dashboard",
  "interviews",
  "login",
  "logs",
  "mail",
  "pipeline",
  "placements",
  "requirements",
  "search",
  "settings",
  "submissions",
  "tasks",
  "timesheet",
  "users",
  "vendors",
]);

function isKnownAppPath(path: string): boolean {
  if (path === "/") return true;
  const [, segment] = path.split("/");
  return KNOWN_TOP_LEVEL_SEGMENTS.has(segment);
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
  const isPublic = path === "/login" || path.startsWith("/auth");

  // STAF-116: A path outside every known section cannot resolve to a page
  // regardless of auth state, so it should 404 rather than redirect to login.
  if (!user && !isPublic && isKnownAppPath(path)) {
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
