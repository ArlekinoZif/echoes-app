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
  authorWallet?: string;

  // Set after listing (pay gate completes)
  listingTxSig?: string;

  // Set after tokenization
  ticker?: string;
  tokenMint?: string;
  tokenListingUrl?: string;
  launchType?: LaunchType;
  sponsorWallet?: string;
  arweaveCid?: string;
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
