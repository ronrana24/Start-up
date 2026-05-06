"use client";

import {
  NavAccountIcon,
  NavCartIcon,
  NavHomeIcon,
  NavLoginIcon,
} from "@presentation/components/shop/nav-icons";
import { Badge } from "@presentation/components/ui/badge";
import { cn } from "@presentation/lib/cn";
import { useAuthStore } from "@presentation/state/auth-store";
import { useCartStore } from "@presentation/state/cart-store";
import Link from "next/link";
import { usePathname } from "next/navigation";

const centerLinks = [
  { href: "/", label: "Home" },
  { href: "/catalog", label: "Catalog" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
];

function DesktopIconLink({
  href,
  ariaLabel,
  badgeCount,
  children,
}: {
  href: string;
  ariaLabel: string;
  badgeCount?: number;
  children: React.ReactNode;
}) {
  const showBadge = typeof badgeCount === "number" && badgeCount > 0;
  return (
    <Link
      href={href}
      aria-label={
        showBadge
          ? `${ariaLabel}, ${badgeCount > 99 ? "99+" : badgeCount} items`
          : ariaLabel
      }
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-heading transition-colors hover:bg-primary-light/70"
    >
      {children}
      {showBadge ? (
        <span className="pointer-events-none absolute -right-0.5 -top-0.5">
          <Badge className="min-h-[1.125rem] min-w-[1.125rem] px-[5px] text-[10px] leading-none">
            {badgeCount > 99 ? "99+" : badgeCount}
          </Badge>
        </span>
      ) : null}
    </Link>
  );
}

export function DesktopNavBar() {
  const pathname = usePathname();
  const lines = useCartStore((s) => s.lines);
  const cartCount = lines.reduce((n, l) => n + l.quantity, 0);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <div className="pointer-events-none px-4 pb-4 pt-3 sm:px-6 lg:pb-5">
      <div
        className={cn(
          "desktop-glass-nav pointer-events-auto mx-auto grid w-full max-w-5xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 overflow-hidden px-5 py-3 sm:gap-6 sm:px-8",
          "rounded-[2rem] border-white/55 shadow-[0_18px_45px_-22px_rgba(15,81,50,0.42)] ring-1 ring-white/35",
        )}
      >
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 rounded-xl text-heading transition-colors hover:bg-primary-light/70"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
            <NavHomeIcon className="h-6 w-6 shrink-0" aria-hidden />
          </span>
          <span className="truncate text-lg font-bold tracking-tight text-primary">
            Grove
          </span>
        </Link>

        <nav aria-label="Main" className="flex min-w-0 items-center justify-center gap-5 md:gap-8">
          {centerLinks.map(({ href, label }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "whitespace-nowrap text-sm font-semibold transition-colors",
                  active ? "text-primary" : "text-secondary hover:text-heading",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
          {isAuthenticated ? (
            <>
              <DesktopIconLink
                href="/cart"
                ariaLabel="Shopping cart"
                badgeCount={cartCount}
              >
                <NavCartIcon className="h-6 w-6" />
              </DesktopIconLink>
              <DesktopIconLink href="/account" ariaLabel="Account">
                <NavAccountIcon className="h-6 w-6" />
              </DesktopIconLink>
            </>
          ) : (
            <DesktopIconLink href="/login" ariaLabel="Sign in">
              <NavLoginIcon className="h-6 w-6" />
            </DesktopIconLink>
          )}
        </div>
      </div>
    </div>
  );
}
