export const NUMBERS = Array.from({ length: 49 }, (_, index) => index + 1);
export const DEFAULT_SIMULATIONS = 1000000;

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

function isBig(number) {
  return number >= 25 ? "大" : "小";
}

export function parseDraw(raw) {
  const numbers = String(raw.openCode).split(",").map(Number);
  const waves = String(raw.wave).split(",");
  const zodiacs = String(raw.zodiac).split(",");
  return {
    expect: String(raw.expect),
    openTime: String(raw.openTime),
    numbers,
    normal: numbers.slice(0, 6),
    special: numbers[6],
    waves,
    zodiacs,
    specialWave: waves[6],
    specialZodiac: zodiacs[6],
  };
}

export function sortDraws(draws) {
  return draws.slice().sort((a, b) => b.openTime.localeCompare(a.openTime));
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
  if (index < 50) return 5 - (index / 49) * 2.5;
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

export function buildMeta(draws) {
  const meta = {};
  for (const draw of draws) {
    draw.numbers.forEach((number, index) => {
      if (!meta[number]) meta[number] = { wave: draw.waves[index], zodiac: draw.zodiacs[index] };
    });
  }
  return meta;
}

function createRng(seedText) {
  let seed = 2166136261;
  for (const char of String(seedText)) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick(items, rng) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let target = rng() * total;
  for (const item of items) {
    target -= item.weight;
    if (target <= 0) return item;
  }
  return items[items.length - 1];
}

export function analyze(draws) {
  const specialSample = draws.slice(0, SPECIAL_MODEL.limit);
  const specialRecent = specialSample.slice(0, Math.min(SPECIAL_MODEL.recentLimit, specialSample.length));
  const normalSample = draws.slice(0, ZODIAC_MODEL.limit);
  const normalRecent = normalSample.slice(0, Math.min(ZODIAC_MODEL.recentLimit, normalSample.length));
  const specialCounts = makeCounter();
  const recentSpecialCounts = makeCounter();
  const normalCounts = makeCounter();
  const recentNormalCounts = makeCounter();
  const weightedSpecialCounts = makeCounter();
  const weightedNormalCounts = makeCounter();
  const specialMiss = numberMiss(specialSample, (draw) => [draw.special]);
  const normalMiss = numberMiss(normalSample, (draw) => draw.normal);
  const meta = buildMeta(draws);

  specialSample.forEach((draw, index) => {
    add(specialCounts, draw.special);
    add(weightedSpecialCounts, draw.special, drawAgeWeight(index));
  });
  specialRecent.forEach((draw) => add(recentSpecialCounts, draw.special));
  normalSample.forEach((draw, index) => {
    draw.normal.forEach((number) => {
      add(normalCounts, number);
      add(weightedNormalCounts, number, drawAgeWeight(index));
    });
  });
  normalRecent.forEach((draw) => draw.normal.forEach((number) => add(recentNormalCounts, number)));

  const maxCount = Math.max(...Object.values(weightedSpecialCounts), 1);
  const maxRecent = Math.max(...Object.values(recentSpecialCounts), 1);
  const maxMiss = Math.max(...Object.values(specialMiss), 1);
  const maxNormalCount = Math.max(...Object.values(weightedNormalCounts), 1);
  const maxRecentNormal = Math.max(...Object.values(recentNormalCounts), 1);
  const maxNormalMiss = Math.max(...Object.values(normalMiss), 1);
  const zodiacToNumbers = {};

  NUMBERS.forEach((number) => {
    const zodiac = meta[number]?.zodiac || "";
    if (!zodiacToNumbers[zodiac]) zodiacToNumbers[zodiac] = [];
    zodiacToNumbers[zodiac].push(number);
  });

  const weightedNumbers = NUMBERS.map((number) => {
    const score =
      normalize(weightedSpecialCounts[number], maxCount) * SPECIAL_MODEL.weights.frequency +
      normalize(recentSpecialCounts[number], maxRecent) * SPECIAL_MODEL.weights.recent +
      normalize(specialMiss[number], maxMiss) * SPECIAL_MODEL.weights.miss;
    return withMeta(number, meta, {
      weight: Math.max(1, score + 1),
      score: Math.round(score * 10) / 10,
      count: specialCounts[number],
      recent: recentSpecialCounts[number],
      miss: specialMiss[number],
    });
  });

  const weightedNormalNumbers = NUMBERS.map((number) => {
    const score =
      normalize(weightedNormalCounts[number], maxNormalCount) * ZODIAC_MODEL.weights.frequency +
      normalize(recentNormalCounts[number], maxRecentNormal) * ZODIAC_MODEL.weights.recent +
      normalize(normalMiss[number], maxNormalMiss) * ZODIAC_MODEL.weights.miss;
    return withMeta(number, meta, {
      weight: Math.max(1, score + 1),
      score: Math.round(score * 10) / 10,
      count: normalCounts[number],
      recent: recentNormalCounts[number],
      miss: normalMiss[number],
    });
  });

  return { weightedNumbers, weightedNormalNumbers, numberMeta: meta, zodiacToNumbers };
}

function countBy(items, getter) {
  return items.reduce((counts, item) => {
    const key = getter(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function averageProfiles(profiles, group) {
  const totals = {};
  profiles.forEach((profile) => {
    Object.entries(profile[group]).forEach(([key, count]) => add(totals, key, count));
  });
  return Object.fromEntries(
    Object.entries(totals).map(([key, total]) => [key, total / Math.max(1, profiles.length)]),
  );
}

function mergeProfiles(current, learned, currentWeight = 0.55) {
  const keys = new Set([...Object.keys(current), ...Object.keys(learned)]);
  return Object.fromEntries([...keys].map((key) => [
    key,
    (current[key] || 0) * currentWeight + (learned[key] || 0) * (1 - currentWeight),
  ]));
}

function normalizeExternalRecords(records) {
  return (Array.isArray(records) ? records : [])
    .map((record) => ({
      ...record,
      expect: String(record.expect || ""),
      numbers: uniqueNumbers(record.numbers || []),
      generated20: uniqueNumbers(record.generated20 || []),
      generated10: uniqueNumbers(record.generated10 || []),
      generated5: uniqueNumbers(record.generated5 || []),
    }))
    .filter((record) => record.numbers.length)
    .sort((a, b) => Number(b.expect || 0) - Number(a.expect || 0));
}

function buildExternalSpecialModel(analysis, records) {
  const normalizedRecords = normalizeExternalRecords(records);
  if (!normalizedRecords.length) return null;

  const baseRows = analysis.weightedNumbers
    .slice()
    .sort((a, b) => b.score - a.score || a.number - b.number)
    .map((row, index) => ({ ...row, baseRank: index + 1 }));
  const rankMap = new Map(baseRows.map((row) => [row.number, row.baseRank]));
  const profiles = normalizedRecords.map((record) => {
    const rows = record.numbers.map((number) => ({
      number,
      wave: analysis.numberMeta[number]?.wave || "unknown",
      zodiac: analysis.numberMeta[number]?.zodiac || "unknown",
      size: number >= 25 ? "big" : "small",
      tail: number % 10,
    }));
    return {
      wave: countBy(rows, (row) => row.wave),
      zodiac: countBy(rows, (row) => row.zodiac),
      size: countBy(rows, (row) => row.size),
      tail: countBy(rows, (row) => row.tail),
      top22: rows.filter((row) => (rankMap.get(row.number) || 99) <= 22).length,
    };
  });
  const current = profiles[0];
  const average = {
    wave: averageProfiles(profiles, "wave"),
    zodiac: averageProfiles(profiles, "zodiac"),
    size: averageProfiles(profiles, "size"),
    tail: averageProfiles(profiles, "tail"),
  };
  const target = {
    wave: mergeProfiles(current.wave, average.wave),
    zodiac: mergeProfiles(current.zodiac, average.zodiac),
    size: mergeProfiles(current.size, average.size),
    tail: mergeProfiles(current.tail, average.tail),
  };
  const averageTop22 = profiles.reduce((sum, profile) => sum + profile.top22, 0) / profiles.length;
  const targetTop22 = Math.round(current.top22 * 0.6 + averageTop22 * 0.4);
  const numberFrequency = {};
  normalizedRecords.forEach((record) => record.numbers.forEach((number) => add(numberFrequency, number)));
  const latestInputSet = new Set(normalizedRecords[0].numbers);
  const latestGeneratedSet = new Set(normalizedRecords[0].generated20);
  const selected = [];
  const selectedNumbers = new Set();
  const selectedProfile = { wave: {}, zodiac: {}, size: {}, tail: {} };

  const need = (group, key) => Math.max(0, (target[group][key] || 0) - (selectedProfile[group][key] || 0));
  while (selected.length < NUMBERS.length) {
    const selectedTop22 = selected.filter((row) => row.baseRank <= 22).length;
    let best = null;
    let bestScore = -Infinity;
    baseRows.forEach((row) => {
      if (selectedNumbers.has(row.number)) return;
      if (selected.length < 20) {
        if (latestGeneratedSet.size >= 20 && !latestGeneratedSet.has(row.number)) return;
        if (latestGeneratedSet.size < 20 && latestInputSet.has(row.number)) return;
      }
      const wave = row.wave || "unknown";
      const zodiac = row.zodiac || "unknown";
      const size = row.number >= 25 ? "big" : "small";
      const tail = row.number % 10;
      let score = row.score;
      score += need("wave", wave) * 180;
      score += need("zodiac", zodiac) * 120;
      score += need("size", size) * 140;
      score += need("tail", tail) * 40;
      score += (numberFrequency[row.number] || 0) * 85;
      if (selectedTop22 < targetTop22 && row.baseRank <= 22) score += 260;
      score -= row.baseRank * 2;
      if (score > bestScore) {
        best = row;
        bestScore = score;
      }
    });
    if (!best) break;
    const modelRank = selected.length + 1;
    const item = {
      ...best,
      modelRank,
      externalScore: Math.round(bestScore * 100) / 100,
      sampleFrequency: numberFrequency[best.number] || 0,
      weight: Math.pow(1.06, NUMBERS.length - modelRank) * 100,
    };
    selected.push(item);
    selectedNumbers.add(best.number);
    add(selectedProfile.wave, best.wave || "unknown");
    add(selectedProfile.zodiac, best.zodiac || "unknown");
    add(selectedProfile.size, best.number >= 25 ? "big" : "small");
    add(selectedProfile.tail, best.number % 10);
  }

  return {
    rows: selected,
    sampleCount: normalizedRecords.length,
    latestSampleExpect: normalizedRecords[0].expect,
  };
}

function withMeta(number, meta, fields = {}) {
  return {
    number,
    code: formatNumber(number),
    wave: meta[number]?.wave || "",
    zodiac: meta[number]?.zodiac || "",
    size: isBig(number),
    ...fields,
  };
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

function rankNormalHit3(draws, meta, normalHits, simulations) {
  return NUMBERS.map((number) => withMeta(number, meta, {
    hits: normalHits[number] || 0,
    probability: (normalHits[number] || 0) / Math.max(1, simulations),
    modelScore: Math.round(normalHit3Score(number, draws) * 100) / 100,
  }))
    .sort((a, b) => b.modelScore - a.modelScore || b.probability - a.probability || a.number - b.number)
    .slice(0, 5);
}

function getStatisticalZodiacs(analysis) {
  const scores = {};
  analysis.weightedNormalNumbers.forEach((item) => {
    if (!item.zodiac) return;
    scores[item.zodiac] = (scores[item.zodiac] || 0) + item.weight;
  });
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([zodiac]) => zodiac);
}

export function runMonteCarlo(draws, simulations = DEFAULT_SIMULATIONS, externalRecords = []) {
  const analysis = analyze(draws);
  const externalModel = buildExternalSpecialModel(analysis, externalRecords);
  const specialPool = externalModel?.rows || analysis.weightedNumbers;
  const rng = createRng(`${draws[0]?.expect || ""}|stat|${simulations}`);
  const numberHits = makeCounter();
  const normalNumberHits = makeCounter();
  const zodiacHits = {};

  for (let index = 0; index < simulations; index += 1) {
    const picked = weightedPick(specialPool, rng);
    const normalPicked = weightedPick(analysis.weightedNormalNumbers, rng);
    add(numberHits, picked.number);
    add(normalNumberHits, normalPicked.number);
    add(zodiacHits, normalPicked.zodiac);
  }

  const specialPicks = NUMBERS.map((number) => withMeta(number, analysis.numberMeta, {
    hits: numberHits[number],
    probability: numberHits[number] / simulations,
    modelRank: externalModel?.rows.find((item) => item.number === number)?.modelRank,
    sampleFrequency: externalModel?.rows.find((item) => item.number === number)?.sampleFrequency,
  })).sort((a, b) => b.hits - a.hits || a.number - b.number);

  const zodiacPicks = Object.entries(zodiacHits)
    .map(([zodiac, hits]) => ({
      zodiac,
      hits,
      probability: hits / simulations,
      numbers: (analysis.zodiacToNumbers[zodiac] || []).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 5);

  const usedNormalNumbers = new Set();
  const normalRecommendations = zodiacPicks.map((zodiacPick) => {
    const candidates = (analysis.zodiacToNumbers[zodiacPick.zodiac] || [])
      .map((number) => withMeta(number, analysis.numberMeta, {
        hits: normalNumberHits[number],
        probability: normalNumberHits[number] / simulations,
      }))
      .filter((item) => !usedNormalNumbers.has(item.number))
      .sort((a, b) => b.hits - a.hits || a.number - b.number);
    const selected = candidates[0];
    if (selected) usedNormalNumbers.add(selected.number);
    return { ...zodiacPick, normalNumber: selected };
  });

  return {
    simulations,
    specialPicks: specialPicks.slice(0, 10),
    special20Picks: specialPicks.slice(0, 20).sort((a, b) => a.number - b.number),
    zodiacPicks: normalRecommendations,
    topZodiac: normalRecommendations[0],
    oneZodiacPick: normalRecommendations[0]
      ? {
        zodiac: normalRecommendations[0].zodiac,
        hits: normalRecommendations[0].hits,
        probability: normalRecommendations[0].probability,
      }
      : null,
    normalHit3Picks: rankNormalHit3(draws, analysis.numberMeta, normalNumberHits, simulations),
    specialModel: externalModel
      ? {
        name: "external-number-learning",
        sampleCount: externalModel.sampleCount,
        latestSampleExpect: externalModel.latestSampleExpect,
      }
      : {
        name: "statistical-history",
        sampleCount: 0,
        latestSampleExpect: "",
      },
    analysis,
  };
}

function uniqueNumbers(numbers) {
  return [...new Set(numbers.map(Number).filter((number) => number >= 1 && number <= 49))];
}

function digitSum(value) {
  return String(value).replace(/\D/g, "").split("").reduce((sum, char) => sum + Number(char), 0);
}

function numbersByFilter(limit, filter) {
  return NUMBERS.filter(filter).slice(0, limit);
}

function buildMysticMethods(draws, analysis, targetDate, nextExpect) {
  const latest = draws[0];
  const meta = analysis.numberMeta;
  const elementWaves = ["red", "green", "blue", "red", "green"];
  const wave = elementWaves[(targetDate.getFullYear() + targetDate.getMonth() + 1 + targetDate.getDate()) % 5];
  const zodiacCycle = ["鼠", "牛", "虎", "兔", "龍", "蛇", "馬", "羊", "猴", "雞", "狗", "豬"];
  const yearZodiac = zodiacCycle[(targetDate.getFullYear() - 2020 + 1200) % 12];
  const dateKey = Number(`${targetDate.getFullYear()}${formatNumber(targetDate.getMonth() + 1)}${formatNumber(targetDate.getDate())}`);
  const dateSum = digitSum(dateKey);
  const expectSum = digitSum(nextExpect);
  const weekday = targetDate.getDay() || 7;
  const latestNums = latest?.numbers || [];
  const latestSpecial = latest?.special || 1;

  const methods = [
    { name: "生肖五行", numbers: numbersByFilter(8, (number) => [yearZodiac, zodiacCycle[(zodiacCycle.indexOf(yearZodiac) + 4) % 12], zodiacCycle[(zodiacCycle.indexOf(yearZodiac) + 8) % 12]].includes(meta[number]?.zodiac)), weight: 1.15 },
    { name: "波色五行", numbers: numbersByFilter(12, (number) => meta[number]?.wave === wave), weight: 1.05 },
    { name: "日期数秘", numbers: uniqueNumbers([dateSum, dateSum * 2, dateSum * 3, targetDate.getDate() + targetDate.getMonth() + 1, targetDate.getDate() * (targetDate.getMonth() + 1), targetDate.getFullYear() + targetDate.getDate()]), weight: 1 },
    { name: "期号数秘", numbers: uniqueNumbers([expectSum, expectSum * 2, expectSum * 3, nextExpect % 49, (nextExpect % 100) + weekday]), weight: 1 },
    { name: "周易卦数", numbers: uniqueNumbers([(dateSum % 8) * 6 + (expectSum % 6 || 6), ((targetDate.getDate() + weekday) % 8) * 6 + (21 % 6 || 6), (dateSum + expectSum + 21) % 64, (targetDate.getDate() * 6 + weekday) % 49]), weight: 1.1 },
    { name: "梅花易数", numbers: uniqueNumbers([targetDate.getFullYear() + targetDate.getMonth() + 1 + targetDate.getDate(), targetDate.getMonth() + 1 + targetDate.getDate() + 21, targetDate.getFullYear() + targetDate.getMonth() + 1 + targetDate.getDate() + 21, (targetDate.getDate() + 21) * 2, (targetDate.getMonth() + 1 + weekday) * 3]), weight: 1.05 },
    { name: "九宫洛书", numbers: numbersByFilter(10, (number) => ((number - 1) % 9) + 1 === ((dateSum + weekday - 1) % 9) + 1), weight: 0.95 },
    { name: "尾数法", numbers: numbersByFilter(12, (number) => [targetDate.getDate() % 10, nextExpect % 10, latestSpecial % 10].includes(number % 10)), weight: 0.95 },
    { name: "上期开奖共振", numbers: uniqueNumbers(latestNums.flatMap((number) => [number + weekday, number - weekday, number + targetDate.getDate()])), weight: 0.9 },
    { name: "冷热重合", numbers: analysis.weightedNumbers.slice().sort((a, b) => b.weight - a.weight).slice(0, 12).map((item) => item.number), weight: 1.2 },
  ];

  return methods.map((method) => ({ ...method, numbers: uniqueNumbers(method.numbers).slice(0, 12) }));
}

export function runMysticMonteCarlo(draws, statistical, simulations = DEFAULT_SIMULATIONS, targetDate = null) {
  const analysis = statistical.analysis || analyze(draws);
  const latest = draws[0];
  const nextExpect = Number(latest?.expect || 0) + 1;
  const nextDate = targetDate || new Date(String(latest?.openTime || "").replace(" ", "T"));
  if (!Number.isNaN(nextDate.getTime())) nextDate.setDate(nextDate.getDate() + 1);
  const methods = buildMysticMethods(draws, analysis, nextDate, nextExpect);
  const mysticScoreMap = makeCounter();
  methods.forEach((method) => {
    method.numbers.forEach((number, index) => add(mysticScoreMap, number, method.weight * (1 + (12 - index) / 20)));
  });

  const specialModel = new Map(analysis.weightedNumbers.map((item) => [item.number, item.weight]));
  const normalModel = new Map(analysis.weightedNormalNumbers.map((item) => [item.number, item.weight]));
  const statisticalZodiacs = getStatisticalZodiacs(analysis);
  const zodiacSet = new Set(statisticalZodiacs);
  const specialPool = NUMBERS.map((number) => ({ number, weight: Math.max(1, (mysticScoreMap[number] || 0.2) * 4 + (specialModel.get(number) || 1)) }));
  const normalPool = NUMBERS
    .filter((number) => zodiacSet.has(analysis.numberMeta[number]?.zodiac))
    .map((number) => ({ number, weight: Math.max(1, (mysticScoreMap[number] || 0.2) * 4 + (normalModel.get(number) || 1)) }));
  const specialHits = makeCounter();
  const normalHits = makeCounter();
  const rng = createRng(`${latest?.expect || ""}|mystic|${simulations}`);

  for (let index = 0; index < simulations; index += 1) {
    add(specialHits, weightedPick(specialPool, rng).number);
    add(normalHits, weightedPick(normalPool, rng).number);
  }

  const makePicks = (hits, limit) => NUMBERS.map((number) => withMeta(number, analysis.numberMeta, {
    probability: hits[number] / simulations,
    score: mysticScoreMap[number] || 0,
    methods: methods.filter((method) => method.numbers.includes(number)).map((method) => method.name),
  }))
    .sort((a, b) => b.probability - a.probability || b.score - a.score || a.number - b.number)
    .slice(0, limit);
  const normalPicks = statisticalZodiacs.map((zodiac) => NUMBERS
    .filter((number) => analysis.numberMeta[number]?.zodiac === zodiac)
    .map((number) => withMeta(number, analysis.numberMeta, {
      probability: normalHits[number] / simulations,
      score: mysticScoreMap[number] || 0,
      methods: methods.filter((method) => method.numbers.includes(number)).map((method) => method.name),
    }))
    .sort((a, b) => b.probability - a.probability || b.score - a.score || a.number - b.number)[0])
    .filter(Boolean);

  return {
    methods,
    specialPicks: makePicks(specialHits, 7),
    normalPicks,
    statisticalZodiacs,
    simulations,
    generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    context: {
      nextExpect,
      targetDate: Number.isNaN(nextDate.getTime()) ? "" : nextDate.toISOString().slice(0, 10),
    },
  };
}

export function createPredictionSnapshot(draws, simulations = DEFAULT_SIMULATIONS, externalRecords = []) {
  const sorted = sortDraws(draws);
  const statistical = runMonteCarlo(sorted, simulations, externalRecords);
  const mystic = runMysticMonteCarlo(sorted, statistical, simulations);
  const latest = sorted[0];
  const targetExpect = String(Number(latest?.expect || 0) + 1);
  delete statistical.analysis;
  return {
    generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    sourceLatestExpect: latest?.expect || "",
    targetExpect,
    simulations,
    ...statistical,
    mysticPrediction: mystic,
  };
}

export function predictionForReview(prediction) {
  return {
    specialTop10: (prediction?.specialPicks || []).map((pick) => ({ ...pick, code: pick.code || formatNumber(pick.number) })),
    specialTop20: (prediction?.special20Picks || []).map((pick) => ({ ...pick, code: pick.code || formatNumber(pick.number) })),
    normalHit3Five: (prediction?.normalHit3Picks || []).map((pick) => ({ ...pick, code: pick.code || formatNumber(pick.number) })),
    mysticNormalFive: (prediction?.mysticPrediction?.normalPicks || []).map((pick) => ({ ...pick, code: pick.code || formatNumber(pick.number) })),
  };
}
