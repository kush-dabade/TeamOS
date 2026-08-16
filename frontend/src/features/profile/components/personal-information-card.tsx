import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldTitle } from "@/components/ui/field";
import { cn, formatDate } from "@/utils";

import { AvatarUploadControl } from "./avatar-upload-control";
import { EmailVerificationStatus } from "./email-verification-status";
import { ProfileNameForm } from "./profile-name-form";

interface PersonalInformationCardProps {
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export function PersonalInformationCard({
  name,
  email,
  emailVerified,
  image,
  createdAt,
  updatedAt,
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
        <AvatarUploadControl name={name} image={image} updatedAt={updatedAt} />

        <ProfileNameForm name={name} />

        <div className="flex flex-col gap-4">
          <Field orientation="horizontal">
            <FieldTitle className="text-muted-foreground">Email</FieldTitle>
            <FieldContent className="flex-none">
              <div
                className={cn(
                  "flex gap-2",
                  emailVerified ? "flex-row flex-wrap items-center" : "flex-col items-start",
                )}
              >
                <p className="text-sm">{email}</p>
                <EmailVerificationStatus email={email} emailVerified={emailVerified} />
              </div>
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
