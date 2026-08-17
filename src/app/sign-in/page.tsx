import { AuthForm } from "@/components/auth-form";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  return <AuthForm mode="sign-in" {...(error ? { error } : {})} {...(next ? { next } : {})} />;
}
