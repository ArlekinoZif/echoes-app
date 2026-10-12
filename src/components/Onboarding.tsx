"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, Zap, ChevronRight, Check, Mail } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useIdentity } from "@/hooks/useIdentity";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

const SLIDES = [
  {
    emoji: "📚",
    title: "Your Life is a Library",
    body: "You don't need to be famous to be heard. Your experiences are valuable lessons for the next generation.",
    accent: "#ededed",
  },
  {
    emoji: "📢",
    title: "Share Your Voice",
    body: "Tell us about your first job, a funny mistake, or read a piece of a tale. Your voice has character AI cannot replicate.",
    accent: "#ededed",
  },
  {
    emoji: "💸",
    title: "Earn from Memories",
    body: "Each story becomes a digital asset. Listeners tip you, and you earn fees when your story is traded.",
    accent: "#c8a84b",
  },
];

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
  micAllowed: boolean;
  termsAccepted: boolean;
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

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all"
      style={active
        ? { background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.25)", color: "var(--text-1)" }
        : { background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.06)", color: "var(--text-3)" }
      }>
      {active && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#ededed" }} />}
      {children}
    </button>
  );
}

export default function Onboarding() {
  const { authenticated } = useWallet();
  const { userId, email: accountEmail } = useIdentity();
  const [phase, setPhase] = useState<"intro" | "profile" | "done">("done");
  const [authReady, setAuthReady] = useState(false);
  const [slide, setSlide] = useState(0);
  const [profileStep, setProfileStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    age: "", gender: "", status: "", country: "",
    languages: "", goals: [], email: "", micAllowed: false, termsAccepted: false,
  });
  const micRef = useRef(false);

  useEffect(() => {
    if (!authenticated) return;
    setAuthReady(true);
    const seen = localStorage.getItem("echoes_onboarded");
    if (!seen) setPhase("intro");
  }, [authenticated]);

  // Helius already captured the email at login — use it so the user never has to
  // type it twice. Derived (not state) to avoid syncing effects.
  const effectiveEmail = accountEmail ?? profile.email;

  function animatedClose(cb: () => void) {
    setExiting(true);
    setTimeout(cb, 280);
  }

  function nextSlide() {
    if (slide < SLIDES.length - 1) setSlide(s => s + 1);
    else { setSlide(0); setPhase("profile"); }
  }

  function step1Valid() { return profile.age.trim() !== "" && profile.gender !== "" && profile.status !== "" && profile.country.trim() !== ""; }
  function step2Valid() { return profile.languages.trim() !== "" && profile.goals.length > 0; }
  function step3Valid() { return effectiveEmail.includes("@") && profile.termsAccepted; }

  function toggleGoal(g: Goal) {
    setProfile(p => ({ ...p, goals: p.goals.includes(g) ? p.goals.filter(x => x !== g) : [...p.goals, g] }));
  }

  async function requestMic() {
    if (micRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      micRef.current = true;
      setProfile(p => ({ ...p, micAllowed: true }));
    } catch { /* user denied */ }
  }

  async function finish() {
    localStorage.setItem("echoes_profile", JSON.stringify(profile));
    animatedClose(async () => {
      localStorage.setItem("echoes_onboarded", "1");
      setPhase("done");
      // Profiles are keyed by the connected Solana wallet address.
      if (userId) {
        authenticatedFetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet: userId,
            age: profile.age ? Number(profile.age) : undefined,
            gender: profile.gender || undefined,
            status: profile.status || undefined,
            country: profile.country || undefined,
            languages: profile.languages || undefined,
            goals: profile.goals.join(","),
            email: effectiveEmail || undefined,
          }),
        }).catch(() => {});
      }
    });
  }

  if (!authReady || phase === "done") return null;

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 100,
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    padding: "0 16px 20px",
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    opacity: exiting ? 0 : 1,
    transition: "opacity 0.28s ease",
  };

  const card: React.CSSProperties = {
    width: "100%", maxWidth: "400px",
    borderRadius: "28px", padding: "24px 20px 28px",
    background: "rgba(18,18,18,0.97)",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)",
    display: "flex", flexDirection: "column", gap: "16px",
    transform: exiting ? "translateY(40px)" : "translateY(0)",
    transition: "transform 0.28s ease",
  };

  // ── Intro ──
  if (phase === "intro") {
    const { emoji, title, body, accent } = SLIDES[slide];
    const isLast = slide === SLIDES.length - 1;
    return (
      <div style={overlay}>
        <div style={card}>
          {/* emoji */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
              {emoji}
            </div>
          </div>
          {/* text */}
          <div className="text-center flex flex-col gap-2">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-1)" }}>{title}</h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{body}</p>
          </div>
          {/* dots */}
          <div className="flex justify-center gap-2">
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => setSlide(i)}
                className="rounded-full transition-all"
                style={{ width: i === slide ? "20px" : "6px", height: "6px", background: i === slide ? accent : "rgba(255,255,255,0.15)" }} />
            ))}
          </div>
          {/* actions */}
          <div className="flex flex-col gap-2">
            <button onClick={nextSlide}
              className="btn-gold w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all">
              {isLast ? "Set up my studio" : "Next"} <ChevronRight className="w-4 h-4" />
            </button>
            {!isLast && (
              <button onClick={() => { setSlide(0); setPhase("profile"); }}
                className="w-full py-2 text-sm" style={{ color: "var(--text-3)" }}>
                Skip
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Profile Setup ──
  const steps = ["About you", "Languages & Goals", "Final touches"];

  return (
    <div style={overlay}>
      <div style={card}>
        {/* step indicator */}
        <div className="flex items-center gap-2">
          {steps.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className="flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0"
                style={{
                  width: "24px", height: "24px",
                  background: i < profileStep ? "#ededed" : i === profileStep ? "#ededed" : "rgba(255,255,255,0.06)",
                  color: i <= profileStep ? "#0c0c0c" : "var(--text-3)",
                  border: i > profileStep ? "1px solid rgba(255,255,255,0.08)" : "none",
                }}>
                {i < profileStep ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 h-px"
                  style={{ background: i < profileStep ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)" }} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {profileStep === 0 && (
          <>
            <div>
              <h2 className="text-base font-bold mb-0.5" style={{ color: "var(--text-1)" }}>Tell about yourself</h2>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>Help us personalise your experience</p>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: "var(--text-3)" }}>Age</label>
                <input type="number" min={10} max={120} value={profile.age}
                  onChange={e => setProfile(p => ({ ...p, age: e.target.value }))}
                  placeholder="Your age"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "var(--text-1)" }} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-3)" }}>Gender</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {GENDERS.map(g => (
                    <Chip key={g.value} active={profile.gender === g.value} onClick={() => setProfile(p => ({ ...p, gender: g.value }))}>{g.label}</Chip>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-3)" }}>Current status</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {STATUSES.map(s => (
                    <Chip key={s.value} active={profile.status === s.value} onClick={() => setProfile(p => ({ ...p, status: s.value }))}>{s.label}</Chip>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: "var(--text-3)" }}>Country of living</label>
                <input type="text" value={profile.country}
                  onChange={e => setProfile(p => ({ ...p, country: e.target.value }))}
                  placeholder="e.g. Ukraine"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "var(--text-1)" }} />
              </div>
            </div>
            <button onClick={() => setProfileStep(1)} disabled={!step1Valid()}
              className="btn-gold w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Step 2 */}
        {profileStep === 1 && (
          <>
            <div>
              <h2 className="text-base font-bold mb-0.5" style={{ color: "var(--text-1)" }}>Language & Goals</h2>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>We&apos;ll match stories to your preferences</p>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: "var(--text-3)" }}>Languages you speak</label>
                <input type="text" value={profile.languages}
                  onChange={e => setProfile(p => ({ ...p, languages: e.target.value }))}
                  placeholder="e.g. English, Ukrainian"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "var(--text-1)" }} />
                <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>Comma separated</p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-3)" }}>I&apos;m here to…</label>
                <div className="flex flex-col gap-1.5">
                  {GOALS.map(g => (
                    <Chip key={g.value} active={profile.goals.includes(g.value)} onClick={() => toggleGoal(g.value)}>
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{g.label}</span>
                        <span className="text-xs" style={{ color: "var(--text-3)" }}>{g.sub}</span>
                      </span>
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setProfileStep(0)}
                className="flex-1 py-3 rounded-2xl font-semibold text-sm"
                style={{ border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-2)" }}>
                Back
              </button>
              <button onClick={() => setProfileStep(2)} disabled={!step2Valid()}
                className="btn-gold flex-[2] py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* Step 3 */}
        {profileStep === 2 && (
          <>
            <div>
              <h2 className="text-base font-bold mb-0.5" style={{ color: "var(--text-1)" }}>Final Touches</h2>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>Almost there</p>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: "var(--text-3)" }}>Email address</label>
                {accountEmail ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "var(--text-2)" }}>
                    <Mail className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-3)" }} />
                    <span className="truncate">{accountEmail}</span>
                    <Check className="w-4 h-4 ml-auto flex-shrink-0" style={{ color: "#10b981" }} />
                  </div>
                ) : (
                  <input type="email" value={profile.email}
                    onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "var(--text-1)" }} />
                )}
              </div>
              <button type="button" onClick={requestMic}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all"
                style={profile.micAllowed
                  ? { background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.25)" }
                  : { background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.06)" }
                }>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: profile.micAllowed ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)" }}>
                  {profile.micAllowed ? <Check className="w-4 h-4" style={{ color: "#ededed" }} /> : <Mic className="w-4 h-4" style={{ color: "var(--text-3)" }} />}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                    {profile.micAllowed ? "Microphone allowed ✓" : "Allow microphone use"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>Required for recording stories</p>
                </div>
              </button>
              <button type="button" onClick={() => setProfile(p => ({ ...p, termsAccepted: !p.termsAccepted }))}
                className="flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all"
                style={profile.termsAccepted
                  ? { background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.25)" }
                  : { background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.06)" }
                }>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: profile.termsAccepted ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)" }}>
                  {profile.termsAccepted ? <Check className="w-4 h-4" style={{ color: "#ededed" }} /> : <span className="text-xs font-bold" style={{ color: "var(--text-3)" }}>T&C</span>}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>Agree to Terms & Conditions</p>
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>Your recordings are stored on Solana. You own your content.</p>
                </div>
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setProfileStep(1)}
                className="flex-1 py-3 rounded-2xl font-semibold text-sm"
                style={{ border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-2)" }}>
                Back
              </button>
              <button onClick={finish} disabled={!step3Valid()}
                className="btn-gold flex-[2] py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <Zap className="w-4 h-4" /> Let&apos;s go!
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
