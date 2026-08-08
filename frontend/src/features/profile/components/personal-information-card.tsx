import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldTitle } from "@/components/ui/field";
import { UserAvatar } from "@/components/ux";
import { formatDate } from "@/utils";

import { ProfileNameForm } from "./profile-name-form";

interface PersonalInformationCardProps {
  name: string;
  email: string;
  image?: string | null;
  createdAt: Date | string;
}

export function PersonalInformationCard({
  name,
  email,
  image,
  createdAt,
}: PersonalInformationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
        <CardDescription>
          Your name is visible to your teammates across TeamOS.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <UserAvatar name={name} image={image} size="lg" />

        <ProfileNameForm name={name} />

        <div className="flex flex-col gap-4">
          <Field orientation="horizontal">
            <FieldTitle className="text-muted-foreground">Email</FieldTitle>
            <FieldContent className="flex-none">
              <p className="text-sm">{email}</p>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldTitle className="text-muted-foreground">Member Since</FieldTitle>
            <FieldContent className="flex-none">
              <p className="text-sm">{formatDate(createdAt)}</p>
            </FieldContent>
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
