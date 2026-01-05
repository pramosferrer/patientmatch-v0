import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabaseServer";
import { pmqToUiQuestions } from "@/lib/pmqAdapter";
import { SourceTag } from "@/lib/screener/types";

type TrialRow = {
  nct_id: string;
  title?: string | null;
  sponsor?: string | null;
  questionnaire_json: unknown;
};

const MAX_PATIENT_SAMPLE = 10;
const MAX_CLINIC_SAMPLE = 10;
const MAX_AUDIT = 30;

const ContextSchema = z.object({
  params: z.object({
    nct_id: z.string(),
  }),
});

export async function GET(_request: Request, context: unknown) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { params } = ContextSchema.parse(context);
  const nctId = (params.nct_id ?? "").toUpperCase().trim();
  if (!nctId) {
    return NextResponse.json({ error: "Missing nct_id" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("trials")
    .select(
      "nct_id, title, sponsor, questionnaire_json",
    )
    .eq("nct_id", nctId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Trial not found", details: error?.message }, { status: 404 });
  }

  const trial = data as TrialRow;
  const { mainQuestions, optionalQuestions } = pmqToUiQuestions(trial.questionnaire_json);
  const uiQuestions = [...mainQuestions, ...optionalQuestions];
  const patientQuestions = uiQuestions.filter(
    (question) => question.sourceTag !== SourceTag.Clinic && question.kind !== "heading",
  );
  const clinicQuestions = uiQuestions.filter((question) => question.sourceTag === SourceTag.Clinic);

  const patientSample = patientQuestions.slice(0, MAX_PATIENT_SAMPLE).map((question) => ({
    id: question.id,
    label: question.label,
    ui: { kind: question.kind },
    sourceTag: question.sourceTag,
  }));
  const clinicSample = clinicQuestions.slice(0, MAX_CLINIC_SAMPLE).map((item) => ({
    id: item.id,
    label: item.label,
    sourceTag: item.sourceTag,
  }));

  return NextResponse.json({
    counts: {
      patient: patientQuestions.length,
      clinic: clinicQuestions.length,
    },
    patient: patientSample,
    clinic: clinicSample,
  });
}
