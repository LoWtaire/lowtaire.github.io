const VBUCKS_TO_EUR = 8.99 / 1000;

const rarityConfig = {
  Common: { label: "Commun", color: "#64748b" },
  Uncommon: { label: "Atypique", color: "#2ee66b" },
  Rare: { label: "Rare", color: "#2e8bff" },
  Epic: { label: "Epique", color: "#9b4dff" },
  Legendary: { label: "Legendaire", color: "#ff8e26" }
};

const skinCatalog = [
  { id: "renegade_raider", name: "Renegade Raider", rarity: "Legendary", baseVbucks: 1200, source: "Season 1", season: "S1", exclusivity: 1.6 },
  { id: "black_knight", name: "Black Knight", rarity: "Legendary", baseVbucks: 2000, source: "Battle Pass", season: "S2", exclusivity: 1.45 },
  { id: "sparkle_specialist", name: "Sparkle Specialist", rarity: "Epic", baseVbucks: 1500, source: "Battle Pass", season: "S2", exclusivity: 1.25 },
  { id: "omega", name: "Omega", rarity: "Legendary", baseVbucks: 2000, source: "Battle Pass", season: "S4", exclusivity: 1.2 },
  { id: "drift", name: "Drift", rarity: "Legendary", baseVbucks: 2000, source: "Battle Pass", season: "S5", exclusivity: 1.15 },
  { id: "lynx", name: "Lynx", rarity: "Legendary", baseVbucks: 2000, source: "Battle Pass", season: "S7", exclusivity: 1.15 },
  { id: "peely", name: "Peely", rarity: "Epic", baseVbucks: 1500, source: "Battle Pass", season: "S8", exclusivity: 1.1 },
  { id: "midas", name: "Midas", rarity: "Legendary", baseVbucks: 2000, source: "Battle Pass", season: "C2S2", exclusivity: 1.15 },
  { id: "jules", name: "Jules", rarity: "Epic", baseVbucks: 1500, source: "Battle Pass", season: "C2S3", exclusivity: 1.05 },
  { id: "spider_gwen", name: "Spider-Gwen", rarity: "Epic", baseVbucks: 1500, source: "Battle Pass", season: "C3S4", exclusivity: 1.05 },
  { id: "the_ageless", name: "The Ageless", rarity: "Legendary", baseVbucks: 2000, source: "Battle Pass", season: "C4S1", exclusivity: 1.05 },
  { id: "hope", name: "Hope", rarity: "Epic", baseVbucks: 1500, source: "Battle Pass", season: "C5S1", exclusivity: 1.0 },
  { id: "aura", name: "Aura", rarity: "Uncommon", baseVbucks: 800, source: "Item Shop", season: "Shop", exclusivity: 1.0 },
  { id: "crystal", name: "Crystal", rarity: "Uncommon", baseVbucks: 800, source: "Item Shop", season: "Shop", exclusivity: 1.0 },
  { id: "raven", name: "Raven", rarity: "Legendary", baseVbucks: 2000, source: "Item Shop", season: "Shop", exclusivity: 1.0 },
  { id: "fishstick", name: "Fishstick", rarity: "Rare", baseVbucks: 1200, source: "Item Shop", season: "Shop", exclusivity: 1.0 },
  { id: "john_wick", name: "John Wick", rarity: "Legendary", baseVbucks: 2000, source: "Item Shop", season: "Shop", exclusivity: 1.05 },
  { id: "cuddle_team_leader", name: "Cuddle Team Leader", rarity: "Legendary", baseVbucks: 2000, source: "Item Shop", season: "Shop", exclusivity: 1.0 },
  { id: "frozen_raven", name: "Frozen Raven", rarity: "Legendary", baseVbucks: 1000, source: "Frozen Legends Pack", season: "Pack", pack: "Frozen Legends", exclusivity: 1.1 },
  { id: "frozen_love_ranger", name: "Frozen Love Ranger", rarity: "Legendary", baseVbucks: 1000, source: "Frozen Legends Pack", season: "Pack", pack: "Frozen Legends", exclusivity: 1.1 },
  { id: "polar_patroller", name: "Polar Patroller", rarity: "Epic", baseVbucks: 800, source: "Polar Legends Pack", season: "Pack", pack: "Polar Legends", exclusivity: 1.05 },
  { id: "dark_wild_card", name: "Dark Wild Card", rarity: "Epic", baseVbucks: 800, source: "Darkfire Bundle", season: "Pack", pack: "Darkfire", exclusivity: 1.05 },
  { id: "minty_bomber", name: "Minty Bomber", rarity: "Rare", baseVbucks: 1200, source: "Minty Legends Pack", season: "Pack", pack: "Minty Legends", exclusivity: 1.05 },
  { id: "golden_peely", name: "Agent Peely (Gold)", rarity: "Legendary", baseVbucks: 2200, source: "Progression", season: "C2S2", exclusivity: 1.25 }
];

const seasonBundles = {
  S1: ["renegade_raider"],
  S2: ["black_knight", "sparkle_specialist"],
  S4: ["omega"],
  S5: ["drift"],
  S7: ["lynx"],
  S8: ["peely"],
  C2S2: ["midas", "golden_peely"],
  C2S3: ["jules"],
  C3S4: ["spider_gwen"],
  C4S1: ["the_ageless"],
  C5S1: ["hope"]
};

const packBundles = {
  "Frozen Legends": ["frozen_raven", "frozen_love_ranger"],
  "Polar Legends": ["polar_patroller"],
  Darkfire: ["dark_wild_card"],
  "Minty Legends": ["minty_bomber"]
};

const demoStats = {
  A: { nickname: "Compte A", wins: 143, kills: 5194, matches: 2441, kd: 2.58 },
  B: { nickname: "Compte B", wins: 96, kills: 3277, matches: 1864, kd: 2.03 }
};

const state = {
  view: "merged",
  stats: { ...demoStats },
  selections: {
    seasons: new Set(["S2", "C2S2"]),
    packs: new Set(["Frozen Legends"]),
    manualA: new Set(["aura", "raven", "fishstick"]),
    manualB: new Set(["aura", "crystal", "john_wick", "frozen_raven"])
  }
};

const byId = Object.fromEntries(skinCatalog.map((skin) => [skin.id, skin]));

const els = {
  statsGrid: document.querySelector("#statsGrid"),
  winRateFill: document.querySelector("#winRateFill"),
  winRateLabel: document.querySelector("#winRateLabel"),
  kdRing: document.querySelector("#kdRing"),
  kdRingLabel: document.querySelector("#kdRingLabel"),
  killsRing: document.querySelector("#killsRing"),
  avgKillsLabel: document.querySelector("#avgKillsLabel"),
  seasonChips: document.querySelector("#seasonChips"),
  packChips: document.querySelector("#packChips"),
  manualSkinSelect: document.querySelector("#manualSkinSelect"),
  manualAccountSelect: document.querySelector("#manualAccountSelect"),
  addManualSkinBtn: document.querySelector("#addManualSkinBtn"),
  clearSeasonsBtn: document.querySelector("#clearSeasonsBtn"),
  clearPacksBtn: document.querySelector("#clearPacksBtn"),
  clearManualBtn: document.querySelector("#clearManualBtn"),
  countA: document.querySelector("#countA"),
  countB: document.querySelector("#countB"),
  countUnique: document.querySelector("#countUnique"),
  duplicateCount: document.querySelector("#duplicateCount"),
  lockerGrid: document.querySelector("#lockerGrid"),
  valueVbucks: document.querySelector("#valueVbucks"),
  valueEuro: document.querySelector("#valueEuro"),
  rarityBreakdown: document.querySelector("#rarityBreakdown"),
  statCardTemplate: document.querySelector("#statCardTemplate"),
  lockerItemTemplate: document.querySelector("#lockerItemTemplate")
};

async function init() {
  bindUi();
  buildChips();
  buildManualOptions();
  await loadStats();
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
      const target = btn.dataset.sectionTarget;
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  els.addManualSkinBtn.addEventListener("click", addManualSkin);
  els.clearSeasonsBtn.addEventListener("click", () => {
    state.selections.seasons.clear();
    render();
  });
  els.clearPacksBtn.addEventListener("click", () => {
    state.selections.packs.clear();
    render();
  });
  els.clearManualBtn.addEventListener("click", () => {
    state.selections.manualA.clear();
    state.selections.manualB.clear();
    render();
  });
}

function buildChips() {
  Object.keys(seasonBundles).forEach((seasonKey) => {
    els.seasonChips.append(createChip(seasonKey, () => {
      toggleInSet(state.selections.seasons, seasonKey);
      render();
    }, () => state.selections.seasons.has(seasonKey)));
  });

  Object.keys(packBundles).forEach((packName) => {
    els.packChips.append(createChip(packName, () => {
      toggleInSet(state.selections.packs, packName);
      render();
    }, () => state.selections.packs.has(packName)));
  });
}

function createChip(label, onClick, isSelected) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chip";
  btn.textContent = label;
  btn.addEventListener("click", () => {
    onClick();
    refreshChipState();
  });
  btn.dataset.label = label;
  btn._isSelected = isSelected;
  return btn;
}

function refreshChipState() {
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("is-selected", Boolean(chip._isSelected?.()));
  });
}

function buildManualOptions() {
  const sorted = [...skinCatalog].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  for (const skin of sorted) {
    const option = document.createElement("option");
    option.value = skin.id;
    option.textContent = `${skin.name} (${rarityConfig[skin.rarity].label})`;
    els.manualSkinSelect.append(option);
  }
}

function addManualSkin() {
  const skinId = els.manualSkinSelect.value;
  const account = els.manualAccountSelect.value;
  if (!skinId) return;

  if (account === "A" || account === "both") state.selections.manualA.add(skinId);
  if (account === "B" || account === "both") state.selections.manualB.add(skinId);
  render();
}

function toggleInSet(set, value) {
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

async function loadStats() {
  const resultA = await fetchFortniteStats("Compte A", "A");
  const resultB = await fetchFortniteStats("Compte B", "B");
  if (resultA) state.stats.A = resultA;
  if (resultB) state.stats.B = resultB;
}

async function fetchFortniteStats(_nickname, accountKey) {
  // Point d'extension: remplacer ce bloc par un fetch API.
  // Exemple Fortnite-API.com (proxy/backend recommande pour CORS/secrets selon fournisseur):
  // GET /stats?name=<pseudo>&accountType=epic
  return Promise.resolve(demoStats[accountKey]);
}

function getMergedStats(statsA, statsB) {
  const wins = statsA.wins + statsB.wins;
  const kills = statsA.kills + statsB.kills;
  const matches = statsA.matches + statsB.matches;
  const estimatedDeathsA = Math.max(1, Math.round(statsA.kills / Math.max(statsA.kd, 0.01)));
  const estimatedDeathsB = Math.max(1, Math.round(statsB.kills / Math.max(statsB.kd, 0.01)));
  const deaths = estimatedDeathsA + estimatedDeathsB;
  const kd = kills / Math.max(deaths, 1);
  return { nickname: "Fusion", wins, kills, matches, kd, deaths };
}

function getCurrentStats() {
  if (state.view === "A") return state.stats.A;
  if (state.view === "B") return state.stats.B;
  return getMergedStats(state.stats.A, state.stats.B);
}

function getLockerSets() {
  const fromSeasons = new Set();
  const fromPacks = new Set();
  const manualA = new Set(state.selections.manualA);
  const manualB = new Set(state.selections.manualB);

  for (const seasonKey of state.selections.seasons) {
    for (const id of seasonBundles[seasonKey] || []) {
      fromSeasons.add(id);
      manualA.add(id);
      manualB.add(id);
    }
  }

  for (const packName of state.selections.packs) {
    for (const id of packBundles[packName] || []) {
      fromPacks.add(id);
      manualA.add(id);
      manualB.add(id);
    }
  }

  return { accountA: manualA, accountB: manualB, fromSeasons, fromPacks };
}

function getUnifiedLockerData() {
  const { accountA, accountB, fromSeasons, fromPacks } = getLockerSets();
  const uniqueIds = new Set([...accountA, ...accountB]);
  const duplicateIds = [...uniqueIds].filter((id) => accountA.has(id) && accountB.has(id));

  const items = [...uniqueIds]
    .map((id) => {
      const skin = byId[id];
      if (!skin) return null;
      const owners = accountA.has(id) && accountB.has(id) ? "A+B" : accountA.has(id) ? "A" : "B";
      const tags = [];
      if (fromSeasons.has(id)) tags.push("Saison");
      if (fromPacks.has(id)) tags.push("Pack");
      if (!fromSeasons.has(id) && !fromPacks.has(id)) tags.push("Manuel");
      const computedVbucks = computeSkinValueVbucks(skin);
      return { ...skin, owners, tags, computedVbucks };
    })
    .filter(Boolean)
    .sort((a, b) => b.computedVbucks - a.computedVbucks || a.name.localeCompare(b.name, "fr"));

  const totalVbucks = items.reduce((sum, item) => sum + item.computedVbucks, 0);
  const byRarity = items.reduce((acc, item) => {
    const bucket = acc[item.rarity] || { count: 0, vbucks: 0 };
    bucket.count += 1;
    bucket.vbucks += item.computedVbucks;
    acc[item.rarity] = bucket;
    return acc;
  }, {});

  return { items, totalVbucks, byRarity, counts: { a: accountA.size, b: accountB.size, unique: uniqueIds.size, duplicates: duplicateIds.length } };
}

function computeSkinValueVbucks(skin) {
  const multiplier = skin.exclusivity ?? 1;
  return Math.round(skin.baseVbucks * multiplier);
}

function render() {
  refreshChipState();
  renderStats();
  renderLocker();
  renderValue();
}

function renderStats() {
  const current = getCurrentStats();
  const killsPerMatch = current.kills / Math.max(current.matches, 1);
  const winRate = (current.wins / Math.max(current.matches, 1)) * 100;
  const kd = current.kd ?? 0;

  const cards = [
    { label: "Wins", value: current.wins, fill: Math.min(100, winRate * 2.5) },
    { label: "Kills", value: current.kills, fill: Math.min(100, (current.kills / 10000) * 100) },
    { label: "Matchs", value: current.matches, fill: Math.min(100, (current.matches / 5000) * 100) },
    { label: "K/D", value: kd.toFixed(2), fill: Math.min(100, (kd / 6) * 100) }
  ];

  els.statsGrid.innerHTML = "";
  for (const card of cards) {
    const fragment = els.statCardTemplate.content.cloneNode(true);
    fragment.querySelector(".stat-label").textContent = card.label;
    fragment.querySelector(".stat-value").textContent = String(card.value);
    fragment.querySelector(".stat-meter-fill").style.width = `${card.fill}%`;
    els.statsGrid.append(fragment);
  }

  els.winRateFill.style.width = `${Math.min(100, winRate)}%`;
  els.winRateLabel.textContent = `${winRate.toFixed(1)}% win rate`;
  els.kdRing.style.setProperty("--ring-percent", String(Math.min(100, (kd / 6) * 100)));
  els.kdRingLabel.textContent = kd.toFixed(2);
  els.killsRing.style.setProperty("--ring-percent", String(Math.min(100, (killsPerMatch / 8) * 100)));
  els.avgKillsLabel.textContent = killsPerMatch.toFixed(2);
}

function renderLocker() {
  const locker = getUnifiedLockerData();
  els.countA.textContent = `${locker.counts.a} skins`;
  els.countB.textContent = `${locker.counts.b} skins`;
  els.countUnique.textContent = `${locker.counts.unique} skins`;
  els.duplicateCount.textContent = String(locker.counts.duplicates);

  els.lockerGrid.innerHTML = "";
  for (const item of locker.items) {
    const fragment = els.lockerItemTemplate.content.cloneNode(true);
    const root = fragment.querySelector(".locker-item");
    root.dataset.rarity = item.rarity;
    fragment.querySelector(".locker-name").textContent = item.name;
    fragment.querySelector(".ownership").textContent = item.owners;
    fragment.querySelector(".locker-meta").textContent = `${rarityConfig[item.rarity].label} • ${item.computedVbucks} V-Bucks`;
    const tagsEl = fragment.querySelector(".locker-tags");
    for (const tag of item.tags) {
      const tagEl = document.createElement("span");
      tagEl.className = "tag";
      tagEl.textContent = tag;
      tagsEl.append(tagEl);
    }
    els.lockerGrid.append(fragment);
  }
}

function renderValue() {
  const locker = getUnifiedLockerData();
  const euro = locker.totalVbucks * VBUCKS_TO_EUR;
  els.valueVbucks.textContent = `${locker.totalVbucks.toLocaleString("fr-FR")} V-Bucks`;
  els.valueEuro.textContent = `${euro.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;

  els.rarityBreakdown.innerHTML = "";
  const orderedRarities = ["Legendary", "Epic", "Rare", "Uncommon", "Common"];
  for (const rarity of orderedRarities) {
    const data = locker.byRarity[rarity];
    if (!data) continue;
    const card = document.createElement("article");
    card.className = "break-card";
    card.style.borderColor = `${rarityConfig[rarity].color}55`;
    card.style.boxShadow = `inset 0 0 0 1px ${rarityConfig[rarity].color}22`;
    card.innerHTML = `
      <h4>${rarityConfig[rarity].label}</h4>
      <p>${data.count} skin(s)</p>
      <strong>${data.vbucks.toLocaleString("fr-FR")} V-Bucks</strong>
      <p>${(data.vbucks * VBUCKS_TO_EUR).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR</p>
    `;
    els.rarityBreakdown.append(card);
  }
}

init();
