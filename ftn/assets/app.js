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
  manual: {
    selectedSkinId: "",
    selectedSkinIds: new Set(),
    pickerOpen: false,
    pickerQuery: "",
    pickerSort: "name",
    pickerResults: [],
    lastFocusedEl: null
  },
  pendingOps: 0,
  errors: [],
  api: {
    rateLimitUntil: 0,
    rateLimitSource: "",
    statsAbortController: null,
    statsLoadPromise: null
  }
};

const els = {
  apiStatus: document.querySelector("#apiStatus"),
  seasonChips: document.querySelector("#seasonChips"),
  setChips: document.querySelector("#setChips"),
  clearSeasonsBtn: document.querySelector("#clearSeasonsBtn"),
  clearSetsBtn: document.querySelector("#clearSetsBtn"),
  openSkinPickerBtn: document.querySelector("#openSkinPickerBtn"),
  manualSkinPreview: document.querySelector("#manualSkinPreview"),
  manualSkinPreviewName: document.querySelector("#manualSkinPreviewName"),
  manualSkinPreviewMeta: document.querySelector("#manualSkinPreviewMeta"),
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
  lockerItemTemplate: document.querySelector("#lockerItemTemplate"),
  skinPickerModal: document.querySelector("#skinPickerModal"),
  skinPickerPanel: document.querySelector("#skinPickerPanel"),
  closeSkinPickerBtn: document.querySelector("#closeSkinPickerBtn"),
  skinPickerSearch: document.querySelector("#skinPickerSearch"),
  skinPickerSort: document.querySelector("#skinPickerSort"),
  skinPickerCount: document.querySelector("#skinPickerCount"),
  skinPickerGrid: document.querySelector("#skinPickerGrid"),
  skinPickerCardTemplate: document.querySelector("#skinPickerCardTemplate")
};

const API_MAX_CONCURRENCY = 2;
const API_DEFAULT_RETRIES = 4;
const API_DEFAULT_TTL_MS = 3 * 60 * 1000;
const API_CACHE_PREFIX = "ftn-cache-v1:";
const apiRuntime = {
  inFlight: new Map(),
  queue: [],
  activeCount: 0,
  memoryCache: new Map()
};

class RateLimitError extends Error {
  constructor(message, { retryAfterMs = 0, status = 429, url = "" } = {}) {
    super(message);
    this.name = "RateLimitError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.url = url;
  }
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function isRateLimitError(error) {
  return error instanceof RateLimitError || error?.status === 429;
}

function debounce(fn, delayMs = 350) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, Math.max(0, ms));

    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    const cleanup = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
    };

    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });
}

function parseRetryAfterMs(retryAfterHeader) {
  if (!retryAfterHeader) return 0;

  const seconds = Number(retryAfterHeader);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const dateMs = Date.parse(retryAfterHeader);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return 0;
}

function setRateLimitStatus(source, retryAfterMs) {
  const until = Date.now() + Math.max(0, retryAfterMs || 0);
  state.api.rateLimitUntil = Math.max(state.api.rateLimitUntil || 0, until);
  state.api.rateLimitSource = source || "fortnite-api.com";
  renderStatus();
}

function getRateLimitRemainingSeconds() {
  const ms = Math.max(0, (state.api.rateLimitUntil || 0) - Date.now());
  return Math.ceil(ms / 1000);
}

function getLocalCache(key) {
  try {
    const raw = localStorage.getItem(API_CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (Number(parsed.expiresAt || 0) <= Date.now()) {
      localStorage.removeItem(API_CACHE_PREFIX + key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function setLocalCache(key, value, ttlMs) {
  try {
    const payload = {
      value,
      expiresAt: Date.now() + ttlMs
    };
    localStorage.setItem(API_CACHE_PREFIX + key, JSON.stringify(payload));
  } catch {
    // Ignore quota/private mode errors.
  }
}

function getCachedValue(cacheKey) {
  if (!cacheKey) return null;

  const mem = apiRuntime.memoryCache.get(cacheKey);
  if (mem && mem.expiresAt > Date.now()) return mem.value;
  if (mem) apiRuntime.memoryCache.delete(cacheKey);

  const local = getLocalCache(cacheKey);
  if (local != null) {
    apiRuntime.memoryCache.set(cacheKey, {
      value: local,
      expiresAt: Date.now() + 30_000
    });
    return local;
  }

  return null;
}

function setCachedValue(cacheKey, value, ttlMs = API_DEFAULT_TTL_MS) {
  if (!cacheKey) return;
  const expiresAt = Date.now() + ttlMs;
  apiRuntime.memoryCache.set(cacheKey, { value, expiresAt });
  setLocalCache(cacheKey, value, ttlMs);
}

function enqueueApiTask(taskFactory) {
  return new Promise((resolve, reject) => {
    apiRuntime.queue.push({ taskFactory, resolve, reject });
    pumpApiQueue();
  });
}

function pumpApiQueue() {
  while (apiRuntime.activeCount < API_MAX_CONCURRENCY && apiRuntime.queue.length > 0) {
    const item = apiRuntime.queue.shift();
    apiRuntime.activeCount += 1;

    Promise.resolve()
      .then(item.taskFactory)
      .then(item.resolve, item.reject)
      .finally(() => {
        apiRuntime.activeCount -= 1;
        pumpApiQueue();
      });
  }
}

async function apiFetch(url, options = {}) {
  const {
    method = "GET",
    headers = {},
    signal,
    dedupeKey = `${method}:${String(url)}`,
    cacheKey = "",
    ttlMs = 0,
    useCache = true,
    retries = API_DEFAULT_RETRIES,
    parse = "json"
  } = options;

  if (useCache && cacheKey) {
    const cached = getCachedValue(cacheKey);
    if (cached != null) return cached;
  }

  if (apiRuntime.inFlight.has(dedupeKey)) {
    return apiRuntime.inFlight.get(dedupeKey);
  }

  const requestPromise = enqueueApiTask(async () => {
    let lastError = null;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const res = await fetch(url, { method, headers, signal });

      if (res.status !== 429) {
        if (!res.ok) {
          const error = new Error(`API ${res.status} (${url})`);
          error.status = res.status;
          throw error;
        }

        let payload;
        if (parse === "json") payload = await res.json();
        else if (parse === "text") payload = await res.text();
        else payload = res;

        if (useCache && cacheKey && ttlMs > 0) {
          setCachedValue(cacheKey, payload, ttlMs);
        }

        return payload;
      }

      const retryAfterHeader = res.headers.get("Retry-After");
      const retryAfterMs = parseRetryAfterMs(retryAfterHeader);
      const backoffMs = retryAfterMs || Math.min(8000, 1000 * (2 ** (attempt - 1)));

      setRateLimitStatus(new URL(String(url)).host, backoffMs);

      lastError = new RateLimitError(
        `Rate limit API (${new URL(String(url)).host})`,
        { retryAfterMs: backoffMs, status: 429, url: String(url) }
      );

      if (attempt >= retries) {
        throw lastError;
      }

      await delay(backoffMs, signal);
    }

    throw lastError || new Error("Unknown API error");
  });

  apiRuntime.inFlight.set(dedupeKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    if (apiRuntime.inFlight.get(dedupeKey) === requestPromise) {
      apiRuntime.inFlight.delete(dedupeKey);
    }
  }
}

function pushUiError(label, message) {
  const full = `${label}: ${message}`;
  const last = state.errors[state.errors.length - 1];
  if (last !== full) state.errors.push(full);
  if (state.errors.length > 10) state.errors.shift();
}

function formatApiErrorForUi(error) {
  if (isAbortError(error)) return "";
  if (isRateLimitError(error)) {
    const sec = Math.max(1, Math.ceil((error.retryAfterMs || 1000) / 1000));
    return `Rate limit, reessaie dans ${sec}s`;
  }
  return error instanceof Error ? error.message : String(error);
}

const scheduleStatsReload = debounce(() => {
  loadStats({ force: true });
}, 450);

const imageObserver = createImageObserver();

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
  const debouncedPickerSearch = debounce(() => {
    refreshSkinPickerResults();
  }, 180);

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
    const account = els.manualAccountSelect.value;
    const selectedIds = [...state.manual.selectedSkinIds];
    if (selectedIds.length === 0 && state.manual.selectedSkinId) {
      selectedIds.push(state.manual.selectedSkinId);
    }
    if (selectedIds.length === 0) return;

    const idsToAdd = selectedIds.filter((id) => !isCosmeticOwnedByAccount(id, account));
    const alreadyOwnedCount = selectedIds.length - idsToAdd.length;

    if (idsToAdd.length === 0) {
      const accountLabel = account === "A" ? "Compte A" : "Compte B";
      pushUiError("ajout-manuel", `Selection deja ajoutee dans ${accountLabel}`);
      updateManualSkinPreview();
      if (state.manual.pickerOpen) renderSkinPickerGrid();
      renderStatus();
      return;
    }

    addCosmeticsToLocker(idsToAdd, account);
    if (alreadyOwnedCount > 0) {
      pushUiError("ajout-manuel", `${alreadyOwnedCount} skin(s) deja ajoutes ignores`);
    }
    updateManualSkinPreview();
    if (state.manual.pickerOpen) renderSkinPickerGrid();
    render();
  });

  els.openSkinPickerBtn?.addEventListener("click", openSkinPickerModal);
  els.closeSkinPickerBtn?.addEventListener("click", () => closeSkinPickerModal());
  els.skinPickerModal?.addEventListener("click", (event) => {
    if (event.target === els.skinPickerModal) closeSkinPickerModal();
  });
  els.skinPickerSearch?.addEventListener("input", () => {
    state.manual.pickerQuery = els.skinPickerSearch.value || "";
    debouncedPickerSearch();
  });
  els.skinPickerSort?.addEventListener("change", () => {
    state.manual.pickerSort = els.skinPickerSort.value || "name";
    refreshSkinPickerResults();
  });
  els.manualAccountSelect?.addEventListener("change", () => {
    updateManualSkinPreview();
    if (state.manual.pickerOpen) renderSkinPickerGrid();
  });
  els.skinPickerPanel?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSkinPickerModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.manual.pickerOpen) {
      event.preventDefault();
      closeSkinPickerModal();
    }
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

async function loadStatsImpl({ force = false } = {}) {
  if (!force && state.api.statsLoadPromise) {
    return state.api.statsLoadPromise;
  }

  if (state.api.statsAbortController) {
    state.api.statsAbortController.abort();
  }
  const controller = new AbortController();
  state.api.statsAbortController = controller;

  const run = withPending(async () => {
    const tasks = [
      fetchPlayerStats(ACCOUNT_A, { signal: controller.signal, force }),
      fetchPlayerStats(ACCOUNT_B, { signal: controller.signal, force })
    ];

    const [resultA, resultB] = await Promise.allSettled(tasks);

    if (resultA.status === "fulfilled") {
      state.statsByAccount.A = resultA.value;
    }
    if (resultB.status === "fulfilled") {
      state.statsByAccount.B = resultB.value;
    }

    const failures = [];
    if (resultA.status === "rejected" && !isAbortError(resultA.reason)) {
      failures.push({ account: ACCOUNT_A, error: resultA.reason });
    }
    if (resultB.status === "rejected" && !isAbortError(resultB.reason)) {
      failures.push({ account: ACCOUNT_B, error: resultB.reason });
    }

    if (failures.length > 0) {
      const messages = failures.map(({ account, error }) => {
        const uiMsg = formatApiErrorForUi(error) || "Erreur inconnue";
        return `${account}: ${uiMsg}`;
      });

      if (failures.length < 2) {
        pushUiError("stats", messages.join(" | "));
        console.warn("[stats] Partial failure:", failures);
      } else {
        throw new Error(messages.join(" | "));
      }
    }
  }, "stats");

  state.api.statsLoadPromise = run.finally(() => {
    if (state.api.statsLoadPromise === run) state.api.statsLoadPromise = null;
    if (state.api.statsAbortController === controller) state.api.statsAbortController = null;
  });

  return state.api.statsLoadPromise;
}

async function loadStats(options = {}) {
  return loadStatsImpl(options);
}

async function loadCosmetics() {
  await withPending(async () => {
    const url = new URL("/v2/cosmetics/br", API_BASE);
    const json = await apiFetch(url, {
      headers: { Authorization: API_KEY },
      dedupeKey: `GET:${url.toString()}`,
      cacheKey: "cosmetics:br",
      ttlMs: 60 * 60 * 1000,
      retries: 3,
      parse: "json"
    });

    const raw = Array.isArray(json?.data) ? json.data : [];
    state.cosmetics = raw
      .map((c, index) => normalizeCosmeticRecord(c, index))
      .filter((c) => (c?.type?.value || "").toLowerCase() === "outfit" && c?.id);
    state.cosmeticsById = new Map(state.cosmetics.map((c) => [c.id, c]));
    state.cosmeticsLoaded = true;
    buildManualSkinOptions();
  }, "cosmetics");
}

async function fetchPlayerStats(username, { signal, force = false } = {}) {
  const url = new URL("/v2/stats/br/v2", API_BASE);
  url.searchParams.set("name", username);
  url.searchParams.set("accountType", "epic");

  const cacheKey = `stats:epic:${String(username).trim().toLowerCase()}`;
  const json = await apiFetch(url, {
    headers: { Authorization: API_KEY },
    signal,
    dedupeKey: `GET:${url.toString()}`,
    cacheKey,
    ttlMs: force ? 0 : API_DEFAULT_TTL_MS,
    useCache: !force,
    retries: 4,
    parse: "json"
  });

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
  if (state.manual.selectedSkinId && !state.cosmeticsById.has(state.manual.selectedSkinId)) {
    state.manual.selectedSkinId = "";
  }
  state.manual.selectedSkinIds = new Set(
    [...state.manual.selectedSkinIds].filter((id) => state.cosmeticsById.has(id))
  );
  refreshSkinPickerResults();
  updateManualSkinPreview();
}

function normalizeCosmeticRecord(cosmetic, index = 0) {
  const item = cosmetic && typeof cosmetic === "object" ? { ...cosmetic } : {};
  if (!item.id) item.id = createStableCosmeticId(item, index);
  return item;
}

function createStableCosmeticId(cosmetic, index = 0) {
  const base = String(cosmetic?.name || cosmetic?.displayName || `skin-${index}`)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `skin-${index}`;
}

function getManualSelectedCosmetic() {
  if ((!state.manual.selectedSkinId || !state.cosmeticsById.has(state.manual.selectedSkinId)) && state.manual.selectedSkinIds.size > 0) {
    state.manual.selectedSkinId = [...state.manual.selectedSkinIds][state.manual.selectedSkinIds.size - 1];
  }
  return state.cosmeticsById.get(state.manual.selectedSkinId) || null;
}

function getCurrentManualAccount() {
  const account = els.manualAccountSelect?.value;
  return account === "B" ? "B" : "A";
}

function getOwnedIdsForCurrentManualAccount() {
  const account = getCurrentManualAccount();
  return new Set(account === "B" ? state.lockerB : state.lockerA);
}

function isCosmeticOwnedByAccount(cosmeticId, account = getCurrentManualAccount()) {
  if (!cosmeticId) return false;
  if (account === "B") return state.lockerB.includes(cosmeticId);
  return state.lockerA.includes(cosmeticId);
}

function updateManualSkinPreview() {
  const selectedCount = state.manual.selectedSkinIds.size;
  if (selectedCount > 1) {
    const ownedCount = [...state.manual.selectedSkinIds].filter((id) => isCosmeticOwnedByAccount(id)).length;
    els.manualSkinPreview?.classList.add("is-selected");
    els.manualSkinPreview?.classList.remove("is-owned");
    if (els.manualSkinPreviewName) els.manualSkinPreviewName.textContent = `${selectedCount} skins selectionnes`;
    if (els.manualSkinPreviewMeta) {
      els.manualSkinPreviewMeta.textContent = ownedCount > 0
        ? `${ownedCount} deja ajoutes (${getCurrentManualAccount()})`
        : `Compte ${getCurrentManualAccount()}`;
    }
    return;
  }

  const cosmetic = getManualSelectedCosmetic();
  if (!cosmetic) {
    els.manualSkinPreview?.classList.remove("is-selected");
    els.manualSkinPreview?.classList.remove("is-owned");
    if (els.manualSkinPreviewName) els.manualSkinPreviewName.textContent = "Aucun skin selectionne";
    if (els.manualSkinPreviewMeta) els.manualSkinPreviewMeta.textContent = "Clique sur “Choisir un skin”";
    return;
  }

  const rarity = cosmetic?.rarity?.value || "Common";
  const account = getCurrentManualAccount();
  const owned = isCosmeticOwnedByAccount(cosmetic.id, account);
  els.manualSkinPreview?.classList.add("is-selected");
  els.manualSkinPreview?.setAttribute("data-rarity", rarity);
  els.manualSkinPreview?.classList.toggle("is-owned", owned);
  if (els.manualSkinPreviewName) els.manualSkinPreviewName.textContent = cosmetic.name || cosmetic.id;
  if (els.manualSkinPreviewMeta) {
    const rarityLabel = rarityUi[rarity]?.label || rarity;
    els.manualSkinPreviewMeta.textContent = owned
      ? `${rarityLabel} • Deja ajoute (${account})`
      : rarityLabel;
  }
}

function getSortedFilteredPickerItems() {
  const query = state.manual.pickerQuery.trim().toLowerCase();
  const items = query
    ? state.cosmetics.filter((c) => String(c?.name || "").toLowerCase().includes(query))
    : [...state.cosmetics];

  items.sort((a, b) => {
    const sort = state.manual.pickerSort;
    if (sort === "rarity") {
      const vbDiff = rarityToVbucks(b?.rarity?.value) - rarityToVbucks(a?.rarity?.value);
      if (vbDiff !== 0) return vbDiff;
    }
    return String(a?.name || "").localeCompare(String(b?.name || ""), "fr");
  });

  return items;
}

function refreshSkinPickerResults() {
  state.manual.pickerResults = getSortedFilteredPickerItems();
  renderSkinPickerGrid();
}

function renderSkinPickerGrid() {
  if (!els.skinPickerGrid) return;

  const allItems = state.manual.pickerResults || [];
  const ownedIds = getOwnedIdsForCurrentManualAccount();

  els.skinPickerGrid.innerHTML = "";
  for (const cosmetic of allItems) {
    els.skinPickerGrid.append(createSkinPickerCard(cosmetic, ownedIds));
  }

  if (els.skinPickerCount) {
    const ownedCount = allItems.reduce((count, item) => count + (ownedIds.has(item.id) ? 1 : 0), 0);
    els.skinPickerCount.textContent = `${allItems.length} skins • ${ownedCount} deja ajoutes (${getCurrentManualAccount()})`;
  }
}

function createSkinPickerCard(cosmetic, ownedIds = getOwnedIdsForCurrentManualAccount()) {
  const frag = els.skinPickerCardTemplate.content.cloneNode(true);
  const card = frag.querySelector(".skin-picker-card");
  const img = frag.querySelector("img");
  const flagsEl = frag.querySelector(".skin-picker-card-flags");
  const nameEl = frag.querySelector(".skin-picker-card-name");
  const badgeEl = frag.querySelector(".skin-picker-card-rarity");

  const id = cosmetic.id;
  const rarity = cosmetic?.rarity?.value || "Common";
  const label = rarityUi[rarity]?.label || rarity;
  const icon = cosmetic?.images?.icon || cosmetic?.images?.smallIcon || "";
  const isSelected = state.manual.selectedSkinIds.has(id);
  const isOwned = ownedIds.has(id);

  card.dataset.id = id;
  card.dataset.rarity = rarity;
  card.classList.toggle("selected", isSelected);
  card.classList.toggle("owned", isOwned);
  card.setAttribute("aria-pressed", String(isSelected));
  card.setAttribute("aria-label", `${cosmetic.name || id}${isOwned ? " - deja ajoute" : ""}`);

  if (nameEl) nameEl.textContent = cosmetic.name || id;
  if (badgeEl) badgeEl.textContent = label;
  renderPickerCardFlags(flagsEl, { isOwned, isSelected });
  if (img) {
    img.alt = cosmetic.name || "Skin Fortnite";
    if (icon) {
      img.dataset.src = icon;
      imageObserver?.observe(img);
    }
  }

  card.addEventListener("click", () => {
    selectManualSkin(id);
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectManualSkin(id);
    }
  });

  return frag;
}

function renderPickerCardFlags(flagsEl, { isOwned, isSelected }) {
  if (!flagsEl) return;
  flagsEl.innerHTML = "";
  if (isOwned) flagsEl.append(createPickerFlag("OWNED", "owned"));
  if (isSelected) flagsEl.append(createPickerFlag("SELECTED", "selected"));
}

function createPickerFlag(label, variant) {
  const el = document.createElement("span");
  el.className = `skin-picker-flag ${variant}`;
  el.textContent = label;
  return el;
}

function selectManualSkin(cosmeticId) {
  if (!cosmeticId || !state.cosmeticsById.has(cosmeticId)) return;
  const wasSelected = state.manual.selectedSkinIds.has(cosmeticId);
  if (wasSelected) {
    state.manual.selectedSkinIds.delete(cosmeticId);
    if (state.manual.selectedSkinId === cosmeticId) {
      state.manual.selectedSkinId = state.manual.selectedSkinIds.size > 0
        ? [...state.manual.selectedSkinIds][state.manual.selectedSkinIds.size - 1]
        : "";
    }
  } else {
    state.manual.selectedSkinIds.add(cosmeticId);
    state.manual.selectedSkinId = cosmeticId;
  }
  updateManualSkinPreview();
  if (state.manual.pickerOpen) updateSkinPickerCardVisual(cosmeticId);
}

function updateSkinPickerCardVisual(cosmeticId, ownedIds = getOwnedIdsForCurrentManualAccount()) {
  if (!cosmeticId || !els.skinPickerGrid) return;
  const card = els.skinPickerGrid.querySelector(`.skin-picker-card[data-id="${CSS.escape(cosmeticId)}"]`);
  if (!card) return;
  const isSelected = state.manual.selectedSkinIds.has(cosmeticId);
  const isOwned = ownedIds.has(cosmeticId);
  card.classList.toggle("selected", isSelected);
  card.classList.toggle("owned", isOwned);
  card.setAttribute("aria-pressed", String(isSelected));
  const flagsEl = card.querySelector(".skin-picker-card-flags");
  renderPickerCardFlags(flagsEl, { isOwned, isSelected });
}

function openSkinPickerModal() {
  if (!els.skinPickerModal) return;
  state.manual.pickerOpen = true;
  state.manual.lastFocusedEl = document.activeElement;
  refreshSkinPickerResults();
  els.skinPickerModal.hidden = false;
  els.skinPickerModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  if (els.skinPickerSort) {
    els.skinPickerSort.value = state.manual.pickerSort;
  }
  if (els.skinPickerSearch) {
    els.skinPickerSearch.value = state.manual.pickerQuery;
    els.skinPickerSearch.focus();
    els.skinPickerSearch.select();
  }
}

function closeSkinPickerModal({ restoreFocus = true } = {}) {
  if (!els.skinPickerModal || els.skinPickerModal.hidden) return;
  state.manual.pickerOpen = false;
  els.skinPickerModal.hidden = true;
  els.skinPickerModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  if (restoreFocus && state.manual.lastFocusedEl && typeof state.manual.lastFocusedEl.focus === "function") {
    state.manual.lastFocusedEl.focus();
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
  updateManualSkinPreview();
  if (state.manual.pickerOpen) renderSkinPickerGrid();
}

function renderStatus() {
  const retrySeconds = getRateLimitRemainingSeconds();
  if (retrySeconds > 0) {
    els.apiStatus.textContent = `Rate limit Fortnite API, reessaie dans ${retrySeconds}s...`;
    return;
  }
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
    const ownerWrapEl = cardFrag.querySelector(".ownership-badges");
    const metaEl = cardFrag.querySelector(".locker-meta");
    const tagsEl = cardFrag.querySelector(".locker-tags");

    const id = cosmetic.id;
    const inA = state.lockerA.includes(id);
    const inB = state.lockerB.includes(id);
    const rarity = cosmetic?.rarity?.value || "Common";
    const vb = rarityToVbucks(rarity);

    card.dataset.rarity = rarity;
    card.classList.toggle("is-selected", fusionSet.has(id));
    card.dataset.id = id;

    nameEl.textContent = cosmetic.name || id;
    if (ownerWrapEl) {
      ownerWrapEl.innerHTML = "";
      if (inA) ownerWrapEl.append(createOwnershipBadge("A"));
      if (inB) ownerWrapEl.append(createOwnershipBadge("B"));
    }
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

function createOwnershipBadge(label) {
  const el = document.createElement("span");
  el.className = "ownership";
  el.textContent = label;
  return el;
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
    if (isAbortError(error)) {
      return;
    }

    const message = formatApiErrorForUi(error) || "Erreur inconnue";
    pushUiError(label, message);

    if (isRateLimitError(error)) {
      console.warn(`[${label}] ${message}`);
    } else {
      console.error(`[${label}]`, error);
    }
  } finally {
    state.pendingOps -= 1;
    renderStatus();
  }
}

init().catch((error) => {
  pushUiError("init", formatApiErrorForUi(error) || "Erreur d'initialisation");
  console.error("[init]", error);
  renderStatus();
});
window.selectBySeason = selectBySeason;
window.selectBySet = selectBySet;
window.scheduleStatsReload = scheduleStatsReload;
