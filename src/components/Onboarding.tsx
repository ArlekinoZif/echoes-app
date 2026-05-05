"use client";

import { useState, useEffect } from "react";
import { Mic, Library, Zap } from "lucide-react";

const SLIDES = [
  {
    icon: Mic,
    gradient: "linear-gradient(135deg, #a8edea, #fed6e3)",
    title: "Record your story",
    body: "Speak freely. War, love, survival, immigration — your real experience deserves to be heard by the world.",
  },
  {
    icon: Library,
    gradient: "linear-gradient(135deg, #fed6e3, #c3b1e1)",
    title: "Get listed in the library",
    body: "Evaluate 3 other stories for free, or pay $1 in $ECHOES to publish instantly. Your story enters the weekly vote pool.",
  },
  {
    icon: Zap,
    gradient: "linear-gradient(135deg, #c3b1e1, #a8edea)",
    title: "Tokenize & earn forever",
    body: "Launch a token on Bags App backed by your story. Earn 0.75% of every trade — forever. Sponsors can co-launch and share revenue.",
  },
];

export default function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("echoes_onboarded");
    if (!seen) setVisible(true);
  }, []);

  function dismiss() {
    setExiting(true);
    setTimeout(() => {
      localStorage.setItem("echoes_onboarded", "1");
      setVisible(false);
    }, 300);
  }

  function next() {
    if (slide < SLIDES.length - 1) {
      setSlide((s) => s + 1);
    } else {
      dismiss();
    }
  }

  if (!visible) return null;

  const { icon: Icon, gradient, title, body } = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "0 16px 20px",
        background: "rgba(0,0,0,0.25)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        opacity: exiting ? 0 : 1,
        transition: "opacity 0.3s ease",
      }}
    >
      <div
        className="w-full max-w-sm rounded-3xl flex flex-col gap-3"
        style={{
          padding: "16px 20px 20px",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.95)",
          boxShadow: "0 8px 48px rgba(0,0,0,0.12)",
          transform: exiting ? "translateY(40px)" : "translateY(0)",
          transition: "transform 0.3s ease, opacity 0.3s ease",
        }}
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: gradient }}
          >
            <Icon className="w-6 h-6 text-black" strokeWidth={1.5} />
          </div>
        </div>

        {/* Text */}
        <div className="text-center flex flex-col gap-1.5">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-1)" }}>
            {title}
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
            {body}
          </p>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className="rounded-full transition-all"
              style={{
                width: i === slide ? "20px" : "6px",
                height: "6px",
                background:
                  i === slide
                    ? "linear-gradient(90deg, #00c6be, #ff6b9d)"
                    : "rgba(0,0,0,0.15)",
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={next}
            className="w-full py-3 rounded-2xl font-semibold text-sm transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #00c6be, #ff6b9d, #c77dff)",
              color: "#fff",
            }}
          >
            {isLast ? "Get started" : "Next"}
          </button>
          {!isLast && (
            <button
              onClick={dismiss}
              className="w-full py-2 text-sm transition-colors"
              style={{ color: "var(--text-3)" }}
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
