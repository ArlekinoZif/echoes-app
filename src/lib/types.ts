export type StoryCategory =
  | "War"
  | "Love"
  | "Immigration"
  | "Entrepreneurship"
  | "Family"
  | "Survival"
  | "Other";

export type PublishGate = "pay" | "evaluate";

export interface Story {
  id: string;
  title: string;
  description: string;
  category: StoryCategory;
  audioBlobUrl: string;
  durationSeconds: number;
  publishGate: PublishGate;
  createdAt: number;
  status: "draft" | "pending_eval" | "tokenized";
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
