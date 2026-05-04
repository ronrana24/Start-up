"use client";

import {
  NavAccountIcon,
  NavCartIcon,
  NavCatalogIcon,
  NavHistoryIcon,
  NavHomeIcon,
  NavTrackingIcon,
} from "@presentation/components/shop/nav-icons";
import { DesktopNavBar } from "@presentation/components/shop/desktop-nav-bar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@presentation/lib/cn";

function isOrderTrackDetail(pathname: string): boolean {
  return /^\/orders\/[^/]+\/track$/.test(pathname);
}

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[10px] font-semibold leading-tight sm:text-[11px]",
        active ? "text-primary" : "text-secondary",
      )}
    >
      <span className={cn(active ? "text-primary" : "text-secondary")}>{icon}</span>
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}

export function ShopChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const trackingActive =
    pathname === "/orders/tracking" || isOrderTrackDetail(pathname);
  const historyActive = pathname === "/orders/history";
  const catalogRoute = pathname === "/catalog";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header
        className={cn(
          "sticky top-0 z-10 border-b border-default bg-card/95 backdrop-blur lg:hidden",
          catalogRoute && "hidden",
        )}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3 sm:max-w-3xl">
          <Link href="/" className="text-lg font-bold text-primary">
            Grove
          </Link>
        </div>
      </header>

      <div className="hidden lg:block">
        <DesktopNavBar />
      </div>

      <main
        className={cn(
          "mx-auto w-full max-w-lg flex-1 pb-24 lg:max-w-3xl lg:pb-6 lg:pt-6",
          catalogRoute ? "px-0 py-0" : "px-4 py-4",
        )}
      >
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-default bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg sm:max-w-3xl">
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
          />
          <NavLink
            href="/orders/tracking"
            label="Tracking"
            icon={<NavTrackingIcon className="h-6 w-6" />}
            active={trackingActive}
          />
          <NavLink
            href="/orders/history"
            label="History"
            icon={<NavHistoryIcon className="h-6 w-6" />}
            active={historyActive}
          />
          <NavLink
            href="/account"
            label="Account"
            icon={<NavAccountIcon className="h-6 w-6" />}
            active={pathname.startsWith("/account")}
          />
        </div>
      </nav>
    </div>
  );
}
