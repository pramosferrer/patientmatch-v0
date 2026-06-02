import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const trials = readJson("fixtures/demo/trials.json");
const sites = readJson("fixtures/demo/trial_sites.json");
const zips = readJson("fixtures/demo/zip_centroids.json");

assert.ok(Array.isArray(trials) && trials.length > 0, "Expected demo trials.");
assert.ok(Array.isArray(sites) && sites.length > 0, "Expected demo trial sites.");
assert.ok(Array.isArray(zips) && zips.length > 0, "Expected demo ZIP centroids.");

const trialIds = new Set(trials.map((trial) => trial.nct_id));

for (const trial of trials) {
  assert.match(trial.nct_id, /^NCT\d{8}$/, `Invalid NCT ID: ${trial.nct_id}`);
  assert.equal(typeof trial.title, "string", "Trial title is required.");
  assert.equal(typeof trial.display_title, "string", "Trial display title is required.");
  assert.ok(Array.isArray(trial.conditions), "Trial conditions must be an array.");
  assert.ok(trial.questionnaire_json?.questions?.length > 0, "Trial questionnaire questions are required.");
}

for (const site of sites) {
  assert.ok(trialIds.has(site.nct_id), `Site references unknown trial: ${site.nct_id}`);
  assert.equal(typeof site.facility_name, "string", "Site facility name is required.");
  assert.equal(typeof site.city, "string", "Site city is required.");
  assert.equal(typeof site.state, "string", "Site state is required.");
  assert.equal(typeof site.lat, "number", "Site lat must be a number.");
  assert.equal(typeof site.lon, "number", "Site lon must be a number.");
}

for (const zip of zips) {
  assert.match(zip.postal_code, /^\d{5}$/, `Invalid ZIP code: ${zip.postal_code}`);
  assert.equal(typeof zip.lat, "number", "ZIP lat must be a number.");
  assert.equal(typeof zip.lon, "number", "ZIP lon must be a number.");
}

console.log("Demo fixtures are valid.");
