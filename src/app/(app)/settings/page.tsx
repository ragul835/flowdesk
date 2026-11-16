"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { AVATAR_COLORS } from "@/lib/avatar";
import Avatar from "@/components/Avatar";

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  // profile form
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [avatarColor, setAvatarColor] = useState("#4f46e5");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api<{ profile: Profile }>("/api/profile").then((r) => {
      setProfile(r.profile);
      setName(r.profile.name);
      setTitle(r.profile.title);
      setAvatarColor(r.profile.avatarColor);
    });
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ name, title, avatarColor }),
      });
      setProfileMsg("Saved");
      router.refresh(); // update nav avatar/name
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPw(true);
    setPwMsg(null);
    try {
      await api("/api/profile/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPwMsg({ ok: true, text: "Password updated" });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSavingPw(false);
    }
  }

  if (!profile) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile &amp; settings</h1>
        <p className="text-sm text-slate-500">Manage your personal details and password.</p>
      </div>

      {/* Profile */}
      <form onSubmit={saveProfile} className="card space-y-4 p-6">
        <div className="flex items-center gap-4">
          <Avatar name={name || profile.name} color={avatarColor} size={56} />
          <div>
            <p className="font-semibold">{name || profile.name}</p>
            <p className="text-sm text-slate-500">{profile.email}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Job title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Product Designer"
            />
          </div>
        </div>

        <div>
          <label className="label">Avatar color</label>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setAvatarColor(c)}
                style={{ background: c }}
                className={`h-8 w-8 rounded-full transition ${
                  avatarColor === c ? "ring-2 ring-slate-900 ring-offset-2" : ""
                }`}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={savingProfile}>
            {savingProfile ? "Saving…" : "Save changes"}
          </button>
          {profileMsg && <span className="text-sm text-slate-500">{profileMsg}</span>}
        </div>
      </form>

      {/* Password */}
      <form onSubmit={changePassword} className="card space-y-4 p-6">
        <h2 className="font-semibold">Change password</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Current password</label>
            <input
              type="password"
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">New password</label>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={savingPw}>
            {savingPw ? "Updating…" : "Update password"}
          </button>
          {pwMsg && (
            <span className={`text-sm ${pwMsg.ok ? "text-green-600" : "text-red-600"}`}>
              {pwMsg.text}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
