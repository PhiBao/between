import { signOut } from "@/app/auth-actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="btn btn-quiet no-print text-sm">
        Sign out
      </button>
    </form>
  );
}
