"use client";

import { cn } from "@presentation/lib/cn";
import Link from "next/link";
import { useState } from "react";
import { formatDateTime, statusLabel } from "./admin-format";
import {
  listAdminUsers,
  type AdminRoleFilter,
  type AdminUser,
} from "./admin-api";
import { useAdminQuery } from "./use-admin-query";

const roleFilters: Array<{ value: AdminRoleFilter; label: string }> = [
  { value: "BUYER", label: "Buyers" },
  { value: "ADMIN", label: "Admins" },
  { value: "RIDER", label: "Riders" },
  { value: "ALL", label: "All" },
];

function displayName(user: AdminUser): string {
  return user.name?.trim() || user.businessName || user.phone || "Unnamed user";
}

export function AdminUsersScreen() {
  const [role, setRole] = useState<AdminRoleFilter>("BUYER");
  const { data, error, isLoading } = useAdminQuery(
    ["admin", "users", role, 1, 100],
    () => listAdminUsers(role, 1, 100),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-catalog-text">All Users</h1>
          <p className="text-sm text-catalog-text-muted">
            Buyer-first account view with admins and riders available by filter.
          </p>
        </div>
        <div className="flex rounded-lg border border-catalog-border bg-card p-1">
          {roleFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={cn(
                "min-h-9 rounded-md px-3 text-xs font-bold transition-colors",
                role === filter.value
                  ? "bg-catalog-green text-white"
                  : "text-catalog-text-muted hover:bg-catalog-input hover:text-catalog-text",
              )}
              onClick={() => setRole(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-catalog-border bg-card shadow-sm">
        {isLoading ? (
          <div className="h-64 animate-pulse bg-catalog-input" />
        ) : error ? (
          <p className="p-4 text-sm text-red-600">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-catalog-surface text-xs uppercase text-catalog-text-muted">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">GST</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Addresses</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Insights</th>
                  <th className="px-4 py-3">Pricing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-catalog-border">
                {(data?.items ?? []).map((user) => (
                  <tr key={user.id} className="hover:bg-catalog-surface/70">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-catalog-text">
                        {displayName(user)}
                      </p>
                      <p className="text-xs text-catalog-text-muted">
                        {user.phone}
                        {user.email ? ` / ${user.email}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-catalog-green-border bg-catalog-green-muted px-2.5 py-1 text-xs font-bold text-catalog-green">
                        {statusLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-catalog-text">
                        {user.businessName}
                      </p>
                      <p className="text-xs text-catalog-text-muted">
                        {user.businessType}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {user.gstNumber ?? (
                        <span className="text-catalog-text-muted">Not added</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{user._count?.orders ?? 0}</td>
                    <td className="px-4 py-3">{user._count?.addresses ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-catalog-text-muted">
                      {formatDateTime(user.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {user.role === "BUYER" ? (
                        <Link
                          href={`/admin/users/${user.id}/analytics`}
                          className="text-xs font-bold text-catalog-green hover:underline"
                        >
                          View analytics
                        </Link>
                      ) : (
                        <span className="text-xs text-catalog-text-muted">
                          Not available
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.role === "BUYER" ? (
                        <Link
                          href={`/admin/users/${user.id}/pricing`}
                          className="text-xs font-bold text-catalog-blue hover:underline"
                        >
                          Special pricing
                        </Link>
                      ) : (
                        <span className="text-xs text-catalog-text-muted">
                          Not available
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-catalog-text-muted"
                    >
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
