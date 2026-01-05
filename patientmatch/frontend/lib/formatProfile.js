export function titleCase(str = "") {
  return str
    .replace(/_/g, " ")
    .replace(/\bwillingness to travel km\b/i, "willing to travel")
    .replace(/\bzip\b/i, "ZIP")
    .replace(/\busa\b/i, "United States")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1));
}

export function labelForKey(key) {
  const map = {
    age: "Age",
    sex: "Sex",
    conditions: "Conditions",
    meds: "Medications",
    location: "Location",
    willingness_to_travel_km: "Willing To Travel",
  };
  return map[key] || titleCase(key);
}

export function formatLocation(loc) {
  if (!loc) return "";
  const parts = [];
  if (loc.zip) parts.push(loc.zip);
  if (loc.country) parts.push(loc.country);
  return parts.join(" · ");
}

export function isEmptyValue(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (typeof v === "object" && !Array.isArray(v)) {
    if (!v.country && !v.zip) return true;
  }
  return false;
}
