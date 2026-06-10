import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPredictionSnapshot, DEFAULT_SIMULATIONS, parseDraw, sortDraws } from "./prediction-engine.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const historyFile = path.join(root, "data", "history.json");
const predictionFile = path.join(root, "data", "latest-prediction.json");
const externalLearningFile = path.join(root, "data", "external-learning.json");

export async function createLatestPrediction(simulations = DEFAULT_SIMULATIONS) {
  const [databaseText, externalLearningText] = await Promise.all([
    readFile(historyFile, "utf8"),
    readFile(externalLearningFile, "utf8").catch(() => '{"records":[]}'),
  ]);
  const database = JSON.parse(databaseText);
  const externalLearning = JSON.parse(externalLearningText);
  const draws = sortDraws(database.data.map(parseDraw));
  const prediction = createPredictionSnapshot(draws, simulations, externalLearning.records || []);
  await writeFile(predictionFile, `${JSON.stringify(prediction, null, 2)}\n`, "utf8");
  return prediction;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  createLatestPrediction()
    .then((prediction) => {
      console.log(JSON.stringify({
        targetExpect: prediction.targetExpect,
        simulations: prediction.simulations,
        specialTop10: prediction.specialPicks.map((pick) => pick.code),
        normalHit3: prediction.normalHit3Picks.map((pick) => pick.code),
        mysticNormal: prediction.mysticPrediction.normalPicks.map((pick) => pick.code),
      }, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
