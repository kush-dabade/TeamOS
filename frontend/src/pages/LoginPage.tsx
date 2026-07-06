import { LoginForm } from "@/features/auth/components/login-form";
import AuthLayout from "@/layouts/AuthLayout";

function LoginPage() {
  return (
    <AuthLayout title="Welcome back" description="Sign in to continue building with your team.">
      <LoginForm />
    </AuthLayout>
  );
}

export default LoginPage;
