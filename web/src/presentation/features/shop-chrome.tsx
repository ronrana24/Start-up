"use client";

import {
  NavAccountIcon,
  NavAboutIcon,
  NavCartIcon,
  NavCatalogIcon,
  NavContactIcon,
  NavHomeIcon,
  NavLoginIcon,
  NavTrackingIcon,
} from "@presentation/components/shop/nav-icons";
import { DesktopNavBar } from "@presentation/components/shop/desktop-nav-bar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@presentation/lib/cn";
import { useAuthStore } from "../state/auth-store";
import { useCartStore } from "../state/cart-store";

function isOrderTrackDetail(pathname: string): boolean {
  return /^\/orders\/[^/]+\/track$/.test(pathname);
}

function isOrderConfirmation(pathname: string): boolean {
  return /^\/orders\/[^/]+\/confirmation$/.test(pathname);
}

function isProductDetail(pathname: string): boolean {
  return /^\/products\/[^/]+$/.test(pathname);
}

function hasFlushMobileHeader(pathname: string): boolean {
  return (
    pathname === "/account" ||
    pathname === "/cart" ||
    pathname === "/checkout" ||
    pathname === "/orders/history" ||
    pathname === "/orders/tracking" ||
    isOrderTrackDetail(pathname) ||
    isOrderConfirmation(pathname) ||
    isProductDetail(pathname)
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
  badgeCount,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  badgeCount?: number;
}) {
  const showBadge = typeof badgeCount === "number" && badgeCount > 0;
  const badgeLabel = badgeCount && badgeCount > 99 ? "99+" : badgeCount;

  return (
    <Link
      href={href}
      aria-label={showBadge ? `${label}, ${badgeLabel} items` : label}
      className={cn(
        "flex min-h-[3.5rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[1.35rem] px-0.5 py-1.5 text-[10px] font-semibold leading-tight transition-colors sm:text-[11px]",
        active
          ? "bg-white/45 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.58)]"
          : "text-secondary hover:bg-white/28 hover:text-heading",
      )}
    >
      <span
        className={cn(
          "relative",
          showBadge &&
            "flex h-9 w-9 items-center justify-center rounded-full bg-catalog-blue/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] ring-1 ring-catalog-blue-light/40",
          !showBadge && (active ? "text-primary" : "text-secondary"),
        )}
      >
        {icon}
        {showBadge ? (
          <span className="absolute -right-2 -top-2 flex min-h-[1.05rem] min-w-[1.05rem] items-center justify-center rounded-full border border-white/80 bg-catalog-green px-1 text-[9px] font-black leading-none text-white shadow-sm">
            {badgeLabel}
          </span>
        ) : null}
      </span>
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}

export function ShopChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const trackingActive =
    pathname === "/orders/tracking" || isOrderTrackDetail(pathname);
  const catalogRoute = pathname === "/catalog";
  const flushMobileHeader = hasFlushMobileHeader(pathname);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const lines = useCartStore((s) => s.lines);
  const cartCount = lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <div className="flex min-h-0 max-w-full flex-1 flex-col overflow-x-hidden">
      <div className="sticky top-0 z-50 hidden lg:block">
        <DesktopNavBar />
      </div>

      <main
        className={cn(
          "mx-auto flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col items-stretch overflow-x-hidden pb-24 sm:max-w-3xl md:max-w-5xl lg:max-w-6xl lg:pb-8 xl:max-w-7xl 2xl:max-w-[88rem]",
          catalogRoute
            ? "px-0 py-0"
            : flushMobileHeader
              ? "px-4 pt-0 sm:px-6 sm:pt-0 md:px-8 md:pt-0 lg:px-10 lg:pt-6 xl:px-12"
              : "px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 lg:px-10 xl:px-12",
        )}
      >
        {children}
      </main>

      <nav className="pointer-events-none fixed inset-x-0 bottom-3 z-50 px-3 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mobile-glass-nav pointer-events-auto mx-auto flex max-w-lg overflow-hidden rounded-[1.75rem] border border-white/55 p-1 shadow-[0_18px_45px_-20px_rgba(15,81,50,0.5)] ring-1 ring-white/35 sm:max-w-3xl">
          {isAuthenticated ? (
            <>
              <NavLink
                href="/"
                label="Home"
                icon={<NavHomeIcon className="h-6 w-6" />}
                active={pathname === "/"}
              />
              <NavLink
                href="/catalog"
                label="Catalog"
                icon={<NavCatalogIcon className="h-6 w-6" />}
                active={catalogRoute}
              />
              <NavLink
                href="/cart"
                label="Cart"
                icon={<NavCartIcon className="h-6 w-6" />}
                active={pathname.startsWith("/cart")}
                badgeCount={cartCount}
              />
              <NavLink
                href="/orders/tracking"
                label="Tracking"
                icon={<NavTrackingIcon className="h-6 w-6" />}
                active={trackingActive}
              />
              <NavLink
                href="/account"
                label="Account"
                icon={<NavAccountIcon className="h-6 w-6" />}
                active={pathname.startsWith("/account")}
              />
            </>
          ) : (
            <>
              <NavLink
                href="/"
                label="Home"
                icon={<NavHomeIcon className="h-6 w-6" />}
                active={pathname === "/"}
              />
              <NavLink
                href="/about"
                label="About Us"
                icon={<NavAboutIcon className="h-6 w-6" />}
                active={pathname === "/about" || pathname.startsWith("/about/")}
              />
              <NavLink
                href="/contact"
                label="Contact"
                icon={<NavContactIcon className="h-6 w-6" />}
                active={
                  pathname === "/contact" || pathname.startsWith("/contact/")
                }
              />
              <NavLink
                href="/login"
                label="Login"
                icon={<NavLoginIcon className="h-6 w-6" />}
                active={pathname === "/login" || pathname.startsWith("/login/")}
              />
            </>
          )}
        </div>
      </nav>
    </div>
  );
}
