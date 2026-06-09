import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const startYearArg = Number(process.argv[2]);
const endYearArg = Number(process.argv[3]);
const nowYear = new Date().getFullYear();
const startYear = Number.isFinite(startYearArg) ? startYearArg : 2017;
const endYear = Number.isFinite(endYearArg) ? endYearArg : nowYear;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const outFile = path.join(dataDir, "history.json");
const records = new Map();
const fetchedYears = [];

function normalizeRecord(record) {
  return {
    expect: String(record.expect || ""),
    openTime: String(record.openTime || ""),
    openCode: String(record.openCode || ""),
    wave: String(record.wave || ""),
    zodiac: String(record.zodiac || ""),
  };
}

await mkdir(dataDir, { recursive: true });

for (let year = startYear; year <= endYear; year += 1) {
  const url = `https://history.macaumarksix.com/history/macaujc2/y/${year}`;
  console.log(`Downloading ${year} ...`);
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) {
    throw new Error(`Request failed for ${year}: ${response.status}`);
  }
  const payload = await response.json();
  if (!payload.result || !Array.isArray(payload.data)) {
    continue;
  }
  fetchedYears.push(year);
  for (const item of payload.data) {
    if (item.expect && !records.has(item.expect)) {
      records.set(item.expect, normalizeRecord(item));
    }
  }
}

const data = Array.from(records.values()).sort((a, b) => b.openTime.localeCompare(a.openTime));
const database = {
  source: "https://history.macaumarksix.com/history/macaujc2/y/{year}",
  generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
  startYear,
  endYear,
  fetchedYears,
  count: data.length,
  data,
};

await writeFile(outFile, JSON.stringify(database), "utf8");
console.log(`Saved ${data.length} unique records to ${outFile}`);
