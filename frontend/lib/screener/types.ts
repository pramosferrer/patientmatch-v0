export const SourceTag = {
  Patient: "patient",
  Clinic: "clinic",
} as const;

export type SourceTag = typeof SourceTag[keyof typeof SourceTag];

export type CriteriaClause = {
  criterion_id: string;
  type: "inclusion" | "exclusion";
  category: string;
  source: "patient" | "site";
  question_text?: string;
  internal_description?: string;
  rule?: {
    variable?: string;
    field?: string;
    operator?: string;
    min?: unknown;
    max?: unknown;
    value?: unknown;
  };
  critical?: boolean;
};

export type UiQuestion = {
  id: string;
  kind: "boolean" | "number" | "choice" | "heading";
  label: string;
  clause: CriteriaClause;
  field?: string;
  critical?: boolean;
  sourceTag: SourceTag;
  options?: string[];
  operator?: string;
  value?: number;
  minValue?: number;
  maxValue?: number;
  minInclusive?: boolean;
  maxInclusive?: boolean;
  unit?: string;
  helperText?: string;
  placeholder?: string;
  multiSelect?: boolean; // If true, allow multiple selections for choice questions
};

export type UiQuestionnaire = { include: UiQuestion[]; exclude: UiQuestion[] };

export type ClinicItem = {
  id: string;
  label: string;
  clause: CriteriaClause;
  helperText?: string;
  sourceTag: SourceTag;
};

export type NormalizedQuestionnaire = {
  primary: UiQuestion[];
  more: UiQuestion[];
  clinicItems: ClinicItem[];
  clinicOnlyCount: number;
};

type CriteriaJsonObject = {
  include?: CriteriaClause[];
  includes?: CriteriaClause[];
  exclude?: CriteriaClause[];
  excludes?: CriteriaClause[];
  clinic?: CriteriaClause[];
  [key: string]: unknown;
};

export type CriteriaJson = CriteriaClause[] | CriteriaJsonObject;
