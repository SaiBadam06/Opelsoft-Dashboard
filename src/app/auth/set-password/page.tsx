import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { SetPasswordForm } from "./set-password-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SetPasswordPage() {
  // Reachable only with a valid session (established by the invite/recovery link
  // via /auth/confirm). Without one, send them to sign in.
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?error=Invalid%20or%20expired%20link");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-3">
          <Image
            src="/logo.svg"
            alt="OpelSoft"
            width={150}
            height={40}
            className="h-9 w-auto"
            priority
          />
          <CardTitle className="text-lg">Create your account</CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            You&apos;ve been invited to OpelSoft. Set a password to finish
            creating your account.
          </p>
        </CardHeader>
        <CardContent>
          <SetPasswordForm email={profile.email} />
        </CardContent>
      </Card>
    </main>
  );
}
