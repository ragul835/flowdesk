"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Board from "@/components/Board";

export default function BoardPage({ params }: { params: { projectId: string } }) {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    api<{ user: { id: string; name: string } }>("/api/auth/me").then((r) => setUser(r.user));
  }, []);

  if (!user) return <p className="text-slate-500">Loading…</p>;
  return <Board projectId={params.projectId} currentUser={user} />;
}
