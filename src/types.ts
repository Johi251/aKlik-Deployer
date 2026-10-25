export interface Source {
  id: string; name: string; url: string; feed?: string;
  kind: "github" | "markdown" | "directory" | "reference";
  purpose: string;
}
export interface Evidence { label: string; url: string; text: string; checkedAt: string }
export interface Candidate {
  id: string; name: string; url: string; description: string; sources: string[];
  score: number; reasons: string[]; kind: "repository" | "online";
  license?: string; stars?: number; updated?: string; archived?: boolean;
  cost: "oss" | "catalog" | "unknown"; evidence: Evidence[];
  category?: string; platforms?: string[]; licenseSource?: string;
  fit?: { type: string; hints: number; total: number; checks: RequirementCheck[]; cautions: string[] };
}
export interface RequirementCheck { requirement: string; status: "hint" | "unknown" | "conflict"; excerpt?: string; url?: string }
export interface SearchOptions { requirements?: string[]; excluded?: string[]; target?: "any" | "selfhosted" | "online" | "desktop" }
export interface Coverage {
  id: string; name: string; url: string;
  status: "searched" | "cached" | "partial" | "reference" | "failed";
  detail: string; count: number; checkedAt: string;
}
export interface SearchProfile {
  original: string; title: string; terms: string[]; githubQuery: string;
  localPreferred: boolean; openSourceOnly: boolean; notes: string[]; inputUrl?: string;
  requirements?: string[]; excluded?: string[]; target?: SearchOptions["target"];
}
export interface SearchResult {
  testOnly?: boolean;
  id: string; createdAt: string; profile: SearchProfile;
  candidates: Candidate[]; coverage: Coverage[]; recommendation: string;
}
export interface Favorite { testOnly?: boolean; id: string; candidate: Candidate; searchId: string; notes: string; createdAt: string; hidden: boolean }
export interface CandidateReview { id: string; candidateId: string; checkedAt: string; title: string; url: string; license?: string; updated?: string; archived?: boolean; readmeSha?: string; checks: RequirementCheck[]; evidence: Evidence[]; cautions: string[]; cached?: boolean }
export interface RepoRef { owner: string; repo: string; ref?: string; url: string }
export interface EnvHint { name: string; required: boolean; source: string }
export interface Analysis {
  testOnly?: boolean;
  id: string; createdAt: string; repository: RepoRef; commit: string;
  root: string; roots: string[]; name: string; description: string;
  language: string; framework: string; projectType: string;
  strategy: "compose" | "dockerfile" | "railpack" | "unsupported";
  configFile?: string; ports: number[]; env: EnvHint[];
  commands: { install?: string; build?: string; start?: string };
  license: string; archived: boolean; updatedAt: string; openIssues: number;
  warnings: string[]; blockers: string[]; evidence: Evidence[];
  files: Record<string, string>;
  installOptions?: InstallOption[]; onlineOptions?: OnlineOption[]; releaseNote?: string;
}
export interface ReleaseAsset { name: string; url: string; size: number; architecture: string }
export interface InstallOption { id: string; title: string; status: "available" | "conditional" | "unavailable"; recommended: boolean; description: string; advantages: string[]; limitations: string[]; prerequisites: string[]; links: { label: string; url: string }[]; assets?: ReleaseAsset[] }
export interface OnlineOption { id: string; title: string; status: "candidate" | "unsuitable"; description: string; advantages: string[]; limitations: string[]; steps: string[]; docs: string; checkedAt: string }
export interface ModelProvider { id: string; name: string; state: "live" | "catalog"; model: string; task: string; endpoint?: string; tools?: boolean; pricing: string; docs: string }
export interface ModelReport { id: string; modelId: string; url: string; source: "huggingface" | "pirateface"; inputUrl: string; checkedAt: string; task: string; license: string; gated: boolean | "unknown"; revision?: string; providers: ModelProvider[]; ggufFiles: string[]; notes: string[]; recommendation: string; evidence: Evidence[] }
export interface ModelProfile { id: string; createdAt: string; name: string; mode: "model" | "profile"; agent: string; purpose: string; reportId: string; modelId: string; providerId: string; prompt: string }
export type JobStatus = "queued" | "fetching" | "building" | "checking" | "running" | "started" | "stopped" | "failed";
export interface Project {
  testOnly?: boolean;
  id: string; name: string; analysisId: string; createdAt: string;
  status: JobStatus; strategy: Analysis["strategy"]; commit: string;
  sourceDir: string; runtimeFile: string; url?: string;
  error?: string; logs: string[]; containerNames: string[];
}
