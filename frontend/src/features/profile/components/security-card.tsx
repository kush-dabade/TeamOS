import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { ChangePasswordForm } from "./change-password-form";

export function SecurityCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security</CardTitle>
        <CardDescription>Change your password to keep your account secure.</CardDescription>
      </CardHeader>

      <CardContent>
        <ChangePasswordForm />
      </CardContent>
    </Card>
  );
}
