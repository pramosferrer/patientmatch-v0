export type PatientProfile = {
  age: number;
  sex?: string | null;
  location?: { zip?: string | null } | null;
  home_lat?: number | null;
  home_lon?: number | null;
  prefers_remote?: boolean | null;
  max_travel_miles?: number | null;
  willingness_to_travel_miles?: number | null;
  conditions: string[];
  pregnancy?: boolean | null;
  comorbidities?: string[] | null;
  meds?: string[] | null;
};
