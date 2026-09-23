export const SOURCES = [
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "smartrecruiters",
  "recruitee",
  "breezy",
  "teamtailor",
] as const;

export type Source = (typeof SOURCES)[number];

export type Company = {
  name: string;
  source: Source;
  slug: string;
};

export type Job = {
  source: Source;
  company: string;
  title: string;
  location: string;
  url: string;
  updated: string;
};

export type BoardFailure = {
  name: string;
  source: Source;
  slug: string;
};

export type SearchPayload = {
  jobs: Job[];
  checked: number;
  failed: BoardFailure[];
};
