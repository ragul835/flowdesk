"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Avatar from "@/components/Avatar";
import type { SessionUser } from "@/lib/auth";

export default function TopNav({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight">
            Flow<span className="text-brand-600">Desk</span>
          </Link>
          <nav className="hidden gap-1 sm:flex">
            <Link href="/dashboard" className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              Dashboard
            </Link>
            <Link href="/team" className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              Team
            </Link>
          </nav>
        </div>

        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100"
          >
            <Avatar name={user.name} color={user.avatarColor} size={32} />
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-xs leading-tight text-slate-500">{user.title || user.email}</p>
            </div>
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
                <Link href="/settings" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-slate-50">
                  Profile & settings
                </Link>
                <Link href="/team" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-slate-50">
                  Team members
                </Link>
                <button
                  onClick={logout}
                  className="block w-full border-t border-slate-100 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
