import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLatestReview } from "./review-latest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataFile = path.join(root, "data", "history.json");
const latestUrl = "https://macaumarksix.com/api/macaujc2.com";

export async function updateLatestHistory() {
  const [databaseText, response] = await Promise.all([
    readFile(dataFile, "utf8"),
    fetch(latestUrl, {
      headers: { "user-agent": "Mozilla/5.0" },
    }),
  ]);

  if (!response.ok) {
    throw new Error(`最新开奖接口请求失败：${response.status}`);
  }

  const payload = await response.json();
  const latestRecords = Array.isArray(payload) ? payload : Array.isArray(payload.value) ? payload.value : [];
  if (!latestRecords.length) {
    throw new Error("最新开奖接口没有返回开奖记录。");
  }

  const database = JSON.parse(databaseText);
  const records = new Map(database.data.map((item) => [item.expect, item]));
  const added = [];
  const updated = [];

  for (const record of latestRecords) {
    if (!record.expect || !record.openCode) continue;
    if (records.has(record.expect)) {
      records.set(record.expect, { ...records.get(record.expect), ...record });
      updated.push(record.expect);
    } else {
      records.set(record.expect, record);
      added.push(record.expect);
    }
  }

  const data = Array.from(records.values()).sort((a, b) => b.openTime.localeCompare(a.openTime));
  const nextDatabase = {
    ...database,
    latestSource: latestUrl,
    lastUpdatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    count: data.length,
    data,
  };

  await writeFile(dataFile, `${JSON.stringify(nextDatabase, null, 2)}\n`, "utf8");
  const review = await createLatestReview();

  return {
    added,
    updated,
    count: data.length,
    latest: data[0],
    lastUpdatedAt: nextDatabase.lastUpdatedAt,
    review: review.result,
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
