import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import AuthLayout from "@/layouts/AuthLayout";

function ResetPasswordPage() {
  return (
    <AuthLayout title="Reset your password" description="Choose a new password for your account.">
      <ResetPasswordForm />
    </AuthLayout>
  );
}

export default ResetPasswordPage;
