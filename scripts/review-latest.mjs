import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const historyFile = path.join(root, "data", "history.json");
const reviewFile = path.join(root, "data", "latest-review.json");
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

function parseDraw(raw) {
  const numbers = raw.openCode.split(",").map(Number);
  const waves = raw.wave.split(",");
  const zodiacs = raw.zodiac.split(",");
  return {
    expect: raw.expect,
    openTime: raw.openTime,
    numbers,
    normal: numbers.slice(0, 6),
    special: numbers[6],
    waves,
    zodiacs,
    specialWave: waves[6],
    specialZodiac: zodiacs[6],
  };
}

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

export async function createLatestReview() {
  const database = JSON.parse(await readFile(historyFile, "utf8"));
  const draws = database.data.map(parseDraw).sort((a, b) => b.openTime.localeCompare(a.openTime));
  const actual = draws[0];
  const train = draws.filter((draw) => draw.expect < actual.expect);
  const meta = buildMeta(train);
  const specialTop20 = rankSpecial(train, meta, 20);
  const specialPicks = specialTop20.slice(0, 10);
  const zodiacPicks = rankZodiac(train, meta);
  const actualNormalZodiacs = actual.zodiacs.slice(0, 6);
  const actualNormalSet = new Set(actual.normal);
  const specialHit = specialPicks.some((pick) => pick.number === actual.special);
  const specialTop20Hit = specialTop20.some((pick) => pick.number === actual.special);
  const zodiacMatches = zodiacPicks.filter((pick) => actualNormalZodiacs.includes(pick.zodiac)).map((pick) => pick.zodiac);
  const normalNumberMatches = zodiacPicks
    .filter((pick) => actualNormalSet.has(pick.normalNumber.number))
    .map((pick) => pick.normalNumber.code);

  const review = {
    generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    expect: actual.expect,
    openTime: actual.openTime,
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
      specialTop10: specialPicks,
      specialTop20: specialTop20.slice().sort((a, b) => a.number - b.number),
      zodiacFive: zodiacPicks.map((pick) => ({
        zodiac: pick.zodiac,
        normalNumber: pick.normalNumber.code,
        wave: pick.wave,
        score: pick.score,
      })),
    },
    result: {
      specialHit,
      specialTop20Hit,
      zodiacMatchedCount: zodiacMatches.length,
      zodiacMatches,
      normalNumberMatchedCount: normalNumberMatches.length,
      normalNumberMatches,
    },
  };

  await writeFile(reviewFile, `${JSON.stringify(review, null, 2)}\n`, "utf8");
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
