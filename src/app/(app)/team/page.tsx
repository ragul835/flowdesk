"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Member, Role } from "@/lib/types";
import Avatar from "@/components/Avatar";

type TeamResponse = { myRole: Role; members: Member[] };

const ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER"];
const RANK: Record<Role, number> = { MEMBER: 1, ADMIN: 2, OWNER: 3 };

export default function TeamPage() {
  const [data, setData] = useState<TeamResponse | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; link?: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api<TeamResponse>("/api/team");
    setData(r);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setMsg(null);
    try {
      const res = await api<{ member: Member; setupUrl?: string }>("/api/team", {
        method: "POST",
        body: JSON.stringify({ email, name: name || undefined, role }),
      });
      setMsg({
        ok: true,
        text: `${res.member.name} added to the team.`,
        link: res.setupUrl,
      });
      setEmail("");
      setName("");
      setRole("MEMBER");
      load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed to invite" });
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(userId: string, newRole: Role) {
    await api(`/api/team/${userId}`, { method: "PATCH", body: JSON.stringify({ role: newRole }) });
    load();
  }

  async function removeMember(userId: string, memberName: string) {
    if (!confirm(`Remove ${memberName} from the workspace?`)) return;
    await api(`/api/team/${userId}`, { method: "DELETE" });
    load();
  }

  if (!data) return <p className="text-slate-500">Loading team…</p>;

  const isOwner = data.myRole === "OWNER";
  const canInvite = RANK[data.myRole] >= RANK.ADMIN;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team members</h1>
        <p className="text-sm text-slate-500">{data.members.length} people in this workspace.</p>
      </div>

      {canInvite && (
        <form onSubmit={invite} className="card space-y-3 p-5">
          <h2 className="font-semibold">Invite a member</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@company.com"
              required
            />
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
            />
            <select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
              {isOwner && <option value="OWNER">Owner</option>}
            </select>
            <button type="submit" className="btn-primary" disabled={inviting}>
              {inviting ? "Inviting…" : "Invite"}
            </button>
          </div>
          {msg && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {msg.text}
              {msg.link && (
                <>
                  {" "}
                  <a href={msg.link} className="font-medium underline">
                    Copy their setup link
                  </a>
                  <span className="block text-xs text-slate-500">
                    (No mail server configured — share this link so they can set a password.)
                  </span>
                </>
              )}
            </div>
          )}
        </form>
      )}

      <div className="card divide-y divide-slate-100">
        {data.members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 p-4">
            <Avatar name={m.name} color={m.avatarColor} size={40} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{m.name}</p>
              <p className="truncate text-sm text-slate-500">
                {m.title ? `${m.title} · ` : ""}
                {m.email}
              </p>
            </div>

            {isOwner ? (
              <select
                value={m.role}
                onChange={(e) => changeRole(m.id, e.target.value as Role)}
                className="input w-auto text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0) + r.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
              </span>
            )}

            {canInvite && m.role !== "OWNER" && (
              <button
                onClick={() => removeMember(m.id, m.name)}
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
