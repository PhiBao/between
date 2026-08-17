import Link from "next/link";
import { signIn, signUp } from "@/app/auth-actions";

/**
 * A plain form posting to a server action: it works before JavaScript loads, and
 * the session cookie is set on the same response as the redirect.
 */
export function AuthForm({
  mode,
  error,
  next,
}: {
  mode: "sign-in" | "sign-up";
  error?: string;
  next?: string;
}) {
  const isSignUp = mode === "sign-up";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <Link href="/" className="text-sm font-semibold text-[var(--color-accent)]">
        BETWEEN
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">
        {isSignUp ? "Start a record" : "Sign in"}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {isSignUp
          ? "One account per parent. You can invite the other parent later, or keep the record on your own."
          : "Welcome back."}
      </p>

      <form className="mt-6 space-y-4" action={isSignUp ? signUp : signIn}>
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            className="field"
            type="email"
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            className="field"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={8}
          />
          {isSignUp ? (
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              At least 8 characters.
            </p>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary w-full">
          {isSignUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-[var(--color-muted)]">
        {isSignUp ? (
          <>
            Already have an account?{" "}
            <Link className="underline" href="/sign-in">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link className="underline" href="/sign-up">
              Start a record
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
