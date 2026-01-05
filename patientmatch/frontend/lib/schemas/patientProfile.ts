import { z } from "zod";

// PatientProfile schema used by the match API
// Keep minimal but expressive fields for initial launch
export const LocationSchema = z.object({
  country: z.string().min(1).default("United States"),
  state: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
});

export const PatientProfileSchema = z.object({
  conditions: z.array(z.string()).min(1, "At least one condition is required"),
  age: z.number().int().min(0).max(120),
  sex: z.enum(["male", "female", "other"]).optional(),
  location: LocationSchema.optional(),
  willingness_to_travel_miles: z.number().int().min(0).max(10000).optional(),
  prefers_remote: z.boolean().optional(),
  meds: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  // New optional fields for richer matching
  pregnant: z.boolean().optional(),
  smoker: z.boolean().optional(),
  comorbidities: z.array(z.string()).optional(),
  procedures_ok: z.boolean().optional(),
  compensation_interest: z.boolean().optional(),
  home_lat: z.number().min(-90).max(90).optional(),
  home_lon: z.number().min(-180).max(180).optional(),
  max_travel_miles: z.number().min(0).max(5000).optional(),
});

export type PatientProfile = z.infer<typeof PatientProfileSchema>;


// URL-based lightweight profile (non-PII) for server-side matching via /trials?prefill=1
export const UrlMatchProfileSchema = z.object({
  condition: z.string().min(2),
  age: z.number().int().min(0).max(120),
  sex: z.enum(["female","male","other","prefer_not_to_say"]).optional(),
  zip: z.string().min(3).max(10).optional(),
  radiusMiles: z.number().int().min(5).max(5000).default(50),
  remoteOk: z.boolean().default(true),
});

export type UrlMatchProfile = z.infer<typeof UrlMatchProfileSchema>;
