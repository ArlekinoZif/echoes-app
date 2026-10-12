"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useIdentity } from "@/hooks/useIdentity";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

type Gender = "male" | "female" | "non-binary" | "prefer not to say";
type Status = "employed" | "unemployed" | "student" | "retired";
type Goal = "tell" | "listen" | "earn" | "inspire";

interface ProfileData {
  age: string;
  gender: Gender | "";
  status: Status | "";
  country: string;
  languages: string;
  goals: Goal[];
  email: string;
}

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non-binary", label: "Non-binary" },
  { value: "prefer not to say", label: "Prefer not to say" },
];

const STATUSES: { value: Status; label: string }[] = [
  { value: "employed", label: "Employed" },
  { value: "unemployed", label: "Unemployed" },
  { value: "student", label: "Student" },
  { value: "retired", label: "Retired" },
];

const GOALS: { value: Goal; label: string; sub: string }[] = [
  { value: "tell", label: "Tell my stories", sub: "Share life experiences" },
  { value: "listen", label: "Listen to others", sub: "Learn from real people" },
  { value: "earn", label: "Make some money", sub: "Get paid for sharing" },
  { value: "inspire", label: "Get inspired", sub: "Hear wisdom and perspectives" },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all"
      style={
        active
          ? { background: "rgba(200,168,75,0.1)", border: "1.5px solid rgba(200,168,75,0.4)", color: "var(--text-1)" }
          : { background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.08)", color: "var(--text-3)" }
      }
    >
      {active && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#c8a84b" }} />}
      {children}
    </button>
  );
}

export default function ProfileEditPage() {
  const router = useRouter();
  const { userId, email: accountEmail } = useIdentity();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [profile, setProfile] = useState<ProfileData>({
    age: "",
    gender: "",
    status: "",
    country: "",
    languages: "",
    goals: [],
    email: "",
  });

  useEffect(() => {
    const stored = localStorage.getItem("echoes_profile");
    if (stored) {
      try {
        const p = JSON.parse(stored);
        setProfile({
          age: p.age ?? "",
          gender: p.gender ?? "",
          status: p.status ?? "",
          country: p.country ?? "",
          languages: p.languages ?? "",
          goals: p.goals ?? [],
          email: p.email ?? "",
        });
      } catch { /* ignore */ }
    }
  }, []);

  // Helius already knows the user's email — prefer it, no manual typing needed.
  const emailValue = accountEmail ?? profile.email;

  function toggleGoal(g: Goal) {
    setProfile((p) => ({
      ...p,
      goals: p.goals.includes(g) ? p.goals.filter((x) => x !== g) : [...p.goals, g],
    }));
  }

  async function handleSave() {
    setSaving(true);
    const updatedProfile = { ...profile };
    localStorage.setItem("echoes_profile", JSON.stringify(updatedProfile));

    if (userId) {
      try {
        await authenticatedFetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet: userId,
            age: profile.age ? Number(profile.age) : undefined,
            gender: profile.gender || undefined,
            status: profile.status || undefined,
            country: profile.country || undefined,
            languages: profile.languages || undefined,
            goals: profile.goals.join(",") || undefined,
            email: emailValue || undefined,
          }),
        });
      } catch { /* ignore — stored locally */ }
    }

    setSaved(true);
    setSaving(false);
    setTimeout(() => router.push("/zone"), 1000);
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-xl mx-auto px-4 py-10 pb-16">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/zone"
            className="p-2 rounded-full transition-colors"
            style={{ background: "rgba(20,20,20,0.95)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-2)" }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-1)" }}>Edit profile</h1>
            <p className="text-sm" style={{ color: "var(--text-3)" }}>Update your personal info</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Age */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-3)" }}>Age</label>
            <input
              type="number"
              min={10}
              max={120}
              value={profile.age}
              onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value }))}
              placeholder="Your age"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
              style={{ background: "rgba(20,20,20,0.95)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-1)" }}
            />
          </div>

          {/* Gender */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-3)" }}>Gender</label>
            <div className="grid grid-cols-2 gap-2">
              {GENDERS.map((g) => (
                <Chip key={g.value} active={profile.gender === g.value} onClick={() => setProfile((p) => ({ ...p, gender: g.value }))}>
                  {g.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-3)" }}>Current status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <Chip key={s.value} active={profile.status === s.value} onClick={() => setProfile((p) => ({ ...p, status: s.value }))}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Country */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-3)" }}>Country</label>
            <input
              type="text"
              value={profile.country}
              onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))}
              placeholder="e.g. Ukraine"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
              style={{ background: "rgba(20,20,20,0.95)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-1)" }}
            />
          </div>

          {/* Languages */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-3)" }}>Languages</label>
            <input
              type="text"
              value={profile.languages}
              onChange={(e) => setProfile((p) => ({ ...p, languages: e.target.value }))}
              placeholder="e.g. English, Ukrainian"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
              style={{ background: "rgba(20,20,20,0.95)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-1)" }}
            />
            <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>Comma separated</p>
          </div>

          {/* Goals */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-3)" }}>I&apos;m here to…</label>
            <div className="flex flex-col gap-2">
              {GOALS.map((g) => (
                <Chip key={g.value} active={profile.goals.includes(g.value)} onClick={() => toggleGoal(g.value)}>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{g.label}</span>
                    <span className="text-xs" style={{ color: "var(--text-3)" }}>{g.sub}</span>
                  </span>
                </Chip>
              ))}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-3)" }}>Email</label>
            <input
              type="email"
              value={emailValue}
              onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
              placeholder="you@example.com"
              readOnly={!!accountEmail}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
              style={{ background: "rgba(20,20,20,0.95)", border: "1px solid rgba(255,255,255,0.1)", color: accountEmail ? "var(--text-3)" : "var(--text-1)" }}
            />
            {accountEmail && (
              <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>From your login — no need to re-enter.</p>
            )}
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-60"
            style={{
              background: saved
                ? "rgba(16,185,129,0.12)"
                : "#ededed",
              color: saved ? "#10b981" : "#fff",
            }}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </span>
            ) : saved ? (
              "✓ Saved!"
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
