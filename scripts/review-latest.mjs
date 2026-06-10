import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPredictionSnapshot, parseDraw, predictionForReview, sortDraws } from "./prediction-engine.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const historyFile = path.join(root, "data", "history.json");
const reviewFile = path.join(root, "data", "latest-review.json");
const reviewHistoryFile = path.join(root, "data", "review-history.json");
const predictionFile = path.join(root, "data", "latest-prediction.json");
const NUMBERS = Array.from({ length: 49 }, (_, index) => index + 1);
const SPECIAL_MODEL = {
  limit: 120,
  recentLimit: 50,
  weights: { frequency: 45, recent: 100, miss: 45 },
};
const ZODIAC_MODEL = {
  limit: 240,
  recentLimit: 50,
  weights: { frequency: 45, recent: 110, miss: 25, carry: 0 },
};
const NORMAL_HIT3_MODEL = {
  limit: 120,
  weights: {
    rc10: -10.037,
    rc30: -10.815,
    rc50: 0.824,
    rc80: 1.212,
    wm15: -13.505,
    wm30: -1.449,
    wm50: 2.496,
    wm80: 13.866,
    prevAny: 6.36,
  },
};

function formatNumber(value) {
  return String(value).padStart(2, "0");
}

function makeCounter() {
  return Object.fromEntries(NUMBERS.map((number) => [number, 0]));
}

function add(counter, key, amount = 1) {
  counter[key] = (counter[key] || 0) + amount;
}

function normalize(value, max) {
  return max > 0 ? value / max : 0;
}

function drawAgeWeight(index) {
  if (index < 50) {
    return 5 - (index / 49) * 2.5;
  }
  return Math.max(0.08, 0.35 * Math.exp(-(index - 50) / 70));
}

function numberMiss(draws, selector) {
  const miss = makeCounter();
  for (const number of NUMBERS) {
    const index = draws.findIndex((draw) => selector(draw).includes(number));
    miss[number] = index === -1 ? draws.length : index;
  }
  return miss;
}

function buildMeta(draws) {
  const meta = {};
  for (const draw of draws) {
    draw.numbers.forEach((number, index) => {
      if (!meta[number]) {
        meta[number] = { wave: draw.waves[index], zodiac: draw.zodiacs[index] };
      }
    });
  }
  return meta;
}

function rankSpecial(train, meta, limit = 10) {
  const sample = train.slice(0, SPECIAL_MODEL.limit);
  const recent = sample.slice(0, Math.min(SPECIAL_MODEL.recentLimit, sample.length));
  const weightedCounts = makeCounter();
  const recentCounts = makeCounter();
  const miss = numberMiss(sample, (draw) => [draw.special]);

  sample.forEach((draw, index) => add(weightedCounts, draw.special, drawAgeWeight(index)));
  recent.forEach((draw) => add(recentCounts, draw.special));

  const maxCount = Math.max(...Object.values(weightedCounts), 1);
  const maxRecent = Math.max(...Object.values(recentCounts), 1);
  const maxMiss = Math.max(...Object.values(miss), 1);

  return NUMBERS.map((number) => {
    const score =
      normalize(weightedCounts[number], maxCount) * SPECIAL_MODEL.weights.frequency +
      normalize(recentCounts[number], maxRecent) * SPECIAL_MODEL.weights.recent +
      normalize(miss[number], maxMiss) * SPECIAL_MODEL.weights.miss;
    return {
      number,
      code: formatNumber(number),
      score: Math.round(score * 10) / 10,
      zodiac: meta[number]?.zodiac || "",
      wave: meta[number]?.wave || "",
    };
  })
    .sort((a, b) => b.score - a.score || a.number - b.number)
    .slice(0, limit);
}

function rankZodiac(train, meta) {
  const sample = train.slice(0, ZODIAC_MODEL.limit);
  const recent = sample.slice(0, Math.min(ZODIAC_MODEL.recentLimit, sample.length));
  const weightedCounts = makeCounter();
  const recentCounts = makeCounter();
  const miss = numberMiss(sample, (draw) => draw.normal);
  const carryZodiacs = new Set(sample[0]?.zodiacs.slice(0, 6) || []);

  sample.forEach((draw, index) => draw.normal.forEach((number) => add(weightedCounts, number, drawAgeWeight(index))));
  recent.forEach((draw) => draw.normal.forEach((number) => add(recentCounts, number)));

  const maxCount = Math.max(...Object.values(weightedCounts), 1);
  const maxRecent = Math.max(...Object.values(recentCounts), 1);
  const maxMiss = Math.max(...Object.values(miss), 1);
  const zodiacScores = {};
  const bestNumberByZodiac = {};

  for (const number of NUMBERS) {
    const zodiac = meta[number]?.zodiac || "";
    if (!zodiac) continue;
    const score =
      normalize(weightedCounts[number], maxCount) * ZODIAC_MODEL.weights.frequency +
      normalize(recentCounts[number], maxRecent) * ZODIAC_MODEL.weights.recent +
      normalize(miss[number], maxMiss) * ZODIAC_MODEL.weights.miss +
      (carryZodiacs.has(zodiac) ? ZODIAC_MODEL.weights.carry : 0);
    zodiacScores[zodiac] = (zodiacScores[zodiac] || 0) + score;
    if (!bestNumberByZodiac[zodiac] || score > bestNumberByZodiac[zodiac].score) {
      bestNumberByZodiac[zodiac] = { number, code: formatNumber(number), score };
    }
  }

  return Object.entries(zodiacScores)
    .map(([zodiac, score]) => ({
      zodiac,
      score: Math.round(score * 10) / 10,
      normalNumber: bestNumberByZodiac[zodiac],
      wave: meta[bestNumberByZodiac[zodiac].number]?.wave || "",
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function normalHit3Score(number, draws) {
  const sample = draws.slice(0, NORMAL_HIT3_MODEL.limit);
  const normalCount = (limit) => sample.slice(0, limit).filter((draw) => draw.normal.includes(number)).length;
  const weightedCount = (decay) => sample.reduce(
    (sum, draw, index) => sum + (draw.normal.includes(number) ? Math.exp(-index / decay) : 0),
    0,
  );
  const previousAny = sample[0]?.normal.includes(number) || sample[0]?.special === number ? 1 : 0;
  const weights = NORMAL_HIT3_MODEL.weights;
  return (
    normalCount(10) * weights.rc10 +
    normalCount(30) * weights.rc30 +
    normalCount(50) * weights.rc50 +
    normalCount(80) * weights.rc80 +
    weightedCount(15) * weights.wm15 +
    weightedCount(30) * weights.wm30 +
    weightedCount(50) * weights.wm50 +
    weightedCount(80) * weights.wm80 +
    previousAny * weights.prevAny
  );
}

function rankNormalHit3(train, meta) {
  return NUMBERS.map((number) => ({
    number,
    code: formatNumber(number),
    score: Math.round(normalHit3Score(number, train) * 100) / 100,
    zodiac: meta[number]?.zodiac || "",
    wave: meta[number]?.wave || "",
  }))
    .sort((a, b) => b.score - a.score || a.number - b.number)
    .slice(0, 5);
}

export async function createLatestReview() {
  const database = JSON.parse(await readFile(historyFile, "utf8"));
  const draws = sortDraws(database.data.map(parseDraw));
  const actual = draws[0];
  const train = draws.filter((draw) => draw.expect < actual.expect);
  let reviewHistory = [];
  try {
    const existing = JSON.parse(await readFile(reviewHistoryFile, "utf8"));
    reviewHistory = Array.isArray(existing.reviews) ? existing.reviews : [];
  } catch {
    reviewHistory = [];
  }
  const existingSealedReview = reviewHistory.find(
    (item) => String(item.expect) === String(actual.expect) && item.predictionSource === "sealed",
  );
  if (existingSealedReview) {
    await writeFile(reviewFile, `${JSON.stringify(existingSealedReview, null, 2)}\n`, "utf8");
    return existingSealedReview;
  }

  let sealedPrediction = null;
  let predictionSource = "sealed";
  try {
    sealedPrediction = JSON.parse(await readFile(predictionFile, "utf8"));
  } catch {
    predictionSource = "backfill-missing";
  }
  if (!sealedPrediction || String(sealedPrediction.targetExpect || "") !== String(actual.expect)) {
    sealedPrediction = createPredictionSnapshot(train);
    predictionSource = predictionSource === "sealed" ? "backfill-target-mismatch" : predictionSource;
  }
  const predicted = predictionForReview(sealedPrediction);
  const actualNormalZodiacs = actual.zodiacs.slice(0, 6);
  const actualNormalSet = new Set(actual.normal);
  const specialHit = predicted.specialTop10.some((pick) => pick.number === actual.special);
  const specialTop20Hit = predicted.specialTop20.some((pick) => pick.number === actual.special);
  const normalHit3Matches = predicted.normalHit3Five
    .filter((pick) => actualNormalSet.has(pick.number))
    .map((pick) => pick.code);
  const mysticNormalMatches = predicted.mysticNormalFive
    .filter((pick) => actualNormalSet.has(pick.number))
    .map((pick) => pick.code);

  const review = {
    generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    expect: actual.expect,
    openTime: actual.openTime,
    predictionSource,
    predictedTargetExpect: sealedPrediction.targetExpect || "",
    predictedGeneratedAt: sealedPrediction.generatedAt || "",
    actual: {
      openCode: actual.numbers.map(formatNumber),
      waves: actual.waves,
      normalNumbers: actual.normal.map(formatNumber),
      special: formatNumber(actual.special),
      normalZodiacs: actualNormalZodiacs,
      specialZodiac: actual.specialZodiac,
      specialWave: actual.specialWave,
    },
    predicted: {
      specialTop10: predicted.specialTop10,
      specialTop20: predicted.specialTop20.slice().sort((a, b) => a.number - b.number),
      normalHit3Five: predicted.normalHit3Five,
      mysticNormalFive: predicted.mysticNormalFive,
    },
    result: {
      specialHit,
      specialTop20Hit,
      normalHit3MatchedCount: normalHit3Matches.length,
      normalHit3Matches,
      mysticNormalMatchedCount: mysticNormalMatches.length,
      mysticNormalMatches,
    },
  };

  await writeFile(reviewFile, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  const nextReviews = [review, ...reviewHistory.filter((item) => String(item.expect) !== String(review.expect))]
    .sort((a, b) => Number(b.expect || 0) - Number(a.expect || 0))
    .slice(0, 20);
  await writeFile(reviewHistoryFile, `${JSON.stringify({
    generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    count: nextReviews.length,
    reviews: nextReviews,
  }, null, 2)}\n`, "utf8");
  return review;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  createLatestReview()
    .then((review) => console.log(JSON.stringify(review.result, null, 2)))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
