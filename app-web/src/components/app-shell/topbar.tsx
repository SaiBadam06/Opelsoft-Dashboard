import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/auth";

export function Topbar({ profile }: { profile: Profile }) {
  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div className="text-sm text-muted-foreground">
        Signed in as{" "}
        <span className="font-medium text-foreground">
          {profile.full_name ?? profile.email}
        </span>{" "}
        ({profile.role})
      </div>
      <form action={signOut}>
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    </header>
  );
}
