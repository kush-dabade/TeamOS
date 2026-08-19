import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import AuthLayout from "@/layouts/AuthLayout";

function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Forgot password?"
      description="Enter your email and we'll send you a reset link."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}

export default ForgotPasswordPage;
