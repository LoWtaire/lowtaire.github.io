const API_BASE = "https://fortnite-api.com";
const API_KEY = "27afe995-d88b-4bca-8d92-a51019b46f6d";
const ACCOUNT_A = "Loriqueee";
const ACCOUNT_B = "Dashdanlvidix";
const VBUCKS_TO_EUR = 8.99 / 1000;

const seasonsMap = [
  { id: "S1", chapter: 1, season: 1 },
  { id: "S2", chapter: 1, season: 2 },
  { id: "C2S2", chapter: 2, season: 2 },
  { id: "C5S1", chapter: 5, season: 1 }
];

const presetSets = ["Frozen Legends", "Minty Legends", "Darkfire", "Lava Legends"];

const rarityValues = {
  legendary: 2000,
  epic: 1500,
  rare: 1200,
  uncommon: 800
};

const rarityUi = {
  Legendary: { label: "Legendaire", color: "#fb7d11" },
  Epic: { label: "Epique", color: "#b15be2" },
  Rare: { label: "Rare", color: "#2e8bff" },
  Uncommon: { label: "Atypique", color: "#2ee66b" },
  Common: { label: "Commun", color: "#64748b" }
};

const state = {
  view: "merged",
  statsByAccount: {
    A: null,
    B: null
  },
  cosmetics: [],
  cosmeticsById: new Map(),
  cosmeticsLoaded: false,
  lockerA: [],
  lockerB: [],
  selectedSeasonIds: new Set(["S2"]),
  selectedSetNames: new Set(),
  pendingOps: 0,
  errors: []
};

const els = {
  apiStatus: document.querySelector("#apiStatus"),
  seasonChips: document.querySelector("#seasonChips"),
  setChips: document.querySelector("#setChips"),
  clearSeasonsBtn: document.querySelector("#clearSeasonsBtn"),
  clearSetsBtn: document.querySelector("#clearSetsBtn"),
  manualSkinSelect: document.querySelector("#manualSkinSelect"),
  manualAccountSelect: document.querySelector("#manualAccountSelect"),
  addManualSkinBtn: document.querySelector("#addManualSkinBtn"),
  clearManualBtn: document.querySelector("#clearManualBtn"),
  setNameInput: document.querySelector("#setNameInput"),
  setAccountSelect: document.querySelector("#setAccountSelect"),
  addSetBtn: document.querySelector("#addSetBtn"),
  winsVal: document.querySelector(".wins-val"),
  killsVal: document.querySelector(".kills-val"),
  matchsVal: document.querySelector(".matchs-val"),
  kdVal: document.querySelector(".kd-val"),
  statMeters: new Map([...document.querySelectorAll("[data-meter]")].map((el) => [el.dataset.meter, el])),
  winRateFill: document.querySelector("#winRateFill"),
  winRateLabel: document.querySelector("#winRateLabel"),
  kdRing: document.querySelector("#kdRing"),
  kdRingLabel: document.querySelector("#kdRingLabel"),
  killsRing: document.querySelector("#killsRing"),
  avgKillsLabel: document.querySelector("#avgKillsLabel"),
  countA: document.querySelector("#countA"),
  countB: document.querySelector("#countB"),
  countUnique: document.querySelector("#countUnique"),
  duplicateCount: document.querySelector("#duplicateCount"),
  lockerGrid: document.querySelector("#lockerGrid"),
  valueVbucks: document.querySelector("#valueVbucks"),
  valueEuro: document.querySelector("#valueEuro"),
  rarityBreakdown: document.querySelector("#rarityBreakdown"),
  lockerItemTemplate: document.querySelector("#lockerItemTemplate")
};

const imageObserver = createImageObserver();

init();

async function init() {
  bindUi();
  buildSeasonChips();
  buildSetChips();
  render();

  await Promise.allSettled([loadStats(), loadCosmetics()]);

  // Preselection example: season S2 to both accounts.
  for (const seasonId of state.selectedSeasonIds) {
    const s = seasonsMap.find((x) => x.id === seasonId);
    if (s) selectBySeason(s.chapter, s.season, "both");
  }

  render();
}

function bindUi() {
  document.querySelectorAll(".toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.view = btn.dataset.view;
      document.querySelectorAll(".toggle-btn").forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", String(active));
      });
      renderStats();
    });
  });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
      document.getElementById(btn.dataset.sectionTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  els.clearSeasonsBtn.addEventListener("click", () => {
    state.selectedSeasonIds.clear();
    state.lockerA = [];
    state.lockerB = [];
    render();
    syncChipStates();
  });

  els.clearSetsBtn.addEventListener("click", () => {
    state.selectedSetNames.clear();
    state.lockerA = [];
    state.lockerB = [];
    render();
    syncChipStates();
  });

  els.clearManualBtn.addEventListener("click", () => {
    state.lockerA = [];
    state.lockerB = [];
    render();
  });

  els.addManualSkinBtn.addEventListener("click", () => {
    const cosmeticId = els.manualSkinSelect.value;
    const account = els.manualAccountSelect.value;
    if (!cosmeticId) return;
    addCosmeticsToLocker([cosmeticId], account);
    render();
  });

  els.addSetBtn.addEventListener("click", () => {
    const setName = els.setNameInput.value.trim();
    if (!setName) return;
    state.selectedSetNames.add(setName);
    selectBySet(setName, els.setAccountSelect.value);
    els.setNameInput.value = "";
    syncChipStates();
    render();
  });
}

function buildSeasonChips() {
  els.seasonChips.innerHTML = "";
  for (const season of seasonsMap) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = season.id;
    chip.dataset.seasonId = season.id;
    chip.addEventListener("click", () => {
      const enabled = !state.selectedSeasonIds.has(season.id);
      if (enabled) {
        state.selectedSeasonIds.add(season.id);
        selectBySeason(season.chapter, season.season, "both");
      } else {
        state.selectedSeasonIds.delete(season.id);
        removeSeasonSelection(season.chapter, season.season);
      }
      syncChipStates();
      render();
    });
    els.seasonChips.append(chip);
  }
  syncChipStates();
}

function buildSetChips() {
  els.setChips.innerHTML = "";
  for (const setName of presetSets) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = setName;
    chip.dataset.setName = setName;
    chip.addEventListener("click", () => {
      const enabled = !state.selectedSetNames.has(setName);
      if (enabled) {
        state.selectedSetNames.add(setName);
        selectBySet(setName, "both");
      } else {
        state.selectedSetNames.delete(setName);
        removeSetSelection(setName);
      }
      syncChipStates();
      render();
    });
    els.setChips.append(chip);
  }
  syncChipStates();
}

function syncChipStates() {
  document.querySelectorAll("#seasonChips .chip").forEach((chip) => {
    chip.classList.toggle("is-selected", state.selectedSeasonIds.has(chip.dataset.seasonId));
  });
  document.querySelectorAll("#setChips .chip").forEach((chip) => {
    chip.classList.toggle("is-selected", state.selectedSetNames.has(chip.dataset.setName));
  });
}

async function loadStats() {
  withPending(async () => {
    const [a, b] = await Promise.all([
      fetchPlayerStats(ACCOUNT_A),
      fetchPlayerStats(ACCOUNT_B)
    ]);
    state.statsByAccount.A = a;
    state.statsByAccount.B = b;
  }, "stats");
}

async function loadCosmetics() {
  await withPending(async () => {
    const url = new URL("/v2/cosmetics/br", API_BASE);
    const res = await fetch(url, {
      headers: { Authorization: API_KEY }
    });
    if (!res.ok) throw new Error(`Cosmetics API ${res.status}`);
    const json = await res.json();
    const raw = Array.isArray(json?.data) ? json.data : [];
    state.cosmetics = raw.filter((c) => (c?.type?.value || "").toLowerCase() === "outfit" && c?.id);
    state.cosmeticsById = new Map(state.cosmetics.map((c) => [c.id, c]));
    state.cosmeticsLoaded = true;
    buildManualSkinOptions();
  }, "cosmetics");
}

async function fetchPlayerStats(username) {
  const url = new URL("/v2/stats/br/v2", API_BASE);
  url.searchParams.set("name", username);
  url.searchParams.set("accountType", "epic");

  const res = await fetch(url, { headers: { Authorization: API_KEY } });
  if (!res.ok) throw new Error(`Stats API ${res.status} (${username})`);
  const json = await res.json();

  const overall =
    json?.data?.stats?.all?.overall ||
    json?.data?.stats?.overall ||
    json?.data?.overall ||
    {};

  return {
    nickname: username,
    wins: Number(overall.wins || 0),
    kills: Number(overall.kills || 0),
    matches: Number(overall.matches || 0),
    kd: Number(overall.kd || 0)
  };
}

function unifiedStatsFrom(a, b) {
  if (!a || !b) return { wins: 0, kills: 0, matches: 0, kd: 0 };
  const totalWins = a.wins + b.wins;
  const totalKills = a.kills + b.kills;
  const totalMatches = a.matches + b.matches;
  const denom = (safeDiv(a.kills, a.kd) + safeDiv(b.kills, b.kd));
  const unifiedKd = denom > 0 ? totalKills / denom : 0;
  return {
    wins: totalWins,
    kills: totalKills,
    matches: totalMatches,
    kd: unifiedKd
  };
}

function getCurrentStats() {
  if (state.view === "A") return state.statsByAccount.A || { wins: 0, kills: 0, matches: 0, kd: 0 };
  if (state.view === "B") return state.statsByAccount.B || { wins: 0, kills: 0, matches: 0, kd: 0 };
  return unifiedStatsFrom(state.statsByAccount.A, state.statsByAccount.B);
}

function safeDiv(num, den) {
  const n = Number(num);
  const d = Number(den);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return 0;
  return n / d;
}

function buildManualSkinOptions() {
  const items = [...state.cosmetics].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  els.manualSkinSelect.innerHTML = "";
  for (const cosmetic of items) {
    const opt = document.createElement("option");
    opt.value = cosmetic.id;
    opt.textContent = `${cosmetic.name} (${cosmetic.rarity?.value || "Unknown"})`;
    els.manualSkinSelect.append(opt);
  }
}

function selectBySeason(chapter, season, account = "both") {
  const matched = state.cosmetics.filter((c) => Number(c?.introduction?.chapter) === Number(chapter) && Number(c?.introduction?.season) === Number(season));
  addCosmeticsToLocker(matched.map((c) => c.id), account);
  return matched;
}

function selectBySet(setName, account = "both") {
  const target = setName.trim().toLowerCase();
  const matched = state.cosmetics.filter((c) => (c?.set?.value || "").trim().toLowerCase() === target);
  addCosmeticsToLocker(matched.map((c) => c.id), account);
  return matched;
}

function removeSeasonSelection(chapter, season) {
  const ids = new Set(state.cosmetics
    .filter((c) => Number(c?.introduction?.chapter) === Number(chapter) && Number(c?.introduction?.season) === Number(season))
    .map((c) => c.id));
  state.lockerA = state.lockerA.filter((id) => !ids.has(id));
  state.lockerB = state.lockerB.filter((id) => !ids.has(id));
}

function removeSetSelection(setName) {
  const target = setName.trim().toLowerCase();
  const ids = new Set(state.cosmetics.filter((c) => (c?.set?.value || "").trim().toLowerCase() === target).map((c) => c.id));
  state.lockerA = state.lockerA.filter((id) => !ids.has(id));
  state.lockerB = state.lockerB.filter((id) => !ids.has(id));
}

function addCosmeticsToLocker(ids, account = "both") {
  if (!Array.isArray(ids) || ids.length === 0) return;
  if (account === "A" || account === "both") state.lockerA = uniqueArray([...state.lockerA, ...ids]);
  if (account === "B" || account === "both") state.lockerB = uniqueArray([...state.lockerB, ...ids]);
}

function uniqueArray(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function getFusionSet() {
  return new Set([...state.lockerA, ...state.lockerB]);
}

function getLockerMetrics() {
  const fusionSet = getFusionSet();
  const uniqueCount = fusionSet.size;
  const duplicateCount = (state.lockerA.length + state.lockerB.length) - fusionSet.size;
  return { fusionSet, uniqueCount, duplicateCount };
}

function getLockerItems() {
  const { fusionSet } = getLockerMetrics();
  return [...fusionSet].map((id) => state.cosmeticsById.get(id)).filter(Boolean);
}

function render() {
  renderStatus();
  renderStats();
  renderLocker();
  renderValue();
}

function renderStatus() {
  if (state.pendingOps > 0) {
    els.apiStatus.textContent = "Chargement API en cours...";
    return;
  }
  if (state.errors.length > 0) {
    els.apiStatus.textContent = `Erreur API: ${state.errors[state.errors.length - 1]}`;
    return;
  }
  els.apiStatus.textContent = `API OK - ${state.cosmetics.length.toLocaleString("fr-FR")} cosmetiques charges`;
}

function renderStats() {
  const stats = getCurrentStats();
  const wins = Number(stats.wins || 0);
  const kills = Number(stats.kills || 0);
  const matchs = Number(stats.matches || 0);
  const kd = Number(stats.kd || 0);

  els.winsVal.textContent = wins.toLocaleString("fr-FR");
  els.killsVal.textContent = kills.toLocaleString("fr-FR");
  els.matchsVal.textContent = matchs.toLocaleString("fr-FR");
  els.kdVal.textContent = kd.toFixed(2);

  const winRate = matchs > 0 ? (wins / matchs) * 100 : 0;
  const killsPerMatch = matchs > 0 ? kills / matchs : 0;

  setMeter("wins", Math.min(100, winRate * 2.5));
  setMeter("kills", Math.min(100, (kills / 10000) * 100));
  setMeter("matchs", Math.min(100, (matchs / 5000) * 100));
  setMeter("kd", Math.min(100, (kd / 6) * 100));

  els.winRateFill.style.width = `${Math.min(100, winRate)}%`;
  els.winRateLabel.textContent = `${winRate.toFixed(1)}% win rate`;
  els.kdRing.style.setProperty("--ring-percent", `${Math.min(100, (kd / 6) * 100)}`);
  els.kdRingLabel.textContent = kd.toFixed(2);
  els.killsRing.style.setProperty("--ring-percent", `${Math.min(100, (killsPerMatch / 8) * 100)}`);
  els.avgKillsLabel.textContent = killsPerMatch.toFixed(2);
}

function setMeter(key, percent) {
  const el = els.statMeters.get(key);
  if (el) el.style.width = `${Math.max(0, percent)}%`;
}

function renderLocker() {
  const { fusionSet, uniqueCount, duplicateCount } = getLockerMetrics();
  const items = getLockerItems().sort(sortCosmeticsForGrid);

  els.countA.textContent = `${state.lockerA.length} skins`;
  els.countB.textContent = `${state.lockerB.length} skins`;
  els.countUnique.textContent = `${uniqueCount} skins`;
  els.duplicateCount.textContent = String(duplicateCount);

  els.lockerGrid.innerHTML = "";

  for (const cosmetic of items) {
    const cardFrag = els.lockerItemTemplate.content.cloneNode(true);
    const card = cardFrag.querySelector(".locker-item");
    const img = cardFrag.querySelector("img");
    const nameEl = cardFrag.querySelector(".locker-name");
    const ownerEl = cardFrag.querySelector(".ownership");
    const metaEl = cardFrag.querySelector(".locker-meta");
    const tagsEl = cardFrag.querySelector(".locker-tags");

    const id = cosmetic.id;
    const inA = state.lockerA.includes(id);
    const inB = state.lockerB.includes(id);
    const ownerLabel = inA && inB ? "A+B" : inA ? "A" : "B";
    const rarity = cosmetic?.rarity?.value || "Common";
    const vb = rarityToVbucks(rarity);

    card.dataset.rarity = rarity;
    card.classList.toggle("is-selected", fusionSet.has(id));
    card.dataset.id = id;

    nameEl.textContent = cosmetic.name || id;
    ownerEl.textContent = ownerLabel;
    metaEl.textContent = `${rarity} • ${vb} V-Bucks`;

    const seasonTag = cosmetic?.introduction ? `C${cosmetic.introduction.chapter}S${cosmetic.introduction.season}` : "Legacy";
    const setTag = cosmetic?.set?.value || "Sans set";
    for (const tagText of [seasonTag, setTag]) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = tagText;
      tagsEl.append(tag);
    }

    const icon = cosmetic?.images?.icon || cosmetic?.images?.smallIcon || "";
    img.alt = cosmetic.name || "Cosmetic";
    if (icon) {
      img.dataset.src = icon;
      imageObserver?.observe(img);
    }

    card.addEventListener("click", () => cycleOwnership(id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        cycleOwnership(id);
      }
    });

    els.lockerGrid.append(cardFrag);
  }
}

function cycleOwnership(id) {
  const inA = state.lockerA.includes(id);
  const inB = state.lockerB.includes(id);

  if (!inA && !inB) {
    state.lockerA = uniqueArray([...state.lockerA, id]);
  } else if (inA && !inB) {
    state.lockerB = uniqueArray([...state.lockerB, id]);
  } else if (inA && inB) {
    state.lockerA = state.lockerA.filter((x) => x !== id);
  } else {
    state.lockerB = state.lockerB.filter((x) => x !== id);
  }
  render();
}

function sortCosmeticsForGrid(a, b) {
  return (rarityToVbucks(b?.rarity?.value) - rarityToVbucks(a?.rarity?.value)) ||
    (a?.name || "").localeCompare(b?.name || "", "fr");
}

function renderValue() {
  const items = getLockerItems();
  const byRarity = new Map();
  let totalVbucks = 0;

  for (const cosmetic of items) {
    const rarity = cosmetic?.rarity?.value || "Common";
    const vb = rarityToVbucks(rarity);
    totalVbucks += vb;
    const current = byRarity.get(rarity) || { count: 0, vbucks: 0 };
    current.count += 1;
    current.vbucks += vb;
    byRarity.set(rarity, current);
  }

  const totalEur = (totalVbucks / 1000) * 8.99;
  els.valueVbucks.textContent = `${totalVbucks.toLocaleString("fr-FR")} V-Bucks`;
  els.valueEuro.textContent = `${totalEur.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;

  els.rarityBreakdown.innerHTML = "";
  for (const rarity of ["Legendary", "Epic", "Rare", "Uncommon", "Common"]) {
    const row = byRarity.get(rarity);
    if (!row) continue;
    const card = document.createElement("article");
    card.className = "break-card";
    card.style.borderColor = `${(rarityUi[rarity]?.color || "#64748b")}66`;
    card.style.boxShadow = `inset 0 0 0 1px ${(rarityUi[rarity]?.color || "#64748b")}22`;
    card.innerHTML = `
      <h4>${rarityUi[rarity]?.label || rarity}</h4>
      <p>${row.count} skin(s)</p>
      <strong>${row.vbucks.toLocaleString("fr-FR")} V-Bucks</strong>
      <p>${((row.vbucks / 1000) * 8.99).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR</p>
    `;
    els.rarityBreakdown.append(card);
  }
}

function rarityToVbucks(rarityValue) {
  const key = String(rarityValue || "").toLowerCase();
  return rarityValues[key] || 0;
}

function createImageObserver() {
  if (!("IntersectionObserver" in window)) return null;
  return new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const img = entry.target;
      const src = img.dataset.src;
      if (src && img.src !== src) img.src = src;
      observer.unobserve(img);
    }
  }, { rootMargin: "120px 0px" });
}

async function withPending(task, label) {
  state.pendingOps += 1;
  renderStatus();
  try {
    await task();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.errors.push(`${label}: ${message}`);
    console.error(`[${label}]`, error);
  } finally {
    state.pendingOps -= 1;
    renderStatus();
  }
}

init();
window.selectBySeason = selectBySeason;
window.selectBySet = selectBySet;
