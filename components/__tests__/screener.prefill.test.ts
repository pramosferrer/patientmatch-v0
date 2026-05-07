import { resolveInitialAnswerForQuestion } from "../Screener";
import { SourceTag, type UiQuestion } from "../../lib/screener/types";

const ageQuestion: UiQuestion = {
  id: "dem_age",
  kind: "number",
  label: "How old are you?",
  clause: {
    criterion_id: "dem_age",
    type: "inclusion",
    category: "demographics",
    source: "patient",
    critical: true,
    rule: { variable: "age_years" },
  },
  sourceTag: SourceTag.Patient,
};

const sexQuestion: UiQuestion = {
  id: "dem_sex",
  kind: "choice",
  label: "What is your sex?",
  clause: {
    criterion_id: "dem_sex",
    type: "inclusion",
    category: "demographics",
    source: "patient",
    critical: true,
    rule: { variable: "sex", operator: "in", value: ["male", "female", "other"] },
  },
  options: ["Male", "Female", "Other"],
  sourceTag: SourceTag.Patient,
};

describe("resolveInitialAnswerForQuestion", () => {
  it("returns initial answers for demographic variables so the screener can auto-advance", () => {
    const initialMap = new Map<string, unknown>([
      ["age_years", 44],
      ["sex", "female"],
    ]);

    expect(resolveInitialAnswerForQuestion(ageQuestion, initialMap)).toBe(44);
    expect(resolveInitialAnswerForQuestion(sexQuestion, initialMap)).toBe("female");
  });
});
