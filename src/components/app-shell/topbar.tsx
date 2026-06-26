"use client";

import { ChevronDown, LogOut } from "lucide-react";

import { signOut } from "@/app/auth/actions";
import type { Profile } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/mode-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";

function initialsFrom(profile: Profile): string {
  const name = profile.full_name?.trim();
  if (name) {
    const parts = name.split(/\s+/);
    const letters =
      parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`
        : parts[0].slice(0, 2);
    return letters.toUpperCase();
  }
  return profile.email.slice(0, 2).toUpperCase();
}

export function Topbar({ profile }: { profile: Profile }) {
  const initials = initialsFrom(profile);
  const displayName = profile.full_name ?? profile.email;

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b bg-background/70 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>

      <div className="flex items-center gap-1">
        <ModeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                aria-label="Open profile menu"
                className="h-10 gap-2 px-1.5 sm:pr-2.5"
              />
            }
          >
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
              {displayName}
            </span>
            <ChevronDown className="hidden text-muted-foreground sm:inline" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarFallback className="bg-primary text-sm text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {displayName}
                </span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {profile.email}
                </span>
                <span className="mt-1 inline-flex w-fit items-center rounded-md bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
                  {profile.role}
                </span>
              </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <form action={signOut} className="w-full">
              <DropdownMenuItem
                variant="destructive"
                render={<button type="submit" className="w-full" />}
              >
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
