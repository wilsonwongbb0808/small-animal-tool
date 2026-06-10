import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLatestReview } from "./review-latest.mjs";
import { createLatestPrediction } from "./generate-prediction.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataFile = path.join(root, "data", "history.json");
const historyUrlTemplate = "https://history.macaumarksix.com/history/macaujc2/y/{year}";

function normalizeRecord(record) {
  return {
    expect: String(record.expect || ""),
    openTime: String(record.openTime || ""),
    openCode: String(record.openCode || ""),
    wave: String(record.wave || ""),
    zodiac: String(record.zodiac || ""),
  };
}

export async function updateLatestHistory() {
  const currentYear = new Date().getFullYear();
  const historyUrl = historyUrlTemplate.replace("{year}", currentYear);
  const [databaseText, response] = await Promise.all([
    readFile(dataFile, "utf8"),
    fetch(historyUrl, {
      headers: { "user-agent": "Mozilla/5.0" },
    }),
  ]);

  if (!response.ok) {
    throw new Error(`历史开奖接口请求失败：${response.status}`);
  }

  const payload = await response.json();
  const currentYearRecords = payload?.result && Array.isArray(payload.data)
    ? payload.data.filter((record) => String(record.expect || "").startsWith(String(currentYear)))
    : [];
  if (!currentYearRecords.length) {
    throw new Error(`历史开奖接口没有返回 ${currentYear} 年开奖记录。`);
  }
  const latestRecord = currentYearRecords
    .filter((record) => record.expect && record.openCode)
    .sort((a, b) => {
      const expectDiff = Number(b.expect) - Number(a.expect);
      return expectDiff || String(b.openTime || "").localeCompare(String(a.openTime || ""));
    })[0];
  if (!latestRecord) {
    throw new Error("历史开奖接口没有返回有效的最新一期开奖记录。");
  }

  const database = JSON.parse(databaseText);
  const records = new Map(database.data.map((item) => {
    const normalized = normalizeRecord(item);
    return [normalized.expect, normalized];
  }));
  const added = [];
  const updated = [];

  const normalized = normalizeRecord(latestRecord);
  if (records.has(normalized.expect)) {
    const existing = records.get(normalized.expect);
    records.set(normalized.expect, normalized);
    if (JSON.stringify(existing) !== JSON.stringify(normalized)) {
      updated.push(normalized.expect);
    }
  } else {
    records.set(normalized.expect, normalized);
    added.push(normalized.expect);
  }

  const data = Array.from(records.values()).sort((a, b) => b.openTime.localeCompare(a.openTime));
  const nextDatabase = {
    ...database,
    source: historyUrlTemplate,
    latestSource: historyUrl,
    lastUpdatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    endYear: Math.max(Number(database.endYear || currentYear), currentYear),
    fetchedYears: Array.from(new Set([...(database.fetchedYears || []), currentYear])).sort((a, b) => a - b),
    count: data.length,
    data,
  };

  await writeFile(dataFile, JSON.stringify(nextDatabase), "utf8");
  const review = await createLatestReview();
  const prediction = await createLatestPrediction();

  return {
    added,
    updated,
    count: data.length,
    latest: data[0],
    lastUpdatedAt: nextDatabase.lastUpdatedAt,
    review: review.result,
    prediction: {
      targetExpect: prediction.targetExpect,
      simulations: prediction.simulations,
      generatedAt: prediction.generatedAt,
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  updateLatestHistory()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
