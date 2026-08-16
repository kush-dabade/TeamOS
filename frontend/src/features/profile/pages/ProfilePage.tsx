import { PageHeader, PageLayout } from "@/components/layout";
import { useAuth } from "@/features/auth";

import { PersonalInformationCard } from "../components/personal-information-card";
import { ProfilePageSkeleton } from "../components/profile-page-skeleton";
import { SecurityCard } from "../components/security-card";

export function ProfilePage() {
  const { user } = useAuth();

  return (
    <PageLayout>
      <PageHeader
        title="Profile"
        description="Manage your personal information and account security."
      />

      <div className="mt-3 flex flex-col gap-6">
        {user ? (
          <>
            <PersonalInformationCard
              name={user.name}
              email={user.email}
              emailVerified={user.emailVerified}
              image={user.image}
              createdAt={user.createdAt}
              updatedAt={user.updatedAt}
            />

            <SecurityCard />
          </>
        ) : (
          <ProfilePageSkeleton />
        )}
      </div>
    </PageLayout>
  );
}
