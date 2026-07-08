import { PageHeader, PageLayout, PageSection } from "@/components/layout";

function DashboardPage() {
  return (
    <PageLayout>
      <PageHeader title="Dashboard" description="Overview of your workspace." />

      <PageSection>
        <p className="text-muted-foreground">Dashboard coming soon.</p>
      </PageSection>
    </PageLayout>
  );
}

export default DashboardPage;
