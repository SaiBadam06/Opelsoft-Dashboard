"use client";

import Image from "next/image";
import { useActionState, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Loader2, Lock, Mail } from "lucide-react";
import { signIn } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null);
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // fromTo (not from) + clearProps so an interrupted/replayed tween — e.g.
      // React StrictMode's double-mount in dev — can never leave an element
      // stuck at opacity:0 and hide the form/button.
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          "[data-animate='brand']",
          { opacity: 0, scale: 1.04 },
          { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out", clearProps: "opacity,transform" },
        );

        gsap.fromTo(
          "[data-animate='stagger']",
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: "power2.out",
            stagger: 0.08,
            delay: 0.1,
            clearProps: "opacity,transform",
          },
        );
      });
    },
    { scope: root }
  );

  return (
    <main ref={root} className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — desktop only */}
      <aside
        data-animate="brand"
        className="relative hidden overflow-hidden bg-gradient-to-br from-primary to-info p-12 lg:flex lg:flex-col lg:justify-between"
      >
        {/* Decorative blurred orbs (kept away from the logo so it stays legible) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 top-1/3 size-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-10 size-80 rounded-full bg-black/10 blur-3xl"
        />

        <div className="relative">
          <div className="inline-flex rounded-xl bg-white px-4 py-3 shadow-lg ring-1 ring-white/30">
            <Image
              src="/logo.svg"
              alt="OpelSoft"
              width={170}
              height={46}
              className="h-9 w-auto"
              priority
            />
          </div>
        </div>

        <div className="relative flex flex-col gap-4 text-primary-foreground">
          <h1 className="text-4xl font-semibold tracking-tight text-balance">
            Staffing, streamlined.
          </h1>
          <p className="max-w-md text-base/relaxed text-primary-foreground/80">
            Manage consultants, requirements, submissions, and placements in one
            place. OpelSoft keeps your bench sales pipeline moving from first
            contact to closed deal.
          </p>
        </div>

        <p className="relative text-sm text-primary-foreground/60">
          &copy; {new Date().getFullYear()} OpelSoft. All rights reserved.
        </p>
      </aside>

      {/* Login form panel */}
      <div className="flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="flex w-full max-w-sm flex-col gap-8">
          {/* Mobile logo */}
          <div
            data-animate="stagger"
            className="flex justify-center lg:hidden"
          >
            <Image
              src="/logo.svg"
              alt="OpelSoft"
              width={170}
              height={46}
              className="h-10 w-auto"
              priority
            />
          </div>

          <div data-animate="stagger" className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-muted-foreground">
              Sign in to your OpelSoft dashboard to continue.
            </p>
          </div>

          <form action={action} className="flex flex-col gap-5">
            <div data-animate="stagger" className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  required
                  className="h-10 pl-8"
                />
              </div>
            </div>

            <div data-animate="stagger" className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  className="h-10 pl-8"
                />
              </div>
            </div>

            {state?.error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {state.error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={pending}
              data-animate="stagger"
              className={cn("h-10 w-full", pending && "cursor-wait")}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
