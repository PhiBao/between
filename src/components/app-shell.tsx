import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

/**
 * The shell is three tabs and nothing else. No sidebar, no settings maze: the
 * whole product is "the record", "what was agreed", and "give me the pack".
 */
const TABS = [
  { href: "/record", label: "Record" },
  { href: "/agreements", label: "Agreements" },
  { href: "/pack", label: "Pack" },
] as const;

export function AppShell({
  active,
  title,
  subtitle,
  children,
  headerAction,
}: {
  active: (typeof TABS)[number]["href"];
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh pb-24">
      <header className="border-b border-[var(--color-line)] bg-[var(--color-card)]">
        <div className="mx-auto flex max-w-2xl items-start justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-[var(--color-muted)]">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {headerAction}
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">{children}</main>

      <nav
        aria-label="Sections"
        className="no-print fixed inset-x-0 bottom-0 border-t border-[var(--color-line)] bg-[var(--color-card)]"
      >
        <ul className="mx-auto flex max-w-2xl">
          {TABS.map((tab) => {
            const isActive = tab.href === active;
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 py-3 text-sm font-medium ${
                    isActive
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-muted)]"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`h-0.5 w-8 rounded-full ${
                      isActive ? "bg-[var(--color-accent)]" : "bg-transparent"
                    }`}
                  />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
