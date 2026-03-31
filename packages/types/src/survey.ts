import type { BaseDocument } from "./base.js";

export type SurveyStatus = "active" | "closed";

export interface SurveyChoice {
  id: string;
  text: string;
}

export interface Survey extends BaseDocument {
  question: string;
  choices: SurveyChoice[];
  status: SurveyStatus;
  createdBy: string;
}

export interface SurveyVote extends BaseDocument {
  surveyId: string;
  visitorId: string;
  choiceId: string;
}
