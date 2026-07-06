import { RegisterForm } from "@/features/auth/components/register-form";
import AuthLayout from "@/layouts/AuthLayout";

function RegisterPage() {
  return (
    <AuthLayout title="Create your account" description="Start collaborating with your team today.">
      <RegisterForm />
    </AuthLayout>
  );
}

export default RegisterPage;
