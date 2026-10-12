import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — Echoes",
  description:
    "What Echoes collects, where it is stored, who it is shared with, and how to erase it.",
};

// NOTE FOR THE TEAM: the two values below are the only placeholders. Replace them
// with the legal entity and the contact address before submitting to a store.
const OPERATOR = "Echoes";
const CONTACT_EMAIL = "privacy@echoes.fans";
const UPDATED = "19 September 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-sm font-bold mb-2" style={{ color: "var(--text-1)" }}>{title}</h2>
      <div className="text-sm leading-relaxed flex flex-col gap-2" style={{ color: "var(--text-2)" }}>
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-20">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 mb-6 text-sm transition-opacity hover:opacity-80"
          style={{ color: "var(--text-3)" }}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-1)" }}>Privacy Policy</h1>
        <p className="text-xs mb-8" style={{ color: "var(--text-3)" }}>Last updated {UPDATED}</p>

        <Section title="Who operates Echoes">
          <p>
            Echoes is operated by {OPERATOR}. Questions about this policy, or about the
            data held about you, go to <a href={`mailto:${CONTACT_EMAIL}`} className="underline" style={{ color: "var(--amber)" }}>{CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <Section title="What we collect">
          <p><strong>Wallet address.</strong> Signing in proves control of a Solana address by signing a
            one-time challenge. That address is your account identifier. We never receive your seed
            phrase or private keys — on a Seeker they stay inside Seed Vault.</p>
          <p><strong>Profile details you choose to enter.</strong> Age, gender, occupation status, country,
            languages, goals, email and social handles. All of it is optional; the age, country and
            language fields are shown publicly so listeners can find stories by audience.</p>
          <p><strong>Recordings you publish.</strong> The audio itself, its title, description, category,
            duration and any cover image.</p>
          <p><strong>Activity.</strong> Evaluations you submit, stories you favourite, reports you file,
            referral code and referrals, votes in the weekly pool, and the signatures of on-chain
            payments used for listing, tokenising or unlocking a story.</p>
          <p><strong>Technical data.</strong> Standard server request logs. The app sets one session
            cookie, which is HttpOnly and same-site; it carries no tracking identifier and there is no
            advertising or analytics SDK in the app.</p>
        </Section>

        <Section title="Microphone">
          <p>
            The microphone is used only while you are recording a story, and only after Android asks
            for your permission. Audio is uploaded when you choose to publish; nothing is captured in
            the background.
          </p>
        </Section>

        <Section title="Where it is stored">
          <p>
            Story metadata, profiles and activity live in a managed Postgres database (Supabase, EU
            region). Audio and images live in object storage (Cloudflare R2); audio for private
            stories is served only through an authenticated proxy after payment is verified on-chain.
          </p>
          <p>
            Anything you publish to the Solana blockchain — a token launch, a listing payment, a vote —
            is public and permanent by the nature of a blockchain, and cannot be deleted by us or by
            you. The same applies to a story you choose to archive permanently on Arweave.
          </p>
        </Section>

        <Section title="Who else sees it">
          <p>
            We do not sell personal data and do not share it for advertising. Data is passed to service
            providers only to make a feature work: wallet and RPC infrastructure (Helius, Phantom),
            token launches and trading quotes (Bags, Jupiter), optional voice enhancement of a
            recording you submit (ElevenLabs), storage (Supabase, Cloudflare), and permanent archival
            when you request it (Arweave).
          </p>
          <p>
            Published stories, their titles, descriptions and the public profile fields listed above are
            visible to everyone, including on shared links.
          </p>
        </Section>

        <Section title="Deleting your account and data">
          <p>
            You can erase your account from inside the app: open your profile, then
            <strong> Delete account</strong>. This removes your profile, favourites, evaluations, reports
            and unlock records, and deletes the stories you own.
          </p>
          <p>
            One exception: a story that has already been tokenised exists on-chain and cannot be
            withdrawn. For those we delete the personal identifiers attached to the record instead.
            Blockchain transactions themselves remain public.
          </p>
          <p>
            You can also write to <a href={`mailto:${CONTACT_EMAIL}`} className="underline" style={{ color: "var(--amber)" }}>{CONTACT_EMAIL}</a> and we will
            carry out the erasure for you, along with any request to access or correct your data.
          </p>
        </Section>

        <Section title="Reporting content">
          <p>
            Every published story carries a <strong>Report</strong> action. Reports are reviewed and
            content that breaks the rules is removed. Reporting requires being signed in so that a
            single account cannot flood the queue.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Echoes is not directed at children under 13, and we do not knowingly collect their data. If
            you believe a child has provided us with personal data, contact us and we will erase it.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If this policy changes materially, the date above changes and the app shows the updated
            policy at this address.
          </p>
        </Section>
      </div>
    </div>
  );
}
