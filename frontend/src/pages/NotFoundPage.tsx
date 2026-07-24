import { SearchX } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ErrorState, PageError } from "@/components/ux";

function NotFoundPage() {
  return (
    <PageError>
      <ErrorState
        icon={SearchX}
        title="Page not found"
        description="The page you're looking for doesn't exist or may have been moved."
        action={
          <Button asChild>
            <Link to="/login">Back to login</Link>
          </Button>
        }
      />
    </PageError>
  );
}

export default NotFoundPage;
