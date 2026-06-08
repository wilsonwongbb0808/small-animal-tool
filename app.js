const DATABASE_URL = "data/history.json";
const NUMBERS = Array.from({ length: 49 }, (_, index) => index + 1);
const WAVE_LABELS = { red: "红波", green: "绿波", blue: "蓝波" };
const SPECIAL_MODEL = {
  limit: 120,
  recentLimit: 45,
  weights: { frequency: 0, recent: 100, miss: 80 },
};
const ZODIAC_MODEL = {
  limit: 240,
  recentLimit: 60,
  weights: { frequency: 120, recent: 15, miss: 30, carry: 0 },
};

const state = {
  draws: [],
  analysis: null,
  prediction: null,
};

const isStaticHosting = !["localhost", "127.0.0.1"].includes(window.location.hostname);

const els = {
  simulationInput: document.querySelector("#simulationInput"),
  loadBtn: document.querySelector("#loadBtn"),
  updateBtn: document.querySelector("#updateBtn"),
  predictBtn: document.querySelector("#predictBtn"),
  connectionStatus: document.querySelector("#connectionStatus"),
  statusText: document.querySelector("#statusText"),
  drawCount: document.querySelector("#drawCount"),
  latestExpect: document.querySelector("#latestExpect"),
  latestSpecial: document.querySelector("#latestSpecial"),
  simulationCount: document.querySelector("#simulationCount"),
  lastUpdatedAt: document.querySelector("#lastUpdatedAt"),
  predictionTime: document.querySelector("#predictionTime"),
  reviewTime: document.querySelector("#reviewTime"),
  simulationResult: document.querySelector("#simulationResult"),
  reviewPanel: document.querySelector("#reviewPanel"),
  specialRecommendations: document.querySelector("#specialRecommendations"),
  zodiacRecommendations: document.querySelector("#zodiacRecommendations"),
  recentRows: document.querySelector("#recentRows"),
};

let activeNumberPopover = null;

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

async function updateLatestDraw() {
  if (isStaticHosting) {
    alert("当前是 GitHub Pages 静态测试版，不能在线更新开奖数据。需要更新时，请在本地更新 data/history.json 后重新上传。");
    return;
  }

  els.updateBtn.disabled = true;
  setStatus("", "更新开奖中");
  try {
    const response = await fetch("/api/update-latest", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.message || "更新开奖失败");
    }
    await loadAndAnalyze(false);
    await loadReview();
    const changed = result.added.length ? `新增 ${result.added.join("、")}` : `已更新 ${result.updated.join("、")}`;
    setStatus("ok", changed);
  } catch (error) {
    console.error(error);
    setStatus("error", "更新失败");
    alert(error.message || "更新失败，请确认本地服务已启动。");
  } finally {
    els.updateBtn.disabled = false;
  }
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

function numberMiss(draws, selector) {
  const miss = makeCounter(NUMBERS);
  NUMBERS.forEach((number) => {
    const index = draws.findIndex((draw) => selector(draw).includes(number));
    miss[number] = index === -1 ? draws.length : index;
  });
  return miss;
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
  const specialMiss = numberMiss(specialSample, (draw) => [draw.special]);
  const normalMiss = numberMiss(normalSample, (draw) => draw.normal);
  const meta = buildNumberMeta(draws);

  specialSample.forEach((draw) => {
    addCount(specialCounts, draw.special);
  });

  specialRecent.forEach((draw) => {
    addCount(recentSpecialCounts, draw.special);
  });

  normalSample.forEach((draw) => {
    draw.normal.forEach((number) => addCount(normalCounts, number));
  });

  normalRecent.forEach((draw) => {
    draw.normal.forEach((number) => addCount(recentNormalCounts, number));
  });

  const maxCount = Math.max(...Object.values(specialCounts), 1);
  const maxRecent = Math.max(...Object.values(recentSpecialCounts), 1);
  const maxMiss = Math.max(...Object.values(specialMiss), 1);
  const maxNormalCount = Math.max(...Object.values(normalCounts), 1);
  const maxRecentNormal = Math.max(...Object.values(recentNormalCounts), 1);
  const maxNormalMiss = Math.max(...Object.values(normalMiss), 1);
  const zodiacToNumbers = {};

  NUMBERS.forEach((number) => {
    const zodiac = meta[number]?.zodiac || "";
    if (!zodiacToNumbers[zodiac]) zodiacToNumbers[zodiac] = [];
    zodiacToNumbers[zodiac].push(number);
  });

  const weightedNumbers = NUMBERS.map((number) => {
    const frequency = normalize(specialCounts[number], maxCount);
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
    const frequency = normalize(normalCounts[number], maxNormalCount);
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

  return {
    simulations,
    specialPicks: specialPicks.slice(0, 10),
    zodiacPicks: normalRecommendations,
    topZodiac: normalRecommendations[0],
    generatedAt: new Date(),
  };
}

function percent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function renderPrediction() {
  const prediction = state.prediction;
  if (!prediction) {
    els.simulationResult.innerHTML = '<article class="pick-card"><strong>点击“开始预测”</strong><small>运行蒙特卡洛模拟后会显示结果。</small></article>';
    return;
  }

  const topSpecial = prediction.specialPicks[0];
  const zodiacNames = prediction.zodiacPicks.map((item) => item.zodiac).join("、");
  els.simulationCount.textContent = prediction.simulations.toLocaleString("zh-CN");
  els.predictionTime.textContent = prediction.generatedAt.toLocaleString("zh-CN", { hour12: false });
  els.simulationResult.innerHTML = `
    <article class="pick-card special-pick">
      <span>最高特码</span>
      <strong><span class="ball ${waveClass(topSpecial.wave)}">${formatNumber(topSpecial.number)}</span></strong>
      <small>${topSpecial.zodiac} / ${WAVE_LABELS[topSpecial.wave]} / 概率 ${percent(topSpecial.probability)}</small>
    </article>
    <article class="pick-card">
      <span>最高生肖</span>
      <strong>${prediction.topZodiac.zodiac}</strong>
      <small>模拟概率 ${percent(prediction.topZodiac.probability)}</small>
    </article>
    <article class="pick-card">
      <span>五个生肖</span>
      <strong>${zodiacNames}</strong>
      <small>下方每个生肖已配一个平码</small>
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

  els.zodiacRecommendations.innerHTML = prediction.zodiacPicks
    .map(
      (item, index) => `
        <article class="zodiac-card">
          <div>
            <span>${index === 0 ? "最高概率" : `推荐 ${index + 1}`}</span>
            <strong>${item.zodiac}</strong>
            <small>模拟 ${item.hits.toLocaleString("zh-CN")} 次 / 概率 ${percent(item.probability)}</small>
          </div>
          <div class="zodiac-card-number">
            <span class="ball ${waveClass(item.normalNumber?.wave)}">${formatNumber(item.normalNumber?.number || 0)}</span>
            <small>平码 / ${item.normalNumber ? percent(item.normalNumber.probability) : "-"}</small>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderReview(review) {
  if (!review) {
    els.reviewTime.textContent = "暂无复盘";
    els.reviewPanel.innerHTML = '<article class="review-card"><strong>暂无复盘记录</strong><small>点击“立即更新开奖”或等每天自动更新后生成。</small></article>';
    return;
  }

  els.reviewTime.textContent = `${review.expect} / ${review.generatedAt}`;
  const specialClass = review.result.specialHit ? "hit" : "miss";
  const zodiacClass = review.result.zodiacMatchedCount >= 3 ? "hit" : "miss";
  const normalClass = review.result.normalNumberMatchedCount > 0 ? "hit" : "miss";
  const actualBalls = review.actual.openCode
    .map((number, index) => {
      const separator = index === 6 ? '<span class="special-separator">+</span>' : "";
      return `${separator}<span class="mini-ball ${waveClass(review.actual.waves?.[index])}">${number}</span>`;
    })
    .join("");
  const specialPicks = review.predicted.specialTop10
    .map((pick) => `<span class="mini-ball ${pick.code === review.actual.special ? "review-hit" : ""}">${pick.code}</span>`)
    .join("");
  const zodiacPicks = review.predicted.zodiacFive
    .map((pick) => {
      const zodiacHit = review.actual.normalZodiacs.includes(pick.zodiac);
      const numberHit = review.actual.normalNumbers.includes(pick.normalNumber);
      return `
        <span class="review-pair ${zodiacHit || numberHit ? "review-hit" : ""}">
          ${pick.zodiac} ${pick.normalNumber}
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
    <article class="review-card ${zodiacClass}">
      <span>生肖复盘</span>
      <strong>${review.result.zodiacMatchedCount} / 5</strong>
      <small>命中：${review.result.zodiacMatches.join("、") || "无"}</small>
    </article>
    <article class="review-card ${normalClass}">
      <span>平码复盘</span>
      <strong>${review.result.normalNumberMatchedCount} 个</strong>
      <small>命中：${review.result.normalNumberMatches.join("、") || "无"}</small>
    </article>
    <article class="review-card wide">
      <span>实际开奖号</span>
      <div class="draw-balls">${actualBalls}</div>
    </article>
    <article class="review-card wide">
      <span>推荐特码</span>
      <div class="draw-balls">${specialPicks}</div>
    </article>
    <article class="review-card wide">
      <span>推荐生肖平码</span>
      <div class="review-pairs">${zodiacPicks}</div>
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
  els.latestSpecial.textContent = formatNumber(latest.special);
  els.lastUpdatedAt.textContent = state.databaseMeta?.lastUpdatedAt || state.databaseMeta?.generatedAt || "-";
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
  els.loadBtn.disabled = true;
  els.predictBtn.disabled = true;
  setStatus("", "加载中");
  try {
    const draws = await fetchDraws();
    state.draws = uniqueAndSort(draws);
    state.analysis = analyze(state.draws);
    renderBase();
    await loadReview();
    setStatus("ok", "已读取本地库");
    els.predictBtn.disabled = false;
    if (runDefaultPrediction) predict();
  } catch (error) {
    console.error(error);
    setStatus("error", "读取失败");
    alert(error.message || "读取失败，请确认 data/history.json 已生成。");
  } finally {
    els.loadBtn.disabled = false;
  }
}

els.loadBtn.addEventListener("click", loadAndAnalyze);
els.updateBtn.addEventListener("click", updateLatestDraw);
els.predictBtn.addEventListener("click", predict);
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

if (isStaticHosting) {
  els.updateBtn.textContent = "静态版不可更新";
  els.updateBtn.title = "GitHub Pages 只能托管静态文件，更新开奖需要本地脚本重新生成数据后再上传。";
}

loadAndAnalyze();
