"use client";

import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { cn } from "@presentation/lib/cn";
import { useAuthStore } from "@presentation/state/auth-store";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const navItems = [
  { href: "/admin", label: "Analytics" },
  { href: "/admin/products/new", label: "Add Product" },
  { href: "/admin/products", label: "All Products" },
  { href: "/admin/orders", label: "All Orders" },
  { href: "/admin/users", label: "All Users" },
];

function navActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const deps = useAppDependencies();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasCheckedSession = useAuthStore((s) => s.hasCheckedSession);
  const role = useAuthStore((s) => s.role);
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    if (hasCheckedSession && (!isAuthenticated || role !== "ADMIN")) {
      router.replace("/admin/login");
    }
  }, [hasCheckedSession, isAuthenticated, role, router]);

  if (!hasCheckedSession || !isAuthenticated || role !== "ADMIN") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-catalog-surface px-4">
        <div className="h-24 w-full max-w-md animate-pulse rounded-xl bg-catalog-input" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-catalog-surface text-catalog-text">
      <div className="fixed inset-x-0 top-0 z-40 h-1 bg-catalog-green" />
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl">
        <aside className="hidden w-64 shrink-0 border-r border-catalog-border bg-card px-4 py-5 lg:block">
          <Link href="/admin" className="mb-8 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-catalog-green-muted text-lg font-black text-catalog-green">
              P
            </span>
            <div>
              <p className="text-base font-bold text-catalog-text">PackRush</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-catalog-text-muted">
                Admin Portal
              </p>
            </div>
          </Link>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = navActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold transition-colors",
                    active
                      ? "bg-catalog-green text-white"
                      : "text-catalog-text-muted hover:bg-catalog-input hover:text-catalog-text",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-catalog-border bg-card/95 px-4 py-3 backdrop-blur lg:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-catalog-green">
                  Admin Portal
                </p>
                <h1 className="text-lg font-bold text-catalog-text">
                  Wholesale operations
                </h1>
              </div>
              <button
                type="button"
                className="rounded-lg border border-catalog-border bg-catalog-surface px-3 py-2 text-xs font-bold text-catalog-text hover:bg-catalog-input"
                onClick={() => {
                  void deps.authGateway.logout().finally(() => {
                    clearSession();
                    router.push("/admin/login");
                  });
                }}
              >
                Log out
              </button>
            </div>
            <nav className="no-scrollbar mt-3 flex gap-2 overflow-x-auto lg:hidden">
              {navItems.map((item) => {
                const active = navActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold",
                      active
                        ? "border-catalog-green bg-catalog-green text-white"
                        : "border-catalog-border bg-catalog-surface text-catalog-text",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>
          <main className="flex-1 px-4 py-5 lg:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
