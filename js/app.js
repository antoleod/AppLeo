// ===== Utilities =====
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const store = {
  get(key, fallback){
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); },
  remove(key){ localStorage.removeItem(key); }
};

// ===== Haptic Feedback =====
function triggerVibration(duration = 50) {
  if (navigator.vibrate) {
    try {
      // Using a short, distinct vibration pattern for confirmation
      navigator.vibrate(duration);
    } catch (e) {
      console.warn("Vibration failed", e);
    }
  }
}

// ===== Theme handling =====
const themeToggleBtn = $('#theme-toggle');
const themeToggleLabel = themeToggleBtn ? themeToggleBtn.querySelector('.theme-toggle-label') : null;
const THEME_STORAGE_KEY = 'appThemePreference';
const THEME_AUTO_NIGHT_START = 21;
const THEME_AUTO_NIGHT_END = 6;
const THEME_META_LIGHT = '#0a84ff';
const THEME_META_DARK = '#0b1424';

let themeState = { mode: 'light', source: 'auto' };
let themeAutoTimer = null;

function isWithinNightSchedule(now = new Date()){
  const hours = now.getHours();
  return hours >= THEME_AUTO_NIGHT_START || hours < THEME_AUTO_NIGHT_END;
}

function getMsUntilNextThemeBoundary(now = new Date()){
  const next = new Date(now);
  const currentTime = now.getTime();

  if(isWithinNightSchedule(now)){
    if(now.getHours() >= THEME_AUTO_NIGHT_START){
      next.setDate(now.getDate() + 1);
    }
    next.setHours(THEME_AUTO_NIGHT_END, 0, 0, 0);
  } else {
    next.setHours(THEME_AUTO_NIGHT_START, 0, 0, 0);
  }

  const delta = next.getTime() - currentTime;
  return Math.max(delta, 60 * 1000); // fallback to at least 1 minute
}

function updateThemeMetaColor(mode){
  const targetColor = mode === 'dark' ? THEME_META_DARK : THEME_META_LIGHT;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if(themeMeta){
    themeMeta.setAttribute('content', targetColor);
  }
  const statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if(statusBarMeta){
    statusBarMeta.setAttribute('content', mode === 'dark' ? 'black' : 'black-translucent');
  }
}

function syncThemeToggleUi(){
  if(!themeToggleBtn) return;
  const isDark = themeState.mode === 'dark';
  themeToggleBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  themeToggleBtn.dataset.source = themeState.source;
  if(themeToggleLabel){
    themeToggleLabel.textContent = isDark ? 'Mode jour' : 'Mode nuit';
  }
  const titleSuffix = themeState.source === 'manual'
    ? ' (préférence manuelle)'
    : ' (automatique 21h-06h)';
  themeToggleBtn.title = `${isDark ? 'Basculer vers le mode jour' : 'Basculer vers le mode nuit'}${titleSuffix}`;
}

function applyAppTheme(mode, source){
  const normalizedMode = mode === 'dark' ? 'dark' : 'light';
  const root = document.documentElement;
  const body = document.body;

  themeState = { mode: normalizedMode, source };

  root.classList.toggle('dark-mode', normalizedMode === 'dark');
  if(body){
    body.classList.toggle('dark-mode', normalizedMode === 'dark');
  }

  updateThemeMetaColor(normalizedMode);
  syncThemeToggleUi();

  if(source === 'manual'){
    store.set(THEME_STORAGE_KEY, normalizedMode);
  } else if(source === 'auto'){
    store.remove(THEME_STORAGE_KEY);
  }
}

function scheduleAutomaticTheme(){
  window.clearTimeout(themeAutoTimer);
  const delay = getMsUntilNextThemeBoundary();
  themeAutoTimer = window.setTimeout(() => {
    if(themeState.source !== 'manual'){
      const nextMode = isWithinNightSchedule() ? 'dark' : 'light';
      applyAppTheme(nextMode, 'auto');
      updateAllCharts(); // Actualiza los gráficos cuando el tema cambia automáticamente
    }
    scheduleAutomaticTheme();
  }, delay);
}

function initThemeManager(){
  const storedPreference = store.get(THEME_STORAGE_KEY, null);
  const hasManualPreference = storedPreference === 'dark' || storedPreference === 'light';
  const initialMode = hasManualPreference ? storedPreference : (isWithinNightSchedule() ? 'dark' : 'light');
  const source = hasManualPreference ? 'manual' : 'auto';

  applyAppTheme(initialMode, source);
  scheduleAutomaticTheme();

  if(themeToggleBtn){
    themeToggleBtn.addEventListener('click', () => {
      const nextMode = themeState.mode === 'dark' ? 'light' : 'dark';
      applyAppTheme(nextMode, 'manual');
      updateAllCharts(); // Actualiza los gráficos al cambiar el tema manualmente
    });
  }
}

initThemeManager();

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function focusFirstElement(modal){
  const preferred = modal.querySelector('[data-modal-focus]');
  const focusable = preferred || modal.querySelector(FOCUSABLE_SELECTOR);
  if(focusable && typeof focusable.focus === 'function'){
    focusable.focus({preventScroll:true});
  }
}

function escapeHtml(value){
  if(!value) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(value, minimumFractionDigits=0, maximumFractionDigits){
  const safe = Number.isFinite(value) ? value : 0;
  const maxDigits = typeof maximumFractionDigits === 'number' ? maximumFractionDigits : minimumFractionDigits;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits,
    maximumFractionDigits: maxDigits
  }).format(safe);
}

function formatMinutes(totalMinutes){
  const safe = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if(hours > 0){
    return `${hours}:${String(minutes).padStart(2, '0')}`;
  }
  return String(minutes);
}

function formatDuration(totalSeconds) {
  const safe = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (safe < 60) {
    return `${safe} sec`;
  }
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes < 60) {
    if (seconds > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${hours}h`;
}

const DAY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
// ===== Hero background =====
const HERO_KEY = 'heroImage';
const HERO_FALLBACKS = [
  'img/baby.jpg',
  'img/baby1.jpg'
];
let heroRotationTimer = null;
const HERO_ROTATION_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const HERO_ROTATION_META_KEY = 'heroRotationMeta';

function isAbsolutePath(src){
  return /^data:/.test(src) || /^https?:/.test(src) || src.startsWith('/');
}

function toDocPath(src){
  if(!src) return null;
  if(isAbsolutePath(src)) return src;
  if(src.startsWith('../')) return src.replace(/^\.\.\//,'');
  if(src.startsWith('./')) return src.slice(2);
  return src;
}

function toCssPath(src){
  if(!src) return null;
  if(isAbsolutePath(src)) return src;
  if(src.startsWith('../')) return src;
  return `../${src}`;
}

function clearHero(){
  document.documentElement.style.removeProperty('--hero-image');
  document.documentElement.classList.add('no-hero-image');
}

function applyHeroBackground(docPath){
  const cssPath = toCssPath(docPath);
  if(cssPath){
    document.documentElement.style.setProperty('--hero-image', `url("${cssPath}")`);
    document.documentElement.classList.remove('no-hero-image');
  }else{
    clearHero();
  }
}

function preloadImage(docPath){
  return new Promise(resolve => {
    if(!docPath){ resolve(false); return; }
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = docPath;
  });
}

function setHeroImage(src, {persist=true, fallbackIndex=0} = {}){
  const docPath = toDocPath(src);
  return preloadImage(docPath).then(ok => {
    if(ok){
      applyHeroBackground(docPath);
      if(persist) store.set(HERO_KEY, docPath);
      return true;
    }
    if(fallbackIndex < HERO_FALLBACKS.length){
      return setHeroImage(HERO_FALLBACKS[fallbackIndex], {persist:false, fallbackIndex:fallbackIndex+1});
    }
    clearHero();
    if(persist) store.set(HERO_KEY, null);
    return false;
  });
}

function getHeroSources(){
  const list = [...HERO_FALLBACKS];
  const custom = store.get(HERO_KEY, null);
  if(custom && !list.includes(custom)){
    list.unshift(custom);
  }
  return list;
}

function getHeroMeta(){
  const meta = store.get(HERO_ROTATION_META_KEY, null);
  if(meta && typeof meta.index === 'number' && typeof meta.lastSwitch === 'number'){
    return meta;
  }
  const fresh = {index:0, lastSwitch: Date.now()};
  store.set(HERO_ROTATION_META_KEY, fresh);
  return fresh;
}

function saveHeroMeta(meta){
  store.set(HERO_ROTATION_META_KEY, meta);
}

function syncHeroRotation({advance=false, force=false} = {}){
  const sources = getHeroSources();
  if(!sources.length) return;
  let meta = getHeroMeta();  
  triggerVibration();
  const now = Date.now();
  let index = meta.index % sources.length;
  if(index < 0) index = (index + sources.length) % sources.length;

  if(force){
    setHeroImage(sources[index], {persist:false});
    meta = {index, lastSwitch: now};
    saveHeroMeta(meta);
    return;
  }

  if(advance){
    index = (index + 1) % sources.length;
    meta = {index, lastSwitch: now};
    saveHeroMeta(meta);
    setHeroImage(sources[index], {persist:false});
    return;
  }

  const elapsed = now - (meta.lastSwitch || 0);
  if(elapsed >= HERO_ROTATION_INTERVAL_MS){
    const steps = Math.max(1, Math.floor(elapsed / HERO_ROTATION_INTERVAL_MS));
    index = (index + steps) % sources.length;
    meta = {index, lastSwitch: now};
    saveHeroMeta(meta);
    setHeroImage(sources[index], {persist:false});
    return;
  }

  const target = sources[index];
  const currentCss = document.documentElement.style.getPropertyValue('--hero-image');
  if(!currentCss || !currentCss.includes(target)){
    setHeroImage(target, {persist:false});
  }
}

function rotateHeroImage(){
  syncHeroRotation({advance:true});
}

function stopHeroRotation(){
  if(heroRotationTimer){
    clearInterval(heroRotationTimer);
    heroRotationTimer = null;
  }
}

function startHeroRotation(){
  stopHeroRotation();
  syncHeroRotation();
  heroRotationTimer = setInterval(rotateHeroImage, HERO_ROTATION_INTERVAL_MS);
}

setHeroImage(store.get(HERO_KEY, null), {persist:false}).then(ok => {
  if(!ok) setHeroImage(HERO_FALLBACKS[0], {persist:false, fallbackIndex:1});
});
startHeroRotation();

// ===== DOM refs =====
const panePecho = $('#pane-pecho');
const paneBiberon = $('#pane-biberon');
const historyList = $('#history');
const countPillEl = $('#count-pill');
const historyRangeBtn = $('#history-range-btn');
const historyRangeLabel = $('#history-range-label');
const historyRangeMenu = $('#history-range-menu');
const historyRangeDateInput = $('#history-range-date');
const historyRangeOptions = $$('#history-range-menu .range-option[data-range]');
const rangePickerModal = $('#modal-range-picker');
const closeRangePickerBtn = $('#close-range-picker');
const statsBtn = $('#btn-stats');
const statsModal = $('#modal-stats');
const closeStatsBtn = $('#close-stats');
const statsBreastHourCanvas = $('#chart-breast-by-hour');
const statsBottleDayCanvas = $('#chart-bottle-by-day');
const statsDiaperCanvas = $('#chart-diaper-pie');
const statsGrowthCanvas = $('#chart-growth');
const statsSummaryEl = $('#stats-summary');
const statsDailyList = $('#stats-day-list');
const statsBreakdownLabel = $('#stats-breakdown-label');
const saveIndicatorEl = $('#save-indicator');
const saveLabelEl = $('#save-label');
const exportReportsBtn = $('#export-pdf');
const btnElim = $('#btn-elim');
const footerAddManualBtn = $('#footer-add-manual');
const summaryElimEl = $('#summary-elim');
const dashboardElimEl = $('#dashboard-elim');
const bgPicker = $('#bg-picker');
const avatarBtn = $('#avatar-btn');
const infoBtn = $('#info-btn');
const infoChevron = $('#info-chevron');
const leoSummaryInfoEl = $('#leo-summary-info');
const addManualBtn = $('#add-manual');
const summaryFeedEl = $('#summary-feed');
const manualModal = $('#modal-manual');
const manualTitle = manualModal ? manualModal.querySelector('h2') : null;
const manualTypeButtons = $$('#manual-type button');
const manualFeedFields = $('#manual-feed-fields');
const manualElimFields = $('#manual-elim-fields');
const manualSource = $('#manual-source');
const manualBreastField = $('#manual-breast-field');
const manualDurationField = $('#manual-duration-field');
const manualAmountField = $('#manual-amount-field');
const manualBreast = $('#manual-breast');
const manualDuration = $('#manual-duration');
const manualAmount = $('#manual-amount');
const manualNotes = $('#manual-notes');
const manualPee = $('#manual-pee');
const manualPoop = $('#manual-poop');
const manualVomit = $('#manual-vomit');
const manualElimNotes = $('#manual-elim-notes');
const manualDatetime = $('#manual-datetime');
const closeManualBtn = $('#close-manual');
const cancelManualBtn = $('#cancel-manual');
const saveManualBtn = $('#save-manual');
const startStopBtn = $('#startStop');
const startStopBottleBtn = $('#startStopBottle');
const cancelSelectBtn = $('#cancel-select-btn');
const deleteSelectedBtn = $('#delete-selected-btn');
const selectionActions = $('#selection-actions');
const startTimeDisplay = $('#start-time-display');
const bottleStartTimeDisplay = $('#bottle-start-time-display');
const bottleChrono = $('#bottle-chrono');
const bottleForm = $('#bottle-form');
const bottleAmountInput = $('#ml');
const saveBottleBtn = $('#save-biberon');
const manualMedFields = $('#manual-med-fields');
const manualMedSelect = $('#manual-med-select');
const manualMedOtherField = $('#manual-med-other-field');
const manualMedOtherInput = $('#manual-med-other');
const manualMedDose = $('#manual-med-dose');
const manualMedNotes = $('#manual-med-notes');
const manualMesuresFields = $('#manual-mesures-fields');
const manualMesureTemp = $('#manual-mesure-temp');
const manualMesurePoids = $('#manual-mesure-poids');
const manualMesureTaille = $('#manual-mesure-taille');
const quickAddBottleBtn = $('#quick-add-bottle');

const SAVE_MESSAGES = {
  idle: 'Prêt',
  saving: 'Synchronisation…',
  offline: 'Enregistré localement',
  error: 'Erreur de synchronisation',
  synced: 'Sauvegardé dans le cloud'
};

let saveIndicatorResetTimer = null;
const summaryMedEl = $('#summary-med');

// ===== State =====
const state = {
  feeds: [], // {id,dateISO,source,breastSide,durationSec,amountMl}
  elims: [], // {id,dateISO,pee,poop,vomit}
  meds: [], // {id,dateISO,name}
  measurements: [] // {id,dateISO,temp,weight,height}
};

function updateState(updater) {
  // The updater function receives the current state and returns the new state.
  const newState = updater(state);
  state.feeds = newState.feeds ?? [];
  state.elims = newState.elims ?? [];
  state.meds = newState.meds ?? [];
  state.measurements = newState.measurements ?? [];
  
  // La persistencia es manejada por el módulo de persistencia.
  // No se usa store.set() aquí. Las llamadas a persistenceApi se hacen
  // en las funciones que guardan/eliminan datos.
}

const HISTORY_RANGE_KEY = 'historyRange';

// Variable para el modo de edición, se gestionará a través de las funciones del modal
let editingEntry = null;


let historyRange = normalizeHistoryRange(store.get(HISTORY_RANGE_KEY, {mode:'day'}));
let statsBreastHourChart = null;
let statsBottleDayChart = null;
let statsDiaperChart = null;
let statsGrowthChart = null;
const TIMER_KEY = 'timerState';
const BOTTLE_TIMER_KEY = 'bottleTimerState';
const BOTTLE_PENDING_KEY = 'bottlePendingDuration';
const BOTTLE_AMOUNT_KEY = 'bottlePendingAmount';
let manualType = 'feed';
let timer = 0;
let timerStart = null;
let timerInterval = null;
let bottleTimer = 0;
let bottleTimerStart = null;
let bottleTimerInterval = null;
let bottlePendingDuration = store.get(BOTTLE_PENDING_KEY, 0) || 0;
let bottlePendingAmount = store.get(BOTTLE_AMOUNT_KEY, null);
let isDeleteMode = false;

if(bottleAmountInput && bottlePendingAmount != null){
  bottleAmountInput.value = String(bottlePendingAmount);
}

function cloneDataSnapshot(){
  return {
    feeds: state.feeds.map(f => ({...f})),
    elims: state.elims.map(e => ({...e})),
    meds: state.meds.map(m => ({...m})),
    measurements: state.measurements.map(m => ({...m}))
  };
}

function isOnline(){
  return navigator.onLine !== false;
}

function updateOfflineIndicator(){
  if(!saveIndicatorEl) return;
  const offline = !isOnline();
  saveIndicatorEl.classList.toggle('is-offline', offline);
  if(offline && saveIndicatorEl.dataset.state !== 'saving'){
    setSaveIndicator('idle', SAVE_MESSAGES.offline);
  }else if(!offline && saveIndicatorEl.dataset.state === 'idle' && saveLabelEl && saveLabelEl.textContent === SAVE_MESSAGES.offline){
    setSaveIndicator('idle', SAVE_MESSAGES.idle);
  }
}

function replaceDataFromSnapshot(snapshot, {skipRender = false} = {}){
  updateState(() => {
    const data = {
      feeds: [],
      elims: [],
      meds: [],
      measurements: []
    };
    if (snapshot && typeof snapshot === 'object') {
      data.feeds = Array.isArray(snapshot.feeds) ? snapshot.feeds.map(f => ({...f})) : [];
      data.elims = Array.isArray(snapshot.elims) ? snapshot.elims.map(e => ({...e})) : [];
      data.meds = Array.isArray(snapshot.meds) ? snapshot.meds.map(m => ({...m})) : [];
      data.measurements = Array.isArray(snapshot.measurements) ? snapshot.measurements.map(m => ({...m})) : [];
    }
    return data;
  });

  if(!skipRender){
    renderHistory();
  }
}

function parseDateInput(value){
  if(value instanceof Date){
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if(typeof value === 'string'){
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if(match){
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      const candidate = new Date(year, month, day);
      if(candidate.getFullYear() === year && candidate.getMonth() === month && candidate.getDate() === day){
        return candidate;
      }
    }
  }
  const fallback = new Date(value);
  if(Number.isNaN(fallback.getTime())){
    return null;
  }
  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
}

function toDateInputValue(date){
  const parsed = parseDateInput(date);
  if(!parsed) return '';
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeHistoryRange(raw){
  const fallback = {mode:'day'};
  if(!raw || typeof raw !== 'object'){
    return {...fallback};
  }
  const validModes = ['day','week','month','custom'];
  const mode = validModes.includes(raw.mode) ? raw.mode : fallback.mode;
  const result = {mode};
  if(mode === 'custom'){
    const parsed = parseDateInput(raw.date);
    if(parsed){
      result.date = toDateInputValue(parsed);
    }else{
      result.mode = 'day';
    }
  }
  return result;
}

function getHistoryRangeBounds(range = historyRange){
  const today = parseDateInput(new Date());
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const todayEnd = todayStart + DAY_MS - 1;

  if(range.mode === 'custom' && range.date){
    const custom = parseDateInput(range.date);
    if(custom){
      custom.setHours(0, 0, 0, 0);
      const start = custom.getTime();
      return {start, end: start + DAY_MS - 1};
    }
  }

  let start = todayStart;
  if(range.mode === 'week'){
    start = todayStart - (6 * DAY_MS);
  }else if(range.mode === 'month'){
    start = todayStart - (29 * DAY_MS);
  }

  return {start, end: todayEnd};
}

function formatHistoryRangeLabel(range = historyRange){
  switch(range.mode){
    case 'week':
      return '7 derniers jours';
    case 'month':
      return '30 derniers jours';
    case 'custom': {
      if(range.date){
        const parsed = parseDateInput(range.date);
        if(parsed){
          return parsed.toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short'});
        }
      }
      return 'Date personnalisée';
    }
    case 'day':
    default:
      return "Aujourd'hui";
  }
}

function syncHistoryRangeUI(){
  if(historyRangeLabel){
    historyRangeLabel.textContent = formatHistoryRangeLabel(historyRange);
  }
  historyRangeOptions.forEach(option => {
    const isActive = option.dataset.range === historyRange.mode;
    option.classList.toggle('active', isActive);
    option.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });
  if(historyRangeDateInput){
    historyRangeDateInput.disabled = historyRange.mode !== 'custom';
    const value = historyRange.mode === 'custom' && historyRange.date ? historyRange.date : '';
    historyRangeDateInput.value = value;
  }
}

function setHistoryRange(mode, extra = {}){
  const next = normalizeHistoryRange({...historyRange, ...extra, mode});
  historyRange = next;
  store.set(HISTORY_RANGE_KEY, historyRange);
  syncHistoryRangeUI();
  renderHistory();
}

function syncRangePickerModal() {
  if (!rangePickerModal) return;
  const options = $$('.range-option-item', rangePickerModal);
  options.forEach(option => {
    const isActive = option.dataset.range === historyRange.mode;
    option.classList.toggle('active', isActive);
    option.setAttribute('aria-checked', String(isActive));
  });
  const customInput = $('#custom-range-date-modal', rangePickerModal);
  if (customInput) {
    const isCustom = historyRange.mode === 'custom';
    customInput.closest('.range-option-item-custom')?.classList.toggle('active', isCustom);
    customInput.value = isCustom && historyRange.date ? historyRange.date : '';
  }
}


function closeHistoryRangeMenu(){
  if(!historyRangeMenu) return;
  if(!historyRangeMenu.classList.contains('is-open')) return;
  historyRangeMenu.classList.remove('is-open');
  historyRangeBtn?.setAttribute('aria-expanded','false');
  if(historyMenuOutsideHandler){
    document.removeEventListener('pointerdown', historyMenuOutsideHandler);
    historyMenuOutsideHandler = null;
  }
  if(historyMenuKeydownHandler){
    document.removeEventListener('keydown', historyMenuKeydownHandler);
    historyMenuKeydownHandler = null;
  }
}

function openHistoryRangeMenu(){
  if(!historyRangeMenu) return;
  if(historyRangeMenu.classList.contains('is-open')) return;
  historyRangeMenu.classList.add('is-open');
  historyRangeBtn?.setAttribute('aria-expanded','true');
  historyMenuOutsideHandler = (event) => {
    if(historyRangeMenu.contains(event.target) || historyRangeBtn?.contains(event.target)){
      return;
    }
    closeHistoryRangeMenu();
  };
  historyMenuKeydownHandler = (event) => {
    if(event.key === 'Escape'){
      closeHistoryRangeMenu();
      historyRangeBtn?.focus();
    }
  };
  document.addEventListener('pointerdown', historyMenuOutsideHandler);
  document.addEventListener('keydown', historyMenuKeydownHandler);
}

function toggleHistoryRangeMenu(force){
  if(!historyRangeMenu) return;
  const shouldOpen = typeof force === 'boolean'
    ? force
    : !historyRangeMenu.classList.contains('is-open');
  if(shouldOpen){
    openHistoryRangeMenu();
  }else{
    closeHistoryRangeMenu();
  }
}

function handleHistoryRangeMenuSelection(target){
  const option = target?.closest?.('.range-option[data-range]');
  if(!option || !historyRangeMenu?.contains(option)) return;
  const mode = option.dataset.range;
  if(!mode) return;
  if(mode === 'custom'){
    const fallbackValue = historyRangeDateInput?.value || historyRange.date || toDateInputValue(new Date());
    if(historyRangeDateInput){
      historyRangeDateInput.disabled = false;
      if(!historyRangeDateInput.value){
        historyRangeDateInput.value = fallbackValue;
      }
    }
    setHistoryRange('custom', {date: fallbackValue});
    historyRangeDateInput?.focus();
    return;
  }
  setHistoryRange(mode);
  closeHistoryRangeMenu();
  historyRangeBtn?.focus();
}

// ===== History render =====
function getHistoryEntriesForRange(range = historyRange){
  const bounds = getHistoryRangeBounds(range);
  return [
    ...state.feeds.map(f => ({type:'feed', item:f})),
    ...state.elims.map(e => ({type:'elim', item:e})),
    ...state.meds.map(m => ({type:'med', item:m})),
    ...state.measurements.map(m => ({type:'measurement', item:m}))
  ]
    .filter(entry => {
      const timestamp = new Date(entry.item.dateISO).getTime();
      if(Number.isNaN(timestamp)) return false;
      if(bounds.start != null && timestamp < bounds.start) return false;
      if(bounds.end != null && timestamp > bounds.end) return false;
      return true;
    })
    .sort((a,b)=> a.item.dateISO < b.item.dateISO ? 1 : -1);
}


function formatStatsDayLabel(dateISO, options = {weekday:'short', day:'numeric'}){
  const parsed = parseDateInput(dateISO);
  if(!parsed) return dateISO || '';
  const label = parsed.toLocaleDateString('fr-FR', options);
  if(!label) return '';
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getChartColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    textColor: style.getPropertyValue('--chart-text-color').trim() || '#f5f7ff',
    gridColor: style.getPropertyValue('--chart-grid-color').trim() || 'rgba(255,255,255,0.15)',
    breastColor: style.getPropertyValue('--chart-breast-color').trim() || 'rgba(37, 99, 235, 0.6)',
    bottleColor: style.getPropertyValue('--chart-bottle-color').trim() || 'rgba(249, 115, 22, 0.6)',
    diaperPeeColor: style.getPropertyValue('--chart-diaper-pee-color').trim() || 'rgba(14, 165, 233, 0.8)',
    diaperPoopColor: style.getPropertyValue('--chart-diaper-poop-color').trim() || 'rgba(249, 115, 22, 0.8)',
    diaperBothColor: style.getPropertyValue('--chart-diaper-both-color').trim() || 'rgba(139, 92, 246, 0.8)',
  };
}

function buildRangeStats(range = historyRange){
  const bounds = getHistoryRangeBounds(range);
  const base = {
    label: formatHistoryRangeLabel(range),
    range,
    bounds,
    dayCount: 0,
    perDay: [],
    perHour: Array.from({length:24}, () => 0),
    feedTotals: {
      feedCount: 0,
      breastMinutes: 0,
      bottleMl: 0,
      breastSessions: 0,
      bottleSessions: 0
    },
    diapers: {
      wet: 0,
      dirty: 0,
      both: 0,
      total: 0
    },
    meds: {
      count: 0
    },
    measurements: {
      entries: [],
      latest: null
    }
  };

  if(!bounds || bounds.start == null || bounds.end == null){
    return base;
  }

  const perDayMap = new Map();
  const orderedKeys = [];
  for(let ts = bounds.start; ts <= bounds.end; ts += DAY_MS){
    const day = new Date(ts);
    day.setHours(0, 0, 0, 0);
    const key = toDateInputValue(day);
    orderedKeys.push(key);
    perDayMap.set(key, {
      dateISO: key,
      feedCount: 0,
      breastMinutes: 0,
      bottleMl: 0,
      breastSessions: 0,
      bottleSessions: 0
    });
  }

  const feeds = Array.isArray(state.feeds) ? state.feeds : [];
  for(const feed of feeds){
    const ts = Date.parse(feed.dateISO);
    if(!Number.isFinite(ts) || ts < bounds.start || ts > bounds.end) continue;
    const dayKey = toDateInputValue(new Date(ts));
    const bucket = perDayMap.get(dayKey);
    if(!bucket) continue;

    bucket.feedCount += 1;
    base.feedTotals.feedCount += 1;

    if(feed.source === 'breast'){
      const minutes = (Number(feed.durationSec) || 0) / 60;
      bucket.breastMinutes += minutes;
      bucket.breastSessions += 1;
      base.feedTotals.breastMinutes += minutes;
      base.feedTotals.breastSessions += 1;
      const hour = new Date(ts).getHours();
      base.perHour[hour] = (base.perHour[hour] || 0) + minutes;
    }else if(feed.source === 'bottle'){
      const ml = Number(feed.amountMl || 0);
      if(Number.isFinite(ml)){
        bucket.bottleMl += ml;
        bucket.bottleSessions += 1;
        base.feedTotals.bottleMl += ml;
        base.feedTotals.bottleSessions += 1;
      }
    }
  }

  const elims = Array.isArray(state.elims) ? state.elims : [];
  for(const elim of elims){
    const ts = Date.parse(elim.dateISO);
    if(!Number.isFinite(ts) || ts < bounds.start || ts > bounds.end) continue;
    const pee = Number(elim.pee || 0);
    const poop = Number(elim.poop || 0);
    if(pee > 0 && poop > 0){
      base.diapers.both += 1;
    }else if(pee > 0){
      base.diapers.wet += 1;
    }else if(poop > 0){
      base.diapers.dirty += 1;
    }
  }
  base.diapers.total = base.diapers.wet + base.diapers.dirty + base.diapers.both;

  const meds = Array.isArray(state.meds) ? state.meds : [];
  base.meds.count = meds.reduce((count, med) => {
    const ts = Date.parse(med.dateISO);
    if(!Number.isFinite(ts) || ts < bounds.start || ts > bounds.end) return count;
    return count + 1;
  }, 0);

  const measurements = Array.isArray(state.measurements) ? state.measurements : [];
  const measurementEntries = measurements
    .filter(entry => {
      const ts = Date.parse(entry.dateISO);
      return Number.isFinite(ts) && ts >= bounds.start && ts <= bounds.end;
    })
    .sort((a, b) => Date.parse(a.dateISO) - Date.parse(b.dateISO));
  base.measurements.entries = measurementEntries;
  base.measurements.latest = measurementEntries.length ? measurementEntries[measurementEntries.length - 1] : null;

  base.perDay = orderedKeys.map(key => {
    const bucket = perDayMap.get(key) || {feedCount:0, breastMinutes:0, bottleMl:0, breastSessions:0, bottleSessions:0};
    return {
      dateISO: key,
      feedCount: bucket.feedCount,
      breastMinutes: Number(bucket.breastMinutes.toFixed(2)),
      bottleMl: Math.round(bucket.bottleMl),
      breastSessions: bucket.breastSessions,
      bottleSessions: bucket.bottleSessions
    };
  });

  base.perHour = base.perHour.map(value => Number(value.toFixed(2)));
  base.feedTotals.breastMinutes = Number(base.feedTotals.breastMinutes.toFixed(2));
  base.feedTotals.bottleMl = Math.round(base.feedTotals.bottleMl);
  base.dayCount = base.perDay.length;
  return base;
}

function getStatsChartData(range = historyRange){
  const stats = buildRangeStats(range);
  const labels = stats.perDay.map(day => formatStatsDayLabel(day.dateISO, {weekday:'short', day:'numeric'}));
  const breastMinutes = stats.perDay.map(day => Number(day.breastMinutes.toFixed(2)));
  const bottleMl = stats.perDay.map(day => day.bottleMl);
  return {
    labels,
    breastMinutes,
    bottleMl,
    rangeLabel: stats.label,
    stats
  };
}

function updateStatsSummary(currentStats = null){
  if(!statsSummaryEl) return;
  const rangeConfigs = [
    { key: 'today', label: 'Hoy', range: {mode:'day'}, icon: '☀️' },
    { key: 'week', label: '7 días', range: {mode:'week'}, icon: '📅' },
    { key: 'month', label: '30 días', range: {mode:'month'}, icon: '🗓️' }
  ];

  const cardsHtml = rangeConfigs.map(cfg => {
    const data = buildRangeStats(cfg.range);
    const dayCount = Math.max(data.dayCount, 1);
    const totalFeeds = data.feedTotals.feedCount;
    const avgFeeds = totalFeeds / dayCount;
    const totalBreastMinutes = data.feedTotals.breastMinutes;
    const avgBreastMinutes = totalBreastMinutes / dayCount;
    const totalBottleMl = data.feedTotals.bottleMl;
    const avgBottleMl = totalBottleMl / dayCount;
    const diapers = data.diapers;
    const meds = data.meds.count;
    const latest = data.measurements.latest;
    const measurementParts = [];
    if(latest){
      if(Number.isFinite(latest.weight)){
        measurementParts.push(`${formatNumber(latest.weight, 2, 2)} kg`);
      }
      if(Number.isFinite(latest.height)){
        measurementParts.push(`${formatNumber(latest.height, 1, 1)} cm`);
      }
      if(Number.isFinite(latest.temp)){
        measurementParts.push(`${formatNumber(latest.temp, 1, 1)} °C`);
      }
    }
    const measurementLabel = measurementParts.join(' • ');
    return `
      <article class="stat-card" data-range="${cfg.key}">
        <div class="stat-card-head">
          <span class="stat-pill">${cfg.icon} ${cfg.label}</span>
          <span class="stat-pill stat-pill-muted">${dayCount}d</span>
        </div>
        <div class="stat-card-main">
          <span class="stat-card-icon">🍼</span>
          <div class="stat-card-main-values">
            <span class="stat-card-value">${formatNumber(totalFeeds)}</span>
            <span class="stat-card-caption">tomas</span>
          </div>
          <span class="stat-card-average">Ø ${formatNumber(avgFeeds, 1, 1)}/d</span>
        </div>
        <div class="stat-card-grid">
          <div class="stat-chip">
            <span class="stat-chip-icon">⏱️</span>
            <div class="stat-chip-data">
              <span class="stat-chip-value">${formatMinutes(totalBreastMinutes)}</span>
              <span class="stat-chip-sub">Ø ${formatMinutes(avgBreastMinutes)}/d</span>
            </div>
          </div>
          <div class="stat-chip">
            <span class="stat-chip-icon">🥛</span>
            <div class="stat-chip-data">
              <span class="stat-chip-value">${formatNumber(totalBottleMl)}</span>
              <span class="stat-chip-sub">Ø ${formatNumber(avgBottleMl, 1, 1)} ml/d</span>
            </div>
          </div>
          <div class="stat-chip">
            <span class="stat-chip-icon">🧷</span>
            <div class="stat-chip-data">
              <span class="stat-chip-value">${formatNumber(diapers.total)}</span>
              <span class="stat-chip-sub">H${formatNumber(diapers.wet)}·S${formatNumber(diapers.dirty)}·A${formatNumber(diapers.both)}</span>
            </div>
          </div>
          <div class="stat-chip">
            <span class="stat-chip-icon">💊</span>
            <div class="stat-chip-data">
              <span class="stat-chip-value">${formatNumber(meds)}</span>
              <span class="stat-chip-sub">Ø ${formatNumber(meds / dayCount, 1, 1)}/d</span>
            </div>
          </div>
          ${measurementLabel ? `
            <div class="stat-chip stat-chip-wide">
              <span class="stat-chip-icon">📏</span>
              <div class="stat-chip-data">
                <span class="stat-chip-value">${escapeHtml(measurementLabel)}</span>
              </div>
            </div>
          ` : ''}
        </div>
      </article>
    `;
  }).join('');

  const statsData = currentStats || buildRangeStats(historyRange);
  const perDay = Array.isArray(statsData.perDay) ? statsData.perDay : [];
  const dayCount = Math.max(statsData.dayCount || perDay.length || 0, 1);
  const totals = statsData.feedTotals || {feedCount:0, breastMinutes:0, bottleMl:0};
  const hasData = totals.feedCount > 0 || totals.breastMinutes > 0 || totals.bottleMl > 0;

  let insightsHtml = '';
  if(hasData){
    const busiestDay = perDay.reduce((best, day) => {
      if(!day) return best;
      if(!best) return day;
      const dayFeeds = day.feedCount || 0;
      const bestFeeds = best.feedCount || 0;
      if(dayFeeds > bestFeeds) return day;
      if(dayFeeds === bestFeeds){
        const dayVolume = (day.breastMinutes || 0) + (day.bottleMl || 0) / 60;
        const bestVolume = (best.breastMinutes || 0) + (best.bottleMl || 0) / 60;
        return dayVolume > bestVolume ? day : best;
      }
      return best;
    }, null);

    const insightItems = [];
    if(busiestDay && (busiestDay.feedCount > 0 || busiestDay.breastMinutes > 0 || busiestDay.bottleMl > 0)){
      const busyLabel = formatStatsDayLabel(busiestDay.dateISO, {weekday:'long', day:'numeric', month:'short'});
      const detailParts = [];
      if(busiestDay.breastMinutes > 0){
        detailParts.push(`${formatMinutes(busiestDay.breastMinutes)} ⏱️`);
      }
      if(busiestDay.bottleMl > 0){
        detailParts.push(`${formatNumber(busiestDay.bottleMl)} ml 🍼`);
      }
      insightItems.push({
        icon: '🌟',
        value: formatNumber(busiestDay.feedCount),
        label: busyLabel,
        sub: detailParts.join(' • ')
      });
    }

    const totalSessions = (totals.breastSessions || 0) + (totals.bottleSessions || 0);
    if(totalSessions > 0){
      const ratioBreast = Math.round((totals.breastSessions / totalSessions) * 100);
      const ratioBottle = Math.max(0, 100 - ratioBreast);
      insightItems.push({
        icon: '🌀',
        value: `${ratioBreast}% / ${ratioBottle}%`,
        label: 'reparto',
        sub: `${formatNumber(totals.breastSessions)} ⏱️ • ${formatNumber(totals.bottleSessions)} 🍼`
      });
    }

    if(totals.feedCount > 0){
      const detailParts = [];
      if(totals.breastSessions > 0){
        const avgPerSessionBreast = totals.breastMinutes / Math.max(totals.breastSessions, 1);
        detailParts.push(`${formatMinutes(avgPerSessionBreast)} ⏱️`);
      }
      if(totals.bottleSessions > 0){
        const avgPerSessionBottle = totals.bottleMl / Math.max(totals.bottleSessions, 1);
        detailParts.push(`${formatNumber(avgPerSessionBottle, 1, 1)} ml 🍼`);
      }
      if(detailParts.length){
        insightItems.push({
          icon: '⚖️',
          value: `${formatNumber(totals.feedCount / dayCount, 1, 1)}/d`,
          label: 'promedio',
          sub: detailParts.join(' • ')
        });
      }
    }

    insightsHtml = insightItems.length
      ? `<div class="stat-insights">${insightItems.map(item => `
          <div class="stat-chip stat-chip-inline">
            <span class="stat-chip-icon">${escapeHtml(item.icon)}</span>
            <div class="stat-chip-data">
              <span class="stat-chip-value">${escapeHtml(item.value)}</span>
              ${item.label ? `<span class="stat-chip-label">${escapeHtml(item.label)}</span>` : ''}
              ${item.sub ? `<span class="stat-chip-sub">${escapeHtml(item.sub)}</span>` : ''}
            </div>
          </div>
        `).join('')}</div>`
      : '';
  }

  statsSummaryEl.innerHTML = `
    <div class="stat-overview-grid">
      ${cardsHtml}
    </div>
    ${insightsHtml}
  `;
}

function renderStatsDailyList(stats = null){
  if(!statsDailyList) return;
  const data = stats || buildRangeStats();
  const perDay = Array.isArray(data?.perDay) ? data.perDay : [];
  if(!perDay.length){
    statsDailyList.innerHTML = '<div class="stat-placeholder">📭 Sin actividad en este rango.</div>';
    return;
  }

  const hasActivity = perDay.some(day => (day?.feedCount || 0) > 0 || (day?.breastMinutes || 0) > 0 || (day?.bottleMl || 0) > 0);
  if(!hasActivity){
    statsDailyList.innerHTML = '<div class="stat-placeholder">📭 Sin actividad en este rango.</div>';
    return;
  }

  const maxBreast = perDay.reduce((max, day) => Math.max(max, day?.breastMinutes || 0), 0);
  const maxBottle = perDay.reduce((max, day) => Math.max(max, day?.bottleMl || 0), 0);

  statsDailyList.innerHTML = perDay.map(day => {
    const dateISO = day?.dateISO || '';
    const labelShort = formatStatsDayLabel(dateISO, {weekday:'short', day:'numeric'});
    const labelFull = formatStatsDayLabel(dateISO, {weekday:'long', day:'numeric', month:'short'});
    const feedCount = day?.feedCount || 0;
    const breastMinutes = day?.breastMinutes || 0;
    const bottleMl = day?.bottleMl || 0;
    const breastPercent = maxBreast > 0 ? Math.round((breastMinutes / maxBreast) * 100) : 0;
    const bottlePercent = maxBottle > 0 ? Math.round((bottleMl / maxBottle) * 100) : 0;
    const breastValue = formatMinutes(breastMinutes);
    const bottleValue = `${formatNumber(bottleMl)} ml`;

    const safeBreastPercent = Math.min(100, Math.max(0, breastPercent));
    const safeBottlePercent = Math.min(100, Math.max(0, bottlePercent));

    return `
      <article class="stats-day" data-day="${escapeHtml(dateISO)}">
        <div class="stats-day-head">
          <span class="stats-day-date" title="${escapeHtml(labelFull)}">${escapeHtml(labelShort)}</span>
          <span class="stats-day-count">${feedCount > 0 ? `✳️ ${formatNumber(feedCount)}` : '&mdash;'}</span>
        </div>
        <div class="stats-day-bars">
          <div class="stats-meter">
            <span class="stats-meter-icon">⏱️</span>
            <div class="stats-meter-bar" title="⏱️ ${escapeHtml(breastValue)}">
              <span class="stats-meter-fill breast" style="--percent:${safeBreastPercent}%"></span>
            </div>
            <span class="stats-meter-value">${escapeHtml(breastValue)}</span>
          </div>
          <div class="stats-meter">
            <span class="stats-meter-icon">🍼</span>
            <div class="stats-meter-bar" title="🍼 ${escapeHtml(bottleValue)}">
              <span class="stats-meter-fill bottle" style="--percent:${safeBottlePercent}%"></span>
            </div>
            <span class="stats-meter-value">${escapeHtml(bottleValue)}</span>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function updateStatsChart(force = false){
  const summary = getStatsChartData();
  const stats = summary.stats;
  updateStatsSummary(stats);
  if(statsBreakdownLabel) statsBreakdownLabel.textContent = summary.rangeLabel || '';
  renderStatsDailyList(stats);

  if(typeof Chart === 'undefined') return;

  const hourCtx = statsBreastHourCanvas?.getContext('2d');
  if(hourCtx){
    const hourLabels = Array.from({length:24}, (_, hour) => `${String(hour).padStart(2, '0')}h`);
    const hourData = stats.perHour.map(value => Number(value.toFixed(2)));
    if(!statsBreastHourChart){
      statsBreastHourChart = new Chart(hourCtx, {
        type: 'line',
        data: {
          labels: hourLabels,
          datasets: [{
            label: 'Minutos de lactancia',
            data: hourData,
            borderColor: 'rgba(37, 99, 235, 0.9)',
            backgroundColor: 'rgba(37, 99, 235, 0.2)',
            borderWidth: 3,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: '⏱️ / hora',
              color: '#f5f7ff'
            },
            tooltip: {
              callbacks: {
                label(context){
                  const val = context.parsed.y ?? 0;
                  return `Minutos ${formatMinutes(val)}`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: '#f5f7ff' },
              grid: { color: 'rgba(255,255,255,0.15)' }
            },
            x: {
              ticks: { color: '#f5f7ff' },
              grid: { color: 'rgba(255,255,255,0.1)' }
            }
          }
        }
      });
    }else{
      statsBreastHourChart.data.labels = hourLabels;
      statsBreastHourChart.data.datasets[0].data = hourData;
      statsBreastHourChart.update();
    }
  }

  const bottleCtx = statsBottleDayCanvas?.getContext('2d');
  if(bottleCtx){
    if(!statsBottleDayChart){
      const chartColors = getChartColors();
      const breastData = summary.breastMinutes;
      const bottleData = summary.bottleMl;

      statsBottleDayChart = new Chart(bottleCtx, {
        type: 'bar',
        data: {
          labels: summary.labels,
          datasets: [
            {
              label: 'Minutos de lactancia',
              data: breastData,
              backgroundColor: chartColors.breastColor,
              borderColor: chartColors.breastColor.replace('0.6', '0.9'),
              borderWidth: 1,
              borderRadius: 6,
              maxBarThickness: 25,
            },
            {
              label: 'Ml de biberón',
              data: bottleData,
              backgroundColor: chartColors.bottleColor,
              borderColor: chartColors.bottleColor.replace('0.6', '0.9'),
              borderWidth: 1,
              borderRadius: 6,
              maxBarThickness: 25,
            }
          ]
        },
        options: {
          animation: { duration: 800, easing: 'easeOutQuart' }, // Animación añadida
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'bottom', labels: { color: chartColors.textColor } },
            title: {
              display: true,
              text: '🍼 Tomas / día',
              color: chartColors.textColor
            },
            tooltip: {
              callbacks: {
                label(context){
                  return ` ${formatNumber(context.parsed.y || 0)} ml`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: chartColors.textColor },
              grid: { color: chartColors.gridColor }
            },
            x: {
              ticks: { color: chartColors.textColor },
              grid: { color: chartColors.gridColor.replace('0.15', '0.1') }
            }
          }
        }
      });
    }else{
      statsBottleDayChart.data.labels = summary.labels;
      statsBottleDayChart.data.datasets[0].data = summary.breastMinutes;
      statsBottleDayChart.data.datasets[1].data = summary.bottleMl;
      statsBottleDayChart.update();
    }
  }

  const diaperCtx = statsDiaperCanvas?.getContext('2d');
  if(diaperCtx){
    const diaperData = [stats.diapers.wet, stats.diapers.dirty, stats.diapers.both];
    const chartColors = getChartColors();
    if(!statsDiaperChart){
      statsDiaperChart = new Chart(diaperCtx, {
        type: 'doughnut',
        data: {
          labels: ['Pipi', 'Caca', 'Ambos'],
          datasets: [{
            data: diaperData,
            backgroundColor: [
              chartColors.diaperPeeColor,
              chartColors.diaperPoopColor,
              chartColors.diaperBothColor
            ],
            borderColor: 'rgba(255,255,255,0.45)',
            borderWidth: 1
          }]
        },
        options: {
          animation: { animateRotate: true, animateScale: true, duration: 800 }, // Animación añadida
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: chartColors.textColor }
            },
            title: {
              display: true,
              text: '🧷 pañales',
              color: chartColors.textColor
            }
          }
        }
      });
    }else{
      statsDiaperChart.data.datasets[0].data = diaperData;
      statsDiaperChart.update();
    }
  }

  const growthCtx = statsGrowthCanvas?.getContext('2d');
  if(growthCtx){
    const measurementEntries = stats.measurements.entries;
    const chartColors = getChartColors();
    const labels = measurementEntries.map(entry => {
      const date = parseDateInput(entry.dateISO);
      return date ? date.toLocaleDateString('fr-FR', {day:'2-digit', month:'short'}) : '';
    });
    const weightData = measurementEntries.map(entry => Number.isFinite(entry.weight) ? entry.weight : null);
    const heightData = measurementEntries.map(entry => Number.isFinite(entry.height) ? entry.height : null);
    const tempData = measurementEntries.map(entry => Number.isFinite(entry.temp) ? entry.temp : null);

    if(!statsGrowthChart){
      statsGrowthChart = new Chart(growthCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'kg',
              data: weightData,
              borderColor: 'rgba(59, 130, 246, 0.9)',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              spanGaps: true,
              tension: 0.3,
              pointRadius: 4,
              yAxisID: 'yWeight'
            },
            {
              label: 'cm',
              data: heightData,
              borderColor: 'rgba(16, 185, 129, 0.9)',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              spanGaps: true,
              tension: 0.3,
              pointRadius: 4,
              yAxisID: 'yHeight'
            },
            {
              label: '°C',
              data: tempData,
              borderColor: 'rgba(244, 63, 94, 0.9)',
              backgroundColor: 'rgba(244, 63, 94, 0.2)',
              spanGaps: true,
              tension: 0.3,
              pointRadius: 4,
              yAxisID: 'yTemp'
            }
          ]
        },
        options: {
          animation: { duration: 800, easing: 'easeOutQuart' }, // Animación añadida
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode:'index', intersect:false },
          plugins: {
            title: {
              display: true,
              text: '📈 crecimiento',
              color: chartColors.textColor
            },
            legend: {
              position: 'bottom',
              labels: { color: chartColors.textColor }
            }
          },
          scales: {
            yWeight: {
              type: 'linear',
              position: 'left',
              title: { display:true, text:'kg', color:chartColors.textColor },
              ticks: { color:chartColors.textColor },
              grid: { color:chartColors.gridColor }
            },
            yHeight: {
              type: 'linear',
              position: 'right',
              title: { display:true, text:'cm', color:chartColors.textColor },
              ticks: { color:chartColors.textColor },
              grid: { drawOnChartArea:false }
            },
            yTemp: {
              type: 'linear',
              position: 'right',
              offset: true,
              title: { display:true, text:'°C', color:chartColors.textColor },
              ticks: { color:chartColors.textColor },
              grid: { drawOnChartArea:false }
            },
            x: {
              ticks: { color:chartColors.textColor },
              grid: { color:chartColors.gridColor.replace('0.15', '0.08') }
            }
          }
        }
      });
    }else{
      statsGrowthChart.data.labels = labels;
      statsGrowthChart.data.datasets[0].data = weightData;
      statsGrowthChart.data.datasets[1].data = heightData;
      statsGrowthChart.data.datasets[2].data = tempData;
      statsGrowthChart.update();
    }
  }
}

function updateAllCharts() {
  // Esta función se puede llamar cuando el tema cambia para redibujar los gráficos con nuevos colores.
  updateStatsChart(true);
}

function renderHistory(){
  if(!historyList) return;
  const itemTemplate = $('#history-item-template');
  const all = getHistoryEntriesForRange();

  historyList.innerHTML = '';
  if(!all.length){
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = "Aucun enregistrement pour le moment. Ajoutez un premier suivi !";
    historyList.appendChild(empty);
  }else{
    const fragment = document.createDocumentFragment();
    const newItems = [];
    const groupedByDay = all.reduce((acc, entry) => {
      const date = new Date(entry.item.dateISO);
      const dayKey = toDateInputValue(date); // YYYY-MM-DD
      if (!acc[dayKey]) {
        acc[dayKey] = [];
      }
      acc[dayKey].push(entry);
      return acc;
    }, {});

    for (const dayKey in groupedByDay) {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'history-day-header';
      const date = parseDateInput(dayKey);
      const isToday = toDateInputValue(new Date()) === dayKey;
      dayHeader.textContent = isToday ? "Aujourd'hui" : date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      fragment.appendChild(dayHeader);

      const entriesForDay = groupedByDay[dayKey];
      for (const row of entriesForDay) {
        const templateClone = itemTemplate.content.cloneNode(true);
        const itemContainer = templateClone.querySelector('.history-item');
        const dateString = new Date(row.item.dateISO).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        let title = '';

        if(row.type === 'feed'){
          if(row.item.source === 'breast'){
            const durationLabel = formatDuration(row.item.durationSec || 0);
            title = `🍼 Sein (${row.item.breastSide || ''}) · ${durationLabel}`;
          }else{
            const ml = Number(row.item.amountMl || 0);
            title = `🍼 Biberon · ${ml} ml`;
          }
        }else if(row.type === 'elim'){
          title = `🚼 Eliminations · P:${row.item.pee} · C:${row.item.poop} · V:${row.item.vomit}`;
        }else if(row.type === 'med'){
          const doseSuffix = row.item.dose ? ` · ${row.item.dose}` : '';
          title = `💊 ${row.item.name}${doseSuffix}`;
        }else if(row.type === 'measurement'){
          const parts = ['📏 Mesures'];
          if(row.item.temp) parts.push(`Temp ${row.item.temp}°C`);
          if(row.item.weight) parts.push(`Poids ${row.item.weight}kg`);
          if(row.item.height) parts.push(`Taille ${row.item.height}cm`);
          title = parts.join(' · ');
        }

        const metaHtml = [`<span class="item-meta-time">${escapeHtml(dateString)}</span>`];
        if(row.type === 'med' && row.item.medKey){
          const medLabel = row.item.medKey === 'other' ? 'AUTRE' : String(row.item.medKey).toUpperCase();
          metaHtml.push(`<span class="item-meta-tag">${escapeHtml(medLabel)}</span>`);
        }
        if(row.item.notes){
          metaHtml.push(`<span class="item-note">${escapeHtml(row.item.notes)}</span>`);
        }

        itemContainer.querySelector('.item-title').textContent = title;
        itemContainer.querySelector('.item-meta').innerHTML = metaHtml.join('');

        const checkbox = itemContainer.querySelector('.history-item-checkbox');
        checkbox.dataset.id = row.item.id;
        checkbox.dataset.type = row.type;

        itemContainer.querySelector('.item-edit').dataset.id = row.item.id;
        itemContainer.querySelector('.item-edit').dataset.type = row.type;
        itemContainer.querySelector('.item-delete').dataset.id = row.item.id;
        itemContainer.querySelector('.item-delete').dataset.type = row.type;
        itemContainer.querySelector('.swipe-delete-btn').dataset.id = row.item.id;
        itemContainer.querySelector('.swipe-delete-btn').dataset.type = row.type;

        fragment.appendChild(itemContainer);
        newItems.push(itemContainer);
      }
    }
    historyList.appendChild(fragment);
    requestAnimationFrame(() => {
      newItems.forEach(item => item.classList.remove('enter'));
    });
  }
  if(countPillEl){
    countPillEl.textContent = String(all.length);
  }
  updateSummaries();
  renderFeedHistory();
  updateStatsChart();
}
syncHistoryRangeUI();

const mesureTempInput = $('#mesure-temp');
const mesurePoidsInput = $('#mesure-poids');
const mesureTailleInput = $('#mesure-taille');

function validateNumericInput(event) {
  const allowedKeys = [
    'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', ','
  ];
  const key = event.key;

  if (event.ctrlKey || event.metaKey) {
    return;
  }

  if (!allowedKeys.includes(key)) {
    event.preventDefault();
  }
}

if (mesureTempInput) {
  mesureTempInput.addEventListener('keydown', validateNumericInput);
}
if (mesurePoidsInput) {
    mesurePoidsInput.addEventListener('keydown', validateNumericInput);
}
if (mesureTailleInput) {
    mesureTailleInput.addEventListener('keydown', validateNumericInput);
}

quickAddBottleBtn?.addEventListener('click', () => {
    const amount = prompt('Quantité (ml) prise ?');

    if (amount) {
        const amountMl = parseFloat(amount.replace(',', '.'));
        if (!isNaN(amountMl) && amountMl > 0) {
            const newFeed = {
                id: `feed-${Date.now()}`,
                dateISO: new Date().toISOString(),
                source: 'bottle',
                amountMl: amountMl,
                durationSec: 0
            };

            const api = getPersistenceApi();
            if (api) {
                api.saveEntry('feed', newFeed).then(() => {
                    updateState(data => ({
                        ...data,
                        feeds: [newFeed, ...data.feeds]
                    }));
                    renderHistory();
                    closeModal('#modal-leche');
                });
            }
        } else {
            alert('Veuillez entrer un nombre valide.');
        }
    }
});

renderHistory();

historyRangeBtn?.addEventListener('click', (event) => {
  event.preventDefault();
  syncRangePickerModal();
  openModal('#modal-range-picker');
});

historyRangeMenu?.addEventListener('click', (event) => {
  handleHistoryRangeMenuSelection(event.target);
});

historyRangeDateInput?.addEventListener('change', () => {
  const value = historyRangeDateInput.value;
  if(!value){
    return;
  }
  setHistoryRange('custom', { date: value });
  closeHistoryRangeMenu();
  historyRangeBtn?.focus();
});

rangePickerModal?.addEventListener('click', (e) => {
  const target = e.target.closest('.range-option-item');
  if (target) {
    const range = target.dataset.range;
    if (range) {
      setHistoryRange(range);
      closeModal('#modal-range-picker');
    }
  }
});

closeRangePickerBtn?.addEventListener('click', () => {
  closeModal('#modal-range-picker');
});

statsBtn?.addEventListener('click', () => {
  openModal('#modal-stats');
  updateStatsSummary();
  requestAnimationFrame(() => updateStatsChart(true));
});

closeStatsBtn?.addEventListener('click', () => {
  closeModal('#modal-stats');
});

let longPressTimer = null;
let longPressTarget = null;
const LONG_PRESS_DURATION = 500;

historyList?.addEventListener('pointerdown', (e) => {
  if (isDeleteMode) return;
  const item = e.target.closest('.history-item-foreground');
  if (!item) return;

  longPressTarget = item;
  longPressTimer = setTimeout(() => {
    if (longPressTarget) {
      toggleDeleteMode(true);
      const checkbox = longPressTarget.querySelector('.history-item-checkbox');
      if (checkbox) {
        checkbox.checked = true;
        longPressTarget.classList.add('is-selected');
        updateSelectionCount();
      }
    }
    longPressTimer = null;
  }, LONG_PRESS_DURATION);
});

function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  longPressTarget = null;
}

historyList?.addEventListener('pointerup', cancelLongPress);
historyList?.addEventListener('pointerleave', cancelLongPress);
historyList?.addEventListener('contextmenu', (e) => e.preventDefault()); // Evita el menú contextual

historyList?.addEventListener('click', (e) => {
  const itemContainer = e.target.closest('.history-item');
  if (longPressTimer) {
    cancelLongPress();
  }
  
  if (isDeleteMode) {
    const checkbox = itemContainer?.querySelector('.history-item-checkbox');
    if (itemContainer && checkbox && e.target !== checkbox) {
      checkbox.checked = !checkbox.checked;
      itemContainer.classList.toggle('is-selected', checkbox.checked);
      updateSelectionCount();
    } else if (e.target.classList.contains('history-item-checkbox')) {
      e.target.closest('.item')?.classList.toggle('is-selected', e.target.checked);
      updateSelectionCount();
    }
    return;
  }
  
  const editBtn = e.target.closest('.item-edit');
  if (editBtn) {
    const { type, id } = editBtn.dataset;
    if (type && id) {
      beginEditEntry(type, id);
    }
    return;
  }

  const deleteBtn = e.target.closest('.swipe-delete-btn, .item-delete');
  if (deleteBtn) {
    const { type, id } = deleteBtn.dataset;
    if (type && id) confirmAndDelete([{ type, id }]);
  }
}); 

let undoState = {
  timer: null,
  items: [],
};

function showUndoToast(items) {
  const toast = $('#undo-toast');
  const messageEl = $('#undo-message');
  const undoBtn = $('#undo-btn');

  if (undoState.timer) {
    clearTimeout(undoState.timer);
    commitDeletion(); // Commit la eliminación anterior antes de mostrar una nueva
  }

  undoState.items = items;
  messageEl.textContent = `${items.length} elemento(s) eliminado(s)`;
  toast.classList.add('show');

  undoBtn.onclick = () => executeUndo();

  undoState.timer = setTimeout(() => {
    commitDeletion();
  }, 7000); // 7 segundos para deshacer
}

function executeUndo() {
  if (undoState.timer) clearTimeout(undoState.timer);
  $('#undo-toast').classList.remove('show');

  // Restore items in the UI
  const idsToRestore = new Set(undoState.items.map(item => item.id));
  $$('.history-item.is-deleting').forEach(el => {
    const checkbox = el.querySelector('.history-item-checkbox');
    if (checkbox && idsToRestore.has(checkbox.dataset.id)) {
      el.classList.remove('is-deleting');
    }
  });

  undoState.items = [];
  undoState.timer = null;
}

function commitDeletion() {
  if (!undoState.items.length) return;
  
  const itemsToDelete = undoState.items;

  // 1. Update state
  updateState(currentData => {
    itemsToDelete.forEach(({ type, id }) => {
      const key = type + 's';
      if (currentData[key]) {
        currentData[key] = currentData[key].filter(item => String(item.id) !== String(id));
      }
    });
    return currentData;
  });

  // 2. Call persistence API
  const api = getPersistenceApi();
  api?.deleteEntries(itemsToDelete);

  // 3. Clean up
  undoState.items = [];
  if (undoState.timer) clearTimeout(undoState.timer);
  undoState.timer = null;
  $('#undo-toast').classList.remove('show');

  // 4. Re-render history to remove the items from the DOM
  renderHistory();
}

function confirmAndDelete(itemsToDelete) {
  if (!itemsToDelete || itemsToDelete.length === 0) return;

  const modal = $('#modal-confirm-delete');
  const messageEl = $('#confirm-delete-message');
  const pinInput = $('#security-pin');
  const confirmBtn = $('#confirm-delete-btn');
  const cancelBtn = $('#cancel-confirm-delete');
  const closeBtn = $('#close-confirm-delete');

  messageEl.textContent = `Voulez-vous vraiment supprimer ${itemsToDelete.length} élément(s) ?`;
  pinInput.value = '';

  const closeConfirmModal = () => closeModal('#modal-confirm-delete');

  const onConfirm = () => {
    if (pinInput.value !== '2410') {
      alert('Code de sécurité incorrect.');
      pinInput.value = '';
      pinInput.focus();
      return;
    }
    triggerVibration(100);

    // Optimistic UI: remove from view immediately
    const idsToDeleteSet = new Set(itemsToDelete.map(item => item.id));
    $$('.history-item').forEach(el => {
      const checkbox = el.querySelector('.history-item-checkbox');
      if (checkbox && idsToDeleteSet.has(checkbox.dataset.id)) {
        el.classList.add('is-deleting');
      }
    });

    // Don't update state here, just show undo toast
    showUndoToast(itemsToDelete);
    
    toggleDeleteMode(false);
    closeConfirmModal();
  }

  confirmBtn.onclick = onConfirm;
  cancelBtn.onclick = closeConfirmModal;
  closeBtn.onclick = closeConfirmModal;

  openModal('#modal-confirm-delete');
  pinInput.focus();
}

function getPersistenceApi() {
  if (!persistenceApi) {
    console.warn("Persistence API not initialized yet. Action delayed or ignored.");
    setSaveIndicator('error', 'API no lista. Intente de nuevo.');
    return null;
  }
  return persistenceApi;
}

function setSaveIndicator(status = 'idle', message){
  if(!saveIndicatorEl || !saveLabelEl) return;
  if(saveIndicatorResetTimer){
    clearTimeout(saveIndicatorResetTimer);
    saveIndicatorResetTimer = null;
  }
  saveIndicatorEl.dataset.state = status || 'idle';
  saveLabelEl.textContent = message || SAVE_MESSAGES[status] || SAVE_MESSAGES.idle;
  if(status === 'synced'){
    saveIndicatorResetTimer = setTimeout(() => {
      if(saveIndicatorEl && saveIndicatorEl.dataset.state === 'synced'){
        setSaveIndicator('idle');
      }
    }, 4000);
  }
}

function exportReports(){
  if (exportReportsBtn.classList.contains('is-loading')) return;
  exportReportsBtn.classList.add('is-loading');
  exportReportsBtn.disabled = true;
  try {
    const snapshot = cloneDataSnapshot();
    snapshot.exportedAt = new Date().toISOString();
    const json = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const pad = (val) => String(val).padStart(2, '0');
    const filename = `leo-reports-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setSaveIndicator('synced', 'Exportation réussie');
  } catch(err) {
    console.error('Export failed:', err);
    setSaveIndicator('error', "L'exportation a échoué");
  } finally {
    setTimeout(() => {
      exportReportsBtn.classList.remove('is-loading');
      exportReportsBtn.disabled = false;
    }, 1000);
  }
}

function updateMedSummary(){
  if(!summaryMedEl) return;
  const nowString = new Date().toLocaleString();
  if(!state.meds.length){
    summaryMedEl.innerHTML = `<strong>Derniere prise</strong><span>Aucun medicament enregistre</span><span>Nouvelle prise ${escapeHtml(nowString)}</span>`;
    return;
  }
  const latest = state.meds.reduce((acc, cur)=> acc && acc.dateISO > cur.dateISO ? acc : cur, state.meds[0]);
  const dateString = new Date(latest.dateISO).toLocaleString();
  const parts = [
    '<strong>Derniere prise</strong>',
    `<span>${escapeHtml(latest.name)} - ${escapeHtml(dateString)}</span>`
  ];
  if(latest.dose){
    parts.push(`<span>Dose ${escapeHtml(latest.dose)}</span>`);
  }
  if(latest.notes){
    parts.push(`<span>Note ${escapeHtml(latest.notes)}</span>`);
  }
  parts.push(`<span>Nouvelle prise ${escapeHtml(nowString)}</span>`);
  summaryMedEl.innerHTML = parts.join('');
}

function updateLeoSummary() {
  if (!leoSummaryInfoEl) return;

  const latestWeight = state.measurements
    .filter(m => m.weight != null && m.weight > 0)
    .sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1))[0];

  const latestHeight = state.measurements
    .filter(m => m.height != null && m.height > 0)
    .sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1))[0];

  const parts = [];
  if (latestWeight) parts.push(`Poids: ${latestWeight.weight} kg`);
  if (latestHeight) parts.push(`Taille: ${latestHeight.height} cm`);

  if (parts.length > 0) {
    leoSummaryInfoEl.textContent = parts.join(' · ');
  } else {
    leoSummaryInfoEl.textContent = 'Touchez pour voir les informations';
  }
}

function updateSummaries(){
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  if(summaryFeedEl){
    const todayFeeds = state.feeds.filter(f => new Date(f.dateISO).getTime() >= start);
    if(!todayFeeds.length){
      summaryFeedEl.innerHTML = "<strong>Aujourd'hui</strong><span>Aucun enregistrement</span>";
    }else{
      const breast = todayFeeds.filter(f => f.source === 'breast');
      const bottle = todayFeeds.filter(f => f.source === 'bottle');
      const breastMinutesTotal = breast.reduce((sum,f)=> sum + (f.durationSec || 0), 0) / 60;
      const breastLabel = formatMinutes(breastMinutesTotal);
      const bottleMl = bottle.reduce((sum,f)=> sum + (f.amountMl || 0), 0);
      summaryFeedEl.innerHTML = `
        <strong>Aujourd'hui</strong>
        <span>${todayFeeds.length} séances</span>
        <span>Sein ${breastLabel}</span>
        <span>Biberon ${bottleMl} ml</span>
      `;
    }
  }

  if(summaryElimEl || dashboardElimEl){
    const todayElims = state.elims.filter(e => new Date(e.dateISO).getTime() >= start);
    if(!todayElims.length){
      if(summaryElimEl) summaryElimEl.innerHTML = "<strong>Aujourd'hui</strong><span>Aucune donnée</span>";
      if(dashboardElimEl) dashboardElimEl.innerHTML = "<strong>Pipi / Caca / Vomi</strong><span>Aucune donnée aujourd'hui</span>";
    }else{
      const totals = todayElims.reduce((acc, cur)=> ({
        pee: acc.pee + (cur.pee || 0),
        poop: acc.poop + (cur.poop || 0),
        vomit: acc.vomit + (cur.vomit || 0)
      }), {pee:0, poop:0, vomit:0});
      const last = todayElims[0];
      const time = new Date(last.dateISO).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      if(summaryElimEl){
        summaryElimEl.innerHTML = `
          <strong>Aujourd'hui</strong>
          <span>Pipi ${totals.pee}</span>
          <span>Caca ${totals.poop}</span>
          <span>Vomi ${totals.vomit}</span>
          <span>${todayElims.length} entrées</span>
        `;
      }
      if(dashboardElimEl){
        dashboardElimEl.innerHTML = `
          <strong>Pipi / Caca / Vomi</strong>
          <span>P ${totals.pee}</span>
          <span>C ${totals.poop}</span>
          <span>V ${totals.vomit}</span>
          <span>Dernier ${time}</span>
        `;
      }
    }
  }
  updateMedSummary();
  updateLeoSummary();
}

function renderElimHistory(){
  const list = $('#elim-history-today');
  if(!list) return;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todays = state.elims
    .filter(e => new Date(e.dateISO).getTime() >= start)
    .sort((a,b)=> a.dateISO < b.dateISO ? 1 : -1);

  list.innerHTML = '';
  if(!todays.length){
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = "Aucune donnée aujourd'hui";
    list.appendChild(empty);
    return;
  }

  for(const elim of todays){
    const time = new Date(elim.dateISO).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const item = document.createElement('div');
    item.className = 'item';
    item.textContent = `🚼 ${time} — P:${elim.pee} · C:${elim.poop} · V:${elim.vomit}`;
    list.appendChild(item);
  }
}

function renderFeedHistory(){
  const container = $('#feed-history');
  if(!container) return;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todaysFeeds = state.feeds
    .filter(f => new Date(f.dateISO).getTime() >= start)
    .sort((a,b)=> a.dateISO < b.dateISO ? 1 : -1);

  container.innerHTML = '';
  if(!todaysFeeds.length){
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = "Aucun enregistrement aujourd'hui";
    container.appendChild(empty);
    return;
  }

  todaysFeeds.forEach(feed => {
    const div = document.createElement('div');
    div.className = 'item';
    const time = new Date(feed.dateISO).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    let line = '';
    if(feed.source === 'breast'){
      const minsLabel = formatMinutes((feed.durationSec || 0)/60);
      line = `🍼 ${escapeHtml(time)} — Sein (${escapeHtml(feed.breastSide || '')}) · ${minsLabel}`;
    }else{
      const ml = Number(feed.amountMl || 0);
      line = `🍼 ${escapeHtml(time)} — Biberon · ${ml} ml`;
    }
    let html = `<div class="feed-history-line">${line}</div>`;
    if(feed.notes){
      html += `<div class="item-note">${escapeHtml(feed.notes)}</div>`;
    }
    div.innerHTML = html;
    container.appendChild(div);
  });
}

// ===== Modal helpers =====
function openModal(id){
  const modal = $(id);
  if(!modal) return;
  modal.__prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.removeAttribute('inert');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
  focusFirstElement(modal);
}

function closeModal(id){
  const modal = $(id);
  if(!modal) return;
  const active = document.activeElement;
  if(active && modal.contains(active) && typeof active.blur === 'function'){
    active.blur();
  }
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
  modal.setAttribute('inert','');
  if ($$('.modal.open').length === 0) {
    document.body.classList.remove('modal-open');
  }
  const prev = modal.__prevFocus;
  if(prev && typeof prev.focus === 'function'){
    prev.focus({preventScroll:true});
  }else if(document.body){
    if(!document.body.hasAttribute('tabindex')) document.body.setAttribute('tabindex','-1');
    document.body.focus({preventScroll:true});
  }
  modal.__prevFocus = null;
}

function closeAllModals(){
  const openModals = $$('.modal.open');
  openModals.forEach(modal => {
    if(modal.id){
      closeModal(`#${modal.id}`);
    }
  });
}

// ===== Leche modal logic =====
let feedMode = 'breast';
let breastSide = 'Gauche';

function updateChrono(){
  const h = String(Math.floor(timer / 3600)).padStart(2, '0');
  const m = String(Math.floor((timer % 3600) / 60)).padStart(2, '0');
  const s = String(timer % 60).padStart(2, '0');
  const chrono = $('#chrono');
  if(chrono){
    chrono.textContent = `${h}:${m}:${s}`;
  }
}
updateChrono();

function updateBottleChrono(){
  if(!bottleChrono) return;
  const h = String(Math.floor(bottleTimer / 3600)).padStart(2, '0');
  const m = String(Math.floor((bottleTimer % 3600) / 60)).padStart(2, '0');
  const s = String(bottleTimer % 60).padStart(2, '0');
  bottleChrono.textContent = `${h}:${m}:${s}`;
}
updateBottleChrono();

function showBottlePrompt(){
  bottleForm.classList.add('is-visible');
}

function hideBottlePrompt({ clearValue = false } = {}){
  if(bottleForm){
    bottleForm.classList.remove('is-visible');
  }
  if(clearValue && bottleAmountInput){
    bottleAmountInput.value = '';
  }
}
hideBottlePrompt();

function tickBottleTimer(){
  if(!bottleTimerStart) return;
  bottleTimer = Math.max(0, Math.floor((Date.now() - bottleTimerStart) / 1000));
  updateBottleChrono();
}

function beginBottleTimer(startTimestamp = Date.now(), persist = true){
  hideBottlePrompt();
  bottleTimerStart = startTimestamp;
  if(bottleTimerInterval){
    clearInterval(bottleTimerInterval);
  }
  if(persist){
    triggerVibration();
  }
  bottleTimer = Math.max(0, Math.floor((Date.now() - bottleTimerStart) / 1000));
  updateBottleChrono();
  bottleTimerInterval = setInterval(tickBottleTimer, 1000);
  const label = new Date(bottleTimerStart).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  bottleStartTimeDisplay && (bottleStartTimeDisplay.textContent = `Commencé à ${label}`);
  startStopBottleBtn && (startStopBottleBtn.textContent = 'Stop');
  bottlePendingDuration = 0;
  store.remove(BOTTLE_PENDING_KEY);
  if(persist){
    store.set(BOTTLE_TIMER_KEY, { start: bottleTimerStart });
  }
}

function stopBottleTimerWithoutSaving({ resetDisplay = true } = {}){
  if(bottleTimerInterval){
    triggerVibration();
    clearInterval(bottleTimerInterval);
    bottleTimerInterval = null;
  }
  bottleTimerStart = null;
  store.remove(BOTTLE_TIMER_KEY);
  startStopBottleBtn && (startStopBottleBtn.textContent = 'Démarrer');
  if(resetDisplay){
    bottleStartTimeDisplay && (bottleStartTimeDisplay.textContent = '');
    bottleTimer = 0;
    updateBottleChrono();
  }
}

function setFeedMode(mode){
  feedMode = mode;
  const pecho = $('#seg-pecho');
  const biberon = $('#seg-biberon');
  pecho?.classList?.toggle('active', mode === 'breast');
  biberon?.classList?.toggle('active', mode === 'bottle');
  panePecho?.classList?.toggle('is-hidden', mode !== 'breast');
  paneBiberon?.classList?.toggle('is-hidden', mode !== 'bottle');
}

function setBreastSide(side){
  breastSide = side;
  $('#side-left')?.classList?.toggle('active', side === 'Gauche');
  $('#side-right')?.classList?.toggle('active', side === 'Droite');
  $('#side-both')?.classList?.toggle('active', side === 'Les deux');
  if(timerStart){
    store.set(TIMER_KEY, { start: timerStart, breastSide });
  }
}

function tickTimer(){
  if(!timerStart) return;
  timer = Math.max(0, Math.floor((Date.now() - timerStart) / 1000));
  updateChrono();
}

function beginTimer(startTimestamp = Date.now(), persist = true){
  timerStart = startTimestamp;
  timerInterval && clearInterval(timerInterval);
  timerInterval = setInterval(tickTimer, 1000);
  tickTimer();
  const label = new Date(timerStart).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  startTimeDisplay && (startTimeDisplay.textContent = `Commencé à ${label}`);
  startStopBtn && (startStopBtn.textContent = 'Stop');
  if(persist){
    store.set(TIMER_KEY, { start: timerStart, breastSide });
  }
}

function stopTimerWithoutSaving(){
  if(timerInterval){
    triggerVibration();
  clearInterval(timerInterval);
    timerInterval = null;
  }
  timerStart = null;
  store.remove(TIMER_KEY);
  startStopBtn && (startStopBtn.textContent = 'Démarrer');
  startTimeDisplay && (startTimeDisplay.textContent = '');
  timer = 0;
  updateChrono();
}

async function saveFeed(entry){
  updateState(currentData => {
    currentData.feeds.push(entry);
    return currentData;
  });
  renderHistory();
  closeModal('#modal-leche');
  const api = getPersistenceApi();
  try{
    if(api?.saveEntry){
      await api.saveEntry('feed', entry, 'Save feed entry');
    }
  }catch(err){
    console.error('Failed to save feed entry to persistence:', err);
  }
}

$('#btn-leche')?.addEventListener('click', ()=> openModal('#modal-leche'));
$('#close-leche')?.addEventListener('click', ()=> closeModal('#modal-leche'));

$('#seg-pecho')?.addEventListener('click', ()=> setFeedMode('breast'));
$('#seg-biberon')?.addEventListener('click', ()=> setFeedMode('bottle'));

$('#side-left')?.addEventListener('click', ()=> setBreastSide('Gauche'));
$('#side-right')?.addEventListener('click', ()=> setBreastSide('Droite'));
$('#side-both')?.addEventListener('click', ()=> setBreastSide('Les deux'));

startStopBtn?.addEventListener('click', async () => {
  if(timerInterval){
    const elapsed = Math.max(1, Math.floor((Date.now() - timerStart) / 1000));
    stopTimerWithoutSaving();
    const entry = {
      id: Date.now()+'',
      dateISO: new Date().toISOString(),
      source: 'breast',
      breastSide,
      durationSec: elapsed
    };
    await saveFeed(entry);
  }else{
    setFeedMode('breast');
    beginTimer(Date.now(), true);
  }
});

startStopBottleBtn?.addEventListener('click', () => {
  if(bottleTimerInterval){
    const start = bottleTimerStart || Date.now();
    const elapsed = Math.max(1, Math.floor((Date.now() - start) / 1000));
    stopBottleTimerWithoutSaving({ resetDisplay: false });
    bottleTimer = elapsed;
    updateBottleChrono();
    if(bottleStartTimeDisplay){
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      bottleStartTimeDisplay.textContent = `Durée : ${h}:${m}:${s}`;
    }
    bottlePendingDuration = elapsed;
    store.set(BOTTLE_PENDING_KEY, bottlePendingDuration);
    const defaultPromptValue = (bottleAmountInput?.value?.trim() || (bottlePendingAmount != null ? String(bottlePendingAmount) : '') || '');
    const promptValue = window.prompt('Quantité (ml) prise ?', defaultPromptValue);
    if(promptValue !== null){
      const normalized = promptValue.replace(',', '.').trim();
      if(normalized === ''){
        bottlePendingAmount = null;
        store.remove(BOTTLE_AMOUNT_KEY);
      }else{
        const parsed = parseFloat(normalized);
        if(Number.isFinite(parsed) && parsed > 0){
          bottlePendingAmount = parsed;
          store.set(BOTTLE_AMOUNT_KEY, bottlePendingAmount);
        }else{
          alert('Veuillez saisir une quantité valide en ml.');
          bottlePendingAmount = null;
          store.remove(BOTTLE_AMOUNT_KEY);
        }
      }
    }
    showBottlePrompt();
    if (saveBottleBtn) {
        saveBottleBtn.classList.add('save-biberon');
        setTimeout(() => {
            saveBottleBtn.classList.remove('save-biberon');
        }, 2000);
    }
    if(bottleAmountInput){
      bottleAmountInput.value = bottlePendingAmount != null ? String(bottlePendingAmount) : '';
      bottleAmountInput.placeholder = 'ej. 120';
      bottleAmountInput.focus({ preventScroll: false });
    }
  }else{
    bottlePendingAmount = null;
    store.remove(BOTTLE_AMOUNT_KEY);
    if(bottleAmountInput){
      bottleAmountInput.value = '';
    }
    setFeedMode('bottle');
    beginBottleTimer(Date.now(), true);
  }
});

saveBottleBtn?.addEventListener('click', async () => {
  triggerVibration();
  saveBottleBtn.classList.add('save-biberon');
  setTimeout(() => {
    saveBottleBtn.classList.remove('save-biberon');
  }, 1000);

  const rawValue = bottleAmountInput?.value ?? '';
  const normalizedValue = rawValue.replace(',', '.').trim();
  const amount = parseFloat(normalizedValue);
  if(!Number.isFinite(amount) || amount <= 0){
    alert('Veuillez saisir une quantité valide en ml.');
    bottleAmountInput?.focus({ preventScroll: false });
    return;
  }

  bottlePendingAmount = amount;
  store.set(BOTTLE_AMOUNT_KEY, bottlePendingAmount);

  const entry = {
    id: Date.now()+'',
    dateISO: new Date().toISOString(),
    source: 'bottle',
    amountMl: bottlePendingAmount,
    durationSec: bottlePendingDuration > 0 ? bottlePendingDuration : undefined
  };

  await saveFeed(entry);

  bottlePendingDuration = 0;
  store.remove(BOTTLE_PENDING_KEY);
  bottlePendingAmount = null;
  store.remove(BOTTLE_AMOUNT_KEY);
  hideBottlePrompt({ clearValue: true });
  stopBottleTimerWithoutSaving();
});

setFeedMode('breast');
setBreastSide(breastSide);
const savedTimer = store.get(TIMER_KEY, null);
if(savedTimer && savedTimer.start){
  setFeedMode('breast');
  if(savedTimer.breastSide) setBreastSide(savedTimer.breastSide);
  beginTimer(savedTimer.start, false);
}
const savedBottleTimer = store.get(BOTTLE_TIMER_KEY, null);
if(savedBottleTimer && savedBottleTimer.start){
  setFeedMode('bottle');
  beginBottleTimer(savedBottleTimer.start, false);
}
if(bottlePendingDuration > 0){
  setFeedMode('bottle');
  showBottlePrompt();
  bottleTimer = bottlePendingDuration;
  updateBottleChrono();
  if(bottleStartTimeDisplay){
    const h = String(Math.floor(bottlePendingDuration / 3600)).padStart(2, '0');
    const m = String(Math.floor((bottlePendingDuration % 3600) / 60)).padStart(2, '0');
    const s = String(bottlePendingDuration % 60).padStart(2, '0');
    bottleStartTimeDisplay.textContent = `Durée : ${h}:${m}:${s}`;
  }
  startStopBottleBtn && (startStopBottleBtn.textContent = 'Démarrer');
  if(bottleAmountInput){
    bottleAmountInput.value = bottlePendingAmount != null ? String(bottlePendingAmount) : '';
    bottleAmountInput.placeholder = 'ej. 120';
    bottleAmountInput.focus({ preventScroll: false });
  }
}

// ===== Eliminations modal logic =====
btnElim?.addEventListener('click', ()=>{ renderElimHistory(); openModal('#modal-elim'); });
$('#close-elim')?.addEventListener('click', ()=> closeModal('#modal-elim'));
$('#cancel-elim')?.addEventListener('click', ()=> closeModal('#modal-elim'));

const scales = { pee:0, poop:0, vomit:0 };

function renderScale(root){
  root.innerHTML = '';
  const key = root.dataset.scale;
  for(let n=0; n<=3; n++){
    const btn = document.createElement('button');
    btn.textContent = n;
    if(scales[key] === n) btn.classList.add('active');
    btn.addEventListener('click', ()=>{ scales[key] = n; renderScale(root); });
    root.appendChild(btn);
  }
}
$$('.scale').forEach(renderScale);

$('#save-elim')?.addEventListener('click', ()=>{
  triggerVibration();
  updateState(currentData => {
    currentData.elims.push({
      id: Date.now()+'',
      dateISO: new Date().toISOString(),
      pee: scales.pee,
      poop: scales.poop,
      vomit: scales.vomit
    });
    return currentData;
  });
  const api = getPersistenceApi();
  api?.saveEntry?.('elim', { id: Date.now()+'', dateISO: new Date().toISOString(), ...scales }, 'Add elimination entry');
  closeModal('#modal-elim');
  renderHistory();
});

// ===== Medications modal logic =====
function setupMedicationModal(){
  const medsBtn = $('#btn-med');
  const medSelect = $('#medication-select');
  const medOtherField = $('#medication-other-field');
  const medOtherInput = $('#medication-other');
  const closeMedBtn = $('#close-med');
  const cancelMedBtn = $('#cancel-med');
  const saveMedBtn = $('#save-med');

  if(!medsBtn && !medSelect){
    return;
  }

  const updateMedOtherField = () => {
    const isOther = medSelect?.value === 'other';
    medOtherField?.classList?.toggle('is-hidden', !isOther);
    if(!isOther && medOtherInput){
      medOtherInput.value = '';
    }
  };

  const resetMedForm = () => {
    if(medSelect) medSelect.value = 'ibufrone';
    updateMedOtherField();
    if(medOtherInput) medOtherInput.value = '';
  };

  const closeMedModal = () => closeModal('#modal-med');

  const saveMedication = () => { triggerVibration();
    if(!medSelect) return;
    const selection = medSelect.value || 'ibufrone';
    const labels = {
      ibufrone: 'Ibufrone',
      dalfalgan: 'Dalfalgan'
    };
    let name = labels[selection] || selection;
    if(selection === 'other'){
      name = (medOtherInput?.value || '').trim();
      if(!name){
        alert('Veuillez indiquer le nom du medicament.');
        medOtherInput?.focus();
        return;
      }
    }
    const entry = {
      id: Date.now()+'',
      dateISO: new Date().toISOString(),
      name,
      medKey: selection
    };
    updateState(currentData => {
      currentData.meds.push(entry);
      return currentData;
    });
    updateMedSummary();
    try {
      const api = getPersistenceApi();
      api?.saveEntry?.('med', entry, 'Add medication entry');
    } catch (error) {
      console.warn('Medication persistence failed:', error);
    }
    renderHistory();
    closeMedModal();
  };

  const openMedModal = () => {
    resetMedForm();
    updateMedSummary();
    openModal('#modal-med');
  };

  medsBtn?.addEventListener('click', openMedModal);
  closeMedBtn?.addEventListener('click', closeMedModal);
  cancelMedBtn?.addEventListener('click', closeMedModal);
  saveMedBtn?.addEventListener('click', saveMedication);
  medSelect?.addEventListener('change', updateMedOtherField);
  updateMedOtherField();
}

setupMedicationModal();

// ===== Mesures modal logic =====
const mesuresBtn = $('#btn-mesures');
const mesuresModal = $('#modal-mesures');
const closeMesuresBtn = $('#close-mesures');
const cancelMesuresBtn = $('#cancel-mesures');
const saveMesuresBtn = $('#save-mesures');
const tempInput = $('#mesure-temp');
const poidsInput = $('#mesure-poids');
const tailleInput = $('#mesure-taille');

function resetMesuresForm() {
  if (tempInput) tempInput.value = '';
  if (poidsInput) poidsInput.value = '';
  if (tailleInput) tailleInput.value = '';
}

function saveMesures() {
    triggerVibration();
  const temp = tempInput.value ? parseFloat(tempInput.value) : null;
  const weight = poidsInput.value ? parseFloat(poidsInput.value) : null;
  const height = tailleInput.value ? parseFloat(tailleInput.value) : null;

  if (temp === null && weight === null && height === null) {
    alert("Veuillez entrer au moins une mesure.");
    return;
  }

  const entry = { id: Date.now() + '', dateISO: new Date().toISOString() };
  if (temp !== null) entry.temp = temp;
  if (weight !== null) entry.weight = weight;
  if (height !== null) entry.height = height;

  updateState(currentData => {
    currentData.measurements.push(entry);
    return currentData;
  });
  const api = getPersistenceApi();
  api?.saveEntry?.('measurement', entry, 'Add measurement entry');
  closeModal('#modal-mesures');
  renderHistory();
}

mesuresBtn?.addEventListener('click', () => {
  resetMesuresForm();
  openModal('#modal-mesures');
});
closeMesuresBtn?.addEventListener('click', () => closeModal('#modal-mesures'));
cancelMesuresBtn?.addEventListener('click', () => closeModal('#modal-mesures'));
saveMesuresBtn?.addEventListener('click', saveMesures);

// ===== Avatar & info actions =====
if(bgPicker){
  bgPicker.addEventListener('change', handleBackgroundChange);
}

if(avatarBtn){
  avatarBtn.addEventListener('click', ()=>{
    bgPicker?.click();
  });
}

function showProfile(){
  alert('Profil de Léo:\n• Naissance: 27/10/25 16:13\n• Poids de naissance: 3800 gr');
}

infoBtn?.addEventListener('click', showProfile);
infoChevron?.addEventListener('click', showProfile);

function handleBackgroundChange(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file) return;

  if (firebaseInitialized && firebaseStorageInstance && firebaseStorageFns) {
    const { createRef, uploadBytes, getDownloadURL } = firebaseStorageFns;
    const avatarRef = createRef(firebaseStorageInstance, "backgrounds/leo-main-avatar.jpg");

    setSaveIndicator('saving', 'Chargement de la photo...');

    uploadBytes(avatarRef, file)
      .then(() => getDownloadURL(avatarRef))
      .then(downloadURL => {
        console.log('Image uploaded to Firebase, URL:', downloadURL);
        setSaveIndicator('synced', 'Photo sauvegardée !');
        return setHeroImage(downloadURL);
      })
      .then(ok => {
        if (ok) {
          saveHeroMeta({ index: 0, lastSwitch: Date.now() });
          startHeroRotation();
        }
      })
      .catch(error => {
        console.error("Error uploading to Firebase Storage:", error);
        setSaveIndicator('error', 'Erreur de chargement');
      });
  } else {
    console.warn("Firebase Storage not available. Image will not be saved to the cloud.");
    setSaveIndicator('error', 'Stockage cloud indisponible');
  }

  input.value = ''; // Limpiar el input para poder seleccionar el mismo archivo de nuevo
}

// ===== Manual entry =====
function formatDateInput(date){
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0,16);
}

function clamp(value, min, max){
  return Math.min(max, Math.max(min, value));
}

function setManualType(type){
  manualType = type;
  manualTypeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));
  manualFeedFields?.classList?.toggle('is-hidden', type !== 'feed');
  manualElimFields?.classList?.toggle('is-hidden', type !== 'elim');
  manualMedFields?.classList?.toggle('is-hidden', type !== 'med');
  manualMesuresFields?.classList?.toggle('is-hidden', type !== 'measurement');
  if(type === 'feed') updateManualSourceFields();
  if(type === 'med') updateManualMedFields();
}

function updateManualSourceFields(){
  const source = manualSource?.value || 'breast';
  const isBreast = source === 'breast';
  manualBreastField?.classList?.toggle('is-hidden', !isBreast);
  manualDurationField?.classList?.toggle('is-hidden', !isBreast);
  manualAmountField?.classList?.toggle('is-hidden', isBreast);
}

function updateManualMedFields(){
  const isOther = manualMedSelect?.value === 'other';
  manualMedOtherField?.classList?.toggle('is-hidden', !isOther);
  if(!isOther && manualMedOtherInput){
    manualMedOtherInput.value = '';
  }
  if(isOther){
    requestAnimationFrame(() => manualMedOtherInput?.focus());
  }
}

function getListByType(type){
  if(type === 'feed') return state.feeds;
  if(type === 'elim') return state.elims;
  if(type === 'med') return state.meds;
  if(type === 'measurement') return state.measurements;
  return null;
}

function findEntryById(type, id){
  const list = getListByType(type);
  if(!list) return null;
  return list.find(item => item && String(item.id) === String(id)) || null;
}

function replaceEntryInList(type, entry){
  const list = getListByType(type); // This is a copy from state
  if(!list) return false;
  const idx = list.findIndex(item => item && item.id === entry.id);
  if(idx !== -1){
    list[idx] = entry;
    return true;
  }
  return false;
}

function setManualMode(isEdit){
  manualTypeButtons.forEach(btn => {
    if(btn){
      btn.disabled = isEdit;
      btn.classList.toggle('is-disabled', isEdit);
    }
  });
  if(saveManualBtn){
    saveManualBtn.textContent = isEdit ? 'Mettre à jour' : 'Enregistrer';
  }
  const titleNode = manualTitle || manualModal?.querySelector('h2');
  if(titleNode){
    titleNode.textContent = isEdit ? 'Modifier un enregistrement' : 'Nouvel enregistrement';
  }
  manualModal?.classList?.toggle('is-editing', isEdit);
}

function resetManualFields(){
  if(manualSource) manualSource.value = 'breast';
  updateManualSourceFields();
  if(manualBreast) manualBreast.value = 'Gauche';
  if(manualDuration) manualDuration.value = '';
  if(manualAmount) manualAmount.value = '';
  if(manualNotes) manualNotes.value = '';
  if(manualPee) manualPee.value = 0;
  if(manualPoop) manualPoop.value = 0;
  if(manualVomit) manualVomit.value = 0;
  if(manualElimNotes) manualElimNotes.value = '';
  if(manualMedSelect) manualMedSelect.value = 'ibufrone';
  if(manualMedOtherInput) manualMedOtherInput.value = '';
  if(manualMedDose) manualMedDose.value = '';
  if(manualMedNotes) manualMedNotes.value = '';
  if(manualMesureTemp) manualMesureTemp.value = '';
  if(manualMesurePoids) manualMesurePoids.value = '';
  if(manualMesureTaille) manualMesureTaille.value = '';
  updateManualMedFields();
  if(manualDatetime) manualDatetime.value = formatDateInput(new Date());
}

function populateManualForm(type, entry){
  if(!entry) return;
  if(manualDatetime && entry.dateISO){
    manualDatetime.value = formatDateInput(new Date(entry.dateISO));
  }
  if(type === 'feed'){
    const source = entry.source === 'bottle' ? 'bottle' : 'breast';
    if(manualSource){
      manualSource.value = source;
    }
    updateManualSourceFields();
    if(source === 'breast'){
      if(manualBreast) manualBreast.value = entry.breastSide || 'Gauche';
      if(manualDuration) manualDuration.value = Math.round((entry.durationSec || 0) / 60);
      if(manualAmount) manualAmount.value = '';
    }else{
      if(manualAmount) manualAmount.value = entry.amountMl != null ? entry.amountMl : '';
      if(manualDuration) manualDuration.value = '';
    }
    if(manualNotes) manualNotes.value = entry.notes || '';
  }else if(type === 'elim'){
    if(manualPee) manualPee.value = clamp(Number(entry.pee ?? 0), 0, 3);
    if(manualPoop) manualPoop.value = clamp(Number(entry.poop ?? 0), 0, 3);
    if(manualVomit) manualVomit.value = clamp(Number(entry.vomit ?? 0), 0, 3);
    if(manualElimNotes) manualElimNotes.value = entry.notes || '';
  }else if(type === 'med'){
    let selection = entry.medKey || 'other';
    const allowed = new Set(['ibufrone','dalfalgan','other']);
    if(!allowed.has(selection)){
      selection = 'other';
    }
    if(manualMedSelect){
      manualMedSelect.value = selection;
    }
    updateManualMedFields();
    if(selection === 'other'){
      if(manualMedOtherInput) manualMedOtherInput.value = entry.name || '';
    }else if(manualMedOtherInput){
      manualMedOtherInput.value = '';
    }
    if(selection !== 'other' && !entry.name){
      const labels = {ibufrone:'Ibufrone', dalfalgan:'Dalfalgan'};
      entry.name = labels[selection];
    }
    if(manualMedDose) manualMedDose.value = entry.dose || '';
    if(manualMedNotes) manualMedNotes.value = entry.notes || '';
  }else if(type === 'measurement'){
    if(manualMesureTemp) manualMesureTemp.value = entry.temp ?? '';
    if(manualMesurePoids) manualMesurePoids.value = entry.weight ?? '';
    if(manualMesureTaille) manualMesureTaille.value = entry.height ?? '';
  }
}

function openManualModal({mode='create', type='feed', entry=null} = {}){
  const isEdit = mode === 'edit' && entry;
  editingEntry = isEdit ? {type, id: entry.id} : null;
  setManualMode(isEdit);
  resetManualFields();
  const effectiveType = isEdit && entry ? type : 'feed';
  setManualType(effectiveType);
  if(isEdit && entry){
    populateManualForm(type, entry);
  }
  if(!isEdit && manualDatetime){
    manualDatetime.value = formatDateInput(new Date());
  }
  openModal('#modal-manual');
}
function closeManualModal(){
  setManualMode(false);
  editingEntry = null;
  setManualType('feed');
  resetManualFields();
  closeModal('#modal-manual');

}

const DEFAULT_FIRESTORE_DOC_ID = 'family-shared';
const DOC_STORAGE_KEY = 'lo.sharedDocId';

function resolveSharedDocumentId() {
  try {
    const url = new URL(window.location.href);
    const queryDoc = url.searchParams.get('doc') || url.searchParams.get('docId');
    if (queryDoc) {
      localStorage.setItem(DOC_STORAGE_KEY, queryDoc);
      return queryDoc;
    }
    const stored = localStorage.getItem(DOC_STORAGE_KEY);
    if (stored) {
      return stored;
    }
  } catch (error) {
    console.warn('Could not resolve shared Firestore document id:', error);
  }
  return DEFAULT_FIRESTORE_DOC_ID;
}

let firebaseInitialized = false;
let firebaseDocId;
let firebaseDbInstance;
let firebaseStorageInstance;
let firebaseStorageFns;
// let firebaseReportsApi = null; // This seems unused with persistenceApi
let persistenceApi = null;


function beginEditEntry(type, id){
  const existing = findEntryById(type, id);
  if(!existing){
    console.warn('Entry not found for editing', type, id);
    return;
  }
  const copy = JSON.parse(JSON.stringify(existing));
  openManualModal({mode:'edit', type, entry: copy});

}



function saveManualEntry() {



    triggerVibration();
  triggerVibration();
  const isEdit = Boolean(editingEntry);
  const targetType = isEdit && editingEntry ? editingEntry.type : manualType;
  let date = manualDatetime && manualDatetime.value ? new Date(manualDatetime.value) : new Date();
  if(Number.isNaN(date.getTime())) date = new Date();
  let reason = null;
  let entry = null;

  updateState(currentData => {
    if (targetType === 'feed') {
      const sourceValue = (manualSource?.value || 'breast') === 'bottle' ? 'bottle' : 'breast';
      entry = { id: isEdit ? editingEntry.id : Date.now()+'', dateISO: date.toISOString(), source: sourceValue };
      if (sourceValue === 'breast') {
        const mins = Math.max(0, Number(manualDuration?.value || 0));
        entry.durationSec = Math.round(mins * 60);
        entry.breastSide = manualBreast?.value || 'Gauche';
      } else {
        entry.amountMl = Math.max(0, Number(manualAmount?.value || 0));
      }
      const notes = manualNotes?.value?.trim();
      if (notes) entry.notes = notes;

      if (isEdit) {
        const idx = currentData.feeds.findIndex(item => String(item.id) === String(entry.id));
        if (idx > -1) currentData.feeds[idx] = entry; else currentData.feeds.push(entry);
        reason = `Edit feed entry ${entry.id}`;
      } else {
        currentData.feeds.push(entry);
        reason = 'Manual feed entry';
      }
    } else if (targetType === 'elim') {
      entry = {
        id: isEdit ? editingEntry.id : Date.now()+'',
        dateISO: date.toISOString(),
        pee: clamp(Number(manualPee?.value || 0), 0, 3),
        poop: clamp(Number(manualPoop?.value || 0), 0, 3),
        vomit: clamp(Number(manualVomit?.value || 0), 0, 3)
      };
      const notes = manualElimNotes?.value?.trim();
      if (notes) entry.notes = notes;

      if (isEdit) {
        const idx = currentData.elims.findIndex(item => String(item.id) === String(entry.id));
        if (idx > -1) currentData.elims[idx] = entry; else currentData.elims.push(entry);
        reason = `Edit elimination entry ${entry.id}`;
      } else {
        currentData.elims.push(entry);
        reason = 'Manual elimination entry';
      }
    } else if (targetType === 'med') {
    let selection = manualMedSelect?.value || 'ibufrone';
    const labels = {ibufrone:'Ibufrone', dalfalgan:'Dalfalgan', other:''};
    if(!labels[selection]) selection = 'other';
    let name = labels[selection] || selection;
    if(selection === 'other'){
      name = (manualMedOtherInput?.value || '').trim();
      if(!name){
        alert('Veuillez indiquer le nom du medicament.');
        manualMedOtherInput?.focus();
        throw new Error("Medication name required"); // Throw to stop execution
      }
    }
    const dose = (manualMedDose?.value || '').trim();
    const notes = (manualMedNotes?.value || '').trim();
    entry = { id: isEdit ? editingEntry.id : Date.now()+'', dateISO: date.toISOString(), name, medKey: selection };
    if (dose) entry.dose = dose;
    if (notes) entry.notes = notes;

      if (isEdit) {
        const idx = currentData.meds.findIndex(item => String(item.id) === String(entry.id));
        if (idx > -1) currentData.meds[idx] = entry; else currentData.meds.push(entry);
        reason = `Edit medication entry ${entry.id}`;
      } else {
        currentData.meds.push(entry);
        reason = 'Manual medication entry';
      }
    } else if (targetType === 'measurement') {
      const temp = manualMesureTemp.value ? parseFloat(manualMesureTemp.value) : null;
      const weight = manualMesurePoids.value ? parseFloat(manualMesurePoids.value) : null;
      const height = manualMesureTaille.value ? parseFloat(manualMesureTaille.value) : null;

      if (temp === null && weight === null && height === null) {
        alert("Veuillez entrer au moins une mesure.");
        throw new Error("At least one measurement is required");
      }

      entry = { id: isEdit ? editingEntry.id : Date.now() + '', dateISO: date.toISOString() };
      if (temp !== null) entry.temp = temp;
      if (weight !== null) entry.weight = weight;
      if (height !== null) entry.height = height;

      if (isEdit) {
        const idx = currentData.measurements.findIndex(item => String(item.id) === String(entry.id));
        if (idx > -1) currentData.measurements[idx] = entry; else currentData.measurements.push(entry);
        reason = `Edit measurement entry ${entry.id}`;
      } else {
        currentData.measurements.push(entry);
        reason = 'Manual measurement entry';
      }
    }
    return currentData;
  });

  if(reason && entry){
    const api = getPersistenceApi();
    api?.saveEntry?.(targetType, entry, reason);
  }
  closeManualModal();
  renderHistory();
}


async function initFirebaseSync() {
  const { db: firebaseDb, auth: firebaseAuth, ensureAuth } = await import('./firebase.js');
  firebaseDbInstance = firebaseDb;
  if (!firebaseDbInstance || !firebaseDocId) {
    console.warn("Firebase dependencies not ready.");
    setSaveIndicator('error', 'Dependencias no listas.');
    return;
  }

  // Asegurarse de que la autenticación anónima se complete antes de continuar.
  try {
    await ensureAuth();
  } catch (authError) {
    console.error("Firebase authentication failed:", authError);
    setSaveIndicator('error', 'Error de autenticación.');
    return; // Detener si la autenticación falla.
  }

  try {
  // pass auth so persistence can set owner on initial document
  persistenceApi.init(firebaseDbInstance, firebaseDocId, firebaseAuth);
    firebaseInitialized = true;

    // Esperamos a que lleguen los primeros datos y los renderizamos.
    const initialData = await persistenceApi.connect();
    console.log(`Firebase sync connected for document ${firebaseDocId}. Initial data received.`);
    // Debug: log counts & sample ids so we can compare what's in Firestore vs what's rendered
    try {
      const counts = {
        feeds: Array.isArray(initialData.feeds) ? initialData.feeds.length : 0,
        elims: Array.isArray(initialData.elims) ? initialData.elims.length : 0,
        meds: Array.isArray(initialData.meds) ? initialData.meds.length : 0,
        measurements: Array.isArray(initialData.measurements) ? initialData.measurements.length : 0
      };
      const sample = {
        feeds: (initialData.feeds || []).slice(0,5).map(i => i && i.id).filter(Boolean),
        elims: (initialData.elims || []).slice(0,5).map(i => i && i.id).filter(Boolean),
        meds: (initialData.meds || []).slice(0,5).map(i => i && i.id).filter(Boolean),
        measurements: (initialData.measurements || []).slice(0,5).map(i => i && i.id).filter(Boolean)
      };
      console.info('Initial snapshot summary:', counts, sample);
    } catch (e) {
      console.debug('Could not summarize initialData', e);
    }
    replaceDataFromSnapshot(initialData, { skipRender: false });

    persistenceApi.on((event, payload) => {
      // Ahora, cualquier 'data-changed' se trata como la fuente de la verdad.
      // La lógica de fusión compleja ya no es necesaria en el cliente.
      if (event === 'data-changed') {
        replaceDataFromSnapshot(payload.snapshot, { skipRender: false });
      } else if (event === 'server-raw') {
        // Debug: server gave us a raw document; log a compact summary so developer can compare
        try {
          const raw = payload && payload.raw ? payload.raw : null;
          if (raw) {
            const rawCounts = {
              feeds: Array.isArray(raw.snapshot ? raw.snapshot.feeds : raw.feeds) ? (raw.snapshot ? raw.snapshot.feeds.length : raw.feeds.length) : 0,
              elims: Array.isArray(raw.snapshot ? raw.snapshot.elims : raw.elims) ? (raw.snapshot ? raw.snapshot.elims.length : raw.elims.length) : 0,
              meds: Array.isArray(raw.snapshot ? raw.snapshot.meds : raw.meds) ? (raw.snapshot ? raw.snapshot.meds.length : raw.meds.length) : 0,
              measurements: Array.isArray(raw.snapshot ? raw.snapshot.measurements : raw.measurements) ? (raw.snapshot ? raw.snapshot.measurements.length : raw.measurements.length) : 0
            };
            console.info('Server raw document summary for', payload.docId || firebaseDocId, 'source=', payload.source || '?', rawCounts);
            // Also log a short sample of ids for manual inspection
            const sampleIds = {
              feeds: (raw.snapshot ? raw.snapshot.feeds : raw.feeds || []).slice(0,5).map(i=>i && i.id).filter(Boolean),
              elims: (raw.snapshot ? raw.snapshot.elims : raw.elims || []).slice(0,5).map(i=>i && i.id).filter(Boolean),
              meds: (raw.snapshot ? raw.snapshot.meds : raw.meds || []).slice(0,5).map(i=>i && i.id).filter(Boolean),
              measurements: (raw.snapshot ? raw.snapshot.measurements : raw.measurements || []).slice(0,5).map(i=>i && i.id).filter(Boolean)
            };
            console.debug('Server raw sample ids:', sampleIds);
          }
        } catch (e) {
          console.debug('Error handling server-raw payload', e);
        }
      } else if (event === 'sync-status') {
        setSaveIndicator(payload.status, payload.message);
      } else if (event === 'server-update') {
        setSaveIndicator('synced', 'Données à jour');
      }
    });

  } catch (error) {
    console.error("Firebase init failed:", error);
    setSaveIndicator('error', SAVE_MESSAGES.error);
  }
}

async function bootstrap() {
  try {
  const { db, storage, storageFns, ensureAuth } = await import('./firebase.js');
    const persistenceModule = await import('./persistence.js');
    const { Persistence } = persistenceModule;

    persistenceApi = Persistence;
    firebaseDbInstance = db;
    firebaseStorageInstance = storage;
    firebaseStorageFns = storageFns;
    firebaseDocId = resolveSharedDocumentId();

    setSaveIndicator('idle', isOnline() ? SAVE_MESSAGES.idle : SAVE_MESSAGES.offline);
    updateOfflineIndicator();

    // Ensure the user is authenticated (attempt anonymous sign-in) before starting sync.
    try {
      if (typeof ensureAuth === 'function') {
        await ensureAuth();
      }
    } catch (e) {
      console.warn('ensureAuth failed:', e);
    }

    await initFirebaseSync();
  } catch (error) {
    console.error("Failed to bootstrap Firebase or app modules:", error);
    setSaveIndicator('error', 'Erreur de chargement');
  }

  cancelSelectBtn?.addEventListener('click', () => toggleDeleteMode(false));
  deleteSelectedBtn?.addEventListener('click', () => {
    const selectedItems = $$('.history-item-checkbox:checked', historyList)
      .map(cb => ({ type: cb.dataset.type, id: cb.dataset.id }));

    if (selectedItems.length > 0) {
      confirmAndDelete(selectedItems);
    } else {
      toggleDeleteMode(false);
    }
  });
}

addManualBtn?.addEventListener('click', ()=> openManualModal({mode:'create', type:'feed'}));
footerAddManualBtn?.addEventListener('click', ()=> openManualModal({mode:'create', type:'feed'}));
exportReportsBtn?.addEventListener('click', exportReports);
closeManualBtn?.addEventListener('click', closeManualModal);
cancelManualBtn?.addEventListener('click', closeManualModal);
saveManualBtn?.addEventListener('click', () => {
  try {
    saveManualEntry();
  } catch (e) {
    console.warn("Save manual entry failed:", e.message);
    // Alert the user that something went wrong, as the function might have bailed early.
  }
});
manualTypeButtons.forEach(btn => btn.addEventListener('click', ()=> setManualType(btn.dataset.type)));
manualSource?.addEventListener('change', updateManualSourceFields);
manualMedSelect?.addEventListener('change', updateManualMedFields);
if(manualModal){
  setManualType('feed');
  updateManualSourceFields();
  updateManualMedFields();
}

window.addEventListener('online', () => {
  updateOfflineIndicator();
});

window.addEventListener('offline', () => {
  updateOfflineIndicator();
});

// --- Lógica de Deslizamiento para Eliminar ---
let swipeState = {
  startX: 0,
  currentX: 0,
  isSwiping: false,
  target: null,
  swipedItem: null,
  threshold: 80, // Ancho del área de borrado en px
};

function handleSwipeStart(e) {
  if (isDeleteMode || e.target.closest('.item-action, .history-item-checkbox, .swipe-delete-btn')) return;
  const foreground = e.target.closest('.history-item-foreground');
  if (!foreground) return;

  // Cerrar cualquier otro item abierto
  if (swipeState.swipedItem && swipeState.swipedItem !== foreground.parentElement) {
    closeSwipedItem(swipeState.swipedItem);
  }

  swipeState.target = foreground;
  swipeState.startX = e.clientX;
  swipeState.isSwiping = false;
  historyList.addEventListener('pointermove', handleSwipeMove, { passive: false });
  historyList.addEventListener('pointerup', handleSwipeEnd);
  historyList.addEventListener('pointercancel', handleSwipeEnd);
}

function handleSwipeMove(e) {
  if (!swipeState.target) return;

  swipeState.currentX = e.clientX;
  const deltaX = swipeState.currentX - swipeState.startX;

  if (!swipeState.isSwiping && Math.abs(deltaX) > 10) {
    swipeState.isSwiping = true;
  }

  if (swipeState.isSwiping) {
    e.preventDefault(); // Prevenir scroll vertical
    const newX = Math.min(0, Math.max(-swipeState.threshold, deltaX));
    swipeState.target.style.transform = `translateX(${newX}px)`;
    swipeState.target.style.transition = 'none';
  }
}

function handleSwipeEnd() {
  if (!swipeState.target) return;

  const deltaX = swipeState.currentX - swipeState.startX;
  const itemContainer = swipeState.target.parentElement;

  if (swipeState.isSwiping && deltaX < -(swipeState.threshold / 2)) {
    // Abrir
    swipeState.target.style.transform = `translateX(-${swipeState.threshold}px)`;
    swipeState.target.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    itemContainer.classList.add('is-swiped');
    swipeState.swipedItem = itemContainer;
  } else {
    // Cerrar
    closeSwipedItem(itemContainer);
  }

  // Limpiar estado
  swipeState.target = null;
  swipeState.isSwiping = false;
  swipeState.startX = 0;
  swipeState.currentX = 0;
  historyList.removeEventListener('pointermove', handleSwipeMove);
  historyList.removeEventListener('pointerup', handleSwipeEnd);
  historyList.removeEventListener('pointercancel', handleSwipeEnd);
}

function closeSwipedItem(itemContainer) {
  if (!itemContainer) return;
  const foreground = itemContainer.querySelector('.history-item-foreground');
  if (foreground) {
    foreground.style.transform = 'translateX(0)';
    foreground.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
  }
  itemContainer.classList.remove('is-swiped');
  if (swipeState.swipedItem === itemContainer) swipeState.swipedItem = null;
}
// Temporarily disable service worker registration to avoid caching stale bundles.
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('./sw.js').catch(err => {
//       console.error('Service worker registration failed:', err);
//     });
//   });
// }

historyList?.addEventListener('pointerdown', handleSwipeStart);
document.addEventListener('click', (e) => {
  // Cerrar el item deslizado si se hace clic fuera de él
  if (swipeState.swipedItem && !swipeState.swipedItem.contains(e.target)) {
    closeSwipedItem(swipeState.swipedItem);
  }
});

bootstrap();
