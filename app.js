const DATABASE_URL = "data/history.json";
const NUMBERS = Array.from({ length: 49 }, (_, index) => index + 1);
const WAVE_LABELS = { red: "红波", green: "绿波", blue: "蓝波" };
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

const state = {
  draws: [],
  analysis: null,
  prediction: null,
  mysticPrediction: null,
  externalAnalysis: null,
};

const els = {
  simulationInput: document.querySelector("#simulationInput"),
  predictBtn: document.querySelector("#predictBtn"),
  connectionStatus: document.querySelector("#connectionStatus"),
  statusText: document.querySelector("#statusText"),
  drawCount: document.querySelector("#drawCount"),
  latestExpect: document.querySelector("#latestExpect"),
  simulationCount: document.querySelector("#simulationCount"),
  lastUpdatedAt: document.querySelector("#lastUpdatedAt"),
  predictionTime: document.querySelector("#predictionTime"),
  reviewTime: document.querySelector("#reviewTime"),
  simulationResult: document.querySelector("#simulationResult"),
  reviewPanel: document.querySelector("#reviewPanel"),
  specialRecommendations: document.querySelector("#specialRecommendations"),
  special20Recommendations: document.querySelector("#special20Recommendations"),
  zodiacRecommendations: document.querySelector("#zodiacRecommendations"),
  recentRows: document.querySelector("#recentRows"),
  tabButtons: document.querySelectorAll(".tab-button"),
  pageSections: document.querySelectorAll(".page-section"),
  mysticTargetTime: document.querySelector("#mysticTargetTime"),
  mysticSimInput: document.querySelector("#mysticSimInput"),
  mysticPredictBtn: document.querySelector("#mysticPredictBtn"),
  mysticTimeInfo: document.querySelector("#mysticTimeInfo"),
  mysticSpecialResults: document.querySelector("#mysticSpecialResults"),
  mysticNormalResults: document.querySelector("#mysticNormalResults"),
  mysticMethodList: document.querySelector("#mysticMethodList"),
  externalNumbersInput: document.querySelector("#externalNumbersInput"),
  analyzeExternalBtn: document.querySelector("#analyzeExternalBtn"),
  saveExternalBtn: document.querySelector("#saveExternalBtn"),
  externalAccessGate: document.querySelector("#externalAccessGate"),
  externalProtectedContent: document.querySelector("#externalProtectedContent"),
  externalPasswordInput: document.querySelector("#externalPasswordInput"),
  externalUnlockBtn: document.querySelector("#externalUnlockBtn"),
  externalPasswordError: document.querySelector("#externalPasswordError"),
  externalSaveStatus: document.querySelector("#externalSaveStatus"),
  externalSummary: document.querySelector("#externalSummary"),
  externalNumberAnalysis: document.querySelector("#externalNumberAnalysis"),
  externalHistoryAnalysis: document.querySelector("#externalHistoryAnalysis"),
};

let activeNumberPopover = null;
const EXTERNAL_PASSWORD_HASH = "9646f275f10ae73f70fa297fef85e62b5accd3a38284eb0a64b8203e12dd1373";
const EXTERNAL_HISTORY_STORAGE_KEY = "macauMarksixExternal22History";
const EXTERNAL_HISTORY_RECORDS = [
  {
    label: "5.31",
    expect: "2026151",
    numbers: [10, 11, 14, 16, 18, 22, 25, 26, 28, 30, 31, 34, 38, 40, 41, 42, 43, 46, 49],
  },
  {
    label: "6.1",
    expect: "2026152",
    numbers: [2, 4, 10, 11, 14, 16, 17, 20, 22, 23, 25, 26, 28, 32, 35, 37, 38, 41, 42, 44, 46, 47],
  },
  {
    label: "6.2",
    expect: "2026153",
    numbers: [2, 4, 10, 11, 14, 16, 22, 23, 25, 26, 28, 31, 34, 35, 38, 40, 41, 42, 43, 46, 47, 49],
  },
  {
    label: "6.3",
    expect: "2026154",
    numbers: [10, 11, 13, 14, 16, 20, 22, 23, 25, 26, 28, 32, 34, 35, 36, 38, 40, 42, 44, 46, 47, 48],
  },
  {
    label: "6.4",
    expect: "2026155",
    numbers: [2, 4, 10, 11, 14, 15, 16, 20, 22, 23, 25, 26, 28, 32, 34, 36, 38, 39, 42, 44, 46, 49],
  },
  {
    label: "6.5",
    expect: "2026156",
    numbers: [2, 4, 6, 8, 10, 12, 13, 14, 16, 18, 20, 22, 23, 24, 26, 28, 30, 32, 34, 35, 36, 38],
  },
  {
    label: "6.6",
    expect: "2026157",
    numbers: [10, 12, 14, 15, 16, 18, 20, 22, 24, 26, 27, 28, 30, 32, 34, 36, 38, 39, 40, 42, 46, 47],
  },
  {
    label: "6.7",
    expect: "2026158",
    numbers: [2, 3, 6, 8, 9, 10, 12, 14, 15, 18, 20, 22, 24, 26, 27, 30, 32, 33, 34, 36, 38, 39],
  },
  {
    label: "6.8",
    expect: "2026159",
    numbers: [2, 3, 6, 8, 9, 10, 12, 14, 15, 18, 20, 22, 24, 26, 27, 30, 32, 33, 34, 36, 38, 39],
  },
];

function externalNumbersKey(numbers) {
  return [...numbers].sort((a, b) => a - b).map(formatNumber).join(",");
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function setExternalAccess(unlocked) {
  els.externalAccessGate.hidden = unlocked;
  els.externalProtectedContent.hidden = !unlocked;
  if (unlocked) {
    els.externalPasswordError.textContent = "";
  } else {
    els.externalPasswordInput.value = "";
    els.externalPasswordError.textContent = "";
  }
}

async function unlockExternalPage() {
  const password = els.externalPasswordInput.value;
  const hash = await sha256Hex(password);
  if (hash !== EXTERNAL_PASSWORD_HASH) {
    els.externalPasswordError.textContent = "密码错误，请重新输入。";
    els.externalPasswordError.className = "save-status warn";
    els.externalPasswordInput.select();
    return;
  }
  setExternalAccess(true);
}

function externalHistoryKey(record) {
  return `${record.expect || record.label || ""}|${externalNumbersKey(record.numbers)}`;
}

function nextExternalExpect() {
  return inferExternalExpect(formatExternalDateLabel()) || String(Number(state.draws[0]?.expect || 0) + 1);
}

function formatExternalDateLabel(date = new Date()) {
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

function normalizeExternalLabel(label) {
  return String(label || "").replace("/", ".");
}

function inferExternalExpect(label) {
  const normalized = normalizeExternalLabel(label);
  const [month, day] = normalized.split(".").map(Number);
  const anchor = EXTERNAL_HISTORY_RECORDS.find((record) => record.label === "6.8");
  if (!month || !day || !anchor) return "";
  const year = new Date().getFullYear();
  const targetDate = Date.UTC(year, month - 1, day);
  const anchorDate = Date.UTC(year, 5, 8);
  const dayDiff = Math.round((targetDate - anchorDate) / 86400000);
  return String(Number(anchor.expect) + dayDiff);
}

function normalizeExternalHistoryRecord(record, index = 0) {
  const numbers = uniqueNumbers(record.numbers || []);
  const generated20 = uniqueNumbers(record.generated20 || record.generatedNumbers || []);
  const generated10 = uniqueNumbers(record.generated10 || generated20.slice(0, 10));
  const generated5 = uniqueNumbers(record.generated5 || generated20.slice(0, 5));
  return {
    id: record.id || "",
    label: normalizeExternalLabel(record.label || `记录 ${index + 1}`),
    expect: record.expect || nextExternalExpect(),
    numbers,
    generated20,
    generated10,
    generated5,
    generatedReason: record.generatedReason || "",
    createdAt: record.createdAt || new Date().toLocaleString("zh-CN", { hour12: false }),
  };
}

function migrateSavedExternalRecord(record) {
  const isSaved = String(record.id || "").startsWith("saved-");
  const normalizedLabel = normalizeExternalLabel(record.label);
  const inferredExpect = inferExternalExpect(normalizedLabel);
  if (isSaved && inferredExpect) {
    return { ...record, label: normalizedLabel, expect: inferredExpect };
  }
  return { ...record, label: normalizedLabel };
}

function loadSavedExternalHistory() {
  try {
    const raw = localStorage.getItem(EXTERNAL_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw)
      .map(normalizeExternalHistoryRecord)
      .map(migrateSavedExternalRecord)
      .filter((record) => record.numbers.length > 0);
  } catch (error) {
    console.warn("22码历史读取失败", error);
    return [];
  }
}

function saveExternalHistory(records) {
  localStorage.setItem(EXTERNAL_HISTORY_STORAGE_KEY, JSON.stringify(records));
}

function getExternalHistoryRecords() {
  const savedRecords = loadSavedExternalHistory();
  const seen = new Set();
  const fixedRecords = EXTERNAL_HISTORY_RECORDS.map(normalizeExternalHistoryRecord).filter((record) => record.numbers.length > 0);
  const fixedByKey = new Map(fixedRecords.map((record) => [externalHistoryKey(record), record]));
  fixedRecords.forEach((record) => seen.add(externalHistoryKey(record)));
  const uniqueSavedRecords = savedRecords
    .map(normalizeExternalHistoryRecord)
    .filter((record) => {
      if (record.numbers.length === 0) return false;
      const key = externalHistoryKey(record);
      if (fixedByKey.has(key)) {
        const fixedRecord = fixedByKey.get(key);
        if (record.generated20.length) {
          fixedRecord.generated20 = record.generated20;
          fixedRecord.generated10 = record.generated10;
          fixedRecord.generated5 = record.generated5;
          fixedRecord.generatedReason = record.generatedReason;
        }
        return false;
      }
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return [...uniqueSavedRecords, ...fixedRecords].sort((a, b) => {
    const expectDiff = Number(b.expect || 0) - Number(a.expect || 0);
    if (expectDiff) return expectDiff;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function addExternalHistoryRecord(numbers, generated20 = [], generated10 = [], generated5 = [], generatedReason = "") {
  if (!numbers.length) return { added: false, message: "请先输入号码再保存。" };
  const pendingExpect = nextExternalExpect();
  const key = externalHistoryKey({ expect: pendingExpect, numbers });
  const savedRecords = loadSavedExternalHistory();
  const savedIndex = savedRecords.findIndex((record) => externalHistoryKey(record) === key);
  if (savedIndex >= 0) {
    savedRecords[savedIndex] = normalizeExternalHistoryRecord({
      ...savedRecords[savedIndex],
      generated20,
      generated10,
      generated5,
      generatedReason,
    });
    saveExternalHistory(savedRecords);
    return { added: true, message: "历史记录已更新，并保存模型20码、10码和5码。" };
  }

  const existingKeys = new Set(getExternalHistoryRecords().map(externalHistoryKey));
  const existingFixed = existingKeys.has(key);
  if (existingFixed && !generated20.length) {
    return { added: false, message: "这组号码已经在当前期号的历史复盘里，不重复保存。" };
  }
  const nextRecord = normalizeExternalHistoryRecord({
    id: `saved-${Date.now()}`,
    label: formatExternalDateLabel(),
    expect: pendingExpect,
    numbers,
    generated20,
    generated10,
    generated5,
    generatedReason,
    createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
  });
  savedRecords.unshift(nextRecord);
  saveExternalHistory(savedRecords);
  return { added: true, message: `已保存 ${numbers.length} 个号码到历史复盘。` };
}

function saveCurrentExternalNumbers() {
  const numbers = parseExternalNumbers(els.externalNumbersInput.value);
  const currentKey = externalNumbersKey(numbers);
  const analyzedKey = externalNumbersKey(state.externalAnalysis?.numbers || []);
  if (!state.externalAnalysis || currentKey !== analyzedKey) {
    els.externalSaveStatus.textContent = "请先分析当前这组号码，再保存原号码和模型20码、10码、5码。";
    els.externalSaveStatus.className = "save-status warn";
    return;
  }
  const result = addExternalHistoryRecord(
    numbers,
    state.externalAnalysis.generatedNumbers,
    state.externalAnalysis.recommendation10,
    state.externalAnalysis.recommendation5,
    state.externalAnalysis.generatedReason,
  );
  els.externalSaveStatus.textContent = result.message;
  els.externalSaveStatus.className = `save-status ${result.added ? "ok" : "warn"}`;
  if (result.added) renderExternalHistoryAnalysis();
}

function formatNumber(value) {
  return String(value).padStart(2, "0");
}

function isBig(number) {
  return number >= 25 ? "大" : "小";
}

function waveClass(wave) {
  return ["red", "green", "blue"].includes(wave) ? wave : "green";
}

function parseDraw(raw) {
  const numbers = raw.openCode.split(",").map((value) => Number(value));
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

async function fetchDraws() {
  const response = await fetch(DATABASE_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`本地数据库读取失败：${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload.data)) {
    throw new Error("本地数据库格式不正确，请重新运行下载脚本。");
  }
  state.databaseMeta = payload;
  return payload.data.map(parseDraw);
}

async function fetchReview() {
  const response = await fetch("data/latest-review.json", { cache: "no-store" });
  if (!response.ok) return null;
  return response.json();
}

function uniqueAndSort(draws) {
  const map = new Map();
  draws.forEach((draw) => {
    if (!map.has(draw.expect)) map.set(draw.expect, draw);
  });
  return Array.from(map.values()).sort((a, b) => b.openTime.localeCompare(a.openTime));
}

function makeCounter(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function addCount(counter, key, amount = 1) {
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
  const miss = makeCounter(NUMBERS);
  NUMBERS.forEach((number) => {
    const index = draws.findIndex((draw) => selector(draw).includes(number));
    miss[number] = index === -1 ? draws.length : index;
  });
  return miss;
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

function rankNormalHit3Picks(draws, meta, normalHits = makeCounter(NUMBERS), simulations = 1) {
  return NUMBERS.map((number) => ({
    number,
    hits: normalHits[number] || 0,
    probability: (normalHits[number] || 0) / Math.max(1, simulations),
    modelScore: normalHit3Score(number, draws),
    wave: meta[number]?.wave || "",
    zodiac: meta[number]?.zodiac || "",
    size: isBig(number),
  }))
    .sort((a, b) => b.modelScore - a.modelScore || b.probability - a.probability || a.number - b.number)
    .slice(0, 5);
}

function rankStatisticalZodiacs() {
  const scores = {};
  (state.analysis?.weightedNormalNumbers || []).forEach((item) => {
    if (!item.zodiac) return;
    scores[item.zodiac] = (scores[item.zodiac] || 0) + item.weight;
  });
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([zodiac]) => zodiac);
}

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let target = Math.random() * total;
  for (const item of items) {
    target -= item.weight;
    if (target <= 0) return item;
  }
  return items[items.length - 1];
}

function buildNumberMeta(draws) {
  const meta = {};
  draws.forEach((draw) => {
    draw.numbers.forEach((number, index) => {
      if (!meta[number]) {
        meta[number] = {
          wave: draw.waves[index],
          zodiac: draw.zodiacs[index],
        };
      }
    });
  });
  return meta;
}

function analyze(draws) {
  const specialSample = draws.slice(0, SPECIAL_MODEL.limit);
  const specialRecent = specialSample.slice(0, Math.min(SPECIAL_MODEL.recentLimit, specialSample.length));
  const normalSample = draws.slice(0, ZODIAC_MODEL.limit);
  const normalRecent = normalSample.slice(0, Math.min(ZODIAC_MODEL.recentLimit, normalSample.length));
  const specialCounts = makeCounter(NUMBERS);
  const recentSpecialCounts = makeCounter(NUMBERS);
  const normalCounts = makeCounter(NUMBERS);
  const recentNormalCounts = makeCounter(NUMBERS);
  const weightedSpecialCounts = makeCounter(NUMBERS);
  const weightedNormalCounts = makeCounter(NUMBERS);
  const specialMiss = numberMiss(specialSample, (draw) => [draw.special]);
  const normalMiss = numberMiss(normalSample, (draw) => draw.normal);
  const meta = buildNumberMeta(draws);

  specialSample.forEach((draw, index) => {
    addCount(specialCounts, draw.special);
    addCount(weightedSpecialCounts, draw.special, drawAgeWeight(index));
  });

  specialRecent.forEach((draw) => {
    addCount(recentSpecialCounts, draw.special);
  });

  normalSample.forEach((draw, index) => {
    draw.normal.forEach((number) => {
      addCount(normalCounts, number);
      addCount(weightedNormalCounts, number, drawAgeWeight(index));
    });
  });

  normalRecent.forEach((draw) => {
    draw.normal.forEach((number) => addCount(recentNormalCounts, number));
  });

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
    const frequency = normalize(weightedSpecialCounts[number], maxCount);
    const shortTrend = normalize(recentSpecialCounts[number], maxRecent);
    const miss = normalize(specialMiss[number], maxMiss);
    const score =
      frequency * SPECIAL_MODEL.weights.frequency +
      shortTrend * SPECIAL_MODEL.weights.recent +
      miss * SPECIAL_MODEL.weights.miss;
    return {
      number,
      weight: Math.max(1, score + 1),
      score: Math.round(score * 10) / 10,
      count: specialCounts[number],
      recent: recentSpecialCounts[number],
      miss: specialMiss[number],
      wave: meta[number]?.wave || "",
      zodiac: meta[number]?.zodiac || "",
      size: isBig(number),
    };
  });

  const weightedNormalNumbers = NUMBERS.map((number) => {
    const zodiac = meta[number]?.zodiac || "";
    const frequency = normalize(weightedNormalCounts[number], maxNormalCount);
    const shortTrend = normalize(recentNormalCounts[number], maxRecentNormal);
    const miss = normalize(normalMiss[number], maxNormalMiss);
    const score =
      frequency * ZODIAC_MODEL.weights.frequency +
      shortTrend * ZODIAC_MODEL.weights.recent +
      miss * ZODIAC_MODEL.weights.miss;
    return {
      number,
      weight: Math.max(1, score + 1),
      score: Math.round(score * 10) / 10,
      count: normalCounts[number],
      recent: recentNormalCounts[number],
      miss: normalMiss[number],
      wave: meta[number]?.wave || "",
      zodiac: meta[number]?.zodiac || "",
      size: isBig(number),
    };
  });

  return {
    specialSample,
    normalSample,
    weightedNumbers,
    weightedNormalNumbers,
    numberMeta: meta,
    zodiacToNumbers,
  };
}

function runMonteCarlo(simulations) {
  const numberHits = makeCounter(NUMBERS);
  const normalNumberHits = makeCounter(NUMBERS);
  const zodiacHits = {};
  const pool = state.analysis.weightedNumbers;
  const normalPool = state.analysis.weightedNormalNumbers;

  for (let index = 0; index < simulations; index += 1) {
    const picked = weightedPick(pool);
    const normalPicked = weightedPick(normalPool);
    addCount(numberHits, picked.number);
    addCount(normalNumberHits, normalPicked.number);
    addCount(zodiacHits, normalPicked.zodiac);
  }

  const specialPicks = NUMBERS.map((number) => {
    const meta = state.analysis.numberMeta[number] || {};
    return {
      number,
      hits: numberHits[number],
      probability: numberHits[number] / simulations,
      wave: meta.wave || "",
      zodiac: meta.zodiac || "",
      size: isBig(number),
    };
  }).sort((a, b) => b.hits - a.hits || a.number - b.number);

  const zodiacPicks = Object.entries(zodiacHits)
    .map(([zodiac, hits]) => ({
      zodiac,
      hits,
      probability: hits / simulations,
      numbers: (state.analysis.zodiacToNumbers[zodiac] || []).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 5);

  const usedNormalNumbers = new Set();
  const normalRecommendations = zodiacPicks.map((zodiacPick) => {
    const candidates = (state.analysis.zodiacToNumbers[zodiacPick.zodiac] || [])
      .map((number) => {
        const meta = state.analysis.numberMeta[number] || {};
        return {
          number,
          hits: normalNumberHits[number],
          probability: normalNumberHits[number] / simulations,
          wave: meta.wave || "",
          zodiac: meta.zodiac || zodiacPick.zodiac,
          size: isBig(number),
        };
      })
      .filter((item) => !usedNormalNumbers.has(item.number))
      .sort((a, b) => b.hits - a.hits || a.number - b.number);
    const selected = candidates[0];
    if (selected) usedNormalNumbers.add(selected.number);
    return {
      ...zodiacPick,
      normalNumber: selected,
    };
  });

  const normalHit3Picks = rankNormalHit3Picks(state.draws, state.analysis.numberMeta, normalNumberHits, simulations);

  return {
    simulations,
    specialPicks: specialPicks.slice(0, 10),
    special20Picks: specialPicks.slice(0, 20).sort((a, b) => a.number - b.number),
    zodiacPicks: normalRecommendations,
    topZodiac: normalRecommendations[0],
    normalHit3Picks,
    generatedAt: new Date(),
  };
}

function percent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function renderInlineBalls(picks) {
  return picks
    .map((item) => `<span class="mini-ball ${waveClass(item.wave)}">${formatNumber(item.number)}</span>`)
    .join("");
}

function renderSummaryMysticNormal() {
  if (!state.mysticPrediction?.normalPicks?.length) {
    return '<strong class="summary-pending">暂未预测</strong>';
  }
  return `<div class="summary-ball-row">${renderInlineBalls(state.mysticPrediction.normalPicks)}</div>`;
}

function renderPrediction() {
  const prediction = state.prediction;
  if (!prediction) {
    els.simulationResult.innerHTML = '<article class="pick-card"><strong>点击“开始预测”</strong><small>运行蒙特卡洛模拟后会显示结果。</small></article>';
    return;
  }

  const topSpecial = prediction.specialPicks[0];
  const normalHit3Balls = renderInlineBalls(prediction.normalHit3Picks);
  const mysticNormalSummary = renderSummaryMysticNormal();
  els.simulationCount.textContent = prediction.simulations.toLocaleString("zh-CN");
  els.predictionTime.textContent = prediction.generatedAt.toLocaleString("zh-CN", { hour12: false });
  els.simulationResult.innerHTML = `
    <article class="pick-card special-pick">
      <span>最高特码</span>
      <strong><span class="ball ${waveClass(topSpecial.wave)}">${formatNumber(topSpecial.number)}</span></strong>
      <small>${topSpecial.zodiac} / ${WAVE_LABELS[topSpecial.wave]} / 概率 ${percent(topSpecial.probability)}</small>
    </article>
    <article class="pick-card">
      <span>三中三推荐</span>
      <div class="summary-ball-row">${normalHit3Balls}</div>
      <small>近50期加权 + 组内冲三模型</small>
    </article>
    <article class="pick-card">
      <span>玄学平码推荐</span>
      ${mysticNormalSummary}
    </article>
  `;

  els.specialRecommendations.innerHTML = prediction.specialPicks
    .map(
      (item, index) => `
        <article class="number-card">
          <div class="number-head">
            <span class="ball ${waveClass(item.wave)}">${formatNumber(item.number)}</span>
            <span class="score">#${index + 1}</span>
          </div>
          <div class="tags">
            <span class="tag">${item.zodiac}</span>
            <span class="tag">${WAVE_LABELS[item.wave]}</span>
            <span class="tag">${item.size}</span>
            <span class="tag">${percent(item.probability)}</span>
          </div>
        </article>
      `,
    )
    .join("");

  els.special20Recommendations.innerHTML = prediction.special20Picks
    .map((item) => `<span class="mini-ball ${waveClass(item.wave)}">${formatNumber(item.number)}</span>`)
    .join("");

  els.zodiacRecommendations.innerHTML = prediction.normalHit3Picks
    .map(
      (item, index) => `
        <article class="zodiac-card normal-hit3-card">
          <div>
            <span>平码 ${index + 1}</span>
            <strong><span class="ball ${waveClass(item.wave)}">${formatNumber(item.number)}</span></strong>
            <small>${item.zodiac} / ${WAVE_LABELS[item.wave]} / ${item.size}</small>
          </div>
          <div class="zodiac-card-number">
            <span class="score">#${index + 1}</span>
            <small>模型分 ${item.modelScore.toFixed(2)} / 模拟 ${percent(item.probability)}</small>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderReview(review) {
  if (!review) {
    els.reviewTime.textContent = "暂无复盘";
    els.reviewPanel.innerHTML = '<article class="review-card"><strong>暂无复盘记录</strong><small>本地历史库更新后会自动生成最新复盘。</small></article>';
    return;
  }

  els.reviewTime.textContent = `${review.expect} / ${review.generatedAt}`;
  const specialClass = review.result.specialHit ? "hit" : "miss";
  const normalHit3MatchedCount = review.result.normalHit3MatchedCount ?? review.result.normalNumberMatchedCount ?? 0;
  const normalClass = normalHit3MatchedCount >= 3 ? "hit" : "miss";
  const actualBalls = review.actual.openCode
    .map((number, index) => {
      const separator = index === 6 ? '<span class="special-separator">+</span>' : "";
      return `${separator}<span class="mini-ball ${waveClass(review.actual.waves?.[index])}">${number}</span>`;
    })
    .join("");
  const specialPicks = review.predicted.specialTop10
    .map((pick) => `<span class="mini-ball ${waveClass(pick.wave)} ${pick.code === review.actual.special ? "review-hit" : ""}">${pick.code}</span>`)
    .join("");
  const special20Source = Array.isArray(review.predicted.specialTop20)
    ? review.predicted.specialTop20
    : [];
  const special20Picks = special20Source
    .slice()
    .sort((a, b) => Number(a.code || a.number) - Number(b.code || b.number))
    .slice(0, 20)
    .map((pick) => `<span class="mini-ball ${waveClass(pick.wave)} ${pick.code === review.actual.special ? "review-hit" : ""}">${pick.code}</span>`)
    .join("");
  const special20Display = special20Picks
    || '<small class="review-data-warning">缺少20码复盘数据，请先在本地更新历史库后重新上传。</small>';
  const normalHit3Source = Array.isArray(review.predicted.normalHit3Five)
    ? review.predicted.normalHit3Five
    : (review.predicted.zodiacFive || []).map((pick) => ({
      code: pick.normalNumber,
      number: Number(pick.normalNumber),
      zodiac: pick.zodiac,
      wave: pick.wave,
    }));
  const normalHit3Picks = normalHit3Source
    .map((pick) => {
      const code = pick.code || formatNumber(pick.number);
      const numberHit = review.actual.normalNumbers.includes(code);
      return `
        <span class="review-pair ${numberHit ? "review-hit" : ""}">
          <span class="mini-ball ${waveClass(pick.wave)}">${code}</span>
          <span class="review-zodiac-name">${pick.zodiac}</span>
        </span>
      `;
    })
    .join("");

  els.reviewPanel.innerHTML = `
    <article class="review-card ${specialClass}">
      <span>特码复盘</span>
      <strong>${review.result.specialHit ? "命中" : "未中"}</strong>
      <small>实际特码 ${review.actual.special}</small>
    </article>
    <article class="review-card ${normalClass}">
      <span>三中三推荐复盘</span>
      <strong>${normalHit3MatchedCount} / 5</strong>
      <small>命中：${(review.result.normalHit3Matches || review.result.normalNumberMatches || []).join("、") || "无"}</small>
    </article>
    <article class="review-card wide">
      <span>实际开奖号</span>
      <div class="draw-balls">${actualBalls}</div>
    </article>
    <article class="review-card wide">
      <span>10码中特</span>
      <div class="draw-balls">${specialPicks}</div>
    </article>
    <article class="review-card wide">
      <span>20码中特（${special20Source.slice(0, 20).length} 个）</span>
      <div class="draw-balls review-special-20">${special20Display}</div>
    </article>
    <article class="review-card wide">
      <span>三中三推荐</span>
      <div class="review-pairs">${normalHit3Picks}</div>
    </article>
  `;
}

async function loadReview() {
  try {
    const review = await fetchReview();
    renderReview(review);
  } catch {
    renderReview(null);
  }
}

function switchPage(pageId) {
  if (pageId === "externalPage") {
    setExternalAccess(false);
  }
  els.pageSections.forEach((section) => {
    section.classList.toggle("active", section.id === pageId);
  });
  els.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });
}

function uniqueNumbers(numbers) {
  return [...new Set(numbers.map(Number).filter((number) => number >= 1 && number <= 49))];
}

function numberFromSeed(seed) {
  const value = Number(seed);
  return ((Math.abs(value) - 1) % 49) + 1;
}

function digitSum(value) {
  return String(value).replace(/\D/g, "").split("").reduce((sum, char) => sum + Number(char), 0);
}

function numbersByFilter(limit, filter) {
  return NUMBERS.filter(filter).slice(0, limit);
}

const MYSTIC_DRAW_HOUR = 21;
const MYSTIC_DRAW_MINUTE = 32;

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = formatNumber(date.getMonth() + 1);
  const day = formatNumber(date.getDate());
  return `${year}-${month}-${day}`;
}

function getNextMysticTargetTime() {
  const latest = state.draws[0];
  const latestTime = latest?.openTime
    ? new Date(latest.openTime.replace(" ", "T"))
    : new Date();
  const target = Number.isNaN(latestTime.getTime()) ? new Date() : latestTime;
  target.setDate(target.getDate() + 1);
  return target;
}

function syncMysticTargetTime(force = false) {
  if (!els.mysticTargetTime || (!force && els.mysticTargetTime.value)) return;
  els.mysticTargetTime.value = formatDateInput(getNextMysticTargetTime());
}

function parseMysticTargetDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(NaN);
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, MYSTIC_DRAW_HOUR, MYSTIC_DRAW_MINUTE, 0, 0);
}

function chineseHourLabel(hour) {
  const labels = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  return labels[Math.floor(((hour + 1) % 24) / 2)];
}

function getMysticContext(targetTime) {
  const latest = state.draws[0];
  const now = targetTime;
  const nextExpect = Number(latest?.expect || 0) + 1;
  const dateKey = Number(`${now.getFullYear()}${formatNumber(now.getMonth() + 1)}${formatNumber(now.getDate())}`);
  const meta = state.analysis?.numberMeta || buildNumberMeta(state.draws);
  return {
    latest,
    now,
    nextExpect,
    dateKey,
    meta,
    day: now.getDate(),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    weekday: now.getDay() || 7,
    hour: now.getHours(),
    minute: now.getMinutes(),
    hourLabel: chineseHourLabel(now.getHours()),
  };
}

function buildMysticMethods(targetTime) {
  const ctx = getMysticContext(targetTime);
  const elementWaves = ["red", "green", "blue", "red", "green"];
  const dayElementIndex = (ctx.year + ctx.month + ctx.day) % 5;
  const wave = elementWaves[dayElementIndex];
  const zodiacCycle = ["鼠", "牛", "虎", "兔", "龍", "蛇", "馬", "羊", "猴", "雞", "狗", "豬"];
  const yearZodiac = zodiacCycle[(ctx.year - 2020 + 1200) % 12];
  const dateSum = digitSum(ctx.dateKey);
  const expectSum = digitSum(ctx.nextExpect);
  const latestNums = ctx.latest?.numbers || [];
  const latestSpecial = ctx.latest?.special || 1;

  const methods = [
    {
      name: "生肖五行",
      reason: `按年份生肖 ${yearZodiac} 与当日五行取合生肖号码`,
      numbers: numbersByFilter(8, (number) => [yearZodiac, zodiacCycle[(zodiacCycle.indexOf(yearZodiac) + 4) % 12], zodiacCycle[(zodiacCycle.indexOf(yearZodiac) + 8) % 12]].includes(ctx.meta[number]?.zodiac)),
      weight: 1.15,
    },
    {
      name: "波色五行",
      reason: `按日期五行取主波色 ${WAVE_LABELS[wave]}`,
      numbers: numbersByFilter(12, (number) => ctx.meta[number]?.wave === wave),
      weight: 1.05,
    },
    {
      name: "日期数秘",
      reason: "年月日数字相加、拆分、倍数取 1-49",
      numbers: uniqueNumbers([dateSum, dateSum * 2, dateSum * 3, ctx.day + ctx.month, ctx.day * ctx.month, ctx.year + ctx.day]),
      weight: 1,
    },
    {
      name: "期号数秘",
      reason: "下一期期号数字和、尾数与倍数转成号码",
      numbers: uniqueNumbers([expectSum, expectSum * 2, expectSum * 3, ctx.nextExpect % 49, (ctx.nextExpect % 100) + ctx.weekday]),
      weight: 1,
    },
    {
      name: "周易卦数",
      reason: "用日期与期号起上下卦，取卦数与变爻组合",
      numbers: uniqueNumbers([
        (dateSum % 8) * 6 + (expectSum % 6 || 6),
        ((ctx.day + ctx.weekday) % 8) * 6 + (ctx.hour % 6 || 6),
        (dateSum + expectSum + ctx.hour) % 64,
        (ctx.day * 6 + ctx.weekday) % 49,
      ]),
      weight: 1.1,
    },
    {
      name: "梅花易数",
      reason: "年月日时起数，取本卦、互卦、变卦对应号码",
      numbers: uniqueNumbers([
        ctx.year + ctx.month + ctx.day,
        ctx.month + ctx.day + ctx.hour,
        ctx.year + ctx.month + ctx.day + ctx.hour,
        (ctx.day + ctx.hour) * 2,
        (ctx.month + ctx.weekday) * 3,
      ]),
      weight: 1.05,
    },
    {
      name: "九宫洛书",
      reason: "按九宫数 1-9 映射号码根数",
      numbers: numbersByFilter(10, (number) => ((number - 1) % 9) + 1 === ((dateSum + ctx.weekday - 1) % 9) + 1),
      weight: 0.95,
    },
    {
      name: "尾数法",
      reason: "取日期尾、期号尾、上期特码尾",
      numbers: numbersByFilter(12, (number) => [ctx.day % 10, ctx.nextExpect % 10, latestSpecial % 10].includes(number % 10)),
      weight: 0.95,
    },
    {
      name: "上期开奖共振",
      reason: "用上期开奖号码加减日期数，形成共振号码",
      numbers: uniqueNumbers(latestNums.flatMap((number) => [number + ctx.weekday, number - ctx.weekday, number + ctx.day])),
      weight: 0.9,
    },
    {
      name: "冷热重合",
      reason: "玄学候选与统计模型高权重号码重合时加权",
      numbers: [...(state.analysis?.weightedNumbers || [])].sort((a, b) => b.weight - a.weight).slice(0, 12).map((item) => item.number),
      weight: 1.2,
    },
  ];

  return methods.map((method) => ({
    ...method,
    numbers: uniqueNumbers(method.numbers).slice(0, 12),
  }));
}

function getStatisticalFiveZodiacs() {
  const predicted = (state.prediction?.zodiacPicks || [])
    .map((item) => item.zodiac)
    .filter(Boolean);
  if (predicted.length >= 5) return predicted.slice(0, 5);

  const scores = {};
  (state.analysis?.weightedNormalNumbers || []).forEach((item) => {
    if (!item.zodiac) return;
    scores[item.zodiac] = (scores[item.zodiac] || 0) + item.weight;
  });
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([zodiac]) => zodiac);
}

function runMysticMonteCarlo(simulations, targetTime) {
  const context = getMysticContext(targetTime);
  const methods = buildMysticMethods(targetTime);
  const mysticScoreMap = makeCounter(NUMBERS);
  const methodHits = {};
  methods.forEach((method) => {
    methodHits[method.name] = method.numbers.map(formatNumber);
    method.numbers.forEach((number, index) => {
      addCount(mysticScoreMap, number, method.weight * (1 + (12 - index) / 20));
    });
  });

  const specialModel = new Map((state.analysis?.weightedNumbers || []).map((item) => [item.number, item.weight]));
  const normalModel = new Map((state.analysis?.weightedNormalNumbers || []).map((item) => [item.number, item.weight]));
  const statisticalZodiacs = getStatisticalFiveZodiacs();
  const zodiacSet = new Set(statisticalZodiacs);
  const specialPool = NUMBERS.map((number) => ({
    number,
    weight: Math.max(1, (mysticScoreMap[number] || 0.2) * 4 + (specialModel.get(number) || 1)),
  }));
  const normalPool = NUMBERS
    .filter((number) => zodiacSet.has(state.analysis?.numberMeta[number]?.zodiac))
    .map((number) => ({
      number,
      weight: Math.max(1, (mysticScoreMap[number] || 0.2) * 4 + (normalModel.get(number) || 1)),
    }));
  const specialHits = makeCounter(NUMBERS);
  const normalHits = makeCounter(NUMBERS);
  for (let index = 0; index < simulations; index += 1) {
    addCount(specialHits, weightedPick(specialPool).number);
    addCount(normalHits, weightedPick(normalPool).number);
  }

  const meta = state.analysis?.numberMeta || {};
  const makePicks = (hits, limit) => NUMBERS.map((number) => ({
      number,
      probability: hits[number] / simulations,
      score: mysticScoreMap[number] || 0,
      wave: meta[number]?.wave || "",
      zodiac: meta[number]?.zodiac || "",
      methods: methods.filter((method) => method.numbers.includes(number)).map((method) => method.name),
    }))
    .sort((a, b) => b.probability - a.probability || b.score - a.score)
    .slice(0, limit);
  const normalPicks = statisticalZodiacs.map((zodiac) => NUMBERS
    .filter((number) => meta[number]?.zodiac === zodiac)
    .map((number) => ({
      number,
      probability: normalHits[number] / simulations,
      score: mysticScoreMap[number] || 0,
      wave: meta[number]?.wave || "",
      zodiac,
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
    generatedAt: new Date(),
    context,
  };
}

function renderMysticPrediction(result) {
  const targetDate = result.context.now.toLocaleDateString("zh-CN");
  const runText = result.generatedAt.toLocaleString("zh-CN", { hour12: false });
  els.mysticTimeInfo.innerHTML = `
    <strong>本次采用：${targetDate}，固定开奖时间 ${formatNumber(MYSTIC_DRAW_HOUR)}:${formatNumber(MYSTIC_DRAW_MINUTE)}（${result.context.hourLabel}时）</strong>
    <span>目标期号 ${result.context.nextExpect} · 五肖重叠 ${result.statisticalZodiacs.join("、")} · 运行时间 ${runText}</span>
  `;
  const renderPicks = (picks, role) => picks.map((item, index) => `
      <article class="number-card mystic-card">
        <div class="number-head">
          <span class="ball ${waveClass(item.wave)}">${formatNumber(item.number)}</span>
          <span class="score">#${index + 1}</span>
        </div>
        <div class="tags">
          <span class="tag">${item.zodiac || "生肖待定"}</span>
          <span class="tag">${WAVE_LABELS[item.wave] || "波色待定"}</span>
          <span class="tag">${role}</span>
          <span class="tag">${percent(item.probability)}</span>
        </div>
        <small>${item.methods.join("、") || "综合权重"}</small>
      </article>
    `)
    .join("");
  els.mysticSpecialResults.innerHTML = renderPicks(result.specialPicks, "特码");
  els.mysticNormalResults.innerHTML = renderPicks(result.normalPicks, "平码");

  els.mysticMethodList.innerHTML = result.methods
    .map((method) => `
      <article class="method-card">
        <h3>${method.name}</h3>
        <p>${method.reason}</p>
        <div class="draw-balls">
          ${method.numbers.map((number) => {
            const meta = state.analysis?.numberMeta[number] || {};
            return `<span class="mini-ball ${waveClass(meta.wave)}">${formatNumber(number)}</span>`;
          }).join("")}
        </div>
      </article>
    `)
    .join("");
}

function runMysticPrediction() {
  if (!state.draws.length) return;
  syncMysticTargetTime();
  const targetTime = parseMysticTargetDate(els.mysticTargetTime.value);
  if (Number.isNaN(targetTime.getTime())) {
    alert("请先选择正确的目标开奖日期。");
    els.mysticTargetTime.focus();
    return;
  }
  const simulations = Number(els.mysticSimInput.value) || 100000;
  const result = runMysticMonteCarlo(simulations, targetTime);
  state.mysticPrediction = result;
  renderMysticPrediction(result);
  if (state.prediction) renderPrediction();
}

function parseExternalNumbers(text) {
  return uniqueNumbers(text.match(/\d{1,2}/g) || []);
}

function specialStatsForNumber(number, draws) {
  const recent45 = draws.slice(0, 45);
  const sample120 = draws.slice(0, 120);
  const sample365 = draws.slice(0, 365);
  const missIndex = draws.findIndex((draw) => draw.special === number);
  return {
    recent45: recent45.filter((draw) => draw.special === number).length,
    count120: sample120.filter((draw) => draw.special === number).length,
    count365: sample365.filter((draw) => draw.special === number).length,
    miss: missIndex === -1 ? draws.length : missIndex,
  };
}

function countValues(items, getter) {
  return items.reduce((acc, item) => {
    const key = getter(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function sortedCountText(counts, formatter = (key) => key, limit = 6) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([key, count]) => `${formatter(key)}${Number.isInteger(count) ? count : count.toFixed(1)}个`)
    .join("、");
}

function averageCounts(records, group) {
  const totals = {};
  records.forEach((record) => {
    Object.entries(record.profile[group]).forEach(([key, count]) => {
      totals[key] = (totals[key] || 0) + count;
    });
  });
  return Object.fromEntries(Object.entries(totals).map(([key, total]) => [key, total / Math.max(records.length, 1)]));
}

function mergeProfileCounts(currentCounts, learnedCounts, currentWeight = 0.55) {
  const keys = new Set([...Object.keys(currentCounts), ...Object.keys(learnedCounts)]);
  const merged = {};
  keys.forEach((key) => {
    const current = currentCounts[key] || 0;
    const learned = learnedCounts[key] || 0;
    merged[key] = Math.max(0, Math.round(current * currentWeight + learned * (1 - currentWeight)));
  });
  return merged;
}

function buildExternalLearningProfile(records = getExternalHistoryRecords()) {
  const meta = state.analysis?.numberMeta || buildNumberMeta(state.draws);
  const modelRows = buildSpecialModelRows(state.draws);
  const rankMap = new Map(modelRows.map((row, index) => [row.number, index + 1]));
  const normalizedRecords = records
    .map(normalizeExternalHistoryRecord)
    .filter((record) => record.numbers.length > 0)
    .map((record) => {
      const rows = record.numbers.map((number) => ({
        number,
        wave: meta[number]?.wave || "unknown",
        zodiac: meta[number]?.zodiac || "unknown",
        size: number >= 25 ? "big" : "small",
        tail: number % 10,
        rank: rankMap.get(number) || 99,
      }));
      return {
        ...record,
        rows,
        profile: {
          wave: countValues(rows, (row) => row.wave),
          zodiac: countValues(rows, (row) => row.zodiac),
          size: countValues(rows, (row) => row.size),
          tail: countValues(rows, (row) => row.tail),
        },
        top22Count: rows.filter((row) => row.rank <= 22).length,
      };
    });
  const numberFrequency = {};
  normalizedRecords.forEach((record) => {
    record.numbers.forEach((number) => addCount(numberFrequency, number));
  });
  const stableNumbers = Object.entries(numberFrequency)
    .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
    .slice(0, 12)
    .map(([number, count]) => ({ number: Number(number), count }));

  return {
    records: normalizedRecords,
    sampleCount: normalizedRecords.length,
    numberFrequency,
    stableNumbers,
    averageTop22: normalizedRecords.reduce((sum, record) => sum + record.top22Count, 0) / Math.max(normalizedRecords.length, 1),
    average: {
      wave: averageCounts(normalizedRecords, "wave"),
      zodiac: averageCounts(normalizedRecords, "zodiac"),
      size: averageCounts(normalizedRecords, "size"),
      tail: averageCounts(normalizedRecords, "tail"),
    },
  };
}

function buildMimicExternalSet(numbers, inputRows) {
  const mimicCount = 20;
  const modelRows = buildSpecialModelRows(state.draws);
  const rankedRows = modelRows.map((row, index) => ({ ...row, rank: index + 1 }));
  const inputSet = new Set(numbers);
  const currentProfile = {
    wave: countValues(inputRows, (row) => row.wave || "unknown"),
    zodiac: countValues(inputRows, (row) => row.zodiac || "unknown"),
    size: countValues(inputRows, (row) => (row.number >= 25 ? "big" : "small")),
    tail: countValues(inputRows, (row) => row.number % 10),
  };
  const learning = buildExternalLearningProfile();
  const sourceProfile = {
    wave: mergeProfileCounts(currentProfile.wave, learning.average.wave),
    zodiac: mergeProfileCounts(currentProfile.zodiac, learning.average.zodiac),
    size: mergeProfileCounts(currentProfile.size, learning.average.size),
    tail: mergeProfileCounts(currentProfile.tail, learning.average.tail),
  };
  const inputRankMap = new Map(rankedRows.map((row) => [row.number, row.rank]));
  const currentTop22 = numbers.filter((number) => (inputRankMap.get(number) || 99) <= 22).length;
  const targetTop22 = Math.round(currentTop22 * 0.6 + learning.averageTop22 * 0.4);
  const selected = [];
  const selectedSet = new Set();
  const selectedProfile = { wave: {}, zodiac: {}, size: {}, tail: {} };

  function addCandidate(row) {
    selected.push(row);
    selectedSet.add(row.number);
    addCount(selectedProfile.wave, row.wave || "unknown");
    addCount(selectedProfile.zodiac, row.zodiac || "unknown");
    addCount(selectedProfile.size, row.number >= 25 ? "big" : "small");
    addCount(selectedProfile.tail, row.number % 10);
  }

  function profileNeed(group, key) {
    const target = sourceProfile[group][key] || 0;
    const current = selectedProfile[group][key] || 0;
    return Math.max(0, target - current);
  }

  while (selected.length < Math.min(mimicCount, Math.max(0, rankedRows.length - inputSet.size))) {
    let best = null;
    let bestScore = -Infinity;
    const selectedTop22 = selected.filter((row) => row.rank <= 22).length;
    rankedRows.forEach((row) => {
      if (selectedSet.has(row.number) || inputSet.has(row.number)) return;
      const sizeKey = row.number >= 25 ? "big" : "small";
      const tailKey = row.number % 10;
      let score = row.score;
      score += profileNeed("wave", row.wave || "unknown") * 180;
      score += profileNeed("zodiac", row.zodiac || "unknown") * 120;
      score += profileNeed("size", sizeKey) * 140;
      score += profileNeed("tail", tailKey) * 40;
      score += (learning.numberFrequency[row.number] || 0) * 85;
      if (selectedTop22 < targetTop22 && row.rank <= 22) score += 260;
      score -= row.rank * 2;
      if (score > bestScore) {
        best = row;
        bestScore = score;
      }
    });
    if (!best) break;
    addCandidate(best);
  }

  rankedRows.forEach((row) => {
    if (selected.length >= mimicCount || selectedSet.has(row.number)) return;
    addCandidate(row);
  });

  const rankedNumbers = selected.slice(0, mimicCount).map((row) => row.number);
  const finalNumbers = [...rankedNumbers].sort((a, b) => a - b);
  const recommendation10 = rankedNumbers.slice(0, 10).sort((a, b) => a - b);
  const recommendation5 = rankedNumbers.slice(0, 5).sort((a, b) => a - b);
  const finalRows = finalNumbers.map((number) => rankedRows.find((row) => row.number === number));
  const finalTop22 = finalRows.filter((row) => row.rank <= 22).length;
  const sourceWaveText = sortedCountText(sourceProfile.wave, (key) => WAVE_LABELS[key] || "未知波色", 3);
  const sourceZodiacText = sortedCountText(sourceProfile.zodiac, (key) => key || "未知生肖", 5);
  const sizeText = `大号${sourceProfile.size.big || 0}个、小号${sourceProfile.size.small || 0}个`;
  const finalWaveText = sortedCountText(countValues(finalRows, (row) => row.wave || "unknown"), (key) => WAVE_LABELS[key] || "未知波色", 3);
  const finalZodiacText = sortedCountText(countValues(finalRows, (row) => row.zodiac || "unknown"), (key) => key || "未知生肖", 5);
  const stableText = learning.stableNumbers.slice(0, 8).map((item) => `${formatNumber(item.number)}(${item.count})`).join("、");

  return {
    numbers: finalNumbers,
    recommendation10,
    recommendation5,
    learning,
    reason: `这次不是只照抄当前一组，而是把已保存的${learning.sampleCount}组历史样本一起学习。当前输入是${numbers.length}个号码，结构是：${sizeText}，波色偏向${sourceWaveText}，生肖集中在${sourceZodiacText}；历史样本里反复出现的核心号码有${stableText || "暂无"}。仿照时我把“当前输入结构”和“历史习惯画像”合并，优先保留模型Top22、常出现号码、大小比例、波色生肖分布和尾数节奏，最终生成20码；这20码里有${finalTop22}个号码位于模型Top22，波色分布为${finalWaveText}，生肖分布为${finalZodiacText}。`,
  };
}

function analyzeExternalNumbers() {
  const numbers = parseExternalNumbers(els.externalNumbersInput.value);
  if (!numbers.length) {
    state.externalAnalysis = null;
    els.externalSummary.innerHTML = '<div class="notice compact">请先输入 1-49 的特码号码。</div>';
    els.externalNumberAnalysis.innerHTML = "";
    return;
  }

  const meta = state.analysis?.numberMeta || buildNumberMeta(state.draws);
  const modelTop = [...(state.analysis?.weightedNumbers || [])].sort((a, b) => b.weight - a.weight).slice(0, 10).map((item) => item.number);
  const waveCounts = {};
  const zodiacCounts = {};
  const tailCounts = {};
  numbers.forEach((number) => {
    addCount(waveCounts, WAVE_LABELS[meta[number]?.wave] || "未知");
    addCount(zodiacCounts, meta[number]?.zodiac || "未知");
    addCount(tailCounts, number % 10);
  });

  const rows = numbers.map((number) => {
    const stats = specialStatsForNumber(number, state.draws);
    const reasons = [];
    if (stats.recent45 > 0) reasons.push(`近45期出过${stats.recent45}次`);
    if (stats.count120 >= 3) reasons.push(`近120期偏热(${stats.count120}次)`);
    if (stats.miss >= 20) reasons.push(`遗漏${stats.miss}期，可能被当作补位号`);
    if (modelTop.includes(number)) reasons.push("与统计特码模型重合");
    reasons.push(`${meta[number]?.zodiac || "未知生肖"} / ${WAVE_LABELS[meta[number]?.wave] || "未知波色"} / ${isBig(number)}`);
    return {
      number,
      stats,
      reasons,
      wave: meta[number]?.wave || "",
      zodiac: meta[number]?.zodiac || "",
    };
  });

  const sortedWaves = Object.entries(waveCounts).sort((a, b) => b[1] - a[1]).map(([label, count]) => `${label}${count}`);
  const sortedZodiacs = Object.entries(zodiacCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, count]) => `${label}${count}`);
  const sortedTails = Object.entries(tailCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, count]) => `${label}尾${count}`);
  const mimic = buildMimicExternalSet(numbers, rows);
  state.externalAnalysis = {
    numbers: [...numbers],
    generatedNumbers: [...mimic.numbers],
    recommendation10: [...mimic.recommendation10],
    recommendation5: [...mimic.recommendation5],
    generatedReason: mimic.reason,
    analyzedAt: new Date().toISOString(),
  };
  const learnedTopText = mimic.learning.stableNumbers.slice(0, 10).map((item) => `${formatNumber(item.number)}(${item.count})`).join("、");
  const learnedWaveText = sortedCountText(mimic.learning.average.wave, (key) => WAVE_LABELS[key] || "未知波色", 3);
  const learnedSizeText = `大号约${(mimic.learning.average.size.big || 0).toFixed(1)}个，小号约${(mimic.learning.average.size.small || 0).toFixed(1)}个`;
  els.externalSummary.innerHTML = `
    <article class="review-card wide">
      <span>输入号码</span>
      <strong>${numbers.length} 个</strong>
      <small>按当前输入数量分析，不默认当作22码。</small>
    </article>
    <article class="review-card wide">
      <span>可能的选择倾向</span>
      <small>波色：${sortedWaves.join("、")}；生肖集中：${sortedZodiacs.join("、")}；尾数：${sortedTails.join("、")}</small>
    </article>
    <article class="review-card wide external-learning-card">
      <span>模型已学习样本</span>
      <strong>${mimic.learning.sampleCount} 组</strong>
      <small>${learnedSizeText}；平均波色：${learnedWaveText}；高频习惯号：${learnedTopText || "暂无"}</small>
    </article>
    <section class="external-prediction-window">
      <div class="external-prediction-tier">
        <strong>20码推荐</strong>
        <div class="draw-balls">${mimic.numbers.map((number) => {
          const metaRow = meta[number] || {};
          return `<span class="mini-ball ${waveClass(metaRow.wave)}">${formatNumber(number)}</span>`;
        }).join("")}</div>
      </div>
      <div class="external-prediction-tier">
        <strong>10码推荐</strong>
        <div class="draw-balls">${mimic.recommendation10.map((number) => {
          const metaRow = meta[number] || {};
          return `<span class="mini-ball ${waveClass(metaRow.wave)}">${formatNumber(number)}</span>`;
        }).join("")}</div>
      </div>
      <div class="external-prediction-tier">
        <strong>5码推荐</strong>
        <div class="draw-balls">${mimic.recommendation5.map((number) => {
          const metaRow = meta[number] || {};
          return `<span class="mini-ball ${waveClass(metaRow.wave)}">${formatNumber(number)}</span>`;
        }).join("")}</div>
      </div>
      <p>${mimic.reason}</p>
    </section>
  `;

  els.externalNumberAnalysis.innerHTML = rows
    .map((row) => `
      <article class="analysis-card">
        <div class="number-head">
          <span class="ball ${waveClass(row.wave)}">${formatNumber(row.number)}</span>
          <span class="score">${row.zodiac}</span>
        </div>
        <p>${row.reasons.join("；")}</p>
        <small>近365期特码${row.stats.count365}次 / 遗漏${row.stats.miss}期</small>
      </article>
    `)
    .join("");
  renderExternalHistoryAnalysis();
}

function buildSpecialModelRows(draws) {
  const sample = draws.slice(0, SPECIAL_MODEL.limit);
  const recent = sample.slice(0, Math.min(SPECIAL_MODEL.recentLimit, sample.length));
  const counts = makeCounter(NUMBERS);
  const weightedCounts = makeCounter(NUMBERS);
  const recentCounts = makeCounter(NUMBERS);
  const miss = numberMiss(sample, (draw) => [draw.special]);
  const meta = buildNumberMeta(draws);

  sample.forEach((draw, index) => {
    addCount(counts, draw.special);
    addCount(weightedCounts, draw.special, drawAgeWeight(index));
  });
  recent.forEach((draw) => addCount(recentCounts, draw.special));

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
      score,
      count120: counts[number],
      recent45: recentCounts[number],
      miss: miss[number],
      wave: meta[number]?.wave || "",
      zodiac: meta[number]?.zodiac || "",
    };
  }).sort((a, b) => b.score - a.score || a.number - b.number);
}

function buildExternalReasonRows(numbers, frozenDraws) {
  const modelRows = buildSpecialModelRows(frozenDraws);
  const top10 = modelRows.slice(0, 10).map((item) => item.number);
  const top22 = modelRows.slice(0, 22).map((item) => item.number);

  return numbers.map((number) => {
    const row = modelRows.find((item) => item.number === number);
    const reasons = [];
    if (row.recent45 > 0) reasons.push(`近45期出过${row.recent45}次`);
    if (row.count120 >= 3) reasons.push(`近120期偏热(${row.count120}次)`);
    if (row.miss >= 20) reasons.push(`遗漏${row.miss}期，可能被当作补位号`);
    if (top10.includes(number)) reasons.push("进入统计模型Top10");
    else if (top22.includes(number)) reasons.push("进入统计模型Top22");
    reasons.push(`${row.zodiac || "未知生肖"} / ${WAVE_LABELS[row.wave] || "未知波色"} / ${isBig(number)}`);
    return {
      number,
      code: formatNumber(number),
      wave: row.wave,
      zodiac: row.zodiac,
      rank: modelRows.findIndex((item) => item.number === number) + 1,
      reasons,
    };
  });
}

function buildExternalSetReason(record, rows, frozenDraws) {
  const top10Count = rows.filter((row) => row.rank > 0 && row.rank <= 10).length;
  const top22Count = rows.filter((row) => row.rank > 0 && row.rank <= 22).length;
  const bigCount = rows.filter((row) => row.number >= 25).length;
  const smallCount = rows.length - bigCount;
  const waveCounts = rows.reduce((acc, row) => {
    acc[row.wave] = (acc[row.wave] || 0) + 1;
    return acc;
  }, {});
  const zodiacCounts = rows.reduce((acc, row) => {
    acc[row.zodiac] = (acc[row.zodiac] || 0) + 1;
    return acc;
  }, {});
  const mainWaves = Object.entries(waveCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([wave, count]) => `${WAVE_LABELS[wave] || "未知波色"}${count}个`)
    .join("、");
  const mainZodiacs = Object.entries(zodiacCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([zodiac, count]) => `${zodiac || "未知生肖"}${count}个`)
    .join("、");
  const frozenExpect = frozenDraws[0]?.expect || record.expect;

  return `这组${record.numbers.length}码更像是按“统计模型覆盖 + 生肖波色分散 + 大小均衡”的方式挑出来的：以${record.expect}开奖前的数据封存到${frozenExpect}期为准，其中有${top10Count}个号码落在统计模型Top10，${top22Count}个号码落在Top22，说明选择者优先保留了近期热度、遗漏补位和模型排序靠前的号码；大小方面是大号${bigCount}个、小号${smallCount}个，没有只压单边；波色上主要集中在${mainWaves}，生肖上覆盖较多的是${mainZodiacs}。整体思路不是单挑一个号码，而是用当前码数扩大覆盖面，同时保留模型认为更容易被选中的热号、补位号和生肖波色组合。`;
}

function renderExternalHistoryAnalysis() {
  if (!state.draws.length) return;

  els.externalHistoryAnalysis.innerHTML = getExternalHistoryRecords().map((record) => {
    const targetDraw = state.draws.find((draw) => draw.expect === record.expect);
    const actualSpecial = targetDraw?.special;
    const hit = actualSpecial ? record.numbers.includes(actualSpecial) : false;
    const reviewLabel = actualSpecial
      ? `<span class="history-review-badge ${hit ? "hit" : "miss"}">${hit ? "命中" : "未中"} ${formatNumber(actualSpecial)}</span>`
      : '<span class="history-review-badge pending">待开奖</span>';
    const frozenDraws = state.draws.filter((draw) => draw.expect < record.expect);
    const rows = buildExternalReasonRows(record.numbers, frozenDraws);
    const balls = record.numbers
      .map((number) => {
        const row = rows.find((item) => item.number === number);
        return `<span class="mini-ball ${waveClass(row.wave)} ${number === actualSpecial ? "review-hit" : ""}">${formatNumber(number)}</span>`;
      })
      .join("");
    const reason = buildExternalSetReason(record, rows, frozenDraws);
    const renderGeneratedTier = (label, numbers) => {
      const tierRows = numbers.length ? buildExternalReasonRows(numbers, frozenDraws) : [];
      const tierBalls = numbers
        .map((number) => {
          const row = tierRows.find((item) => item.number === number);
          return `<span class="mini-ball ${waveClass(row?.wave)} ${number === actualSpecial ? "review-hit" : ""}">${formatNumber(number)}</span>`;
        })
        .join("");
      const tierHit = actualSpecial ? numbers.includes(actualSpecial) : false;
      const tierReviewLabel = actualSpecial
        ? `<span class="history-review-badge ${tierHit ? "hit" : "miss"}">${tierHit ? "命中" : "未中"} ${formatNumber(actualSpecial)}</span>`
        : '<span class="history-review-badge pending">待开奖</span>';
      return `
        <div class="history-generated-tier">
          <div class="history-generated-head">
            <strong>${label}</strong>
            ${tierReviewLabel}
          </div>
          <div class="history-balls">${tierBalls}</div>
        </div>
      `;
    };
    const generatedBlock = record.generated20.length
      ? `
        <div class="history-generated-block">
          ${renderGeneratedTier("模型20码", record.generated20)}
          ${renderGeneratedTier("模型10码", record.generated10)}
          ${renderGeneratedTier("模型5码", record.generated5)}
          <p>${record.generatedReason || "根据当时的历史样本画像与统计模型生成。"}</p>
        </div>
      `
      : "";

    return `
      <details class="history-analysis-item">
        <summary class="history-analysis-summary">
          <div class="history-analysis-head">
            <span>${record.label} / ${record.expect}</span>
            <span>${record.numbers.length}码选择理由 ${reviewLabel}</span>
          </div>
          <div class="history-balls">${balls}</div>
        </summary>
        <p class="history-set-reason">${reason}</p>
        ${generatedBlock}
      </details>
    `;
  }).join("");
}

function renderRecent(draws) {
  els.recentRows.innerHTML = draws
    .slice(0, 20)
    .map((draw) => {
      const balls = draw.numbers
        .map((number, index) => {
          const separator = index === 6 ? '<span class="special-separator">+</span>' : "";
          return `${separator}<button class="mini-ball history-ball ${waveClass(draw.waves[index])}" type="button" data-number="${formatNumber(number)}" data-zodiac="${draw.zodiacs[index]}" data-wave="${WAVE_LABELS[draw.waves[index]] || ""}" data-role="${index === 6 ? "特码" : "平码"}">${formatNumber(number)}</button>`;
        })
        .join("");
      return `
        <tr>
          <td>${draw.expect}</td>
          <td>${draw.openTime.slice(0, 10)}</td>
          <td><div class="draw-balls">${balls}</div></td>
          <td>${draw.specialZodiac} / ${WAVE_LABELS[draw.specialWave]} / ${isBig(draw.special)}</td>
        </tr>
      `;
    })
    .join("");
}

function hideNumberPopover() {
  if (activeNumberPopover) {
    activeNumberPopover.remove();
    activeNumberPopover = null;
  }
}

function showNumberPopover(button) {
  hideNumberPopover();
  const rect = button.getBoundingClientRect();
  const popover = document.createElement("div");
  popover.className = "number-popover";
  popover.innerHTML = `
    <strong>${button.dataset.number}</strong>
    <span>${button.dataset.zodiac}</span>
    <small>${button.dataset.role} / ${button.dataset.wave}</small>
  `;
  document.body.appendChild(popover);
  const popoverRect = popover.getBoundingClientRect();
  const left = Math.min(window.innerWidth - popoverRect.width - 12, Math.max(12, rect.left + rect.width / 2 - popoverRect.width / 2));
  const top = rect.top + window.scrollY - popoverRect.height - 10;
  popover.style.left = `${left}px`;
  popover.style.top = `${Math.max(12, top)}px`;
  activeNumberPopover = popover;
}

function renderBase() {
  const latest = state.draws[0];
  els.drawCount.textContent = state.draws.length;
  els.latestExpect.textContent = latest.expect;
  els.lastUpdatedAt.textContent = state.databaseMeta?.lastUpdatedAt || state.databaseMeta?.generatedAt || "-";
  syncMysticTargetTime(true);
  renderRecent(state.draws);
}

function setStatus(type, text) {
  els.connectionStatus.className = `status-dot ${type || ""}`.trim();
  els.statusText.textContent = text;
}

function predict() {
  if (!state.analysis) return;
  const simulations = Number(els.simulationInput.value);
  els.predictBtn.disabled = true;
  setStatus("", "模拟中");
  window.setTimeout(() => {
    state.prediction = runMonteCarlo(simulations);
    renderPrediction();
    setStatus("ok", "预测完成");
    els.predictBtn.disabled = false;
  }, 20);
}

async function loadAndAnalyze(runDefaultPrediction = true) {
  els.predictBtn.disabled = true;
  setStatus("", "加载中");
  try {
    const draws = await fetchDraws();
    state.draws = uniqueAndSort(draws);
    state.analysis = analyze(state.draws);
    renderBase();
    renderExternalHistoryAnalysis();
    await loadReview();
    setStatus("ok", "已读取本地库");
    els.predictBtn.disabled = false;
    if (runDefaultPrediction) predict();
  } catch (error) {
    console.error(error);
    setStatus("error", "读取失败");
    alert(error.message || "读取失败，请确认 data/history.json 已生成。");
  } finally {
    els.predictBtn.disabled = false;
  }
}

els.predictBtn.addEventListener("click", predict);
els.tabButtons.forEach((button) => {
  button.addEventListener("click", () => switchPage(button.dataset.page));
});
els.mysticPredictBtn.addEventListener("click", runMysticPrediction);
els.analyzeExternalBtn.addEventListener("click", analyzeExternalNumbers);
els.saveExternalBtn.addEventListener("click", saveCurrentExternalNumbers);
els.externalUnlockBtn.addEventListener("click", unlockExternalPage);
els.externalPasswordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") unlockExternalPage();
});
els.recentRows.addEventListener("click", (event) => {
  const button = event.target.closest(".history-ball");
  if (!button) return;
  showNumberPopover(button);
});
document.addEventListener("click", (event) => {
  if (event.target.closest(".history-ball") || event.target.closest(".number-popover")) return;
  hideNumberPopover();
});
window.addEventListener("scroll", hideNumberPopover, { passive: true });

setExternalAccess(false);
loadAndAnalyze();
