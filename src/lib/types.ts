export type StoryCategory =
  | "War"
  | "Love"
  | "Immigration"
  | "Entrepreneurship"
  | "Family"
  | "Survival"
  | "Other";

export type PublishGate = "pay" | "evaluate";

/** draft → pending_eval → listed → tokenized */
export type StoryStatus = "draft" | "pending_eval" | "listed" | "tokenized";

/** Who launched the token on Bags App */
export type LaunchType = "author" | "sponsor";

export interface Story {
  id: string;
  title: string;
  description: string;
  category: StoryCategory;
  audioBlobUrl: string;
  durationSeconds: number;
  publishGate: PublishGate;
  createdAt: number;
  status: StoryStatus;
  // Stable Solana wallet address of the author — the canonical owner key.
  // Survives re-login and exists without a wallet. See useIdentity.
  ownerId?: string;
  // Real Solana wallet (set when connected, used for on-chain payout/sponsor).
  authorWallet?: string;

  // Set after listing (pay gate completes)
  listingTxSig?: string;

  // Cover image (optional, uploaded at record time)
  coverImageUrl?: string;

  // Optional legacy author social identity.
  authorTwitter?: string;

  // Set after tokenization
  ticker?: string;
  tokenMint?: string;
  tokenListingUrl?: string;
  launchType?: LaunchType;
  sponsorWallet?: string;
  arweaveCid?: string;

  // Private audio (paywall)
  isPrivate?: boolean;
  priceSol?: number;
}

export interface EvaluationCriteria {
  audioQuality: number; // 1-5
  storytelling: number; // 1-5
  descriptionAccuracy: number; // 1-5
}

export interface Evaluation {
  storyId: string;
  criteria: EvaluationCriteria;
  listenedPercent: number;
}
