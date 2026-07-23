import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ErrorState, PageError } from "@/components/ux";

function ForbiddenPage() {
  return (
    <PageError>
      <ErrorState
        icon={ShieldAlert}
        title="Access denied"
        description="You don't have permission to view this page. Return to your dashboard to keep working."
        action={
          <Button asChild>
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        }
      />
    </PageError>
  );
}

export default ForbiddenPage;
