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





// ===== Action Guards & UX Helpers (Phase 3-A) =====


async function safeAction(btn, actionFn) {


  if (!btn || btn.disabled || btn.getAttribute('aria-busy') === 'true') return;


  


  const originalText = btn.textContent;


  const originalOpacity = btn.style.opacity;


  


  btn.disabled = true;


  btn.setAttribute('aria-busy', 'true');


  btn.style.opacity = '0.6';


  btn.style.cursor = 'wait';





  try {


    await actionFn();


  } catch (e) {


    console.error("Action failed:", e);


    alert(e.message || "Une erreur est survenue");


  } finally {


    // Debounce unlock to prevent accidental double-taps immediately after


    setTimeout(() => {


      btn.disabled = false;


      btn.setAttribute('aria-busy', 'false');


      btn.style.opacity = originalOpacity;


      btn.style.cursor = '';


    }, 500);


  }


}





const confirmAction = (msg) => new Promise(resolve => resolve(window.confirm(msg)));





// ===== Constants =====


// Date de naissance pour les courbes de croissance (basé sur le profil)


const BABY_BIRTH_DATE = new Date('2025-10-21T00:00:00');





// ===== Haptic Feedback =====


let vibrationUnlocked = false;


const unlockVibration = () => {


  vibrationUnlocked = true;


  window.removeEventListener('pointerdown', unlockVibration, true);


};


window.addEventListener('pointerdown', unlockVibration, { once: true, capture: true });





function triggerVibration(duration = 50) {


  if (!vibrationUnlocked) return;


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





// ===== Local Settings: Action Visibility (UI only) =====


const ACTION_VISIBILITY_KEY = 'appActionVisibility';


const ACTION_VISIBILITY_DEFAULTS = Object.freeze({


  milk: true,


  diaper: true,


  medication: true,


  measurements: true,


  sleep: true,


  pumping: true,


  behavior: true,


});





const ACTION_BUTTON_SELECTORS = Object.freeze({
  milk: ['#milk-focus', '#btn-breast', '#btn-bottle'],
  diaper: ['#btn-elim'],
  medication: ['#btn-med'],
  measurements: ['#btn-mesures'],
  sleep: ['#btn-sleep'],
  pumping: ['#btn-pump'],
  behavior: ['#btn-behavior'],
});



let actionVisibilityState = { ...ACTION_VISIBILITY_DEFAULTS };





function loadActionVisibilityState() {


  const raw = store.get(ACTION_VISIBILITY_KEY, null);


  if (!raw || typeof raw !== 'object') {


    actionVisibilityState = { ...ACTION_VISIBILITY_DEFAULTS };


    return;


  }


  actionVisibilityState = {


    ...ACTION_VISIBILITY_DEFAULTS,


    ...Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Boolean(value)]))


  };


}





function persistActionVisibilityState() {


  store.set(ACTION_VISIBILITY_KEY, actionVisibilityState);


}





function applyActionVisibilityToUi() {
  for (const [key, selector] of Object.entries(ACTION_BUTTON_SELECTORS)) {
    const selectors = Array.isArray(selector) ? selector : [selector];
    const isHidden = !Boolean(actionVisibilityState[key]);
    selectors.forEach(sel => {
      const el = $(sel);
      if (!el) return;
      el.hidden = isHidden;
    });
  }
}



function syncActionVisibilitySettingsUi() {


  if (!actionVisibilitySettingsEl) return;


  $$('input[type=\"checkbox\"][data-action]', actionVisibilitySettingsEl).forEach(input => {


    input.checked = Boolean(actionVisibilityState[input.dataset.action]);


  });


}





function initActionVisibilitySettings() {


  loadActionVisibilityState();


  applyActionVisibilityToUi();


  syncActionVisibilitySettingsUi();





  settingsBtn?.addEventListener('click', () => {


    applyActionVisibilityToUi();


    syncActionVisibilitySettingsUi();


    openModal('#modal-settings');


  });


  themeToggleGear?.addEventListener('click', (event) => {


    event.preventDefault();


    event.stopPropagation();


    applyActionVisibilityToUi();


    syncActionVisibilitySettingsUi();


    openModal('#modal-settings');


  });


  closeSettingsBtn?.addEventListener('click', () => closeModal('#modal-settings'));





  actionVisibilitySettingsEl?.addEventListener('change', (event) => {


    const target = event.target;


    if (!(target instanceof HTMLInputElement)) return;


    if (target.type !== 'checkbox') return;


    const key = target.dataset.action;


    if (!key || !(key in ACTION_VISIBILITY_DEFAULTS)) return;





    actionVisibilityState[key] = target.checked;


    persistActionVisibilityState();


    applyActionVisibilityToUi();


  });





  settingsResetActionsBtn?.addEventListener('click', () => {


    actionVisibilityState = { ...ACTION_VISIBILITY_DEFAULTS };


    persistActionVisibilityState();


    applyActionVisibilityToUi();


    syncActionVisibilitySettingsUi();


  });


}





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





function formatIntervalMinutes(totalMinutes){


  if(!Number.isFinite(totalMinutes) || totalMinutes <= 0){


    return '--';


  }


  const safe = Math.max(0, Math.round(totalMinutes));


  const hours = Math.floor(safe / 60);


  const minutes = safe % 60;


  if(hours > 0){


    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;


  }


  return `${minutes}m`;


}





function formatSleepMinutesLabel(totalMinutes){


  const safe = Math.max(0, Math.round(Number(totalMinutes) || 0));


  if(safe >= 60){


    const hours = Math.floor(safe / 60);


    const minutes = safe % 60;


    if(minutes > 0){


      return `${hours}h ${minutes}m`;


    }


    return `${hours}h`;


  }


  return `${safe}m`;


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





function toValidDate(value){


  if(value == null) return null;


  const date = new Date(value);


  return Number.isNaN(date.getTime()) ? null : date;


}





function formatDateTimeLabel(date){


  if(!date) return '';


  const dateLabel = date.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' });


  const timeLabel = date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });


  return `${dateLabel} ${timeLabel}`;


}





function formatBottleWindow(startISO, endISO){


  const startDate = toValidDate(startISO);


  const endDate = toValidDate(endISO);


  if(!startDate && !endDate) return '';


  const parts = [];


  if(startDate){


    parts.push(`Début ${formatDateTimeLabel(startDate)}`);


  }


  if(endDate){


    parts.push(`Fin ${formatDateTimeLabel(endDate)}`);


  }


  return parts.join(' · ');


}





const DAY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds


// ===== Hero background =====


const HERO_KEY = 'heroImage';


const HERO_FALLBACKS = [
  'img/baby1.jpg',
  'img/baby2.jpeg',
  'img/baby3.jpg',
  'img/baby4.jpeg'
];

const HERO_LEGACY_MAP = Object.freeze({
  'img/baby.jpg': 'img/baby1.jpg'
});


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
  let custom = store.get(HERO_KEY, null);
  if(custom && HERO_LEGACY_MAP[custom]){
    custom = HERO_LEGACY_MAP[custom];
    store.set(HERO_KEY, custom);
  }
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


const paneTetee = $('#pane-pecho');


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


const milestonesBtn = $('#btn-milestones');


const statsModal = $('#modal-stats');


const closeStatsBtn = $('#close-stats');


const statsBreastHourCanvas = $('#chart-breast-by-hour');


const statsBottleDayCanvas = $('#chart-bottle-by-day');


const statsDiaperCanvas = $('#chart-diaper-pie');


const statsGrowthCanvas = $('#chart-growth');


const statsSummaryEl = $('#stats-summary');


const saveIndicatorEl = $('#save-indicator');


const saveLabelEl = $('#save-label');


const exportReportsBtn = $('#export-pdf');


const exportCsvBtn = $('#export-csv');


const settingsBtn = $('#settings-btn');


const themeToggleGear = $('#theme-toggle-gear');


const settingsModal = $('#modal-settings');


const closeSettingsBtn = $('#close-settings');


const actionVisibilitySettingsEl = $('#action-visibility-settings');


const settingsResetActionsBtn = $('#settings-reset-actions');


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
const summarySleepEl = $('#summary-sleep');
const milkAgeEl = $('#milk-age');
const milkLastValueEl = $('#milk-last-value');
const milkLastMetaEl = $('#milk-last-meta');
const milkTotalValueEl = $('#milk-total-value');
const milkTotalMetaEl = $('#milk-total-meta');
const milkSinceValueEl = $('#milk-since-value');
const milkSinceMetaEl = $('#milk-since-meta');
const milkDetailsBtn = $('#btn-milk-details');
const btnBreast = $('#btn-breast');
const btnBottle = $('#btn-bottle');
const milkDetailsModal = $('#modal-milk-details');
const closeMilkDetailsBtn = $('#close-milk-details');


const milkDetailsSubtitleEl = $('#milk-details-subtitle');


const milkDetailsContentEl = $('#milk-details-content');


const milkDetailsPrevBtn = $('#milk-details-prev');


const milkDetailsNextBtn = $('#milk-details-next');


const manualModal = $('#modal-manual');


const manualTitle = manualModal ? manualModal.querySelector('h2') : null;

const manualSubtitle = $('#manual-subtitle');

const manualTypeButtons = $$('#manual-type button');


const manualFeedFields = $('#manual-feed-fields');


const manualElimFields = $('#manual-elim-fields');


const manualSource = $('#manual-source');


const manualBreastField = $('#manual-breast-field');


const manualDurationField = $('#manual-duration-field');


const manualAmountField = $('#manual-amount-field');


const manualBottleStartField = $('#manual-bottle-start-field');


const manualBottleEndField = $('#manual-bottle-end-field');

const manualBottleEndToggleField = $('#manual-bottle-end-toggle-field');

const manualBottleEndToggle = $('#manual-bottle-end-toggle');

const manualOptionsToggle = $('#manual-options-toggle');

const manualOptionsContent = $('#manual-options-content');

const manualSourceSeg = $('#manual-source-seg');

const manualBreastSeg = $('#manual-breast-seg');

const manualBreast = $('#manual-breast');


const manualDuration = $('#manual-duration');


const manualAmount = $('#manual-amount');


const manualBottleStart = $('#manual-bottle-start');


const manualBottleEnd = $('#manual-bottle-end');


const manualBottleFeedback = $('#manual-bottle-feedback');


const manualBottleDecreaseBtn = $('#manual-bottle-decrease');


const manualBottleIncreaseBtn = $('#manual-bottle-increase');


const manualBottlePresetButtons = $$('#manual-bottle-preset-buttons button');


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


const bottleChrono = $('#bottle-chrono');


const bottleForm = $('#bottle-form');


const bottleStartInput = $('#bottle-start');


const bottleEndInput = $('#bottle-end');


const bottleAmountInput = $('#ml');


const bottleAmountFeedback = $('#bottle-amount-feedback');


const bottleDecreaseBtn = $('#bottle-decrease');


const bottleIncreaseBtn = $('#bottle-increase');





const bottleTimeSummary = $('#bottle-time-summary');


const bottleTimeLabel = $('#bottle-time-label');


const bottleDetailsWrapper = $('#bottle-details-wrapper');


const cancelBottleTimeBtn = $('#cancel-bottle-time');


const confirmBottleTimeBtn = $('#confirm-bottle-time');


const bottleNextHint = $('#bottle-next-hint');
const bottleNextValueEl = $('#bottle-next-value');
const bottleNextMetaEl = $('#bottle-next-meta');
const milkStatusEl = $('#milk-status');
const milkStatusMsgEl = $('#milk-status-msg');
const milkStatusEmoteEl = $('#milk-status-emote');
const milkRangeNumEl = $('#milk-range-num');
const milkStatusBarEl = $('#milk-status-bar');
const milkStatusFillEl = $('#milk-status-fill');





const bottleTypeButtons = $$('#bottle-type-toggle button');


const bottlePresetButtons = $$('#bottle-preset-buttons button');


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


const manualPumpFields = $('#manual-pump-fields');


const manualPumpDuration = $('#manual-pump-duration');


const manualPumpAmount = $('#manual-pump-amount');


const manualPumpNotes = $('#manual-pump-notes');


const quickAddBottleBtn = $('#quick-add-bottle');


const pumpCard = $('#pump-card');


const pumpTimerEl = $('#pump-timer');


const pumpStatusEl = $('#pump-status');


const pumpControlBtn = $('#pump-control');


const pumpIcon = $('#pump-icon');


const pumpConfirmPanel = $('#pump-confirm-panel');


const pumpConfirmDuration = $('#pump-confirm-duration');


const pumpAmountValueEl = $('#pump-amount-value');


const pumpAmountDownBtn = $('#pump-amount-down');


const pumpAmountUpBtn = $('#pump-amount-up');


const pumpSaveIntentBtn = $('#pump-save-intent');


const pumpCancelIntentBtn = $('#pump-cancel-intent');


const pumpConfirmModal = $('#pump-confirm-modal');


const pumpConfirmAmount = $('#pump-confirm-amount');


const pumpConfirmTime = $('#pump-confirm-time');


const pumpConfirmYesBtn = $('#pump-confirm-yes');


const pumpConfirmAdjustBtn = $('#pump-confirm-adjust');


const btnPump = $('#btn-pump');


const closePumpBtn = $('#close-pump');


const btnSleep = $('#btn-sleep');


const sleepModal = $('#modal-sleep');


const closeSleepBtn = $('#close-sleep');


const cancelSleepBtn = $('#cancel-sleep');


const sleepChrono = $('#sleep-chrono');


const sleepStartTimeDisplay = $('#sleep-start-time-display');


const startStopSleepBtn = $('#startStopSleep');


const sleepStartInput = $('#sleep-start');


const sleepEndInput = $('#sleep-end');


const sleepNotesInput = $('#sleep-notes');


const saveSleepBtn = $('#save-sleep');





// Milestones refs


const milestonesModal = $('#modal-milestones');


const closeMilestonesBtn = $('#close-milestones');


const milestonesList = $('#milestones-list');


const milestoneTitleInput = $('#milestone-title');


const milestoneDateInput = $('#milestone-date');


const milestoneIconSelect = $('#milestone-icon');


const saveMilestoneBtn = $('#save-milestone');





// Focus Mode refs


const focusOverlay = $('#focus-overlay');


const focusMinimizeBtn = $('#focus-minimize-btn');


const focusIcon = $('#focus-icon');


const focusLabel = $('#focus-label');


const focusTimerEl = $('#focus-timer');


const focusMeta = $('#focus-meta');


const focusActionBtn = $('#focus-action-btn');


const statsDynamicContent = $('#stats-dynamic-content');





function applyHeartbeatEffect(buttonsSelector = '.btn-heartbeat'){


  const heartbeatButtons = $$(buttonsSelector);


  heartbeatButtons.forEach(btn => {


    btn.addEventListener('click', () => {


      btn.classList.remove('pressed');


      // force reflow to restart animation


      void btn.offsetWidth;


      btn.classList.add('pressed');


      setTimeout(() => btn.classList.remove('pressed'), 700);


    });


  });


}


applyHeartbeatEffect();





const SAVE_MESSAGES = {


  idle: 'Prêt',


  saving: 'Synchronisation…',


  offline: 'Enregistré localement',


  error: 'Erreur de synchronisation',


  synced: 'Sauvegardé dans le cloud'


};


let lastSyncedTime = null;





let saveIndicatorResetTimer = null;


const summaryMedEl = $('#summary-med');





// ===== State =====


const state = {


  feeds: [], // {id,dateISO,source,breastSide,durationSec,amountMl}


  elims: [], // {id,dateISO,pee,poop,vomit}


  meds: [], // {id,dateISO,name}


  measurements: [], // {id,dateISO,temp,weight,height}


  sleepSessions: [], // {id,dateISO,startISO,endISO,durationSec,notes}


  pumpSessions: [], // {id,dateISO,startISO,endISO,durationSec}


  milestones: [] // {id,dateISO,title,icon}


};





function updateState(updater) {


  // The updater function receives the current state and returns the new state.


  const newState = updater(state);


  state.feeds = newState.feeds ?? [];


  state.elims = newState.elims ?? [];


  state.meds = newState.meds ?? [];


  state.measurements = newState.measurements ?? [];


  state.sleepSessions = newState.sleepSessions ?? [];


  state.pumpSessions = newState.pumpSessions ?? [];


  state.milestones = newState.milestones ?? [];


  


  // La persistencia es manejada por el módulo de persistencia.


  // No se usa store.set() aquí. Las llamadas a persistenceApi se hacen


  // en las funciones que guardan/eliminan datos.


}





const HISTORY_RANGE_KEY = 'historyRange';





// Variable para el modo de edición, se gestionará a través de las funciones del modal


let editingEntry = null;


let editingSleepEntry = null;








let historyRange = normalizeHistoryRange(store.get(HISTORY_RANGE_KEY, {mode:'day'}));


let statsBreastHourChart = null;


let statsBottleDayChart = null;


let statsDiaperChart = null;


let statsGrowthChart = null;


const TIMER_KEY = 'timerState';


const BOTTLE_TIMER_KEY = 'bottleTimerState';


const BOTTLE_PENDING_KEY = 'bottlePendingDuration';


const BOTTLE_AMOUNT_KEY = 'bottlePendingAmount';


const PUMP_AMOUNT_PREF_KEY = 'pumpAmountPref';


const PUMP_AMOUNT_STEP = 10;


const PUMP_AMOUNT_MIN = 0;


const PUMP_AMOUNT_MAX = 600;





const BOTTLE_TYPE_PREF_KEY = 'bottleTypePreference';


const BOTTLE_PENDING_START_KEY = 'bottlePendingStart';


const SLEEP_TIMER_KEY = 'sleepTimerState';


const SLEEP_PENDING_START_KEY = 'sleepPendingStart';


const SLEEP_PENDING_DURATION_KEY = 'sleepPendingDuration';


const BOTTLE_PRESET_DEFAULT_KEY = 'bottlePresetDefault';


const BOTTLE_PRESET_COUNTS_KEY = 'bottlePresetCounts';


const BOTTLE_PRESET_VALUES = [90, 120, 130, 140, 150];


const BOTTLE_PRESET_PROMOTION_THRESHOLD = 3;


const BOTTLE_BASE_DEFAULT_PRESET = 130;


const BOTTLE_STEP_ML = 10;


const BOTTLE_MAX_ML = 260;


const BOTTLE_MIN_ML = 0;


const BOTTLE_INTERVAL_MS = 3 * 60 * 60 * 1000;


let manualType = 'feed';


let timer = 0;


let timerStart = null;


let timerInterval = null;


let lastStoppedTimerStart = null;


let bottleTimer = 0;


let bottleTimerStart = null;


let bottleTimerInterval = null;


let bottlePendingDuration = store.get(BOTTLE_PENDING_KEY, 0) || 0;


let bottlePendingAmount = store.get(BOTTLE_AMOUNT_KEY, null);


let bottleHintTicker = null;





let bottlePendingStart = store.get(BOTTLE_PENDING_START_KEY, null);


let lastStoppedBottleStart = null;


let lastBottleStopRequestedAt = null;


let bottleType = store.get(BOTTLE_TYPE_PREF_KEY, 'maternal') || 'maternal';


let bottlePresetCounts = normalizeBottlePresetCounts(store.get(BOTTLE_PRESET_COUNTS_KEY, {}));


let whoData = null;


let bottleDefaultPreset = resolveBottleDefaultPreset();


let sleepTimer = 0;


let sleepTimerStart = null;


let sleepTimerInterval = null;


let lastStoppedSleepStart = null;


let sleepPendingDuration = store.get(SLEEP_PENDING_DURATION_KEY, 0) || 0;


let sleepPendingStart = store.get(SLEEP_PENDING_START_KEY, null);


let pumpTimerSeconds = 0;


let pumpTimerStart = null;


let pumpTimerInterval = null;


let pumpState = 'idle';


let pumpMilestoneTwentyReached = false;


let pumpMilestoneThirtyReached = false;


let pumpSessionStart = null;


let pumpAmountValue = clamp(Number(store.get(PUMP_AMOUNT_PREF_KEY, '160')) || 160, PUMP_AMOUNT_MIN, PUMP_AMOUNT_MAX);


let isDeleteMode = false;


let activeFocusMode = null; // 'breast', 'bottle', 'sleep', 'pump'





if(bottleAmountInput){


  if(bottlePendingAmount != null){


    bottleAmountInput.value = String(bottlePendingAmount);


    handleBottleAmountInputChange();


  }else{


    applyBottleDefaultAmount();


  }


}





function cloneDataSnapshot(){


  return {


    feeds: state.feeds.map(f => ({...f})),


    elims: state.elims.map(e => ({...e})),


    meds: state.meds.map(m => ({...m})),


    measurements: state.measurements.map(m => ({...m})),


    sleepSessions: state.sleepSessions.map(s => ({...s})),


    pumpSessions: state.pumpSessions.map(p => ({...p}))


    // milestones not needed for export usually, but could be added


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


      measurements: [],


      sleepSessions: [],


      pumpSessions: [],


      activeTimers: {}


    };


    if (snapshot && typeof snapshot === 'object') {


      data.feeds = Array.isArray(snapshot.feeds) ? snapshot.feeds.map(f => ({...f})) : [];


      data.elims = Array.isArray(snapshot.elims) ? snapshot.elims.map(e => ({...e})) : [];


      data.meds = Array.isArray(snapshot.meds) ? snapshot.meds.map(m => ({...m})) : [];


      data.measurements = Array.isArray(snapshot.measurements) ? snapshot.measurements.map(m => ({...m})) : [];


      data.sleepSessions = Array.isArray(snapshot.sleepSessions) ? snapshot.sleepSessions.map(s => ({...s})) : [];


      data.pumpSessions = Array.isArray(snapshot.pumpSessions) ? snapshot.pumpSessions.map(p => ({...p})) : [];


      data.milestones = Array.isArray(snapshot.milestones) ? snapshot.milestones.map(m => ({...m})) : [];


      data.activeTimers = (snapshot.activeTimers && typeof snapshot.activeTimers === 'object') ? snapshot.activeTimers : {};


    }


    return data;


  });





  if (snapshot && snapshot.activeTimers) {


    syncLocalTimersWithRemote(snapshot.activeTimers);


  }





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





function toDateTimeInputValue(date){


  if(!(date instanceof Date) || Number.isNaN(date.getTime())) return '';


  const y = date.getFullYear();


  const m = String(date.getMonth() + 1).padStart(2, '0');


  const d = String(date.getDate()).padStart(2, '0');


  const hh = String(date.getHours()).padStart(2, '0');


  const mm = String(date.getMinutes()).padStart(2, '0');


  return `${y}-${m}-${d}T${hh}:${mm}`;


}





function parseDateTimeInput(value){


  if(!value) return null;


  const parsed = new Date(value);


  return Number.isNaN(parsed.getTime()) ? null : parsed;


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


    ...state.measurements.map(m => ({type:'measurement', item:m})),


    ...state.sleepSessions.map(s => ({type:'sleep', item:s})),


    ...state.pumpSessions.map(p => ({type:'pump', item:p}))


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





function computeAverageIntervalMinutes(timestamps = []){


  if(!Array.isArray(timestamps) || timestamps.length < 2){


    return 0;


  }


  const sorted = [...timestamps].filter(Number.isFinite).sort((a,b)=> a - b);


  if(sorted.length < 2){


    return 0;


  }


  let totalDiff = 0;


  for(let i=1; i<sorted.length; i+=1){


    totalDiff += sorted[i] - sorted[i-1];


  }


  const avgMs = totalDiff / (sorted.length - 1);


  return Math.max(0, Math.round(avgMs / 60000));


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


      bottleSessions: 0,


      avgIntervalMinutes: 0,


      avgBottlePerFeed: 0


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


    },


    sleep: {


      totalMinutes: 0,


      sessions: 0,


      avgPerDayMinutes: 0,


      avgSessionMinutes: 0,


      longest: null


    }


  };





  if(!bounds || bounds.start == null || bounds.end == null){


    return base;


  }





  const feedTimestamps = [];


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


      bottleSessions: 0,


      sleepMinutes: 0,


      sleepSessions: 0


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


    feedTimestamps.push(ts);





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





  const sleepSessions = Array.isArray(state.sleepSessions) ? state.sleepSessions : [];


  for(const session of sleepSessions){


    const startTs = Date.parse(session.startISO || session.dateISO);


    const endTs = Date.parse(session.endISO || session.dateISO);


    if(!Number.isFinite(startTs) || !Number.isFinite(endTs)) continue;


    if(endTs < bounds.start || endTs > bounds.end) continue;


    const baseSeconds = Number.isFinite(session.durationSec)


      ? session.durationSec


      : Math.max(0, (endTs - startTs) / 1000);


    const durationMinutes = Math.max(0, Math.round(baseSeconds / 60));


    const dayKey = toDateInputValue(new Date(startTs));


    const bucket = perDayMap.get(dayKey);


    if(bucket){


      bucket.sleepMinutes = (bucket.sleepMinutes || 0) + durationMinutes;


      bucket.sleepSessions = (bucket.sleepSessions || 0) + 1;


    }


    base.sleep.totalMinutes += durationMinutes;


    base.sleep.sessions += 1;


    if(!base.sleep.longest || durationMinutes > base.sleep.longest.durationMinutes){


      base.sleep.longest = {


        durationMinutes,


        startISO: session.startISO || session.dateISO,


        endISO: session.endISO || session.dateISO


      };


    }


  }





  base.perDay = orderedKeys.map(key => {


    const bucket = perDayMap.get(key) || {feedCount:0, breastMinutes:0, bottleMl:0, breastSessions:0, bottleSessions:0, sleepMinutes:0, sleepSessions:0};


    return {


      dateISO: key,


      feedCount: bucket.feedCount,


      breastMinutes: Number(bucket.breastMinutes.toFixed(2)),


      bottleMl: Math.round(bucket.bottleMl),


      breastSessions: bucket.breastSessions,


      bottleSessions: bucket.bottleSessions,


      sleepMinutes: Math.round(bucket.sleepMinutes || 0),


      sleepSessions: bucket.sleepSessions || 0


    };


  });





  base.perHour = base.perHour.map(value => Number(value.toFixed(2)));


  base.feedTotals.breastMinutes = Number(base.feedTotals.breastMinutes.toFixed(2));


  base.feedTotals.bottleMl = Math.round(base.feedTotals.bottleMl);


  base.feedTotals.avgBottlePerFeed = base.feedTotals.feedCount > 0 ? base.feedTotals.bottleMl / base.feedTotals.feedCount : 0;


  base.feedTotals.avgIntervalMinutes = computeAverageIntervalMinutes(feedTimestamps);


  base.dayCount = base.perDay.length;


  base.sleep.avgPerDayMinutes = base.dayCount > 0 ? base.sleep.totalMinutes / base.dayCount : 0;


  base.sleep.avgSessionMinutes = base.sleep.sessions > 0 ? base.sleep.totalMinutes / base.sleep.sessions : 0;


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





function showStatsSkeleton(container){


  if(container){


    container.innerHTML = `


      <div class="stat-overview-grid">


        <div class="skeleton-card" style="height:100px"></div>


        <div class="skeleton-card"></div>


        <div class="skeleton-card"></div>


      </div>


    `;


  }


}





function updateStatsSummary(currentStats = null){


  if(!statsSummaryEl) return;


  const rangeConfigs = [


    { key: 'today', label: "Aujourd'hui", range: {mode:'day'}, icon: '☀️' },


    { key: 'week', label: '7 jours', range: {mode:'week'}, icon: '📅' },


    { key: 'month', label: '30 jours', range: {mode:'month'}, icon: '🗓️' }


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


    const avgBottlePerFeed = data.feedTotals.avgBottlePerFeed || 0;


    const avgInterval = data.feedTotals.avgIntervalMinutes || 0;


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


    const sleepStats = data.sleep || { totalMinutes:0, sessions:0, avgPerDayMinutes:0 };


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


            <span class="stat-card-caption">tétées</span>


          </div>


          <span class="stat-card-average">Ø ${formatNumber(avgFeeds, 1, 1)}/j</span>


        </div>


        <div class="stat-card-grid">


          <div class="stat-chip">


            <span class="stat-chip-icon">⏱️</span>


            <div class="stat-chip-data">


              <span class="stat-chip-value">${formatMinutes(totalBreastMinutes)}</span>


              <span class="stat-chip-sub">Ø ${formatMinutes(avgBreastMinutes)}/j</span>


            </div>


          </div>


          <div class="stat-chip">


            <span class="stat-chip-icon">🥛</span>


            <div class="stat-chip-data">


              <span class="stat-chip-value">${formatNumber(totalBottleMl)}</span>


              <span class="stat-chip-sub">A~ ${formatNumber(avgBottleMl, 1, 1)} ml/j | ${formatNumber(avgBottlePerFeed, 0, 0)} ml/prise</span>


            </div>


          </div>


          <div class="stat-chip">


            <span class="stat-chip-icon">??</span>


            <div class="stat-chip-data">


              <span class="stat-chip-value">${formatIntervalMinutes(avgInterval)}</span>


              <span class="stat-chip-sub">Intervalle moyen</span>


            </div>


          </div>


          <div class="stat-chip">


            <span class="stat-chip-icon">🧷</span>


            <div class="stat-chip-data">


              <span class="stat-chip-value">${formatNumber(diapers.total)}</span>


              <span class="stat-chip-sub">P${formatNumber(diapers.wet)} • C${formatNumber(diapers.dirty)} • PC${formatNumber(diapers.both)}</span>


            </div>


          </div>


          <div class="stat-chip">


            <span class="stat-chip-icon">💊</span>


            <div class="stat-chip-data">


              <span class="stat-chip-value">${formatNumber(meds)}</span>


              <span class="stat-chip-sub">Ø ${formatNumber(meds / dayCount, 1, 1)}/j</span>


            </div>


          </div>


          <div class="stat-chip">


            <span class="stat-chip-icon">💤</span>


            <div class="stat-chip-data">


              <span class="stat-chip-value">${formatSleepMinutesLabel(sleepStats.totalMinutes)}</span>


              <span class="stat-chip-sub">${formatNumber(sleepStats.sessions)} sieste(s) • Ø ${formatSleepMinutesLabel(sleepStats.avgPerDayMinutes || 0)}/j</span>


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


        label: 'répartition',


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


          value: `${formatNumber(totals.feedCount / dayCount, 1, 1)}/j`,


          label: 'moyenne par jour',


          sub: detailParts.join(' • ')


        });


      }


    }


    const sleepStats = statsData.sleep || {};


    if(sleepStats.sessions > 0){


      const subParts = [`Ø ${formatSleepMinutesLabel(sleepStats.avgSessionMinutes || 0)} / sieste`];


      if(sleepStats.longest){


        const longestDate = parseDateTimeInput(sleepStats.longest.startISO || sleepStats.longest.endISO);


        const longestLabel = longestDate ? longestDate.toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short'}) : '';


        subParts.push(`Max ${formatSleepMinutesLabel(sleepStats.longest.durationMinutes || 0)}${longestLabel ? ` (${longestLabel})` : ''}`);


      }


      insightItems.push({


        icon: '💤',


        value: `${formatSleepMinutesLabel(sleepStats.avgPerDayMinutes || 0)}/j`,


        label: `${formatNumber(sleepStats.sessions)} sieste(s)`,


        sub: subParts.join(' • ')


      });


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


    <div class="stat-overview-grid" style="margin-bottom:16px">


      ${cardsHtml}


    </div>


    ${insightsHtml}


  `;


}





function renderStatsDailyList(stats = null, container = null){


  const statsDailyList = container || $('#stats-day-list');


  if(!statsDailyList) return;


  const data = stats || buildRangeStats();


  const perDay = Array.isArray(data?.perDay) ? data.perDay : [];


  if(!perDay.length){


    statsDailyList.innerHTML = '<div class="stat-placeholder">Aucune activité sur cette période.</div>';





  }





  const hasActivity = perDay.some(day => (day?.feedCount || 0) > 0 || (day?.breastMinutes || 0) > 0 || (day?.bottleMl || 0) > 0);


  if(!hasActivity){


    statsDailyList.innerHTML = '<div class="stat-placeholder">Aucune activité sur cette période.</div>';





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





function updateStatsChartLegacy(force = false, container = null){


  const summary = getStatsChartData();


  const stats = summary.stats;


  


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





    // WHO Percentiles calculation


    let p15Data = [], p50Data = [], p85Data = [];


    if (whoData && measurementEntries.length > 0) {


      const { interpolateWho } = whoData;


      const whoBoysWeight = whoData.WHO_DATA.boys.weight;


      


      measurementEntries.forEach(entry => {


        const date = parseDateInput(entry.dateISO);


        const ageMs = date.getTime() - BABY_BIRTH_DATE.getTime();


        const ageMonths = Math.max(0, ageMs / (1000 * 60 * 60 * 24 * 30.44));


        const p = interpolateWho(whoBoysWeight, ageMonths);


        p15Data.push(p.p15);


        p50Data.push(p.p50);


        p85Data.push(p.p85);


      });


    }





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


            },


            {


              label: 'P85 (OMS)',


              data: p85Data,


              borderColor: 'rgba(200, 200, 200, 0.5)',


              borderDash: [5, 5],


              pointRadius: 0,


              borderWidth: 1,


              yAxisID: 'yWeight',


              fill: false


            },


            {


              label: 'P50 (OMS)',


              data: p50Data,


              borderColor: 'rgba(150, 150, 150, 0.6)',


              borderWidth: 1,


              pointRadius: 0,


              yAxisID: 'yWeight',


              fill: false


            },


            {


              label: 'P15 (OMS)',


              data: p15Data,


              borderColor: 'rgba(200, 200, 200, 0.5)',


              borderDash: [5, 5],


              pointRadius: 0,


              borderWidth: 1,


              yAxisID: 'yWeight',


              fill: '-1' // Fill to previous dataset (P50) or similar if desired, but here just lines


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


      statsGrowthChart.data.datasets[3].data = p85Data;


      statsGrowthChart.data.datasets[4].data = p50Data;


      statsGrowthChart.data.datasets[5].data = p15Data;


      statsGrowthChart.update();


    }


  }


}





function renderStatsDashboard(viewMode = 'today') {


  if (!statsDynamicContent) return;


  statsDynamicContent.innerHTML = '';





  // Handle Custom View Settings Visibility


  const customSettings = $('#stats-custom-settings');


  if (customSettings) {


    customSettings.classList.toggle('is-hidden', viewMode !== 'custom');


  }





  // Update Segmented Control UI


  $$('#stats-view-selector button').forEach(btn => {


    btn.classList.toggle('active', btn.dataset.view === viewMode);


  });





  if (viewMode === 'today' || viewMode === 'yesterday') {


    renderComparisonView(viewMode);


  } else if (viewMode === 'week') {


    renderWeekView();


  } else if (viewMode === 'custom') {


    renderCustomView();


  }


}





function renderComparisonView(mode) {


  const today = new Date();


  const yesterday = new Date(today);


  yesterday.setDate(today.getDate() - 1);





  const statsToday = getDayFeedStats(today);


  const statsYesterday = getDayFeedStats(yesterday);





  // Determine which is primary based on mode, but we show both


  const isTodayMode = mode === 'today';


  


  const diffMl = statsToday.bottleMl - statsYesterday.bottleMl;


  const diffCount = statsToday.feedCount - statsYesterday.feedCount;


  


  const trendMl = diffMl > 0 ? 'trend-up' : (diffMl < 0 ? 'trend-down' : '');


  const trendSign = diffMl > 0 ? '+' : '';


  


  const html = `


    <div class="comparison-grid">


      <div class="comparison-card primary">


        <span class="comp-label">Aujourd'hui</span>


        <span class="comp-value">${formatNumber(statsToday.bottleMl)} <small style="font-size:0.6em; font-weight:400">ml</small></span>


        <div class="comp-sub">


          <span>${statsToday.feedCount} tomas</span> • <span>Ø ${formatNumber(statsToday.avgPerFeed, 0, 0)}</span>


        </div>


        <div class="comp-sub" style="margin-top:8px">


          <span class="${trendMl}">${trendSign}${formatNumber(diffMl)} ml</span> vs hier


        </div>


      </div>


      <div class="comparison-card">


        <span class="comp-label">Hier</span>


        <span class="comp-value">${formatNumber(statsYesterday.bottleMl)} <small style="font-size:0.6em; font-weight:400">ml</small></span>


        <div class="comp-sub">


          <span>${statsYesterday.feedCount} tomas</span> • <span>Ø ${formatNumber(statsYesterday.avgPerFeed, 0, 0)}</span>


        </div>


      </div>


    </div>


    


    <div class="stats-breakdown">


      <div class="stats-breakdown-head">


        <h3>Détail ${isTodayMode ? "d'aujourd'hui" : "d'hier"}</h3>


      </div>


      <div class="stats-day-list" id="stats-day-list-target"></div>


    </div>


  `;


  


  statsDynamicContent.innerHTML = html;


  


  // Render the daily list for the selected day


  const targetDate = isTodayMode ? today : yesterday;


  const range = { mode: 'custom', date: toDateInputValue(targetDate) };


  const stats = buildRangeStats(range);


  renderStatsDailyList(stats, $('#stats-day-list-target'));


}





function renderWeekView() {


  const html = `


    <div class="stat-overview-grid">


      <div class="stat-card">


        <div class="stat-card-head">


          <span class="stat-pill">Lait (7 jours)</span>


          <span class="stat-pill stat-pill-muted">Touchez un jour</span>


        </div>


        <div class="muted" id="stats-milk-goal-note">—</div>


        <div class="weekly-sparkline" id="stats-milk-sparkline"></div>


      </div>


      <div class="stat-card">


        <div class="stat-card-head">


          <span class="stat-pill">Croissance</span>


          <span class="stat-pill stat-pill-muted">Dernière mesure</span>


        </div>


        <div class="muted" id="stats-growth-overview">—</div>


      </div>


    </div>


    <div class="charts-grid">


      <div class="chart-container"><canvas id="chart-bottle-by-day"></canvas></div>


      <div class="chart-container"><canvas id="chart-breast-by-hour"></canvas></div>


      <div class="chart-container">


        <canvas id="chart-growth"></canvas>


        <div class="chart-panel" id="growth-point-panel">Touchez un point pour voir le détail.</div>


      </div>


    </div>


    <div class="stats-breakdown">


      <div class="stats-breakdown-head"><h3>7 derniers jours</h3></div>


      <div class="stats-day-list" id="stats-day-list-target"></div>


    </div>


  `;


  statsDynamicContent.innerHTML = html;


  


  // Re-init charts


  requestAnimationFrame(() => {


    updateStatsChart(true);


    renderWeeklyBottleSparkline($('#stats-milk-sparkline'), {mode:'week'}, toDateInputValue(new Date()));


    renderStatsGrowthOverview();


    renderStatsMilkGoalNote();


    const stats = buildRangeStats({mode:'week'});


    renderStatsDailyList(stats, $('#stats-day-list-target'));


  });


}





function renderCustomView() {


  const startInput = $('#stats-custom-start');


  const endInput = $('#stats-custom-end');


  const showCharts = $('#stats-toggle-charts')?.checked;


  


  // Default to current month if empty


  if (!startInput.value) {


    const now = new Date();


    startInput.value = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));


    endInput.value = toDateInputValue(now);


  }





  const html = `


    ${showCharts ? `


    <div class="charts-grid">


      <div class="chart-container"><canvas id="chart-bottle-by-day"></canvas></div>


    </div>` : ''}


    <div class="stats-breakdown">


      <div class="stats-breakdown-head"><h3>Période personnalisée</h3></div>


      <div class="stats-day-list" id="stats-day-list-target"></div>


    </div>


  `;


  statsDynamicContent.innerHTML = html;





  // Logic to fetch custom range stats


  const start = parseDateInput(startInput.value);


  const end = parseDateInput(endInput.value);


  


  // Hack: modify historyRange temporarily or create a custom stats builder that accepts explicit dates


  // For now, let's use buildRangeStats logic but manually filter if needed, 


  // but buildRangeStats relies on historyRange global or passed arg.


  // We can pass a custom range object.


  


  // Note: buildRangeStats doesn't support explicit start/end in 'custom' mode easily without modifying getHistoryRangeBounds.


  // Let's assume 'custom' mode in buildRangeStats uses historyRange.date.


  // We might need to extend getHistoryRangeBounds to support explicit start/end.


  // For simplicity in this iteration, let's just show the list.


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


          }else if(row.item.source === 'pump'){


            const durationLabel = formatDuration(row.item.durationSec || 0);


            title = `🌀 Tirage ${durationLabel}`;


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


          const parts = ['🌡️ Mesures'];


          if(row.item.temp) parts.push(`Temp ${row.item.temp}°C`);


          if(row.item.weight) parts.push(`Poids ${row.item.weight}kg`);


          if(row.item.height) parts.push(`Taille ${row.item.height}cm`);


          title = parts.join(' · ');


        }else if(row.type === 'sleep'){


          const durationSeconds = Number.isFinite(row.item.durationSec)


            ? row.item.durationSec


            : Math.max(0, ((Date.parse(row.item.endISO) || 0) - (Date.parse(row.item.startISO) || 0)) / 1000);


          title = `💤 Sommeil ${formatDuration(durationSeconds)}`;


        }else if(row.type === 'pump'){


          const durationSeconds = Number.isFinite(row.item.durationSec)


            ? row.item.durationSec


            : Math.max(0, ((Date.parse(row.item.endISO) || 0) - (Date.parse(row.item.startISO) || 0)) / 1000);


          const amountLabel = row.item.amountMl ? ` · ${row.item.amountMl} ml` : '';


          title = `🌀 Tirage ${formatDuration(durationSeconds)}${amountLabel}`;


        }


        const metaHtml = [`<span class="item-meta-time">${escapeHtml(dateString)}</span>`];


        if(row.type === 'med' && row.item.medKey){


          const medLabel = row.item.medKey === 'other' ? 'AUTRE' : String(row.item.medKey).toUpperCase();


          metaHtml.push(`<span class="item-meta-tag">${escapeHtml(medLabel)}</span>`);


        }





        if(row.type === 'feed' && row.item.source === 'bottle'){


          const windowLabel = formatBottleWindow(row.item.bottleStartISO, row.item.bottleEndISO);


          if(windowLabel){


            metaHtml.push(`<span class="item-meta-tag">${escapeHtml(windowLabel)}</span>`);


          }


        }


        if(row.type === 'sleep'){


          const windowLabel = formatBottleWindow(row.item.startISO, row.item.endISO);


          if(windowLabel){


            metaHtml.push(`<span class="item-meta-tag">${escapeHtml(windowLabel)}</span>`);


          }


        }


        if(row.type === 'pump'){


          const windowLabel = formatBottleWindow(row.item.startISO, row.item.endISO);


          if(windowLabel){


            metaHtml.push(`<span class="item-meta-tag">${escapeHtml(windowLabel)}</span>`);


          }


        }


        if(row.item.notes){


          metaHtml.push(`<span class="item-note">${escapeHtml(row.item.notes)}</span>`);


        }





        itemContainer.querySelector('.item-title').textContent = title;


        itemContainer.querySelector('.item-meta').innerHTML = metaHtml.join('');





        const checkbox = itemContainer.querySelector('.history-item-checkbox');


        checkbox.dataset.id = row.item.id;


        checkbox.dataset.type = row.type;


        itemContainer.classList.add(`type-${row.type}`);





        const editBtn = itemContainer.querySelector('.item-edit');


        if(editBtn){


          editBtn.style.display = '';


          editBtn.removeAttribute('aria-hidden');


          editBtn.tabIndex = 0;


          editBtn.dataset.id = row.item.id;


          editBtn.dataset.type = row.type;


        }


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


  updateBottleIntervalHint();


  // updateStatsChart(); // Removed auto update to avoid conflict with new dashboard


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


    const amount = prompt('Quantité (ml) prise ?', '120');





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


  showStatsSkeleton(statsDynamicContent);


  openModal('#modal-stats');


  requestAnimationFrame(() => {


    renderStatsDashboard('today');


  });


});





// Stats View Selector Events


$('#stats-view-selector')?.addEventListener('click', (e) => {


  if (e.target.tagName === 'BUTTON') {


    const view = e.target.dataset.view;


    renderStatsDashboard(view);


  }


});





$('#stats-custom-settings')?.addEventListener('change', () => {


  requestAnimationFrame(() => {


    renderStatsDashboard('custom');


  });


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


  messageEl.textContent = `${items.length} élément(s) supprimé(s)`;


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


      const key = getStateKeyForType(type);


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





let syncTimeUpdateTimer = null;





function updateSyncTimeLabel() {


  if (!lastSyncedTime || !saveLabelEl || saveIndicatorEl.dataset.state !== 'synced') return;


  const diff = Math.floor((Date.now() - lastSyncedTime) / 1000);


  if (diff < 5) {


    saveLabelEl.textContent = 'Synchronisé à l\'instant';


  } else if (diff < 60) {


    saveLabelEl.textContent = `Synchronisé il y a ${diff}s`;


  } else {


    saveLabelEl.textContent = 'Synchronisé';


  }


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


    lastSyncedTime = Date.now();


    if (!syncTimeUpdateTimer) syncTimeUpdateTimer = setInterval(updateSyncTimeLabel, 5000);


    updateSyncTimeLabel();


    saveIndicatorResetTimer = setTimeout(() => {


      if(saveIndicatorEl && saveIndicatorEl.dataset.state === 'synced'){


        setSaveIndicator('idle');


      }


    }, 4000);


  } else {


    if (syncTimeUpdateTimer) {


      clearInterval(syncTimeUpdateTimer);


      syncTimeUpdateTimer = null;


    }


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





const BACKUP_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;


const LAST_BACKUP_KEY = 'leo.lastBackupAt';


let backupInFlight = false;





function buildBackupJson() {


  const snapshot = cloneDataSnapshot();


  snapshot.exportedAt = new Date().toISOString();


  return JSON.stringify(snapshot, null, 2);


}





async function writeBackupToOPFS(json) {


  if (!navigator.storage || typeof navigator.storage.getDirectory !== 'function') {


    return false;


  }


  const dirHandle = await navigator.storage.getDirectory();


  const fileHandle = await dirHandle.getFileHandle('report.json', { create: true });


  const writable = await fileHandle.createWritable();


  await writable.write(json);


  await writable.close();


  return true;


}





function downloadBackup(json) {


  const blob = new Blob([json], { type: 'application/json' });


  const url = URL.createObjectURL(blob);


  const a = Object.assign(document.createElement('a'), { href: url, download: 'report.json' });


  document.body.appendChild(a);


  a.click();


  a.remove();


  URL.revokeObjectURL(url);


}





async function runAutoBackup(force = false) {


  if (backupInFlight) return;


  const lastBackup = Number(localStorage.getItem(LAST_BACKUP_KEY) || 0);


  if (!force && Date.now() - lastBackup < BACKUP_INTERVAL_MS) return;


  backupInFlight = true;


  try {


    const json = buildBackupJson();


    let saved = false;


    try {


      saved = await writeBackupToOPFS(json);


    } catch (error) {


      console.warn('Auto backup OPFS failed:', error);


    }


    if (!saved) {


      downloadBackup(json);


    }


    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));


  } finally {


    backupInFlight = false;


  }


}





function exportToCSV() {


  if (exportCsvBtn && exportCsvBtn.classList.contains('is-loading')) return;


  if (exportCsvBtn) exportCsvBtn.classList.add('is-loading');


  


  try {


    const rows = [['Date', 'Heure', 'Type', 'Détail', 'Valeur', 'Unité', 'Durée (min)', 'Notes']];


    


    const entries = [


      ...state.feeds.map(i => ({...i, _type: 'feed'})),


      ...state.elims.map(i => ({...i, _type: 'elim'})),


      ...state.meds.map(i => ({...i, _type: 'med'})),


      ...state.measurements.map(i => ({...i, _type: 'measurement'})),


      ...state.sleepSessions.map(i => ({...i, _type: 'sleep'})),


      ...state.pumpSessions.map(i => ({...i, _type: 'pump'})),


      ...state.milestones.map(i => ({...i, _type: 'milestone'}))


    ].sort((a, b) => (a.dateISO || '') < (b.dateISO || '') ? 1 : -1);





    entries.forEach(e => {


      const dateObj = new Date(e.dateISO);


      const date = dateObj.toLocaleDateString('fr-FR');


      const time = dateObj.toLocaleTimeString('fr-FR');


      let type = '', detail = '', value = '', unit = '', duration = '', notes = e.notes || '';





      if (e._type === 'feed') {


        type = 'Alimentation';


        if (e.source === 'breast') {


          detail = `Sein (${e.breastSide})`;


          duration = e.durationSec ? Math.round(e.durationSec / 60) : '';


        } else {


          detail = 'Biberon';


          value = e.amountMl;


          unit = 'ml';


        }


      } else if (e._type === 'elim') {


        type = 'Couche';


        const parts = [];


        if (e.pee) parts.push(`Pipi: ${e.pee}`);


        if (e.poop) parts.push(`Caca: ${e.poop}`);


        if (e.vomit) parts.push(`Vomi: ${e.vomit}`);


        detail = parts.join(', ');


      } else if (e._type === 'med') {


        type = 'Médicament';


        detail = e.name;


        value = e.dose || '';


      } else if (e._type === 'measurement') {


        type = 'Mesure';


        const parts = [];


        if (e.weight) parts.push(`Poids: ${e.weight}kg`);


        if (e.height) parts.push(`Taille: ${e.height}cm`);


        if (e.temp) parts.push(`Temp: ${e.temp}°C`);


        detail = parts.join(', ');


      } else if (e._type === 'sleep') {


        type = 'Sommeil';


        if (e.durationSec) duration = Math.round(e.durationSec / 60);


      } else if (e._type === 'pump') {


        type = 'Tire-lait';


        if (e.durationSec) duration = Math.round(e.durationSec / 60);


      } else if (e._type === 'milestone') {


        type = 'Étape';


        detail = e.title;


      }





      const escape = (txt) => `"${String(txt || '').replace(/"/g, '""')}"`;


      


      rows.push([


        escape(date),


        escape(time),


        escape(type),


        escape(detail),


        escape(value),


        escape(unit),


        escape(duration),


        escape(notes)


      ].join(','));


    });





    const csvContent = rows.join('\n');


    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });


    const url = URL.createObjectURL(blob);


    const link = document.createElement('a');


    link.setAttribute('href', url);


    const now = new Date();


    const filename = `leo_export_${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}.csv`;


    link.setAttribute('download', filename);


    document.body.appendChild(link);


    link.click();


    document.body.removeChild(link);


    


    setSaveIndicator('synced', 'Export CSV réussi');


  } catch (err) {


    console.error('CSV Export failed', err);


    setSaveIndicator('error', 'Erreur export CSV');


  } finally {


    if (exportCsvBtn) setTimeout(() => exportCsvBtn.classList.remove('is-loading'), 500);


  }


}





function updateMedSummary(){


  if(!summaryMedEl) return;


  const nowString = new Date().toLocaleString();


  if(!state.meds.length){


    summaryMedEl.innerHTML = `<strong>Derniere prise</strong><span class="kpi-pill">Aucun medicament enregistre</span><span class="kpi-pill">Nouvelle prise ${escapeHtml(nowString)}</span>`;


    return;


  }


  const latest = state.meds.reduce((acc, cur)=> acc && acc.dateISO > cur.dateISO ? acc : cur, state.meds[0]);


  const dateString = new Date(latest.dateISO).toLocaleString();


  const parts = [


    '<strong>Derniere prise</strong>',


    `<span class="kpi-pill">${escapeHtml(latest.name)} - ${escapeHtml(dateString)}</span>`


  ];


  if(latest.dose){


    parts.push(`<span class="kpi-pill">Dose ${escapeHtml(latest.dose)}</span>`);


  }


  if(latest.notes){


    parts.push(`<span class="kpi-pill">Note ${escapeHtml(latest.notes)}</span>`);


  }


  parts.push(`<span class="kpi-pill">Nouvelle prise ${escapeHtml(nowString)}</span>`);


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





function getDayFeedStats(dayDate = new Date()){


  const day = parseDateInput(dayDate);


  if(!day) return { feedCount:0, bottleMl:0, breastMinutes:0, avgPerFeed:0, avgInterval:0 };


  day.setHours(0, 0, 0, 0);


  const start = day.getTime();


  const end = start + DAY_MS - 1;


  const feeds = (state.feeds || []).filter(f => {


    const ts = Date.parse(f.dateISO);


    return Number.isFinite(ts) && ts >= start && ts <= end;


  }).sort((a,b)=> Date.parse(a.dateISO) - Date.parse(b.dateISO));





  const bottleMl = feeds.reduce((sum, feed) => sum + (feed.source === 'bottle' ? Number(feed.amountMl || 0) : 0), 0);


  const breastMinutes = feeds.reduce((sum, feed) => sum + (feed.source === 'breast' ? (Number(feed.durationSec || 0) / 60) : 0), 0);


  const feedCount = feeds.length;


  const avgPerFeed = feedCount > 0 ? bottleMl / feedCount : 0;


  const avgInterval = computeAverageIntervalMinutes(feeds.map(f => Date.parse(f.dateISO)));


  return { feedCount, bottleMl, breastMinutes, avgPerFeed, avgInterval };


}





function renderWeeklyBottleSparklineLegacy(container){


  if(!container) return;


  const weeklyStats = buildRangeStats({mode:'week'});


  const perDay = Array.isArray(weeklyStats.perDay) ? weeklyStats.perDay : [];


  if(!perDay.length){


    container.innerHTML = '<span class="muted">Pas de donnée</span>';


    return;


  }


  const max = Math.max(...perDay.map(day => day.bottleMl || 0));


  container.innerHTML = perDay.map(day => {


    const percent = max > 0 ? Math.round((day.bottleMl / max) * 100) : 0;


    const height = Math.max(6, percent);


    const label = formatStatsDayLabel(day.dateISO, {weekday:'short'});


    const valueLabel = `${formatNumber(day.bottleMl)} ml`;


    return `


      <div class="spark-bar" data-label="${escapeHtml(label)}" title="${escapeHtml(valueLabel)}">


        <span class="spark-fill" style="--spark-height:${height}%"></span>


      </div>


    `;


  }).join('');


}





function updateSummariesLegacy(){


  const today = new Date();


  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();





  if(summaryFeedEl){


    const todayStats = getDayFeedStats(today);


    if(!todayStats.feedCount){


      summaryFeedEl.innerHTML = "<strong>Alimentation</strong><span class=\"kpi-pill\">Pas encore de prise</span><span>Ajoutez un biberon ou un sein</span>";


    }else{


      const yesterday = new Date(today.getTime() - DAY_MS);


      const yesterdayStats = getDayFeedStats(yesterday);


      const deltaMl = todayStats.bottleMl - yesterdayStats.bottleMl;


      const deltaLabel = `${deltaMl >= 0 ? "+" : ""}${formatNumber(deltaMl)} ml vs hier`;


      const intervalLabel = formatIntervalMinutes(todayStats.avgInterval);


      summaryFeedEl.innerHTML = `


        <strong>Alimentation</strong>


        <span class="kpi-pill">Total ${formatNumber(todayStats.bottleMl)} ml</span>


        <span class="kpi-pill">${todayStats.feedCount} séances</span>


        <span class="kpi-pill">Ø ${formatNumber(todayStats.avgPerFeed, 0, 0)} ml/prise</span>


        <span class="kpi-pill">Intervalle ${intervalLabel}</span>


        <span class="kpi-pill">Sein ${formatMinutes(todayStats.breastMinutes)}</span>


        <span class="kpi-pill">${deltaLabel}</span>


        <div class="weekly-sparkline" id="weekly-bottle-sparkline"></div>


      `;


      const sparklineEl = document.getElementById("weekly-bottle-sparkline");


      renderWeeklyBottleSparkline(sparklineEl);


    }


  }





  if(summarySleepEl){


    const todaySleep = state.sleepSessions


      .filter(s => {


        const ts = new Date(s.dateISO || s.endISO || s.startISO || '').getTime();


        return Number.isFinite(ts) && ts >= start;


      })


      .sort((a,b)=> (a.dateISO || a.endISO || '') < (b.dateISO || b.endISO || '') ? 1 : -1);


    if(!todaySleep.length){


      summarySleepEl.innerHTML = "<strong>Sommeil</strong><span class=\"kpi-pill\">Aucune sieste enregistrée</span>";


    }else{


      const minutesTotal = todaySleep.reduce((sum, session) => {


        if(Number.isFinite(session.durationSec)){


          return sum + (session.durationSec / 60);


        }


        const startDate = parseDateTimeInput(session.startISO);


        const endDate = parseDateTimeInput(session.endISO);


        if(startDate && endDate){


          return sum + Math.max(0, (endDate.getTime() - startDate.getTime()) / 60000);


        }


        return sum;


      }, 0);


      const avgMinutes = minutesTotal / Math.max(todaySleep.length, 1);


      const lastEnd = toValidDate(todaySleep[0].endISO || todaySleep[0].dateISO);


      const totalLabel = formatSleepMinutesLabel(minutesTotal);


      const avgLabel = formatSleepMinutesLabel(avgMinutes);


      summarySleepEl.innerHTML = `


        <strong>Sommeil</strong>


        <span class="kpi-pill">${todaySleep.length} sieste(s)</span>


        <span class="kpi-pill">Total ${totalLabel}</span>


        <span class="kpi-pill">Ø ${avgLabel}</span>


        ${lastEnd ? `<span class="kpi-pill">Dernier réveil ${lastEnd.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>` : ''}


      `;


    }


  }





  if(summaryElimEl || dashboardElimEl){


    const todayElims = state.elims.filter(e => new Date(e.dateISO).getTime() >= start);


    if(!todayElims.length){


      if(summaryElimEl) summaryElimEl.innerHTML = "<strong>Aujourd'hui</strong><span class=\"kpi-pill\">Aucune donnée</span>";


      if(dashboardElimEl) dashboardElimEl.innerHTML = "<strong>Pipi / Caca / Vomi</strong><span class=\"kpi-pill\">Aucune donnée aujourd'hui</span>";


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


          <span class="kpi-pill">Pipi ${totals.pee}</span>


          <span class="kpi-pill">Caca ${totals.poop}</span>


          <span class="kpi-pill">Vomi ${totals.vomit}</span>


          <span class="kpi-pill">${todayElims.length} entrées</span>


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


    const time = new Date(feed.dateISO).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});


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
let pendingBreastAutoStart = false;



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


  if(activeFocusMode === 'bottle') updateFocusDisplay(bottleTimer);


}


updateBottleChrono();





function updatePumpAmountDisplay(){


  if(pumpAmountValueEl){


    pumpAmountValueEl.textContent = `${pumpAmountValue} ml`;


  }


}





function setPumpAmount(value){


  pumpAmountValue = clamp(Math.round(value), PUMP_AMOUNT_MIN, PUMP_AMOUNT_MAX);


  store.set(PUMP_AMOUNT_PREF_KEY, pumpAmountValue);


  updatePumpAmountDisplay();


}





function adjustPumpAmount(delta){


  setPumpAmount(pumpAmountValue + delta);


}





function formatPumpTimer(seconds){


  const total = Math.max(0, Math.floor(Number(seconds) || 0));


  const minutes = Math.floor(total / 60);


  const sec = total % 60;


  return `${String(minutes).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;


}





function setPumpStatus(message){


  if(pumpStatusEl && typeof message === 'string'){


    pumpStatusEl.textContent = message;


  }


}





function updatePumpUI(){


  if(pumpTimerEl){


    pumpTimerEl.textContent = formatPumpTimer(pumpTimerSeconds);


  }


  const isRunning = pumpState === 'running';


  const isPaused = pumpState === 'paused' && pumpTimerSeconds > 0;


  if(pumpControlBtn){


    let label = 'Démarrer';


    if(isRunning){


      label = 'Pause';


    }else if(isPaused){


      label = 'Reprendre';


    }


    pumpControlBtn.textContent = label;


    pumpControlBtn.classList.toggle('state-stop', isRunning);


    pumpControlBtn.classList.toggle('state-resume', isPaused);


    pumpControlBtn.classList.toggle('state-start', !isRunning && !isPaused);


  }


  if(pumpIcon){


    pumpIcon.classList.toggle('is-running', isRunning);


    pumpIcon.classList.toggle('is-paused', isPaused);


    if(isPaused){


      if(pumpIcon.textContent !== 'Leo'){


        pumpIcon.dataset.og = pumpIcon.textContent;


        pumpIcon.textContent = 'Leo';


      }


    } else if(pumpIcon.dataset.og && pumpIcon.textContent === 'Leo'){


      pumpIcon.textContent = pumpIcon.dataset.og;


    }


  }


  if(pumpCard){


    pumpCard.classList.toggle('is-running', isRunning);


    pumpCard.classList.toggle('is-paused', isPaused);


    pumpCard.classList.toggle('is-alert-20', pumpMilestoneTwentyReached);


    pumpCard.classList.toggle('is-alert-30', pumpMilestoneThirtyReached);


  }


  if(pumpConfirmPanel){


    const shouldShow = isPaused;


    pumpConfirmPanel.classList.toggle('is-visible', shouldShow);


    if(shouldShow && pumpConfirmDuration){


      pumpConfirmDuration.textContent = formatPumpTimer(pumpTimerSeconds);


    }


  }


}


updatePumpUI();


updatePumpAmountDisplay();





function openPumpConfirmModal(){


  if(pumpConfirmAmount){


    pumpConfirmAmount.textContent = `Lait : ${pumpAmountValue} ml`;


  }


  if(pumpConfirmTime){


    pumpConfirmTime.textContent = `Durée : ${formatPumpTimer(pumpTimerSeconds)}`;


  }


  if(pumpConfirmModal){


    pumpConfirmModal.classList.add('open');


    pumpConfirmModal.setAttribute('aria-hidden', 'false');


  }


}





function closePumpConfirmModal(){


  if(pumpConfirmModal){


    pumpConfirmModal.classList.remove('open');


    pumpConfirmModal.setAttribute('aria-hidden', 'true');


  }


}





function handlePumpMilestones(seconds){


  if(seconds >= 1200 && !pumpMilestoneTwentyReached){


    pumpMilestoneTwentyReached = true;


    setPumpStatus('20 minutes atteintes — ajustez votre position.');


    triggerVibration(120);


    updatePumpUI();


  }


  if(seconds >= 1800 && !pumpMilestoneThirtyReached){


    pumpMilestoneThirtyReached = true;


    setPumpStatus('30 minutes atteintes — prenez une pause.');


    triggerVibration([160, 60, 160]);


    updatePumpUI();


  }


}





function startPumpSession(){


  pumpState = 'running';


  closePumpConfirmModal();


  if(!Number.isFinite(pumpSessionStart)){


    pumpSessionStart = Date.now() - pumpTimerSeconds * 1000;


  }


  pumpTimerStart = Date.now() - pumpTimerSeconds * 1000;


  if(pumpTimerInterval){


    clearInterval(pumpTimerInterval);


  }


  pumpTimerInterval = setInterval(tickPumpTimer, 1000);


  tickPumpTimer();


}





function pausePumpSession(){


  if(pumpTimerInterval){


    clearInterval(pumpTimerInterval);


    pumpTimerInterval = null;


  }


  if(pumpTimerStart){


    pumpTimerSeconds = Math.max(0, Math.floor((Date.now() - pumpTimerStart) / 1000));


  }


  pumpTimerStart = null;


  pumpState = 'paused';


  updatePumpUI();


}





function resetPumpSession({ silentStatus = false } = {}){


  if(pumpTimerInterval){


    clearInterval(pumpTimerInterval);


    pumpTimerInterval = null;


  }


  pumpTimerSeconds = 0;


  pumpTimerStart = null;


  pumpState = 'idle';


  pumpMilestoneTwentyReached = false;


  pumpMilestoneThirtyReached = false;


  pumpSessionStart = null;


  if(!silentStatus){


    setPumpStatus('Prête');


  }


  closePumpConfirmModal();


  if(pumpConfirmPanel){


    pumpConfirmPanel.classList.remove('is-visible');


  }


  updatePumpAmountDisplay();


  updatePumpUI();


}





function tickPumpTimer(){


  if(!pumpTimerStart){


    return;


  }


  pumpTimerSeconds = Math.max(0, Math.floor((Date.now() - pumpTimerStart) / 1000));


  updatePumpUI();


  if(activeFocusMode === 'pump') updateFocusDisplay(pumpTimerSeconds);


  handlePumpMilestones(pumpTimerSeconds);


}





function togglePumpSession(){


  if(pumpState === 'running'){


    pausePumpSession();


  }else{


    startPumpSession();


  }


}





function buildPumpEntry(startTimestamp, durationSec){


  if(!Number.isFinite(startTimestamp) || !Number.isFinite(durationSec) || durationSec <= 0){


    return null;


  }


  const duration = Math.round(durationSec);


  const startDate = new Date(startTimestamp);


  const endDate = new Date(startTimestamp + duration * 1000);


  return {


    id: `pump-${Date.now()}`,


    dateISO: endDate.toISOString(),


    startISO: startDate.toISOString(),


    endISO: endDate.toISOString(),


    durationSec: duration


  };


}





function upsertPumpEntry(entry){


  updateState(currentData => {


    const list = Array.isArray(currentData.pumpSessions) ? [...currentData.pumpSessions] : [];


    const idx = list.findIndex(item => item && String(item.id) === String(entry.id));


    if(idx > -1){


      list[idx] = entry;


    }else{


      list.push(entry);


    }


    return { ...currentData, pumpSessions: list };


  });


  renderHistory();


}





async function persistPumpEntry(entry, reason){


  const api = getPersistenceApi();


  try{


    await api?.saveEntry?.('pump', entry, reason);


  }catch(err){


    console.error('Failed to save pump entry:', err);


  }


}





async function completePumpSession({ reason = 'Tirage confirmé' } = {}){


  const duration = pumpTimerSeconds;


  if(!Number.isFinite(duration) || duration <= 0){


    resetPumpSession();


    return;


  }


  const startTs = Number.isFinite(pumpSessionStart)


    ? pumpSessionStart


    : (Number.isFinite(pumpTimerStart) ? pumpTimerStart : Date.now() - duration * 1000);


  const entry = buildPumpEntry(startTs, duration);





  if(entry){


    entry.amountMl = pumpAmountValue;


    store.set(PUMP_AMOUNT_PREF_KEY, pumpAmountValue);


  }





  resetPumpSession({ silentStatus: true });


  closePumpConfirmModal();


  if(!entry){


    setPumpStatus('Prête');


    return;


  }


  upsertPumpEntry(entry);


  await persistPumpEntry(entry, reason);


  triggerVibration(60);


  setPumpStatus('Enregistré');


  setTimeout(() => setPumpStatus('Prête'), 1500);


}





// Pump card is shown inside modal, no inline toggling.





function updateSleepChrono(){


  const el = document.getElementById('sleep-chrono');


  if(!el) return;


  const h = String(Math.floor(sleepTimer / 3600)).padStart(2, '0');


  const m = String(Math.floor((sleepTimer % 3600) / 60)).padStart(2, '0');


  const s = String(sleepTimer % 60).padStart(2, '0');


  el.textContent = `${h}:${m}:${s}`;


  if(activeFocusMode === 'sleep') updateFocusDisplay(sleepTimer);


}


updateSleepChrono();





function tickSleepTimer(){


  if(!sleepTimerStart) return;


  sleepTimer = Math.max(0, Math.floor((Date.now() - sleepTimerStart) / 1000));


  updateSleepChrono();


  if(activeFocusMode === 'sleep') updateFocusDisplay(sleepTimer);


}





function beginSleepTimer(startTimestamp = Date.now(), persist = true){


  sleepTimerStart = startTimestamp;


  if(sleepTimerInterval){


    clearInterval(sleepTimerInterval);


  }


  if(persist){


    triggerVibration();


  }


  tickSleepTimer();


  sleepTimerInterval = setInterval(tickSleepTimer, 1000);


  


  const display = document.getElementById('sleep-start-time-display');


  if(display){


    const label = new Date(startTimestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});


    display.textContent = `Commencé à ${label}`;


  }


  


  const btn = document.getElementById('startStopSleep');


  if(btn) {


    btn.innerHTML = '⏹ Arrêter';


    btn.classList.add('running');


  }


  


  if(persist){


    store.set(SLEEP_TIMER_KEY, { start: startTimestamp });


  }


}





function stopSleepTimer({ persist = true, resetDisplay = false } = {}){


  if(sleepTimerInterval){


    clearInterval(sleepTimerInterval);


    sleepTimerInterval = null;


  }


  if(persist){


    store.remove(SLEEP_TIMER_KEY);


  }


  if(sleepTimerStart){


    sleepTimer = Math.max(0, Math.floor((Date.now() - sleepTimerStart) / 1000));


    updateSleepChrono();


  }


  if (sleepTimerStart) lastStoppedSleepStart = sleepTimerStart;


  const finishedStart = sleepTimerStart;


  sleepTimerStart = null;


  


  const btn = document.getElementById('startStopSleep');


  if(btn) {


    btn.innerHTML = '▶ Démarrer';


    btn.classList.remove('running');


  }


  


  const display = document.getElementById('sleep-start-time-display');


  if(resetDisplay && display){


    display.textContent = '';


  }


  return finishedStart;


}





function clearSleepPending(){


  sleepPendingStart = null;


  sleepPendingDuration = 0;


  store.remove(SLEEP_PENDING_START_KEY);


  store.remove(SLEEP_PENDING_DURATION_KEY);


}





function applySleepPendingToInputs(){


  const startInput = document.getElementById('sleep-start');


  const endInput = document.getElementById('sleep-end');


  const display = document.getElementById('sleep-start-time-display');


  


  if(!startInput || sleepPendingStart == null || !Number.isFinite(sleepPendingDuration) || sleepPendingDuration <= 0){


    return false;


  }


  const startDate = new Date(sleepPendingStart);


  const endDate = new Date(sleepPendingStart + sleepPendingDuration * 1000);


  startInput.value = toDateTimeInputValue(startDate);


  if(endInput){


    endInput.value = toDateTimeInputValue(endDate);


  }


  if(display){


    const windowLabel = formatBottleWindow(startDate.toISOString(), endDate.toISOString());


    display.textContent = windowLabel || '';


  }


  return true;


}





function setSleepPendingFromRange(startTs, durationSec){


  if(!Number.isFinite(startTs) || !Number.isFinite(durationSec) || durationSec <= 0){


    clearSleepPending();


    return;


  }


  sleepPendingStart = startTs;


  sleepPendingDuration = durationSec;


  store.set(SLEEP_PENDING_START_KEY, sleepPendingStart);


  store.set(SLEEP_PENDING_DURATION_KEY, sleepPendingDuration);


  applySleepPendingToInputs();


}





function buildSleepEntry({ startDate, endDate, notes, entryId }){


  if(!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) return null;


  if(!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) return null;


  if(endDate.getTime() <= startDate.getTime()) return null;


  const durationSec = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 1000));


  const entry = {


    id: entryId || Date.now()+'',


    dateISO: endDate.toISOString(),


    startISO: startDate.toISOString(),


    endISO: endDate.toISOString(),


    durationSec


  };


  if(notes){


    entry.notes = notes;


  }


  return entry;


}





async function persistSleepEntry(entry, reason){


  const api = getPersistenceApi();


  try{


    await api?.saveEntry?.('sleep', entry, reason);


  }catch(err){


    console.error('Failed to save sleep entry:', err);


  }


}





async function saveSleepEntry(entry, { reason, autoClose = true } = {}){


  if(!entry) return null;


  updateState(currentData => {


    currentData.sleepSessions = Array.isArray(currentData.sleepSessions) ? currentData.sleepSessions : [];


    const idx = currentData.sleepSessions.findIndex(item => item && String(item.id) === String(entry.id));


    if(idx > -1){


      currentData.sleepSessions[idx] = entry;


    }else{


      currentData.sleepSessions.push(entry);


    }


    return currentData;


  });


  renderHistory();


  await persistSleepEntry(entry, reason || 'Enregistrer sommeil');


  editingSleepEntry = null;


  clearSleepPending();


  resetSleepForm();


  if(autoClose){


    closeSleepModal();


  }


  return entry;


}





function resetSleepForm(){


  stopSleepTimer({ persist: false, resetDisplay: true });


  sleepTimer = 0;


  updateSleepChrono();


}





function injectSleepStyles() {


  if (document.getElementById('sleep-ui-styles')) return;


  const style = document.createElement('style');


  style.id = 'sleep-ui-styles';


  style.textContent = `


    .sleep-minimal-ui { padding: 24px 20px; display: flex; flex-direction: column; height: 100%; color: var(--text-main); }


    .sleep-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }


    .sleep-minimal-ui { padding: 24px 20px; display: flex; flex-direction: column; height: 100%; color: var(--text-main); overflow-y: auto; box-sizing: border-box; }


    .sleep-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-shrink: 0; }


    .sleep-header h2 { margin: 0; font-size: 1.8rem; font-weight: 800; letter-spacing: -0.5px; }


    .sleep-close { display:none; }


    


    .sleep-timer-view { display: flex; flex-direction: column; align-items: center; flex: 1; justify-content: center; gap: 30px; animation: fadeIn 0.3s ease; }


    .sleep-chrono-big { font-size: 4.5rem; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -2px; line-height: 1; }


    .sleep-timer-label { font-size: 1rem; color: var(--text-muted); margin-top: -20px; min-height: 20px; }


    .sleep-timer-view { display: flex; flex-direction: column; align-items: center; flex: 1; justify-content: center; gap: 30px; animation: fadeIn 0.3s ease; min-height: 300px; }


    .sleep-chrono-big { font-size: 4.5rem; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -2px; line-height: 1; text-align: center; }


    .sleep-timer-label { font-size: 1rem; color: var(--text-muted); margin-top: -20px; min-height: 20px; text-align: center; }


    


    .sleep-btn-main { width: 100%; max-width: 280px; height: 80px; border-radius: 40px; font-size: 1.3rem; font-weight: 700; border: none; cursor: pointer; transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 20px 40px -10px rgba(10, 132, 255, 0.3); background: #0a84ff; color: white; }


    .sleep-btn-main { width: 100%; max-width: 280px; height: 80px; border-radius: 40px; font-size: 1.3rem; font-weight: 700; border: none; cursor: pointer; transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 20px 40px -10px rgba(10, 132, 255, 0.3); background: #0a84ff; color: white; flex-shrink: 0; }


    .sleep-btn-main.running { background: #ff3b30; box-shadow: 0 20px 40px -10px rgba(255, 59, 48, 0.3); }


    .sleep-btn-main:active { transform: scale(0.95); }


    


    .sleep-btn-manual { background: transparent; border: none; color: var(--text-muted); font-weight: 600; padding: 15px; margin-top: 10px; }


    .sleep-btn-manual { background: transparent; border: none; color: var(--text-muted); font-weight: 600; padding: 15px; margin-top: 10px; flex-shrink: 0; }


    


    .sleep-manual-view { display: flex; flex-direction: column; gap: 24px; flex: 1; animation: slideUp 0.3s ease; }


    .sleep-inputs-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }


    .sleep-manual-view { display: flex; flex-direction: column; gap: 20px; flex: 1; animation: slideUp 0.3s ease; }


    .sleep-inputs-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; flex-shrink: 0; }


    .sleep-input-group { display: flex; flex-direction: column; gap: 8px; }


    .sleep-input-label { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }


    .sleep-input { background: rgba(120, 120, 128, 0.1); border: none; padding: 16px; border-radius: 16px; font-size: 1.1rem; font-family: inherit; color: inherit; width: 100%; }


    .sleep-input { background: rgba(120, 120, 128, 0.1); border: none; padding: 16px; border-radius: 16px; font-size: 1.1rem; font-family: inherit; color: inherit; width: 100%; box-sizing: border-box; }


    


    .sleep-tags { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }


    .sleep-tags { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex-shrink: 0; }


    .sleep-tag { padding: 16px; border-radius: 16px; border: 2px solid rgba(120, 120, 128, 0.1); background: transparent; font-weight: 700; font-size: 1rem; color: var(--text-muted); cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }


    .sleep-tag.selected { border-color: #0a84ff; background: rgba(10, 132, 255, 0.1); color: #0a84ff; }


    


    .sleep-note-input { width: 100%; border: none; border-bottom: 2px solid rgba(120, 120, 128, 0.1); padding: 12px 0; font-size: 1rem; background: transparent; border-radius: 0; color: inherit; }


    .sleep-note-input { width: 100%; border: none; border-bottom: 2px solid rgba(120, 120, 128, 0.1); padding: 12px 0; font-size: 1rem; background: transparent; border-radius: 0; color: inherit; flex-shrink: 0; }


    .sleep-note-input:focus { border-color: #0a84ff; outline: none; }


    


    .sleep-actions { margin-top: auto; display: flex; flex-direction: column; gap: 12px; }


    .sleep-btn-save { width: 100%; padding: 20px; border-radius: 20px; background: #0a84ff; color: white; font-weight: 700; font-size: 1.1rem; border: none; }


    .sleep-btn-cancel { width: 100%; padding: 15px; background: transparent; color: var(--text-muted); font-weight: 600; border: none; }


    .sleep-actions { margin-top: auto; display: flex; flex-direction: column; gap: 12px; padding-top: 20px; flex-shrink: 0; }


    .sleep-btn-save { width: 100%; padding: 20px; border-radius: 20px; background: #0a84ff; color: white; font-weight: 700; font-size: 1.1rem; border: none; cursor: pointer; }


    .sleep-btn-cancel { width: 100%; padding: 15px; background: transparent; color: var(--text-muted); font-weight: 600; border: none; cursor: pointer; }


    


    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }


    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }





    @media (max-height: 700px) {


      .sleep-minimal-ui { padding: 16px; }


      .sleep-header { margin-bottom: 10px; }


      .sleep-chrono-big { font-size: 3.5rem; }


      .sleep-timer-view { gap: 20px; }


      .sleep-btn-main { height: 64px; font-size: 1.1rem; }


      .sleep-manual-view { gap: 16px; }


      .sleep-input { padding: 12px; font-size: 1rem; }


      .sleep-tag { padding: 12px; font-size: 0.9rem; }


    }


  `;


  document.head.appendChild(style);


}





function renderSleepUI(mode = 'timer', entry = null) {


  const modal = document.getElementById('modal-sleep');


  if (!modal) return;


  injectSleepStyles();





  const isRunning = !!sleepTimerInterval;


  const isManual = mode === 'manual' || (entry !== null && !isRunning);


  


  let startVal = '', endVal = '', notesVal = '', tagVal = '';


  if (entry) {


    startVal = toDateTimeInputValue(parseDateTimeInput(entry.startISO || entry.dateISO));


    endVal = toDateTimeInputValue(parseDateTimeInput(entry.endISO || entry.dateISO));


    notesVal = entry.notes || '';


    if (notesVal.includes('Sieste')) tagVal = 'Sieste';


    if (notesVal.includes('Nuit')) tagVal = 'Nuit';


    notesVal = notesVal.replace('Sieste', '').replace('Nuit', '').trim();


  } else if (sleepPendingStart) {


    startVal = toDateTimeInputValue(new Date(sleepPendingStart));


    if (sleepPendingDuration) {


      endVal = toDateTimeInputValue(new Date(sleepPendingStart + sleepPendingDuration * 1000));


    }


  } else {


    startVal = toDateTimeInputValue(new Date());


  }





  const html = `


    <div class="sleep-minimal-ui">


      <div class="sleep-header">


        <h2>${isManual ? (entry ? 'Modifier' : 'Ajouter') : 'Sommeil'}</h2>


        <button class="modal-close" id="sleep-ui-close" type="button" aria-label="Cerrar" title="Cerrar" data-close-label="Cerrar"><span>×</span></button>


      </div>





      ${!isManual ? `


        <div class="sleep-timer-view">


          <div class="sleep-chrono-big" id="sleep-chrono">00:00:00</div>


          <div class="sleep-timer-label" id="sleep-start-time-display"></div>


          <div class="sleep-controls">


            <button id="startStopSleep" class="sleep-btn-main ${isRunning ? 'running' : ''}">


              ${isRunning ? '⏹ Arrêter' : '▶ Démarrer'}


            </button>


            ${!isRunning ? `<button id="sleep-go-manual" class="sleep-btn-manual">✍️ Saisie manuelle</button>` : ''}


          </div>


        </div>


      ` : `


        <div class="sleep-manual-view">


          <div class="sleep-inputs-row">


            <div class="sleep-input-group">


              <label class="sleep-input-label">Début</label>


              <input type="datetime-local" id="sleep-start" class="sleep-input" value="${startVal}">


            </div>


            <div class="sleep-input-group">


              <label class="sleep-input-label">Fin</label>


              <input type="datetime-local" id="sleep-end" class="sleep-input" value="${endVal}">


            </div>


          </div>


          


          <div class="sleep-tags" id="sleep-tags-container">


            <button type="button" class="sleep-tag ${tagVal === 'Sieste' ? 'selected' : ''}" data-tag="Sieste">😴 Sieste</button>


            <button type="button" class="sleep-tag ${tagVal === 'Nuit' ? 'selected' : ''}" data-tag="Nuit">🌙 Nuit</button>


          </div>


          


          <input type="text" id="sleep-notes" class="sleep-note-input" placeholder="Note optionnelle..." value="${escapeHtml(notesVal)}">


          


          <div class="sleep-actions">


            <button id="save-sleep" class="sleep-btn-save">Enregistrer</button>


            <button id="cancel-sleep" class="sleep-btn-cancel">Annuler</button>


          </div>


        </div>


      `}


    </div>


  `;


  


  modal.innerHTML = html;


  


  document.getElementById('sleep-ui-close')?.addEventListener('click', closeSleepModal);


  document.getElementById('sleep-go-manual')?.addEventListener('click', () => renderSleepUI('manual'));


  document.getElementById('cancel-sleep')?.addEventListener('click', () => {


    if (entry) closeSleepModal();


    else renderSleepUI('timer');


  });


  


  const tagsContainer = document.getElementById('sleep-tags-container');


  if (tagsContainer) {


    tagsContainer.addEventListener('click', (e) => {


      const btn = e.target.closest('.sleep-tag');


      if (btn) {


        const wasSelected = btn.classList.contains('selected');


        tagsContainer.querySelectorAll('.sleep-tag').forEach(b => b.classList.remove('selected'));


        if (!wasSelected) btn.classList.add('selected');


      }


    });


  }





  document.getElementById('startStopSleep')?.addEventListener('click', handleStartStopSleepAction);


  document.getElementById('save-sleep')?.addEventListener('click', handleSaveSleepAction);


  


  if (!isManual) updateSleepChrono();


}





function openSleepModal(entry = null){


  editingSleepEntry = entry ? {...entry} : null;


  openModal('#modal-sleep');


  renderSleepUI(entry ? 'manual' : 'timer', entry);


}





function closeSleepModal(){


  editingSleepEntry = null;


  resetSleepForm();


  closeModal('#modal-sleep');


}





async function handleStartStopSleepAction() {


  if(sleepTimerInterval){


    triggerVibration();


    const startedAt = sleepTimerStart;


    const elapsed = Math.max(1, Math.floor((Date.now() - sleepTimerStart) / 1000));


    stopSleepTimer({ resetDisplay: false });


    


    renderSleepUI('manual');


    


    const startInput = document.getElementById('sleep-start');


    const endInput = document.getElementById('sleep-end');


    


    if(Number.isFinite(startedAt)){


      const startDate = new Date(startedAt);


      const endDate = new Date(startedAt + elapsed * 1000);


      if(startInput) startInput.value = toDateTimeInputValue(startDate);


      if(endInput) endInput.value = toDateTimeInputValue(endDate);


    }


  }else{


    const ts = Date.now();


    beginSleepTimer(ts, true);


    clearSleepPending();


    enterFocusMode('sleep');


  }


}


/*


async function handleSaveSleepAction() {


  triggerVibration();


  const startInput = document.getElementById('sleep-start');


  const endInput = document.getElementById('sleep-end');


  const notesInput = document.getElementById('sleep-notes');


  const tagsContainer = document.getElementById('sleep-tags-container');


  


  const startDate = parseDateTimeInput(startInput?.value);


  if(!startDate){


    alert('Veuillez indiquer l\'heure de début.');


    return;


  }


  const endDate = parseDateTimeInput(endInput?.value);


  if(!endDate){


    alert('Veuillez indiquer l\'heure de fin.');


    return;


  }


  if(endDate.getTime() <= startDate.getTime()){


    alert('L\'heure de fin doit être postérieure au début.');


    return;


  }


  


  let notes = notesInput?.value?.trim() || '';


  const selectedTag = tagsContainer?.querySelector('.selected')?.dataset.tag;


  if(selectedTag){


    notes = `${selectedTag} ${notes}`.trim();


  }


  


  const entry = buildSleepEntry({


    startDate,


    endDate,


    notes,


    entryId: editingSleepEntry ? editingSleepEntry.id : undefined


  });


  


  if(!entry){


    alert('Impossible d\'enregistrer cette session.');


    return;


  }


  


  await saveSleepEntry(entry, { reason: editingSleepEntry ? 'Modifier le sommeil' : 'Ajouter sommeil' });


  stopSleepTimer({ persist: true, resetDisplay: true });


  getPersistenceApi()?.saveTimer('sleep', null);


}


*/





async function handleSaveSleepAction() {


  const btn = document.getElementById('save-sleep');


  await safeAction(btn, async () => {


    triggerVibration();


    const startInput = document.getElementById('sleep-start');


    const endInput = document.getElementById('sleep-end');


    const notesInput = document.getElementById('sleep-notes');


    const tagsContainer = document.getElementById('sleep-tags-container');


    


    const startDate = parseDateTimeInput(startInput?.value);


    if(!startDate) throw new Error('Veuillez indiquer l\'heure de début.');


    


    const endDate = parseDateTimeInput(endInput?.value);


    if(!endDate) throw new Error('Veuillez indiquer l\'heure de fin.');


    


    if(endDate.getTime() <= startDate.getTime()) throw new Error('L\'heure de fin doit être postérieure au début.');


    


    let notes = notesInput?.value?.trim() || '';


    const selectedTag = tagsContainer?.querySelector('.selected')?.dataset.tag;


    if(selectedTag){


      notes = `${selectedTag} ${notes}`.trim();


    }


    


    // Phase 3-B: Confirmation


    const durationMin = Math.round((endDate - startDate) / 60000);


    const confirmMsg = `Enregistrer sommeil de ${formatMinutes(durationMin)} ?\nDe ${startDate.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} à ${endDate.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;


    


    if (!(await confirmAction(confirmMsg))) return;





    const entry = buildSleepEntry({


      startDate,


      endDate,


      notes,


      entryId: editingSleepEntry ? editingSleepEntry.id : undefined


    });


    


    if(!entry) throw new Error('Impossible d\'enregistrer cette session.');


    


    await saveSleepEntry(entry, { reason: editingSleepEntry ? 'Modifier le sommeil' : 'Ajouter sommeil' });


    stopSleepTimer({ persist: true, resetDisplay: true });


  });


}





function showBottlePrompt(){


  bottleForm.classList.add('is-visible');


}





function hideBottlePrompt({ clearValue = false } = {}){


  if(bottleForm){


    bottleForm.classList.remove('is-visible');


  }


  if(clearValue && bottleAmountInput){


    bottleAmountInput.value = '';


    handleBottleAmountInputChange();


  }


  if(clearValue){


    if(bottleStartInput) bottleStartInput.value = '';


    if(bottleEndInput) bottleEndInput.value = '';


    updateBottleTimeSummary();


  }


}


hideBottlePrompt();





function tickBottleTimer(){


  if(!bottleTimerStart) return;


  bottleTimer = Math.max(0, Math.floor((Date.now() - bottleTimerStart) / 1000));


  updateBottleChrono();


}





function beginBottleTimer(startTimestamp = Date.now(), persist = true){


  showBottlePrompt();


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


  if(activeFocusMode === 'bottle') updateFocusDisplay(bottleTimer);


  const label = new Date(bottleTimerStart).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});


  updateBottleTimeSummary();


  startStopBottleBtn && (startStopBottleBtn.textContent = 'Stop');


  bottlePendingDuration = 0;


  store.remove(BOTTLE_PENDING_KEY);


  if(persist){


    store.set(BOTTLE_TIMER_KEY, { start: bottleTimerStart });


  }


}





function stopBottleTimerWithoutSaving({ resetDisplay = true, persist = true } = {}){


  if(bottleTimerInterval){


    triggerVibration();


    clearInterval(bottleTimerInterval);


    bottleTimerInterval = null;


  }


  if (bottleTimerStart) lastStoppedBottleStart = bottleTimerStart;


  lastBottleStopRequestedAt = Date.now();


  bottleTimerStart = null;


  store.remove(BOTTLE_TIMER_KEY);


  if(persist){


    getPersistenceApi()?.saveTimer('bottle', null);


  }


  startStopBottleBtn && (startStopBottleBtn.textContent = 'Démarrer');


  if(resetDisplay){


    bottleTimer = 0;


    updateBottleChrono();


    updateBottleTimeSummary();


  }


}





function syncLocalTimersWithRemote(activeTimers) {


  if (!activeTimers) activeTimers = {};





  // Breast


  const breast = activeTimers.breast;


  if (breast && breast.start) {


    const isJustStopped = lastStoppedTimerStart && Math.abs(lastStoppedTimerStart - breast.start) < 1000;


    if (!isJustStopped && (!timerStart || Math.abs(timerStart - breast.start) > 1000)) {


      setFeedMode('breast');


      if (breast.side) setBreastSide(breast.side);


      beginTimer(breast.start, false);


    } else if (breast.side && breast.side !== breastSide) {


       setBreastSide(breast.side);


    }


  } else if (timerStart) {


    // If remote has no timer but local does, stop local (unless we just started it and it hasn't synced yet)


    // Firestore local writes are immediate in snapshot, so this is safe.


    stopTimerWithoutSaving();


  } else {


    lastStoppedTimerStart = null;


  }





  // Bottle


  const bottle = activeTimers.bottle;


  if (bottle && bottle.start) {


    if(bottlePendingDuration > 0 || bottlePendingAmount != null){


      getPersistenceApi()?.saveTimer('bottle', null);


    } else if(lastBottleStopRequestedAt && Date.now() - lastBottleStopRequestedAt < 10000){


      getPersistenceApi()?.saveTimer('bottle', null);


    } else {


      const isJustStopped = lastStoppedBottleStart && Math.abs(lastStoppedBottleStart - bottle.start) < 1000;


      if (!isJustStopped && (!bottleTimerStart || Math.abs(bottleTimerStart - bottle.start) > 1000)) {


        setFeedMode('bottle');


        if (bottle.bottleType) setBottleType(bottle.bottleType, {persist:true});


        beginBottleTimer(bottle.start, false);


      }


    }


  } else if (bottleTimerStart) {


    stopBottleTimerWithoutSaving({ persist: false });


  } else {


    lastStoppedBottleStart = null;


    lastBottleStopRequestedAt = null;


  }





  // Sleep


  const sleep = activeTimers.sleep;


  if (sleep && sleep.start) {


    const isJustStopped = lastStoppedSleepStart && Math.abs(lastStoppedSleepStart - sleep.start) < 1000;


    if (!isJustStopped && (!sleepTimerStart || Math.abs(sleepTimerStart - sleep.start) > 1000)) {


      beginSleepTimer(sleep.start, false);


    }


  } else if (sleepTimerStart) {


    stopSleepTimer({ persist: true, resetDisplay: true });


  } else {


    lastStoppedSleepStart = null;


  }


}





function syncRemoteTimersFromLocal(activeTimers) {


  const timers = activeTimers || {};


  const api = getPersistenceApi();


  if (!api) return;





  if (timerStart && !timers?.breast?.start) {


    api.saveTimer('breast', { start: timerStart, side: breastSide });


  }


  if (bottleTimerStart && !timers?.bottle?.start) {


    api.saveTimer('bottle', { start: bottleTimerStart, bottleType });


  }


  if (sleepTimerStart && !timers?.sleep?.start) {


    api.saveTimer('sleep', { start: sleepTimerStart });


  }


}





// ===== Milestones Logic =====


milestonesBtn?.addEventListener('click', () => {


  renderMilestones();


  openModal('#modal-milestones');


});


closeMilestonesBtn?.addEventListener('click', () => closeModal('#modal-milestones'));





function renderMilestones() {


  if (!milestonesList) return;


  milestonesList.innerHTML = '';


  


  const sorted = [...state.milestones].sort((a, b) => a.dateISO < b.dateISO ? 1 : -1);


  


  if (sorted.length === 0) {


    milestonesList.innerHTML = '<div class="history-empty">Aucune étape enregistrée.</div>';


    return;


  }





  sorted.forEach(m => {


    const date = new Date(m.dateISO).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });


    const el = document.createElement('div');


    el.className = 'milestone-item';


    el.innerHTML = `


      <div class="milestone-icon">${m.icon || '🏆'}</div>


      <div class="milestone-content">


        <div class="milestone-title">${escapeHtml(m.title)}</div>


        <div class="milestone-date">${date}</div>


      </div>


      <button class="btn btn-ghost btn-compact btn-danger" onclick="deleteMilestone('${m.id}')">×</button>


    `;


    milestonesList.appendChild(el);


  });


}





window.deleteMilestone = function(id) {


  if(confirm('Supprimer cette étape ?')) {


    updateState(data => ({


      ...data,


      milestones: data.milestones.filter(m => m.id !== id)


    }));


    getPersistenceApi()?.deleteEntries([{ type: 'milestone', id }]);


    renderMilestones();


  }


};





saveMilestoneBtn?.addEventListener('click', async () => {


  const title = milestoneTitleInput?.value?.trim();


  const dateVal = milestoneDateInput?.value;


  const icon = milestoneIconSelect?.value || '🏆';





  if (!title || !dateVal) {


    alert('Veuillez remplir le titre et la date.');


    return;


  }





  const entry = {


    id: Date.now() + '',


    dateISO: new Date(dateVal).toISOString(),


    title,


    icon


  };





  updateState(data => ({


    ...data,


    milestones: [...data.milestones, entry]


  }));





  await getPersistenceApi()?.saveEntry('milestone', entry, 'Add milestone');


  


  milestoneTitleInput.value = '';


  milestoneDateInput.value = '';


  renderMilestones();


});





function setFeedMode(mode){


  feedMode = mode;


  const pecho = $('#seg-pecho');


  const biberon = $('#seg-biberon');


  pecho?.classList?.toggle('active', mode === 'breast');


  biberon?.classList?.toggle('active', mode === 'bottle');


  paneTetee?.classList?.toggle('is-hidden', mode !== 'breast');


  paneBiberon?.classList?.toggle('is-hidden', mode !== 'bottle');


}








function normalizeBottlePresetCounts(rawCounts){


  if(!rawCounts || typeof rawCounts !== 'object'){


    return {};


  }


  return Object.entries(rawCounts).reduce((acc, [key, value]) => {


    const numericKey = Number(key);


    const numericValue = Number(value);


    if(


      Number.isFinite(numericKey) &&


      BOTTLE_PRESET_VALUES.includes(numericKey) &&


      Number.isFinite(numericValue) &&


      numericValue > 0


    ){


      acc[numericKey] = numericValue;


    }


    return acc;


  }, {});


}





function clampBottleValue(value){


  const safe = Number.isFinite(value) ? value : 0;


  return Math.max(BOTTLE_MIN_ML, Math.min(BOTTLE_MAX_ML, Math.round(safe)));


}





function animateBottleBounce(target){


  if(!target) return;


  target.style.animation = 'none';


  void target.offsetHeight;


  target.style.animation = 'bounce-soft 0.26s ease-out';


}





function updateBottleAmountFeedback(value){


  if(!bottleAmountFeedback) return;


  if(!Number.isFinite(value) || value <= 0){


    bottleAmountFeedback.textContent = 'Choisissez ou ajustez';


    bottleAmountFeedback.classList.remove('is-strong');


    return;


  }


  bottleAmountFeedback.textContent = `${formatNumber(value)} ml sAclectionnAcs`;


  bottleAmountFeedback.classList.add('is-strong');


  animateBottleBounce(bottleAmountFeedback);


}





function updateManualBottleFeedback(value){


  if(!manualBottleFeedback) return;


  if(!Number.isFinite(value) || value <= 0){


    manualBottleFeedback.textContent = 'Choisissez ou ajustez';


    manualBottleFeedback.classList.remove('is-strong');


    return;


  }


  manualBottleFeedback.textContent = `${formatNumber(value)} ml saisis`;


  manualBottleFeedback.classList.add('is-strong');


  animateBottleBounce(manualBottleFeedback);


}





function getBottlePresetUpgradeCandidate(){


  let candidate = null;


  BOTTLE_PRESET_VALUES.forEach(value => {


    if(value <= BOTTLE_BASE_DEFAULT_PRESET){


      return;


    }


    const usageCount = Number(bottlePresetCounts?.[value]) || 0;


    if(usageCount >= BOTTLE_PRESET_PROMOTION_THRESHOLD){


      candidate = candidate === null ? value : Math.max(candidate, value);


    }


  });


  return candidate;


}





function resolveBottleDefaultPreset(){


  const storedRaw = store.get(BOTTLE_PRESET_DEFAULT_KEY, null);


  const storedValue = typeof storedRaw === 'number'


    ? storedRaw


    : (storedRaw === null || storedRaw === undefined ? NaN : Number(storedRaw));


  let resolved = BOTTLE_PRESET_VALUES.includes(storedValue) ? storedValue : BOTTLE_BASE_DEFAULT_PRESET;


  if(!BOTTLE_PRESET_VALUES.includes(storedValue)){


    store.set(BOTTLE_PRESET_DEFAULT_KEY, resolved);


  }


  const candidate = getBottlePresetUpgradeCandidate();


  if(candidate && candidate !== resolved){


    resolved = candidate;


    store.set(BOTTLE_PRESET_DEFAULT_KEY, resolved);


  }


  return resolved;


}





function maybeUpdateBottleDefaultFromCounts(){


  const candidate = getBottlePresetUpgradeCandidate();


  if(candidate && candidate !== bottleDefaultPreset){


    bottleDefaultPreset = candidate;


    store.set(BOTTLE_PRESET_DEFAULT_KEY, bottleDefaultPreset);


  }


}





function incrementBottlePresetUsage(value){


  const numericValue = Number(value);


  if(!BOTTLE_PRESET_VALUES.includes(numericValue)){


    return;


  }


  bottlePresetCounts = {


    ...bottlePresetCounts,


    [numericValue]: (Number(bottlePresetCounts?.[numericValue]) || 0) + 1


  };


  store.set(BOTTLE_PRESET_COUNTS_KEY, bottlePresetCounts);


  maybeUpdateBottleDefaultFromCounts();


}





function highlightBottlePresetButton(value){


  if(!bottlePresetButtons.length){


    return false;


  }


  const numericValue = Number(value);


  const hasValue = Number.isFinite(numericValue);


  let matched = false;


  bottlePresetButtons.forEach(btn => {


    const btnValue = Number(btn.dataset.value);


    const isMatch = hasValue && Number.isFinite(btnValue) && btnValue === numericValue;


    btn.classList.toggle('is-selected', isMatch);


    btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');


    if(isMatch){


      matched = true;


    }


  });


  if(!matched && !hasValue){


    bottlePresetButtons.forEach(btn => btn.setAttribute('aria-pressed', 'false'));


  }


  return matched;


}





function selectBottlePresetValue(value, {countUsage = false} = {}){


  const numericValue = Number(value);


  if(!Number.isFinite(numericValue)){


    highlightBottlePresetButton(null);


    updateBottleAmountFeedback(null);


    return;


  }


  if(bottleAmountInput){


    bottleAmountInput.value = String(numericValue);


  }


  highlightBottlePresetButton(numericValue);


  updateBottleAmountFeedback(numericValue);


  animateBottleBounce(bottleAmountInput);


  if(countUsage){


    incrementBottlePresetUsage(numericValue);


  }


}





function applyBottleDefaultAmount(){


  const defaultValue = Number.isFinite(bottleDefaultPreset) ? bottleDefaultPreset : BOTTLE_BASE_DEFAULT_PRESET;


  selectBottlePresetValue(defaultValue, {countUsage: false});


}





function handleBottleAmountInputChange(){


  if(!bottleAmountInput){


    return;


  }


  const rawValue = bottleAmountInput.value.trim();


  if(rawValue === ''){


    highlightBottlePresetButton(null);


    updateBottleAmountFeedback(null);


    return;


  }


  const normalized = parseFloat(rawValue.replace(',', '.'));


  if(Number.isFinite(normalized)){


    highlightBottlePresetButton(normalized);


    updateBottleAmountFeedback(normalized);


  }else{


    highlightBottlePresetButton(null);


    updateBottleAmountFeedback(null);


  }


}





function setBottleType(type, {persist = true} = {}){


  const allowed = new Set(['maternal','supplement']);


  const next = allowed.has(type) ? type : 'maternal';


  bottleType = next;


  bottleTypeButtons.forEach(btn => {


    const isActive = (btn.dataset.type || '') === next;


    btn.classList.toggle('active', isActive);


    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');


  });


  if(persist){


    store.set(BOTTLE_TYPE_PREF_KEY, bottleType);


  }


}





function setBreastSide(side){


  breastSide = side;


  $('#side-left')?.classList?.toggle('active', side === 'Gauche');


  $('#side-right')?.classList?.toggle('active', side === 'Droite');


  $('#side-both')?.classList?.toggle('active', side === 'Les deux');


  if(timerStart){


    store.set(TIMER_KEY, { start: timerStart, breastSide });


  }


  if(timerStart) getPersistenceApi()?.saveTimer('breast', { start: timerStart, side: breastSide });


}








function normalizeBreastSideToken(currentSide = 'Gauche'){


  const value = (currentSide || '').toLowerCase();


  if(value.includes('deux') || value.includes('both')){


    return 'both';


  }


  if(value.includes('droite') || value.includes('right')){


    return 'right';


  }


  return 'left';


}





function normalizeMilkTypeFromApp(type = 'maternal'){


  return type === 'supplement' ? 'formula' : 'maternal';


}





function parseBottleAmountInput(){


  const rawValue = bottleAmountInput?.value ?? '';


  const normalized = rawValue.replace(',', '.').trim();


  const parsed = parseFloat(normalized);


  return Number.isFinite(parsed) ? clampBottleValue(parsed) : null;


}





function adjustBottleAmount(deltaMl = BOTTLE_STEP_ML){


  const currentValue = parseBottleAmountInput();


  const baseValue = Number.isFinite(currentValue)


    ? currentValue


    : (Number.isFinite(bottlePendingAmount) ? bottlePendingAmount : BOTTLE_BASE_DEFAULT_PRESET);


  const nextValue = clampBottleValue(baseValue + deltaMl);


  if(nextValue <= 0){


    if(bottleAmountInput){


      bottleAmountInput.value = '';


    }


    highlightBottlePresetButton(null);


    updateBottleAmountFeedback(null);


    return;


  }


  selectBottlePresetValue(nextValue, {countUsage: false});


  updateBottleAmountFeedback(nextValue);


}





function highlightManualBottlePreset(value){


  if(!manualBottlePresetButtons.length){


    return false;


  }


  const numericValue = Number(value);


  const hasValue = Number.isFinite(numericValue);


  let matched = false;


  manualBottlePresetButtons.forEach(btn => {


    const btnValue = Number(btn.dataset.value);


    const isMatch = hasValue && Number.isFinite(btnValue) && btnValue === numericValue;


    btn.classList.toggle('is-selected', isMatch);


    btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');


    if(isMatch){


      matched = true;


    }


  });


  if(!matched && !hasValue){


    manualBottlePresetButtons.forEach(btn => btn.setAttribute('aria-pressed', 'false'));


  }


  return matched;


}





function setManualBottleAmount(value){


  const numericValue = clampBottleValue(value);


  if(manualAmount){


    manualAmount.value = numericValue > 0 ? String(numericValue) : '';


  }


  updateManualBottleFeedback(numericValue);


  highlightManualBottlePreset(numericValue);


}





function adjustManualBottleAmount(delta = BOTTLE_STEP_ML){


  const raw = manualAmount?.value ?? '';


  const current = parseFloat(String(raw).replace(',', '.'));


  const base = Number.isFinite(current) ? current : BOTTLE_BASE_DEFAULT_PRESET;


  const next = clampBottleValue(base + delta);


  if(next <= 0){


    if(manualAmount) manualAmount.value = '';


    updateManualBottleFeedback(null);


    highlightManualBottlePreset(null);


    return;


  }


  setManualBottleAmount(next);


}





function mapFloatingDraftToEntry(draft){


  if(!draft) return null;


  const durationSec = Math.max(1, Math.round((draft.durationMs || 0) / 1000));


  if(draft.mode === 'sein'){


    let breastSideLabel = 'Gauche';


    if(draft.side === 'right'){


      breastSideLabel = 'Droite';


    } else if(draft.side === 'both'){


      breastSideLabel = 'Les deux';


    }


    return {


      id: Date.now()+'',


      dateISO: new Date().toISOString(),


      source: 'breast',


      breastSide: breastSideLabel,


      durationSec


    };


  }


  if(draft.mode === 'biberon'){


    if(!Number.isFinite(draft.amountMl) || draft.amountMl <= 0){


      alert('Ajoutez la quantité totale en ml avant de valider le biberon.');


      return null;


    }


    const startTs = draft.startTimestamp || Date.now();


    const endTs = draft.endTimestamp || startTs;


    return {


      id: Date.now()+'',


      dateISO: new Date().toISOString(),


      source: 'bottle',


      bottleType: mapMilkTypeToBottleType(draft.milkType),


      amountMl: draft.amountMl,


      durationSec,


      bottleStartISO: new Date(startTs).toISOString(),


      bottleEndISO: new Date(endTs).toISOString()


    };


  }


  return null;


}





function mapMilkTypeToBottleType(value = 'maternal'){


  if(value === 'formula' || value === 'mixta'){


    return 'supplement';


  }


  return 'maternal';


}





function setFloatingButtonState(mode, isActive){


  const target = mode === 'sein' ? startStopBtn : startStopBottleBtn;


  if(!target) return;


  target.disabled = !!isActive;


  if(isActive){


    target.textContent = 'Fenêtre active';


    return;


  }


  const timerRunning = mode === 'sein' ? Boolean(timerInterval) : Boolean(bottleTimerInterval);


  if(!timerRunning){


    target.textContent = 'Démarrer';


  }


}





function beginTimer(startTimestamp = Date.now(), persist = true){


  timerStart = startTimestamp;


  timerInterval && clearInterval(timerInterval);


  timerInterval = setInterval(tickTimer, 1000);


  tickTimer();


  if(activeFocusMode === 'breast') updateFocusDisplay(timer);


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


  if (timerStart) lastStoppedTimerStart = timerStart;


  timerStart = null;


  store.remove(TIMER_KEY);


  startStopBtn && (startStopBtn.textContent = 'Démarrer');


  startTimeDisplay && (startTimeDisplay.textContent = '');


  timer = 0;


  updateChrono();


}





function tickTimer(){


  if(!timerStart) return;


  timer = Math.max(0, Math.floor((Date.now() - timerStart) / 1000));


  updateChrono();


  if(activeFocusMode === 'breast') updateFocusDisplay(timer);


}





function updateBottleIntervalHint(){


  if(!bottleNextHint) return;


  const feeds = Array.isArray(state.feeds) ? state.feeds : [];


  let lastTs = null;


  let lastLabel = '';


  for(const feed of feeds){


    if(feed?.source !== 'bottle') continue;


    const iso = feed.bottleEndISO || feed.dateISO || feed.bottleStartISO;


    const ts = iso ? Date.parse(iso) : NaN;


    if(Number.isFinite(ts) && (lastTs === null || ts > lastTs)){


      lastTs = ts;


      lastLabel = formatDateTimeLabel(new Date(ts));


    }


  }


  const setBottleHint = (mainText, metaText, stateLabel) => {


    if(bottleNextValueEl){


      bottleNextValueEl.textContent = mainText;


    }else{


      bottleNextHint.textContent = mainText;


    }


    if(bottleNextMetaEl){


      bottleNextMetaEl.textContent = metaText || '';


    }


    bottleNextHint.dataset.state = stateLabel;


  };


  if(!lastTs){


    setBottleHint('Prochain biberon a la demande', 'Aucun biberon enregistre', 'empty');


    return;


  }


  const now = Date.now();


  const diff = now - lastTs;


  const remaining = BOTTLE_INTERVAL_MS - diff;


  if(remaining <= 0){


    setBottleHint('Prochain biberon possible maintenant', `Dernier: ${lastLabel}`, 'ready');


    return;


  }


  const remainingLabel = formatDuration(Math.round(remaining / 1000));


  setBottleHint(`Prochain biberon dans ${remainingLabel}`, `Dernier: ${lastLabel}`, 'wait');


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





btnBreast?.addEventListener('click', ()=> {
  setFeedMode('breast');
  openModal('#modal-leche');
  updateBottleIntervalHint();
  pendingBreastAutoStart = true;
});
btnBottle?.addEventListener('click', ()=> {
  setFeedMode('bottle');
  openModal('#modal-leche');
  updateBottleIntervalHint();
  if(!bottleTimerInterval){
    beginBottleTimer(Date.now(), true);
    getPersistenceApi()?.saveTimer('bottle', { start: Date.now(), bottleType });
    enterFocusMode('bottle');
  }
});
$('#close-leche')?.addEventListener('click', ()=> {
  closeModal('#modal-leche');
  pendingBreastAutoStart = false;
});
milkDetailsBtn?.addEventListener('click', () => {
  const todayKey = toDateInputValue(new Date());
  openMilkDetails({ mode: 'week' }, todayKey);
});



$('#seg-pecho')?.addEventListener('click', ()=> setFeedMode('breast'));


$('#seg-biberon')?.addEventListener('click', ()=> setFeedMode('bottle'));





bottleTypeButtons.forEach(btn => btn.addEventListener('click', ()=> setBottleType(btn.dataset.type)));


bottlePresetButtons.forEach(btn => {


  btn.addEventListener('click', () => {


    const value = Number(btn.dataset.value);


    if(Number.isFinite(value)){


      selectBottlePresetValue(value, {countUsage: true});


      triggerVibration(30);


      animateBottleBounce(btn);


    }


  });


});


bottleAmountInput?.addEventListener('input', handleBottleAmountInputChange);


bottleAmountInput?.addEventListener('change', handleBottleAmountInputChange);


bottleDecreaseBtn?.addEventListener('click', () => {


  adjustBottleAmount(-BOTTLE_STEP_ML);


  triggerVibration(20);


});


bottleIncreaseBtn?.addEventListener('click', () => {


  adjustBottleAmount(BOTTLE_STEP_ML);


  triggerVibration(30);


});


pumpControlBtn?.addEventListener('click', () => togglePumpSession());


pumpAmountDownBtn?.addEventListener('click', () => {


  adjustPumpAmount(-PUMP_AMOUNT_STEP);


  triggerVibration(20);


});


pumpAmountUpBtn?.addEventListener('click', () => {


  adjustPumpAmount(PUMP_AMOUNT_STEP);


  triggerVibration(20);


});


pumpSaveIntentBtn?.addEventListener('click', () => {


  openPumpConfirmModal();


});


pumpCancelIntentBtn?.addEventListener('click', () => {


  resetPumpSession();


});


pumpConfirmYesBtn?.addEventListener('click', async () => {


  await completePumpSession({ reason: 'Tirage confirmé' });


});


pumpConfirmAdjustBtn?.addEventListener('click', () => {


  closePumpConfirmModal();


});


btnPump?.addEventListener('click', () => openModal('#modal-pump'));


closePumpBtn?.addEventListener('click', () => {


  resetPumpSession();


  closeModal('#modal-pump');


});


btnSleep?.addEventListener('click', () => openSleepModal());


closeSleepBtn?.addEventListener('click', () => closeSleepModal());


cancelSleepBtn?.addEventListener('click', () => {


  clearSleepPending();


  closeSleepModal();


});


startStopSleepBtn?.addEventListener('click', async () => {


  if(sleepTimerInterval){


    triggerVibration();


    const startedAt = sleepTimerStart;


    const elapsed = Math.max(1, Math.floor((Date.now() - sleepTimerStart) / 1000));


    stopSleepTimer({ resetDisplay: false });


    if(Number.isFinite(startedAt)){


      const startDate = new Date(startedAt);


      const endDate = new Date(startedAt + elapsed * 1000);


      const notes = sleepNotesInput?.value?.trim();


      const entry = buildSleepEntry({ startDate, endDate, notes });


      if(entry){


        await saveSleepEntry(entry, { reason: 'Sommeil (chrono)' });


      }


    }


  }else{


    const desiredStart = parseDateTimeInput(sleepStartInput?.value);


    const useProvidedStart = Boolean(editingSleepEntry && desiredStart);


    const ts = useProvidedStart ? desiredStart.getTime() : Date.now();


    beginSleepTimer(ts, true);


    if(!useProvidedStart && sleepEndInput){


      sleepEndInput.value = '';


    }


    clearSleepPending();


    enterFocusMode('sleep');


  }


});


saveSleepBtn?.addEventListener('click', async () => {


  triggerVibration();


  const startDate = parseDateTimeInput(sleepStartInput?.value);


  if(!startDate){


    alert('Veuillez indiquer l\'heure de début.');


    sleepStartInput?.focus();


    return;


  }


  const endDate = parseDateTimeInput(sleepEndInput?.value);


  if(!endDate){


    alert('Veuillez indiquer l\'heure de fin.');


    sleepEndInput?.focus();


    return;


  }


  if(endDate.getTime() <= startDate.getTime()){


    alert('L\'heure de fin doit être postérieure au début.');


    sleepEndInput?.focus();


    return;


  }


  const notes = sleepNotesInput?.value?.trim();


  const entry = buildSleepEntry({


    startDate,


    endDate,


    notes,


    entryId: editingSleepEntry ? editingSleepEntry.id : undefined


  });


  if(!entry){


    alert('Impossible d\'enregistrer cette session.');


    return;


  }


  await saveSleepEntry(entry, { reason: editingSleepEntry ? 'Modifier le sommeil' : 'Ajouter sommeil' });


});





$('#side-left')?.addEventListener('click', ()=> {
  setBreastSide('Gauche');
  if(pendingBreastAutoStart && !timerInterval){
    pendingBreastAutoStart = false;
    beginTimer(Date.now(), true);
    getPersistenceApi()?.saveTimer('breast', { start: Date.now(), side: breastSide });
    enterFocusMode('breast');
  }
});
$('#side-right')?.addEventListener('click', ()=> {
  setBreastSide('Droite');
  if(pendingBreastAutoStart && !timerInterval){
    pendingBreastAutoStart = false;
    beginTimer(Date.now(), true);
    getPersistenceApi()?.saveTimer('breast', { start: Date.now(), side: breastSide });
    enterFocusMode('breast');
  }
});
$('#side-both')?.addEventListener('click', ()=> {
  setBreastSide('Les deux');
  if(pendingBreastAutoStart && !timerInterval){
    pendingBreastAutoStart = false;
    beginTimer(Date.now(), true);
    getPersistenceApi()?.saveTimer('breast', { start: Date.now(), side: breastSide });
    enterFocusMode('breast');
  }
});



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


    getPersistenceApi()?.saveTimer('breast', null);


  }else{


    setFeedMode('breast');


    beginTimer(Date.now(), true);


    getPersistenceApi()?.saveTimer('breast', { start: Date.now(), side: breastSide });


    enterFocusMode('breast');


  }


});





// ===== Bottle Time UX Logic =====


function updateBottleTimeSummary() {


  if (!bottleTimeLabel) return;


  


  // If timer is running


  if (bottleTimerInterval && bottleTimerStart) {


    const start = new Date(bottleTimerStart);


    bottleTimeLabel.textContent = `En cours depuis ${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;


    return;


  }





  // If manual inputs have values


  const startVal = bottleStartInput?.value;


  const endVal = bottleEndInput?.value;


  


  if (startVal) {


    const s = new Date(startVal);


    const e = endVal ? new Date(endVal) : null;


    const sStr = s.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});


    const eStr = e ? e.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '...';


    bottleTimeLabel.textContent = `${sStr} - ${eStr}`;


  } else {


    bottleTimeLabel.textContent = "Aujourd'hui (maintenant)";


  }


}





function toggleBottleDetails(forceOpen) {


  const isOpen = bottleDetailsWrapper.classList.contains('is-open');


  const shouldOpen = forceOpen !== undefined ? forceOpen : !isOpen;


  


  bottleDetailsWrapper.classList.toggle('is-open', shouldOpen);


  bottleTimeSummary.setAttribute('aria-expanded', shouldOpen);


  


  if (shouldOpen && bottleStartInput && !bottleStartInput.value) {


    // Usar la hora de inicio real si el temporizador está corriendo


    const start = bottleTimerStart ? new Date(bottleTimerStart) : new Date();


    bottleStartInput.value = toDateTimeInputValue(start);


    // Si corre, fin es ahora. Si no, fin = inicio (para edición rápida)


    const end = bottleTimerStart ? new Date() : start;


    bottleEndInput.value = toDateTimeInputValue(end);


  }


}





bottleTimeSummary?.addEventListener('click', () => toggleBottleDetails());


confirmBottleTimeBtn?.addEventListener('click', () => {


  updateBottleTimeSummary();


  toggleBottleDetails(false);


});


cancelBottleTimeBtn?.addEventListener('click', () => {


  // Logic to revert could go here, for now just close


  toggleBottleDetails(false);


});





startStopBottleBtn?.addEventListener('click', async () => {


  if(!bottleTimerInterval){


    const tracker = window.appleoFloatingTracker;


    if(tracker?.openSession){


      const initialAmount = parseBottleAmountInput();


      const floatingContext = {


        milkType: normalizeMilkTypeFromApp(bottleType),


        autoStart: true


      };


      if(Number.isFinite(initialAmount)){


        floatingContext.amount = initialAmount;


      }


      const handled = await tracker.openSession('biberon', floatingContext);


      if(handled){


        return;


      }


    }


  }





  if(bottleTimerInterval){


    const start = bottleTimerStart || Date.now();


    const elapsed = Math.max(1, Math.floor((Date.now() - start) / 1000));


    const endTs = Date.now();


    stopBottleTimerWithoutSaving({ resetDisplay: false });


    bottleTimer = elapsed;


    updateBottleChrono();


    


    if(bottleStartInput) bottleStartInput.value = toDateTimeInputValue(new Date(start));


    if(bottleEndInput) bottleEndInput.value = toDateTimeInputValue(new Date(endTs));


    updateBottleTimeSummary();


    bottlePendingDuration = elapsed;


    store.set(BOTTLE_PENDING_KEY, bottlePendingDuration);


    // UX Improvement: Removed blocking window.prompt.


    // The user can now adjust the amount in the inline form which is already visible or will be shown below.


    showBottlePrompt();


    if (saveBottleBtn) {


        saveBottleBtn.classList.add('save-biberon');


        setTimeout(() => {


            saveBottleBtn.classList.remove('save-biberon');


        }, 2000);


    }


    if(bottleAmountInput){


      bottleAmountInput.value = bottlePendingAmount != null ? String(bottlePendingAmount) : '';


      bottleAmountInput.placeholder = 'ex. 120';


      handleBottleAmountInputChange();


      // Auto-focus amount for immediate entry if needed, but prevent scroll jump if possible


      bottleAmountInput.focus({ preventScroll: false });


    }


  }else{


    bottlePendingAmount = null;


    store.remove(BOTTLE_AMOUNT_KEY);


    if(bottleAmountInput){


      bottleAmountInput.value = '';


      handleBottleAmountInputChange();


    }


    setFeedMode('bottle');


    beginBottleTimer(Date.now(), true);


    updateBottleTimeSummary();


    enterFocusMode('bottle');


  }


});





saveBottleBtn?.addEventListener('click', async () => {


  await safeAction(saveBottleBtn, async () => {


    triggerVibration();


    


    const rawValue = bottleAmountInput?.value ?? '';


    const normalizedValue = rawValue.replace(',', '.').trim();


    const amount = clampBottleValue(parseFloat(normalizedValue));


    


    if(!Number.isFinite(amount) || amount <= 0){


      bottleAmountInput?.focus({ preventScroll: false });


      throw new Error('Veuillez saisir une quantité valide en ml.');


    }





    // Phase 3-B: Confirmation


    if (!(await confirmAction(`Confirmer le biberon de ${amount} ml ?`))) return;





    bottlePendingAmount = amount;


    store.set(BOTTLE_AMOUNT_KEY, bottlePendingAmount);





    // Si el temporizador está corriendo y no hay duración pendiente, calcularla ahora


    if (bottleTimerStart && (!bottlePendingDuration || bottlePendingDuration === 0)) {


      bottlePendingDuration = Math.max(1, Math.floor((Date.now() - bottleTimerStart) / 1000));


    }





    let startISO = bottleTimerStart ? new Date(bottleTimerStart).toISOString() : undefined;


    let endISO = undefined;


    let durationSec = bottlePendingDuration;





    if (bottleStartInput && bottleStartInput.value) {


      const s = parseDateTimeInput(bottleStartInput.value);


      if (s) startISO = s.toISOString();


    }


    if (bottleEndInput && bottleEndInput.value) {


      const e = parseDateTimeInput(bottleEndInput.value);


      if (e) endISO = e.toISOString();


    }





    if (startISO && endISO) {


      if (new Date(endISO) < new Date(startISO)) {


        if(bottleEndInput) bottleEndInput.focus();


        throw new Error('L\'heure de fin doit être postérieure au début.');


      }


      const calculatedDuration = Math.round((new Date(endISO).getTime() - new Date(startISO).getTime()) / 1000);


      if (calculatedDuration === 0 && bottlePendingDuration > 0) {


        durationSec = bottlePendingDuration;


        endISO = new Date(new Date(startISO).getTime() + durationSec * 1000).toISOString();


      } else {


        durationSec = calculatedDuration;


      }


    } else if (startISO && durationSec > 0) {


      endISO = new Date(new Date(startISO).getTime() + durationSec * 1000).toISOString();


    }





    const entry = {


      id: Date.now()+'',


      dateISO: endISO || new Date().toISOString(),


      source: 'bottle',


      amountMl: bottlePendingAmount,


      durationSec: durationSec > 0 ? durationSec : null,


      bottleStartISO: startISO || null,


      bottleEndISO: endISO || null


    };





    await saveFeed(entry);





    bottlePendingDuration = 0;


    store.remove(BOTTLE_PENDING_KEY);


    bottlePendingAmount = null;


    store.remove(BOTTLE_AMOUNT_KEY);


    hideBottlePrompt({ clearValue: true });


    applyBottleDefaultAmount();


    stopBottleTimerWithoutSaving();


  });


});





// ===== Focus Mode Logic =====


function enterFocusMode(type) {


  activeFocusMode = type;


  focusOverlay.classList.add('active');


  focusOverlay.setAttribute('aria-hidden', 'false');


  


  let icon = '⏱️';


  let label = 'Activité';


  let meta = '';


  let initialSeconds = 0;





  if (type === 'breast') {


    icon = '🤱';


    label = 'Tétée';


    meta = `Sein ${breastSide}`;


    initialSeconds = timer;


  } else if (type === 'bottle') {


    icon = '🍼';


    label = 'Biberon';


    meta = bottleType === 'maternal' ? 'Lait maternel' : 'Lait artificiel';


    initialSeconds = bottleTimer;


  } else if (type === 'sleep') {


    icon = '💤';


    label = 'Sommeil';


    meta = 'Dodo en cours';


    initialSeconds = sleepTimer;


  } else if (type === 'pump') {


    icon = '🌀';


    label = 'Tirage';


    meta = 'Tire-lait';


    initialSeconds = pumpTimerSeconds;


  }





  focusIcon.textContent = icon;


  focusLabel.textContent = label;


  focusMeta.textContent = meta;


  updateFocusDisplay(initialSeconds);


}





function exitFocusMode() {


  if (focusOverlay.contains(document.activeElement)) {


    document.activeElement.blur();


  }


  activeFocusMode = null;


  focusOverlay.classList.remove('active');


  focusOverlay.setAttribute('aria-hidden', 'true');


}





function updateFocusDisplay(seconds) {


  if (!focusTimerEl) return;


  const h = Math.floor(seconds / 3600);


  const m = Math.floor((seconds % 3600) / 60);


  const s = seconds % 60;


  


  const mStr = String(m).padStart(2, '0');


  const sStr = String(s).padStart(2, '0');


  


  focusTimerEl.textContent = h > 0 ? `${h}:${mStr}:${sStr}` : `${mStr}:${sStr}`;


}





$$('.btn-focus-toggle').forEach(btn => {


  btn.addEventListener('click', (e) => {


    const type = e.target.dataset.focus;


    enterFocusMode(type);


  });


});





focusMinimizeBtn?.addEventListener('click', exitFocusMode);





focusActionBtn?.addEventListener('click', () => {


  const mode = activeFocusMode;


  exitFocusMode();


  if (mode === 'breast') {


    startStopBtn?.click();


  } else if (mode === 'bottle') {


    startStopBottleBtn?.click();


  } else if (mode === 'sleep') {


    startStopSleepBtn?.click();


  } else if (mode === 'pump') {


    pumpControlBtn?.click();


  }


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


  updateBottleTimeSummary();


  startStopBottleBtn && (startStopBottleBtn.textContent = 'Démarrer');


  if(bottleAmountInput){


    bottleAmountInput.value = bottlePendingAmount != null ? String(bottlePendingAmount) : '';


    bottleAmountInput.placeholder = 'ex. 120';


    handleBottleAmountInputChange();


    bottleAmountInput.focus({ preventScroll: false });


  }


}


const savedSleepTimer = store.get(SLEEP_TIMER_KEY, null);


if(savedSleepTimer && savedSleepTimer.start){


  beginSleepTimer(savedSleepTimer.start, false);


}


if(sleepPendingDuration > 0 && sleepPendingStart != null){


  applySleepPendingToInputs();


}





// ===== Eliminations modal logic =====


let elimState = {


  scales: { pee: 0, poop: 0, vomit: 0 },


  isDirty: false


};





function updateElimSaveButtonState() {


  const saveBtn = $('#save-elim');


  if (!saveBtn) return;


  


  const hasValues = elimState.scales.pee > 0 || elimState.scales.poop > 0 || elimState.scales.vomit > 0;


  saveBtn.disabled = !hasValues;


}





async function closeElimModal() {


  const hasValues = elimState.scales.pee > 0 || elimState.scales.poop > 0 || elimState.scales.vomit > 0;


  if (elimState.isDirty && hasValues) {


    if (!(await confirmAction("Vous avez des modifications non enregistrées. Voulez-vous les annuler ?"))) {


      return;


    }


  }


  closeModal('#modal-elim');


}





btnElim?.addEventListener('click', () => {


  elimState = {


    scales: { pee: 0, poop: 0, vomit: 0 },


    isDirty: false


  };


  $$('.scale').forEach(renderScale);


  updateElimSaveButtonState();


  renderElimHistory(); 


  openModal('#modal-elim');


});





$('#close-elim')?.addEventListener('click', closeElimModal);


$('#cancel-elim')?.addEventListener('click', closeElimModal);





function renderScale(root) {


  root.innerHTML = '';


  const key = root.dataset.scale;


  const currentValue = elimState.scales[key];





  // Fase 2: No renderizar el botón "0". La interacción es solo para añadir.


  for (let n = 1; n <= 3; n++) {


    const btn = document.createElement('button');


    btn.type = 'button';


    btn.textContent = n;


    const isActive = currentValue === n;


    if(isActive) btn.classList.add('active');


    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');


    


    btn.addEventListener('click', () => {


      // Fase 3: Tocar de nuevo deselecciona (vuelve a 0)


      const newValue = isActive ? 0 : n;


      elimState.scales[key] = newValue;


      elimState.isDirty = true;


      


      triggerVibration(isActive ? 20 : 40);


      renderScale(root); // Re-render this specific scale


      updateElimSaveButtonState(); // Update save button state


    });


    root.appendChild(btn);


  }


}


$$('.scale').forEach(renderScale);








$('#save-elim')?.addEventListener('click', async () => {


  const btn = $('#save-elim');


  await safeAction(btn, async () => {


    triggerVibration();


    if (elimState.scales.pee === 0 && elimState.scales.poop === 0 && elimState.scales.vomit === 0) {


      if (!(await confirmAction("Enregistrer une couche vide ?"))) return;


    }


    


    const entry = {


      id: Date.now() + '',


      dateISO: new Date().toISOString(),


      ...elimState.scales


    };


    


    updateState(currentData => {


      currentData.elims.push(entry);


      return currentData;


    });


    


    const api = getPersistenceApi();


    await api?.saveEntry?.('elim', entry, 'Add elimination entry');


    


    closeModal('#modal-elim');


    renderHistory();


  });


});








// ===== Medications modal logic =====


const KNOWN_MEDS_KEY = 'knownMeds';


const DEFAULT_MEDS = ['Ibufrone', 'Dalfalgan'];





function getKnownMeds() {


  return store.get(KNOWN_MEDS_KEY, DEFAULT_MEDS);


}





function learnNewMed(name) {


  if (!name) return;


  const list = getKnownMeds();


  const normalized = name.trim();


  // Evitar duplicados (case-insensitive)


  if (!list.some(m => m.toLowerCase() === normalized.toLowerCase())) {


    list.push(normalized);


    store.set(KNOWN_MEDS_KEY, list);


  }


}





function renderMedicationOptions(selectEl, selectedValue = null) {


  if (!selectEl) return;


  const list = getKnownMeds();


  selectEl.innerHTML = '';


  


  // Opción por defecto si no hay selección


  if (!selectedValue) {


    const def = document.createElement('option');


    def.text = '-- Choisir --';


    def.value = '';


    selectEl.appendChild(def);


  }





  list.forEach(med => {


    const opt = document.createElement('option');


    opt.value = med;


    opt.textContent = med;


    if (selectedValue && med.toLowerCase() === selectedValue.toLowerCase()) {


      opt.selected = true;


    }


    selectEl.appendChild(opt);


  });





  const other = document.createElement('option');


  other.value = 'other';


  other.textContent = 'Autre / Nouveau...';


  if (selectedValue === 'other') other.selected = true;


  selectEl.appendChild(other);


}





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


    updateMedOtherField();


    if(medOtherInput) medOtherInput.value = '';


  };





  const closeMedModal = () => closeModal('#modal-med');





  const saveMedication = () => { triggerVibration();


    if(!medSelect) return;


    const selection = medSelect.value;


    let name = selection;


    if(selection === 'other'){


      name = (medOtherInput?.value || '').trim();


      if(!name){


        alert('Veuillez indiquer le nom du medicament.');


        medOtherInput?.focus();


        return;


      }


      learnNewMed(name); // FASE 3: Aprender nuevo medicamento


    }


    const entry = {


      id: Date.now()+'',


      dateISO: new Date().toISOString(),


      name,


      medKey: selection === 'other' ? 'other' : name // Usar nombre como key para los conocidos


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


    // FASE 3: Sugerir automáticamente el último usado


    const lastMed = state.meds.length > 0 ? state.meds[state.meds.length - 1] : null;


    const suggestion = lastMed ? (lastMed.medKey === 'other' ? 'other' : lastMed.name) : null;


    


    renderMedicationOptions(medSelect, suggestion);


    updateMedOtherField(); // Actualizar visibilidad del campo 'otro' basado en la sugerencia


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


const mesuresGrowthSummaryEl = $('#mesures-growth-summary');


const mesuresGrowthHistoryEl = $('#mesures-growth-history');





let mesuresState = {


  temp: null,


  weight: null,


  height: null,


  isDirty: false


};





function updateMesuresSaveButtonState() {


  if (!saveMesuresBtn) return;


  const hasValues = mesuresState.temp !== null || mesuresState.weight !== null || mesuresState.height !== null;


  saveMesuresBtn.disabled = !hasValues;


}





async function closeMesuresModal() {


  const hasValues = mesuresState.temp !== null || mesuresState.weight !== null || mesuresState.height !== null;


  if (mesuresState.isDirty && hasValues) {


    if (!(await confirmAction("Vous avez des modifications non enregistrées. Voulez-vous les annuler ?"))) {


      return;


    }


  }


  closeModal('#modal-mesures');


}





function resetMesuresForm() {


  if (tempInput) tempInput.value = '';


  if (poidsInput) poidsInput.value = '';


  if (tailleInput) tailleInput.value = '';


}





function handleMesureInput() {


  const tempVal = tempInput.value ? parseFloat(tempInput.value.replace(',', '.')) : null;


  const poidsVal = poidsInput.value ? parseFloat(poidsInput.value.replace(',', '.')) : null;


  const tailleVal = tailleInput.value ? parseFloat(tailleInput.value.replace(',', '.')) : null;





  mesuresState.temp = (Number.isFinite(tempVal) && tempVal > 0) ? tempVal : null;


  mesuresState.weight = (Number.isFinite(poidsVal) && poidsVal > 0) ? poidsVal : null;


  mesuresState.height = (Number.isFinite(tailleVal) && tailleVal > 0) ? tailleVal : null;


  mesuresState.isDirty = true;


  


  updateMesuresSaveButtonState();


}





function renderMesuresGrowthHistory(){


  if(!mesuresGrowthSummaryEl || !mesuresGrowthHistoryEl) return;


  const all = Array.isArray(state.measurements) ? state.measurements : [];


  const entries = all


    .filter(m => m && m.dateISO && (Number.isFinite(m.weight) || Number.isFinite(m.height)))


    .sort((a,b)=> Date.parse(a.dateISO) - Date.parse(b.dateISO));





  if(!entries.length){


    mesuresGrowthSummaryEl.textContent = "Ajoutez un poids / une taille pour voir l'évolution.";


    mesuresGrowthHistoryEl.innerHTML = '<div class="history-empty">Aucune mesure de croissance enregistrée</div>';


    return;


  }





  const latest = entries[entries.length - 1];


  const prev = entries.length > 1 ? entries[entries.length - 2] : null;


  const latestDate = parseDateInput(latest.dateISO);


  const latestDateLabel = latestDate


    ? latestDate.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short', year:'numeric' })


    : latest.dateISO;





  const w = Number.isFinite(latest.weight) ? latest.weight : null;


  const h = Number.isFinite(latest.height) ? latest.height : null;


  const pw = prev && Number.isFinite(prev.weight) ? prev.weight : null;


  const ph = prev && Number.isFinite(prev.height) ? prev.height : null;





  const dW = w != null && pw != null ? (w - pw) : null;


  const dH = h != null && ph != null ? (h - ph) : null;





  const summaryParts = [];


  summaryParts.push(`Dernière mesure: ${latestDateLabel}`);


  if(w != null) summaryParts.push(`Poids ${formatNumber(w, 2, 2)} kg${dW != null ? ` (${formatSignedNumber(dW)} kg)` : ''}`);


  if(h != null) summaryParts.push(`Taille ${formatNumber(h, 0, 1)} cm${dH != null ? ` (${formatSignedNumber(dH)} cm)` : ''}`);


  if(w == null && h == null) summaryParts.push("Valeurs manquantes");





  mesuresGrowthSummaryEl.textContent = summaryParts.join(' • ');





  const lastItems = entries.slice(-10).reverse();


  mesuresGrowthHistoryEl.innerHTML = lastItems.map((entry, reverseIndex) => {


    const idx = entries.length - 1 - reverseIndex;


    const prevEntry = idx > 0 ? entries[idx - 1] : null;


    const date = parseDateInput(entry.dateISO);


    const dateLabel = date ? date.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : entry.dateISO;





    const ew = Number.isFinite(entry.weight) ? entry.weight : null;


    const eh = Number.isFinite(entry.height) ? entry.height : null;


    const epw = prevEntry && Number.isFinite(prevEntry.weight) ? prevEntry.weight : null;


    const eph = prevEntry && Number.isFinite(prevEntry.height) ? prevEntry.height : null;


    const ddW = ew != null && epw != null ? (ew - epw) : null;


    const ddH = eh != null && eph != null ? (eh - eph) : null;





    const deltaParts = [];


    if(ddW != null) deltaParts.push(`${formatSignedNumber(ddW)} kg`);


    if(ddH != null) deltaParts.push(`${formatSignedNumber(ddH)} cm`);


    const deltaLabel = deltaParts.length ? deltaParts.join(' • ') : '—';


    const deltaClass = deltaParts.length


      ? (deltaParts.some(p => p.startsWith('-')) ? 'down' : (deltaParts.some(p => p.startsWith('+')) ? '' : 'neutral'))


      : 'neutral';





    const values = [];


    if(ew != null) values.push(`Poids ${formatNumber(ew, 2, 2)} kg`);


    if(eh != null) values.push(`Taille ${formatNumber(eh, 0, 1)} cm`);


    return `


      <div class="growth-item">


        <div class="growth-item-main">


          <div class="growth-item-date">${escapeHtml(dateLabel)}</div>


          <div class="growth-item-values">${escapeHtml(values.join(' • ') || '—')}</div>


        </div>


        <div class="growth-item-delta ${deltaClass}">${escapeHtml(deltaLabel)}</div>


      </div>


    `;


  }).join('');


}





async function saveMesures() {


  triggerVibration();


  const { temp, weight, height } = mesuresState;





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


  


  await getPersistenceApi()?.saveEntry?.('measurement', entry, 'Add measurement entry');


  


  closeModal('#modal-mesures');


  renderHistory();


  renderMesuresGrowthHistory();


}





mesuresBtn?.addEventListener('click', () => {


  mesuresState = { temp: null, weight: null, height: null, isDirty: false };


  resetMesuresForm();


  updateMesuresSaveButtonState();


  renderMesuresGrowthHistory();


  openModal('#modal-mesures');


});





closeMesuresBtn?.addEventListener('click', closeMesuresModal);


cancelMesuresBtn?.addEventListener('click', closeMesuresModal);


saveMesuresBtn?.addEventListener('click', () => safeAction(saveMesuresBtn, saveMesures));





tempInput?.addEventListener('input', handleMesureInput);


poidsInput?.addEventListener('input', handleMesureInput);


tailleInput?.addEventListener('input', handleMesureInput);





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


  alert('Profil de Léo:\n• Naissance: 21/10/2025\n• Poids de naissance: 3800 g');


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



function getManualTypeMeta(type){

  switch(type){

    case 'elim':

      return { icon: '\ud83d\udebc', label: 'Couche' };

    case 'med':

      return { icon: '\ud83d\udc8a', label: 'Médicaments' };

    case 'measurement':

      return { icon: '\ud83c\udf21\ufe0f', label: 'Mesures' };

    case 'pump':

      return { icon: '\ud83c\udf00', label: 'Tire-lait' };

    case 'feed':

    default:

      return { icon: '\ud83c\udf7c', label: 'Lait' };

  }

}



function formatManualSubtitle(dateISO){

  if(!dateISO) return '';

  const date = new Date(dateISO);

  if(Number.isNaN(date.getTime())) return '';

  const dateLabel = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const timeLabel = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return `${dateLabel} ? ${timeLabel}`;

}



function updateManualTitle(isEdit){

  const titleNode = manualTitle || manualModal?.querySelector('h2');

  if(!titleNode) return;

  if(isEdit){

    const meta = getManualTypeMeta(manualType);

    titleNode.textContent = `${meta.icon} Modifier ${meta.label}`;

    if(manualSubtitle){

      manualSubtitle.textContent = formatManualSubtitle(editingEntry?.entry?.dateISO || '');

    }

  }else{

    titleNode.textContent = 'Nouvel enregistrement';

    if(manualSubtitle) manualSubtitle.textContent = '';

  }

}



function setManualType(type){


  manualType = type;


  manualTypeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));


  manualFeedFields?.classList?.toggle('is-hidden', type !== 'feed');


  manualElimFields?.classList?.toggle('is-hidden', type !== 'elim');


  manualMedFields?.classList?.toggle('is-hidden', type !== 'med');


  manualMesuresFields?.classList?.toggle('is-hidden', type !== 'measurement');


  manualPumpFields?.classList?.toggle('is-hidden', type !== 'pump');


  if(type === 'feed') updateManualSourceFields();


  if(type === 'med') updateManualMedFields();

  updateManualTitle(manualModal?.classList?.contains('is-editing'));


}





function syncManualSeg(segEl, value){


  if(!segEl) return;


  const buttons = Array.from(segEl.querySelectorAll('button'));


  buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.value === value));


}




function updateManualSourceFields(){


  const source = manualSource?.value || 'breast';


  const isBreast = source === 'breast';


  syncManualSeg(manualSourceSeg, source);


  if(manualBreast && manualBreast.value){


    syncManualSeg(manualBreastSeg, manualBreast.value);


  }


  manualBreastField?.classList?.toggle('is-hidden', !isBreast);


  manualDurationField?.classList?.toggle('is-hidden', !isBreast);


  manualAmountField?.classList?.toggle('is-hidden', isBreast);


  const isEditing = manualModal?.classList?.contains('is-editing');


  const showBottleWindow = !isBreast && isEditing;


  manualBottleStartField?.classList?.toggle('is-hidden', !showBottleWindow);


  manualBottleEndToggleField?.classList?.toggle('is-hidden', !showBottleWindow);


  const showEnd = Boolean(showBottleWindow && manualBottleEndToggle?.checked);


  manualBottleEndField?.classList?.toggle('is-hidden', !showEnd);


  if(!showBottleWindow && manualBottleEndToggle){


    manualBottleEndToggle.checked = false;


  }


  if(!isBreast){


    const currentValue = parseFloat((manualAmount?.value || '').replace(',', '.'));


    if(Number.isFinite(currentValue) && currentValue > 0){


      setManualBottleAmount(currentValue);


    }else{


      setManualBottleAmount(BOTTLE_BASE_DEFAULT_PRESET);


    }


  }else{


    updateManualBottleFeedback(null);


    highlightManualBottlePreset(null);


  }


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





function getStateKeyForType(type){


  if(type === 'feed') return 'feeds';


  if(type === 'elim') return 'elims';


  if(type === 'med') return 'meds';


  if(type === 'measurement') return 'measurements';


  if(type === 'sleep') return 'sleepSessions';


  if(type === 'pump') return 'pumpSessions';


  return null;


}





function getListByType(type){


  const key = getStateKeyForType(type);


  return key ? state[key] : null;


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


      btn.disabled = false;


      btn.classList.remove('is-disabled');


    }


  });


  if(saveManualBtn){


    saveManualBtn.textContent = isEdit ? 'Mettre à jour' : 'Enregistrer';


  }

  updateManualTitle(isEdit);

  manualModal?.classList?.toggle('is-editing', isEdit);


}





function resetManualFields(){


  if(manualSource) manualSource.value = 'breast';


  updateManualSourceFields();


  if(manualBreast) manualBreast.value = 'Gauche';


  if(manualDuration) manualDuration.value = '';


  if(manualAmount) manualAmount.value = '';


  if(manualBottleStart) manualBottleStart.value = '';


  if(manualBottleEnd) manualBottleEnd.value = '';


  updateManualBottleFeedback(null);


  highlightManualBottlePreset(null);


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


  if(manualPumpDuration) manualPumpDuration.value = '';


  if(manualPumpAmount) manualPumpAmount.value = '';


  if(manualPumpNotes) manualPumpNotes.value = '';


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


      if(manualBottleStart) manualBottleStart.value = '';


      if(manualBottleEnd) manualBottleEnd.value = '';


      if(manualBottleEndToggle) manualBottleEndToggle.checked = false;


    }else{


      if(manualAmount) setManualBottleAmount(entry.amountMl != null ? entry.amountMl : '');


      if(manualDuration) manualDuration.value = '';


      if(manualBottleStart){


        const startDate = parseDateTimeInput(entry.bottleStartISO);


        manualBottleStart.value = startDate ? toDateTimeInputValue(startDate) : '';


      }


      if(manualBottleEnd){


        const endDate = parseDateTimeInput(entry.bottleEndISO);


        manualBottleEnd.value = endDate ? toDateTimeInputValue(endDate) : '';


        if(manualBottleEndToggle) manualBottleEndToggle.checked = Boolean(endDate);


      }


    }


    updateManualSourceFields();


    if(manualNotes) manualNotes.value = entry.notes || '';

    const hasOptions = Boolean(entry.notes || entry.bottleStartISO || entry.bottleEndISO);

    if(manualOptionsToggle && manualOptionsContent){

      manualOptionsToggle.setAttribute('aria-expanded', hasOptions ? 'true' : 'false');

      manualOptionsContent.classList.toggle('is-collapsed', !hasOptions);

    }


  }else if(type === 'elim'){


    if(manualPee) manualPee.value = clamp(Number(entry.pee ?? 0), 0, 3);


    if(manualPoop) manualPoop.value = clamp(Number(entry.poop ?? 0), 0, 3);


    if(manualVomit) manualVomit.value = clamp(Number(entry.vomit ?? 0), 0, 3);


    if(manualElimNotes) manualElimNotes.value = entry.notes || '';


  }else if(type === 'med'){


    let selection = entry.medKey || 'other';


    // Renderizar opciones antes de asignar valor para asegurar que el medicamento existe en la lista


    if(manualMedSelect) {


      renderMedicationOptions(manualMedSelect, selection);


    }


    updateManualMedFields();


    if(selection === 'other'){


      if(manualMedOtherInput) manualMedOtherInput.value = entry.name || '';


    }else if(manualMedOtherInput){


      manualMedOtherInput.value = '';


    }


    if(manualMedDose) manualMedDose.value = entry.dose || '';


    if(manualMedNotes) manualMedNotes.value = entry.notes || '';


  }else if(type === 'measurement'){


    if(manualMesureTemp) manualMesureTemp.value = entry.temp ?? '';


    if(manualMesurePoids) manualMesurePoids.value = entry.weight ?? '';


    if(manualMesureTaille) manualMesureTaille.value = entry.height ?? '';


  }else if(type === 'pump'){


    if(manualPumpDuration) manualPumpDuration.value = Math.round((entry.durationSec || 0) / 60);


    if(manualPumpAmount) manualPumpAmount.value = entry.amountMl || '';


    if(manualPumpNotes) manualPumpNotes.value = entry.notes || '';


  }


}





function openManualModal({mode='create', type='feed', entry=null} = {}){


  const isEdit = mode === 'edit' && entry;


  editingEntry = isEdit ? { type, originalType: type, entry } : null;


  setManualMode(isEdit);


  resetManualFields();


  const effectiveType = isEdit && entry ? type : 'feed';


  setManualType(effectiveType);


  if(isEdit && entry){


    populateManualForm(type, entry);


    setManualType(type);


  } else if (effectiveType === 'med') {


    // FASE 3: Sugerir también en modo manual si es creación


    const lastMed = state.meds.length > 0 ? state.meds[state.meds.length - 1] : null;


    const suggestion = lastMed ? (lastMed.medKey === 'other' ? 'other' : lastMed.name) : null;


    if(manualMedSelect) renderMedicationOptions(manualMedSelect, suggestion);


    updateManualMedFields();


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





const DEFAULT_FIRESTORE_DOC_ID = '5OVJ41gy1Iehks4dIu6NWsVvDrF2';


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


  if(type === 'sleep'){


    openSleepModal(existing);


    return;


  }


  const copy = JSON.parse(JSON.stringify(existing));


  openManualModal({mode:'edit', type, entry: copy});





}











function saveManualEntry() {











    triggerVibration();


  triggerVibration();


  const isEdit = Boolean(editingEntry);


  const targetType = isEdit ? manualType : manualType;


  const originalType = isEdit && editingEntry ? editingEntry.originalType : null;


  


  // Phase 3-E: Preserve Date Precision


  let dateISO;


  if (isEdit && editingEntry && editingEntry.entry?.dateISO && manualDatetime) {


    const inputVal = manualDatetime.value;


    const originalVal = formatDateInput(new Date(editingEntry.entry.dateISO));


    // If user didn't change the datetime input, keep the original ISO string (with seconds)


    dateISO = (inputVal === originalVal) ? editingEntry.entry.dateISO : new Date(inputVal).toISOString();


  } else {


    dateISO = manualDatetime && manualDatetime.value ? new Date(manualDatetime.value).toISOString() : new Date().toISOString();


  }





  let reason = null;


  let entry = null;


  const baseEntry = isEdit && originalType && targetType !== originalType


    ? { id: editingEntry.entry.id }


    : (isEdit ? { ...editingEntry.entry } : null);





  updateState(currentData => {


    if(isEdit && originalType && targetType !== originalType){


      const originalKey = getStateKeyForType(originalType);


      if(currentData[originalKey]){


        currentData[originalKey] = currentData[originalKey].filter(item => String(item.id) !== String(editingEntry.entry.id));


      }


    }


    if (targetType === 'feed') {


      const sourceValue = (manualSource?.value || 'breast') === 'bottle' ? 'bottle' : 'breast';


      // UX Fix: Merge with existing entry to preserve duration/start times if not editing them directly


      entry = isEdit ? { ...baseEntry } : { id: Date.now()+'', source: sourceValue };


      entry.dateISO = dateISO;


      entry.source = sourceValue;





      if (sourceValue === 'breast') {


        const mins = Math.max(0, Number(manualDuration?.value || 0));


        entry.durationSec = Math.round(mins * 60);


        entry.breastSide = manualBreast?.value || 'Gauche';


      } else {


        entry.amountMl = clampBottleValue(Number(manualAmount?.value || 0));


        if(entry.amountMl <= 0) throw new Error('Ajoutez la quantité totale en ml.');


        const startDate = parseDateTimeInput(manualBottleStart?.value);


        const endDate = parseDateTimeInput(manualBottleEnd?.value);


        if(startDate && endDate && endDate < startDate){


          throw new Error("L'heure de fin doit être postérieure au début.");


        }


        if(startDate){


          entry.bottleStartISO = startDate.toISOString();


        }


        if(endDate){


          entry.bottleEndISO = endDate.toISOString();


          entry.dateISO = entry.bottleEndISO;


        }


        if(startDate && endDate){


          entry.durationSec = Math.round((endDate.getTime() - startDate.getTime()) / 1000);


        }else if(startDate && Number.isFinite(entry.durationSec)){


          entry.bottleEndISO = new Date(startDate.getTime() + (entry.durationSec * 1000)).toISOString();


          entry.dateISO = entry.bottleEndISO;


        }


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


      entry = isEdit ? { ...baseEntry } : { id: Date.now()+'' };


      entry.dateISO = dateISO;


      entry.pee = clamp(Number(manualPee?.value || 0), 0, 3);


      entry.poop = clamp(Number(manualPoop?.value || 0), 0, 3);


      entry.vomit = clamp(Number(manualVomit?.value || 0), 0, 3);





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


    let selection = manualMedSelect?.value;


    let name = selection;


    if(selection === 'other'){


      name = (manualMedOtherInput?.value || '').trim();


      if(!name){


        manualMedOtherInput?.focus();


        throw new Error("Veuillez indiquer le nom du médicament.");


      }


      learnNewMed(name); // FASE 3: Aprender nuevo medicamento en modo manual


    }


    const dose = (manualMedDose?.value || '').trim();


    const notes = (manualMedNotes?.value || '').trim();


    entry = isEdit ? { ...baseEntry } : { id: Date.now()+'' };


    entry.dateISO = dateISO;


    entry.name = name;


    entry.medKey = selection === 'other' ? 'other' : name;


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


        throw new Error("Veuillez entrer au moins une mesure.");


      }





      entry = isEdit ? { ...baseEntry } : { id: Date.now() + '' };


      entry.dateISO = dateISO;


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


    } else if (targetType === 'pump') {


      const durationMins = Math.max(0, Number(manualPumpDuration?.value || 0));


      const amount = Number(manualPumpAmount?.value || 0);


      const durationSec = Math.round(durationMins * 60);


      const endTs = new Date(dateISO).getTime();


      const startTs = endTs - (durationSec * 1000);





      entry = isEdit ? { ...baseEntry } : { id: Date.now()+'' };


      entry.dateISO = dateISO;


      entry.startISO = new Date(startTs).toISOString();


      entry.endISO = dateISO;


      entry.durationSec = durationSec;





      if(amount > 0) entry.amountMl = amount;


      const notes = manualPumpNotes?.value?.trim();


      if(notes) entry.notes = notes;





      if (isEdit) {


        const idx = currentData.pumpSessions.findIndex(item => String(item.id) === String(entry.id));


        if (idx > -1) currentData.pumpSessions[idx] = entry; else currentData.pumpSessions.push(entry);


        reason = `Edit pump entry ${entry.id}`;


      } else {


        currentData.pumpSessions.push(entry);


        reason = 'Manual pump entry';


      }


    }


    return currentData;


  });





  if(reason && entry){


    if(isEdit && originalType && targetType !== originalType){


      getPersistenceApi()?.deleteEntries?.([{ type: originalType, id: entry.id }]);


    }


    // Return promise for safeAction, close modal on success.


    return getPersistenceApi()?.saveEntry?.(targetType, entry, reason)


      .then(() => {


        closeManualModal();


        renderHistory();


      });


  }


  // If no entry created (e.g. error), safeAction catches the error or we return resolved


  closeManualModal();


  renderHistory();


}








async function initFirebaseSync() {


  const { db: firebaseDb, auth: firebaseAuth, ensureAuth } = await import('./firebase.js');


  firebaseDbInstance = firebaseDb;


  if (!firebaseDbInstance || !firebaseDocId) {


    console.warn("Firebase dependencies not ready.");


    setSaveIndicator('error', 'Dépendances manquantes');


    return;


  }





  // Asegurarse de que la autenticación anónima se complete antes de continuar.


  try {


    setSaveIndicator('saving', 'Authentification...');


    await ensureAuth();


  } catch (authError) {


    console.error("Firebase authentication failed:", authError);


    setSaveIndicator('error', 'Erreur auth.');


    return; // Detener si la autenticación falla.


  }





  if (firebaseAuth && !firebaseAuth.currentUser) {


    await new Promise(resolve => {


      const unsubscribe = firebaseAuth.onAuthStateChanged(user => {


        if (user) {


          unsubscribe();


          resolve();


        }


      });


    });


  }





  try {


  // pass auth so persistence can set owner on initial document


  persistenceApi.init(firebaseDbInstance, firebaseDocId, firebaseAuth);


    firebaseInitialized = true;





    setSaveIndicator('saving', 'Connexion...');





    // Esperamos a que lleguen los primeros datos y los renderizamos.


    const initialData = await persistenceApi.connect();


    console.log(`Firebase sync connected for document ${firebaseDocId}. Initial data received.`);


    setSaveIndicator('synced', 'Connecté');


    // Debug: log counts & sample ids so we can compare what's in Firestore vs what's rendered


    try {


      const counts = {


        feeds: Array.isArray(initialData.feeds) ? initialData.feeds.length : 0,


        elims: Array.isArray(initialData.elims) ? initialData.elims.length : 0,


        meds: Array.isArray(initialData.meds) ? initialData.meds.length : 0,


        measurements: Array.isArray(initialData.measurements) ? initialData.measurements.length : 0,


        pumpSessions: Array.isArray(initialData.pumpSessions) ? initialData.pumpSessions.length : 0


      };


      const sample = {


        feeds: (initialData.feeds || []).slice(0,5).map(i => i && i.id).filter(Boolean),


        elims: (initialData.elims || []).slice(0,5).map(i => i && i.id).filter(Boolean),


        meds: (initialData.meds || []).slice(0,5).map(i => i && i.id).filter(Boolean),


        measurements: (initialData.measurements || []).slice(0,5).map(i => i && i.id).filter(Boolean),


        pumpSessions: (initialData.pumpSessions || []).slice(0,5).map(i => i && i.id).filter(Boolean)


      };


      console.info('Initial snapshot summary:', counts, sample);


    } catch (e) {


      console.debug('Could not summarize initialData', e);


    }


    replaceDataFromSnapshot(initialData, { skipRender: false });


    runAutoBackup();


    syncRemoteTimersFromLocal(initialData?.activeTimers);





    persistenceApi.on((event, payload) => {


      // Ahora, cualquier 'data-changed' se trata como la fuente de la verdad.


      // La lógica de fusión compleja ya no es necesaria en el cliente.


      if (event === 'data-changed') {


        replaceDataFromSnapshot(payload.snapshot, { skipRender: false });


        runAutoBackup();


      } else if (event === 'server-raw') {


        // Debug: server gave us a raw document; log a compact summary so developer can compare


        try {


          const raw = payload && payload.raw ? payload.raw : null;


          if (raw) {


            const rawCounts = {


              feeds: Array.isArray(raw.snapshot ? raw.snapshot.feeds : raw.feeds) ? (raw.snapshot ? raw.snapshot.feeds.length : raw.feeds.length) : 0,


              elims: Array.isArray(raw.snapshot ? raw.snapshot.elims : raw.elims) ? (raw.snapshot ? raw.snapshot.elims.length : raw.elims.length) : 0,


              meds: Array.isArray(raw.snapshot ? raw.snapshot.meds : raw.meds) ? (raw.snapshot ? raw.snapshot.meds.length : raw.meds.length) : 0,


              measurements: Array.isArray(raw.snapshot ? raw.snapshot.measurements : raw.measurements) ? (raw.snapshot ? raw.snapshot.measurements.length : raw.measurements.length) : 0,


              pumpSessions: Array.isArray(raw.snapshot ? raw.snapshot.pumpSessions : raw.pumpSessions) ? (raw.snapshot ? raw.snapshot.pumpSessions.length : raw.pumpSessions.length) : 0


            };


            console.info('Server raw document summary for', payload.docId || firebaseDocId, 'source=', payload.source || '?', rawCounts);


            // Also log a short sample of ids for manual inspection


            const sampleIds = {


              feeds: (raw.snapshot ? raw.snapshot.feeds : raw.feeds || []).slice(0,5).map(i=>i && i.id).filter(Boolean),


              elims: (raw.snapshot ? raw.snapshot.elims : raw.elims || []).slice(0,5).map(i=>i && i.id).filter(Boolean),


              meds: (raw.snapshot ? raw.snapshot.meds : raw.meds || []).slice(0,5).map(i=>i && i.id).filter(Boolean),


              measurements: (raw.snapshot ? raw.snapshot.measurements : raw.measurements || []).slice(0,5).map(i=>i && i.id).filter(Boolean),


              pumpSessions: (raw.snapshot ? raw.snapshot.pumpSessions : raw.pumpSessions || []).slice(0,5).map(i=>i && i.id).filter(Boolean)


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


  initActionVisibilitySettings();


  try {


   const { db, storage, storageFns, ensureAuth } = await import('./firebase.js');


     const persistenceModule = await import('./persistence.js');


     const { Persistence } = persistenceModule;





    persistenceApi = Persistence;


    firebaseDbInstance = db;


    firebaseStorageInstance = storage;


    firebaseStorageFns = storageFns;


    firebaseDocId = resolveSharedDocumentId();





    if (saveIndicatorEl) {


      saveIndicatorEl.style.cursor = 'pointer';


      saveIndicatorEl.title = "Vérifier la connexion";


      saveIndicatorEl.addEventListener('click', () => {


        const fbStatus = firebaseInitialized ? '✅ Initialisé' : '❌ Non initialisé';


        const netStatus = isOnline() ? '✅ En ligne' : '⚠️ Hors ligne';


        const docStatus = firebaseDocId ? `📄 ${firebaseDocId}` : '❌ Manquant';


        alert(`État de la connexion :\n\nFirebase : ${fbStatus}\nRéseau : ${netStatus}\nDocument : ${docStatus}`);


      });


    }





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





    try {


      const whoModule = await import('./who_data.js');


      whoData = whoModule;


    } catch (e) {


      console.warn('Failed to load WHO data:', e);


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


exportCsvBtn?.addEventListener('click', exportToCSV);


closeManualBtn?.addEventListener('click', closeManualModal);


cancelManualBtn?.addEventListener('click', closeManualModal);


saveManualBtn?.addEventListener('click', async () => {


  await safeAction(saveManualBtn, async () => saveManualEntry());


});


manualTypeButtons.forEach(btn => btn.addEventListener('click', ()=> setManualType(btn.dataset.type)));


manualSource?.addEventListener('change', updateManualSourceFields);

manualBreast?.addEventListener('change', () => {
  if(manualBreast && manualBreastSeg){
    syncManualSeg(manualBreastSeg, manualBreast.value);
  }
});

manualSourceSeg?.addEventListener('click', (event) => {
  const btn = event.target instanceof Element ? event.target.closest('button[data-value]') : null;
  if(!btn || !manualSource) return;
  manualSource.value = btn.dataset.value || 'breast';
  updateManualSourceFields();
});

manualBreastSeg?.addEventListener('click', (event) => {
  const btn = event.target instanceof Element ? event.target.closest('button[data-value]') : null;
  if(!btn || !manualBreast) return;
  manualBreast.value = btn.dataset.value || 'Gauche';
  syncManualSeg(manualBreastSeg, manualBreast.value);
});

manualOptionsToggle?.addEventListener('click', () => {
  if(!manualOptionsContent || !manualOptionsToggle) return;
  const isOpen = manualOptionsToggle.getAttribute('aria-expanded') === 'true';
  manualOptionsToggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  manualOptionsContent.classList.toggle('is-collapsed', isOpen);
});

manualBottleEndToggle?.addEventListener('change', () => {
  const showEnd = Boolean(manualBottleEndToggle.checked);
  manualBottleEndField?.classList?.toggle('is-hidden', !showEnd);
});


manualMedSelect?.addEventListener('change', updateManualMedFields);


manualBottlePresetButtons.forEach(btn => {


  btn.addEventListener('click', () => {


    const value = Number(btn.dataset.value);


    if(Number.isFinite(value)){


      setManualBottleAmount(value);


      triggerVibration(20);


    }


  });


});


manualBottleDecreaseBtn?.addEventListener('click', () => {


  adjustManualBottleAmount(-BOTTLE_STEP_ML);


  triggerVibration(15);


});


manualBottleIncreaseBtn?.addEventListener('click', () => {


  adjustManualBottleAmount(BOTTLE_STEP_ML);


  triggerVibration(20);


});


manualAmount?.addEventListener('input', () => {


  const val = parseFloat((manualAmount.value || '').replace(',', '.'));


  if(Number.isFinite(val)){


    setManualBottleAmount(val);


  }else{


    updateManualBottleFeedback(null);


    highlightManualBottlePreset(null);


  }


});


if(manualModal){


  setManualType('feed');


  updateManualSourceFields();


  updateManualMedFields();


}





// Keep next-bottle hint live on the home screen


updateBottleIntervalHint();


if(!bottleHintTicker){


  bottleHintTicker = setInterval(updateBottleIntervalHint, 1000);


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


if ('serviceWorker' in navigator) {


  window.addEventListener('load', () => {


    navigator.serviceWorker.getRegistrations()


      .then(registrations => {


        registrations.forEach(registration => registration.unregister());


      })


      .catch(err => {


        console.warn('Service worker cleanup failed:', err);


      });





    if ('caches' in window) {


      caches.keys()


        .then(keys => Promise.all(keys.map(key => caches.delete(key))))


        .catch(err => {


          console.warn('Cache cleanup failed:', err);


        });


    }


  });


}





historyList?.addEventListener('pointerdown', handleSwipeStart);


document.addEventListener('click', (e) => {


  // Cerrar el item deslizado si se hace clic fuera de él


  if (swipeState.swipedItem && !swipeState.swipedItem.contains(e.target)) {


    closeSwipedItem(swipeState.swipedItem);


  }


});





// ===== Reporting UX overrides (UI only) =====


function detachChartFromCanvas(chart, canvas){


  if(!chart) return null;


  if(!canvas || chart.canvas !== canvas){


    try { chart.destroy(); } catch {}


    return null;


  }


  return chart;


}





function updateGrowthPointPanel(entries, index = null){


  const panel = document.getElementById('growth-point-panel');


  if(!panel) return;





  const safeEntries = Array.isArray(entries) ? entries : [];


  if(!safeEntries.length){


    panel.textContent = "Pas encore de mesures. Ajoutez un poids / taille pour suivre l'évolution.";


    return;


  }





  const latestIndex = safeEntries.length - 1;


  const resolvedIndex = typeof index === 'number' && index >= 0 && index < safeEntries.length


    ? index


    : latestIndex;





  const current = safeEntries[resolvedIndex];


  const prev = resolvedIndex > 0 ? safeEntries[resolvedIndex - 1] : null;


  const date = parseDateInput(current?.dateISO);


  const dateLabel = date


    ? date.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short', year:'numeric' })


    : (current?.dateISO || '—');





  const weight = Number.isFinite(current?.weight) ? current.weight : null;


  const height = Number.isFinite(current?.height) ? current.height : null;





  const prevWeight = prev && Number.isFinite(prev.weight) ? prev.weight : null;


  const prevHeight = prev && Number.isFinite(prev.height) ? prev.height : null;





  const dWeight = weight != null && prevWeight != null ? (weight - prevWeight) : null;


  const dHeight = height != null && prevHeight != null ? (height - prevHeight) : null;





  const parts = [`${dateLabel}`];


  if(weight != null){


    parts.push(`Poids: ${formatNumber(weight, 2, 2)} kg${dWeight != null ? ` (${formatSignedNumber(dWeight)} kg)` : ''}`);


  }


  if(height != null){


    parts.push(`Taille: ${formatNumber(height, 0, 1)} cm${dHeight != null ? ` (${formatSignedNumber(dHeight)} cm)` : ''}`);


  }


  if(weight == null && height == null){


    parts.push("Aucune valeur (poids/taille) pour ce point.");


  }





  const trend = (() => {


    if(dWeight == null) return "Tendance: pas assez de données";


    const abs = Math.abs(dWeight);


    if(abs < 0.02) return "Tendance: stable";


    return dWeight > 0 ? "Tendance: en hausse" : "Tendance: en baisse";


  })();


  parts.push(trend);


  panel.textContent = parts.join(' • ');


  return;





  panel.textContent = parts.join(' • ');


}





function updateStatsChart(force = false){


  const summary = getStatsChartData();


  const stats = summary.stats;





  if(typeof Chart === 'undefined') return;





  const chartColors = getChartColors();





  const breastCanvas = document.getElementById('chart-breast-by-hour');


  const bottleCanvas = document.getElementById('chart-bottle-by-day');


  const diaperCanvas = document.getElementById('chart-diaper-pie');


  const growthCanvas = document.getElementById('chart-growth');





  statsBreastHourChart = detachChartFromCanvas(statsBreastHourChart, breastCanvas);


  statsBottleDayChart = detachChartFromCanvas(statsBottleDayChart, bottleCanvas);


  statsDiaperChart = detachChartFromCanvas(statsDiaperChart, diaperCanvas);


  statsGrowthChart = detachChartFromCanvas(statsGrowthChart, growthCanvas);





  const hourCtx = breastCanvas?.getContext?.('2d');


  if(hourCtx){


    const hourLabels = Array.from({length:24}, (_, hour) => `${String(hour).padStart(2, '0')}h`);


    const hourData = stats.perHour.map(value => Number(value.toFixed(2)));


    if(!statsBreastHourChart){


      statsBreastHourChart = new Chart(hourCtx, {


        type: 'line',


        data: {


          labels: hourLabels,


          datasets: [{


            label: 'Minutes (sein)',


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


            title: { display: true, text: 'Sein / heure', color: chartColors.textColor },


            tooltip: {


              callbacks: {


                label(context){


                  const val = context.parsed.y ?? 0;


                  return `Minutes ${formatMinutes(val)}`;


                }


              }


            }


          },


          scales: {


            y: { beginAtZero: true, ticks: { color: chartColors.textColor }, grid: { color: chartColors.gridColor } },


            x: { ticks: { color: chartColors.textColor }, grid: { color: chartColors.gridColor.replace('0.15', '0.1') } }


          }


        }


      });


    }else{


      statsBreastHourChart.data.labels = hourLabels;


      statsBreastHourChart.data.datasets[0].data = hourData;


      statsBreastHourChart.update();


    }


  }





  const bottleCtx = bottleCanvas?.getContext?.('2d');


  if(bottleCtx){


    if(!statsBottleDayChart){


      statsBottleDayChart = new Chart(bottleCtx, {


        type: 'bar',


        data: {


          labels: summary.labels,


          datasets: [


            {


              label: 'Minutes (sein)',


              data: summary.breastMinutes,


              backgroundColor: chartColors.breastColor,


              borderColor: chartColors.breastColor.replace('0.6', '0.9'),


              borderWidth: 1,


              borderRadius: 6,


              maxBarThickness: 25,


            },


            {


              label: 'Ml (biberon)',


              data: summary.bottleMl,


              backgroundColor: chartColors.bottleColor,


              borderColor: chartColors.bottleColor.replace('0.6', '0.9'),


              borderWidth: 1,


              borderRadius: 6,


              maxBarThickness: 25,


            }


          ]


        },


        options: {


          animation: { duration: 600, easing: 'easeOutQuart' },


          responsive: true,


          maintainAspectRatio: false,


          plugins: {


            legend: { display: true, position: 'bottom', labels: { color: chartColors.textColor } },


            title: { display: true, text: 'Alimentation / jour', color: chartColors.textColor },


            tooltip: {


              callbacks: {


                label(context){


                  return context.datasetIndex === 0


                    ? ` ${formatNumber(context.parsed.y || 0)} min`


                    : ` ${formatNumber(context.parsed.y || 0)} ml`;


                }


              }


            }


          },


          scales: {


            y: { beginAtZero: true, ticks: { color: chartColors.textColor }, grid: { color: chartColors.gridColor } },


            x: { ticks: { color: chartColors.textColor }, grid: { color: chartColors.gridColor.replace('0.15', '0.1') } }


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





  const growthCtx = growthCanvas?.getContext?.('2d');


  if(growthCtx){


    const entries = (Array.isArray(state.measurements) ? state.measurements : [])


      .filter(entry => entry && entry.dateISO)


      .sort((a, b) => Date.parse(a.dateISO) - Date.parse(b.dateISO));





    const labels = entries.map(entry => {


      const date = parseDateInput(entry.dateISO);


      return date ? date.toLocaleDateString('fr-FR', {day:'2-digit', month:'short'}) : '';


    });





    const weightData = entries.map(entry => Number.isFinite(entry.weight) ? entry.weight : null);


    const heightData = entries.map(entry => Number.isFinite(entry.height) ? entry.height : null);





    if(!statsGrowthChart || force){


      statsGrowthChart && statsGrowthChart.destroy();


      statsGrowthChart = new Chart(growthCtx, {


        type: 'line',


        data: {


          labels,


          datasets: [


            {


              label: 'Poids (kg)',


              data: weightData,


              borderColor: 'rgba(59, 130, 246, 0.9)',


              backgroundColor: 'rgba(59, 130, 246, 0.15)',


              spanGaps: true,


              tension: 0.25,


              pointRadius: 4,


              pointHoverRadius: 6,


              pointHitRadius: 14,


              yAxisID: 'yWeight'


            },


            {


              label: 'Taille (cm)',


              data: heightData,


              borderColor: 'rgba(16, 185, 129, 0.9)',


              backgroundColor: 'rgba(16, 185, 129, 0.12)',


              spanGaps: true,


              tension: 0.25,


              pointRadius: 4,


              pointHoverRadius: 6,


              pointHitRadius: 14,


              yAxisID: 'yHeight'


            }


          ]


        },


        options: {


          responsive: true,


          maintainAspectRatio: false,


          interaction: { mode:'nearest', intersect:true },


          plugins: {


            title: { display: true, text: 'Croissance', color: chartColors.textColor },


            legend: { position: 'bottom', labels: { color: chartColors.textColor } },


            tooltip: {


              callbacks: {


                title(items){


                  const idx = items?.[0]?.dataIndex;


                  const entry = Number.isFinite(idx) ? entries[idx] : null;


                  const date = entry ? parseDateInput(entry.dateISO) : null;


                  return date ? date.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' }) : '';


                },


                afterBody(items){


                  const idx = items?.[0]?.dataIndex;


                  if(!Number.isFinite(idx) || idx <= 0) return '';


                  const cur = entries[idx];


                  const prev = entries[idx - 1];


                  const lines = [];


                  if(Number.isFinite(cur?.weight) && Number.isFinite(prev?.weight)){


                    lines.push(`Δ poids: ${formatSignedNumber(cur.weight - prev.weight)} kg`);


                  }


                  if(Number.isFinite(cur?.height) && Number.isFinite(prev?.height)){


                    lines.push(`Δ taille: ${formatSignedNumber(cur.height - prev.height)} cm`);


                  }


                  return lines.join('\n');


                }


              }


            }


          },


          onClick(_evt, elements){


            const el = elements?.[0];


            if(!el) return;


            updateGrowthPointPanel(entries, el.index);


          },


          scales: {


            yWeight: {


              type: 'linear',


              position: 'left',


              title: { display:true, text:'kg', color: chartColors.textColor },


              ticks: { color: chartColors.textColor },


              grid: { color: chartColors.gridColor }


            },


            yHeight: {


              type: 'linear',


              position: 'right',


              title: { display:true, text:'cm', color: chartColors.textColor },


              ticks: { color: chartColors.textColor },


              grid: { drawOnChartArea:false }


            },


            x: {


              ticks: { color: chartColors.textColor },


              grid: { color: chartColors.gridColor.replace('0.15', '0.08') }


            }


          }


        }


      });


    }else{


      statsGrowthChart.data.labels = labels;


      statsGrowthChart.data.datasets[0].data = weightData;


      statsGrowthChart.data.datasets[1].data = heightData;


      statsGrowthChart.update();


    }





    updateGrowthPointPanel(entries, null);


  }


}





function formatSignedNumber(value){


  const safe = Number.isFinite(value) ? value : 0;


  const sign = safe > 0 ? '+' : '';


  return `${sign}${formatNumber(safe)}`;


}





function formatPercent(value){


  if(!Number.isFinite(value)) return '';


  const sign = value > 0 ? '+' : '';


  return `${sign}${formatNumber(value, 0, 0)}%`;


}





function getMilkInsight(diffMl, prevMl){


  if(!Number.isFinite(prevMl) || prevMl <= 0){


    return "Pas de comparaison";


  }


  if(!Number.isFinite(diffMl) || diffMl === 0){


    return "Identique à la veille";


  }


  const pct = (diffMl / prevMl) * 100;


  const absPct = Math.abs(pct);


  if(absPct < 5){


    return diffMl > 0 ? "Très légèrement plus qu'hier" : "Très légèrement moins qu'hier";


  }


  if(absPct < 15){


    return diffMl > 0 ? "Un peu plus qu'hier" : "Un peu moins qu'hier";


  }


  return diffMl > 0 ? "Plus qu'hier" : "Moins qu'hier";


}





function getBottleFeedsForDay(dateISO){


  const day = parseDateInput(dateISO);


  if(!day) return [];


  day.setHours(0, 0, 0, 0);


  const start = day.getTime();


  const end = start + DAY_MS - 1;


  return (state.feeds || [])


    .filter(feed => {


      if(feed.source !== 'bottle') return false;


      const ts = Date.parse(feed.dateISO);


      return Number.isFinite(ts) && ts >= start && ts <= end;


    })


    .sort((a,b)=> Date.parse(a.dateISO) - Date.parse(b.dateISO));


}





function getBelgianOneMilkGoalMlPerDay(now = new Date()){
  const birth = BABY_BIRTH_DATE instanceof Date ? BABY_BIRTH_DATE : null;
  if(!birth || !Number.isFinite(birth.getTime())) return null;
  const ageMs = now.getTime() - birth.getTime();
  if(!Number.isFinite(ageMs) || ageMs < 0) return null;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const ageMonths = ageDays / 30.44;



  // Based on ONE (Belgium) "Le biberon de lait" examples by age (approximate):


  // - 1 month: 7 biberons x 90 ml = 630 ml/day


  // - 3 months: 5 day + 1 night; 6 biberons x 150 ml = 900 ml/day


  // - 4-6 months: 5 biberons x 180 ml = 900 ml/day


  // - After solids: 600 ml/day until 1 year


  if(ageMonths < 0.75) return null;


  if(ageMonths < 2.0) return 630;


  if(ageMonths < 6.5) return 900;


  if(ageMonths < 12.0) return 600;
  return null;
}

function getBabyAgeParts(now = new Date()){
  const birth = BABY_BIRTH_DATE instanceof Date ? BABY_BIRTH_DATE : null;
  if(!birth || !Number.isFinite(birth.getTime())) return null;

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if(days < 0){
    months -= 1;
    const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += prevMonthDays;
  }
  if(months < 0){
    years -= 1;
    months += 12;
  }

  const totalMonths = Math.max(0, years * 12 + months);
  return { years, months, totalMonths, days: Math.max(0, days) };
}

function formatBabyAgeLabel(parts){
  if(!parts) return '—';
  if(parts.years > 0){
    const yearLabel = parts.years > 1 ? 'ans' : 'an';
    return `${parts.years} ${yearLabel} ${parts.months} mois`;
  }
  return `${parts.totalMonths} mois ${parts.days} j`;
}

function getMilkRangeByAge(now = new Date()){
  const parts = getBabyAgeParts(now);
  if(!parts) return null;
  const ageMonths = parts.totalMonths + (parts.days / 30.44);

  if(ageMonths < 1.5) return { min: 450, max: 750, label: '0–1 mois' };
  if(ageMonths < 3.5) return { min: 600, max: 900, label: '1–3 mois' };
  if(ageMonths < 6.5) return { min: 750, max: 1050, label: '3–6 mois' };
  if(ageMonths < 12.5) return { min: 500, max: 800, label: '6–12 mois' };
  return null;
}



function renderStatsMilkGoalNote(){


  const el = document.getElementById('stats-milk-goal-note');


  if(!el) return;


  const goal = getBelgianOneMilkGoalMlPerDay(new Date());


  if(!goal){


    el.textContent = "Objectif (ONE): —";


    return;


  }


  el.textContent = `Objectif (ONE): ${formatNumber(goal)} ml / jour (repère indicatif)`;


}





function renderStatsGrowthOverview(){


  const el = document.getElementById('stats-growth-overview');


  if(!el) return;


  const entries = (Array.isArray(state.measurements) ? state.measurements : [])


    .filter(m => m && m.dateISO && (Number.isFinite(m.weight) || Number.isFinite(m.height)))


    .sort((a,b)=> Date.parse(a.dateISO) - Date.parse(b.dateISO));


  if(!entries.length){


    el.textContent = "Pas encore de mesures. Ajoutez poids/taille dans « Mesures ».";


    return;


  }


  const latest = entries[entries.length - 1];


  const prev = entries.length > 1 ? entries[entries.length - 2] : null;





  const date = parseDateInput(latest.dateISO);


  const dateLabel = date ? date.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : latest.dateISO;


  const w = Number.isFinite(latest.weight) ? latest.weight : null;


  const h = Number.isFinite(latest.height) ? latest.height : null;


  const pw = prev && Number.isFinite(prev.weight) ? prev.weight : null;


  const ph = prev && Number.isFinite(prev.height) ? prev.height : null;


  const dW = w != null && pw != null ? (w - pw) : null;


  const dH = h != null && ph != null ? (h - ph) : null;





  const parts = [`Date: ${dateLabel}`];


  if(w != null) parts.push(`Poids ${formatNumber(w, 2, 2)} kg${dW != null ? ` (${formatSignedNumber(dW)} kg)` : ''}`);


  if(h != null) parts.push(`Taille ${formatNumber(h, 0, 1)} cm${dH != null ? ` (${formatSignedNumber(dH)} cm)` : ''}`);


  if(w == null && h == null) parts.push('Valeurs manquantes');


  el.textContent = parts.join(' • ');


}





let milkDetailsState = null;





function renderMilkDetails(){


  if(!milkDetailsState || !milkDetailsContentEl || !milkDetailsSubtitleEl) return;


  const { perDay, index } = milkDetailsState;


  const day = perDay[index];


  if(!day){


    milkDetailsContentEl.innerHTML = '<div class="history-empty">Aucune donnée</div>';


    milkDetailsSubtitleEl.textContent = '—';


    return;


  }





  const date = parseDateInput(day.dateISO);


  milkDetailsSubtitleEl.textContent = date


    ? date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })


    : day.dateISO;





  const prev = perDay[index - 1] || null;


  const prevMl = prev ? Number(prev.bottleMl || 0) : 0;


  const todayMl = Number(day.bottleMl || 0);


  const diffMl = todayMl - prevMl;


  const pct = prevMl > 0 ? (diffMl / prevMl) * 100 : null;


  const insight = getMilkInsight(diffMl, prevMl);





  const bottleCount = Number(day.bottleSessions || 0);


  const avgPerBottle = bottleCount > 0 ? (todayMl / bottleCount) : 0;





  const goalMl = getBelgianOneMilkGoalMlPerDay(new Date(day.dateISO));


  const goalPct = goalMl ? Math.round((todayMl / goalMl) * 100) : null;


  const goalLabel = goalMl ? `Objectif (ONE): ${formatNumber(goalMl)} ml (${goalPct}%)` : null;





  const compareLabel = prev


    ? `${formatSignedNumber(diffMl)} ml${prevMl > 0 ? ` (${formatPercent(pct)})` : ''} vs veille`


    : 'Pas de comparaison';





  const feeds = getBottleFeedsForDay(day.dateISO);


  const feedItems = feeds.length


    ? feeds.map(feed => {


        const time = new Date(feed.dateISO).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });


        const ml = Number(feed.amountMl || 0);


        return `<div class="item"><strong>${escapeHtml(time)}</strong><span class="muted">${formatNumber(ml)} ml</span></div>`;


      }).join('')


    : '<div class="history-empty">Aucun biberon enregistré ce jour</div>';





  milkDetailsContentEl.innerHTML = `


    <div class="report-line" style="margin-top:0">


      <strong>Total</strong>


      <span class="kpi-pill">${formatNumber(todayMl)} ml</span>


      <span class="kpi-pill">${formatNumber(bottleCount)} biberon(s)</span>


      <span class="kpi-pill">Moyenne ${formatNumber(avgPerBottle, 0, 0)} ml</span>


      <span class="kpi-pill">${escapeHtml(compareLabel)}</span>


      <span class="kpi-pill">${escapeHtml(insight)}</span>


      ${goalLabel ? `<span class="kpi-pill">${escapeHtml(goalLabel)}</span>` : ''}


    </div>


    <div class="stack" style="margin-top:12px; gap:10px">


      <strong>Liste des biberons</strong>


      <div class="list">${feedItems}</div>


    </div>


  `;





  milkDetailsPrevBtn && (milkDetailsPrevBtn.disabled = index <= 0);


  milkDetailsNextBtn && (milkDetailsNextBtn.disabled = index >= perDay.length - 1);


}





function openMilkDetails(range, dateISO){


  if(!milkDetailsModal) return;


  const stats = buildRangeStats(range);


  const perDay = Array.isArray(stats.perDay) ? stats.perDay : [];


  const found = perDay.findIndex(day => day.dateISO === dateISO);


  milkDetailsState = { perDay, index: Math.max(0, found), range };


  renderMilkDetails();


  openModal('#modal-milk-details');


}





function initMilkDetailsModal(){


  if(!milkDetailsModal || milkDetailsModal.__milkBound) return;


  milkDetailsModal.__milkBound = true;





  closeMilkDetailsBtn?.addEventListener('click', () => closeModal('#modal-milk-details'));


  milkDetailsPrevBtn?.addEventListener('click', () => {


    if(!milkDetailsState) return;


    milkDetailsState.index = Math.max(0, milkDetailsState.index - 1);


    renderMilkDetails();


  });


  milkDetailsNextBtn?.addEventListener('click', () => {


    if(!milkDetailsState) return;


    const max = Math.max(0, milkDetailsState.perDay.length - 1);


    milkDetailsState.index = Math.min(max, milkDetailsState.index + 1);


    renderMilkDetails();


  });


}





function renderWeeklyBottleSparkline(container, range = {mode:'week'}, selectedDateISO = null){


  if(!container) return;


  const stats = buildRangeStats(range);


  const perDay = Array.isArray(stats.perDay) ? stats.perDay : [];


  if(!perDay.length){


    container.innerHTML = '<span class="muted">Pas de donnée</span>';


    return;


  }





  const max = Math.max(...perDay.map(day => Number(day.bottleMl || 0)));


  container.innerHTML = perDay.map(day => {


    const value = Number(day.bottleMl || 0);


    const percent = max > 0 ? Math.round((value / max) * 100) : 0;


    const height = Math.max(6, percent);


    const label = formatStatsDayLabel(day.dateISO, {weekday:'short'});


    const valueLabel = `${formatNumber(value)} ml`;


    const isZero = value <= 0;


    const isSelected = selectedDateISO && day.dateISO === selectedDateISO;


    return `


      <button type="button" class="spark-bar${isZero ? ' is-zero' : ''}${isSelected ? ' is-selected' : ''}" data-date="${escapeHtml(day.dateISO)}" data-label="${escapeHtml(label)}" title="${escapeHtml(valueLabel)}" aria-label="${escapeHtml(label)}: ${escapeHtml(valueLabel)}">


        <span class="spark-fill" style="--spark-height:${height}%"></span>


      </button>


    `;


  }).join('');





  if(container.__milkSparkBound) return;


  container.__milkSparkBound = true;


  container.addEventListener('click', (event) => {


    const btn = event.target instanceof Element ? event.target.closest('.spark-bar') : null;


    if(!(btn instanceof HTMLElement)) return;


    const dateISO = btn.dataset.date;


    if(!dateISO) return;


    openMilkDetails(range, dateISO);


  });


}





function updateSummaries(){
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  if(milkAgeEl){
    milkAgeEl.textContent = `Age: ${formatBabyAgeLabel(getBabyAgeParts(today))}`;
  }

  const feeds = Array.isArray(state.feeds) ? state.feeds : [];
  const todaysFeeds = feeds.filter(feed => {
    const ts = Date.parse(feed?.dateISO || '');
    return Number.isFinite(ts) && ts >= start;
  });

  const todayBottleFeeds = todaysFeeds.filter(feed => feed.source === 'bottle');
  const todayBreastFeeds = todaysFeeds.filter(feed => feed.source === 'breast');
  const totalBottleMl = todayBottleFeeds.reduce((sum, feed) => sum + (Number(feed.amountMl || 0) || 0), 0);
  const totalBreastMinutes = todayBreastFeeds.reduce((sum, feed) => sum + ((Number(feed.durationSec || 0) || 0) / 60), 0);

  let lastFeed = null;
  let lastTs = null;
  feeds.forEach(feed => {
    const ts = Date.parse(feed?.dateISO || '');
    if(!Number.isFinite(ts)) return;
    if(lastTs === null || ts > lastTs){
      lastTs = ts;
      lastFeed = feed;
    }
  });

  if(milkLastValueEl && milkLastMetaEl){
    if(lastFeed && lastTs){
      const timeLabel = new Date(lastTs).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      const sourceLabel = lastFeed.source === 'bottle' ? 'Biberon' : 'Tetee';
      milkLastValueEl.textContent = `${timeLabel}`;
      const metaParts = [];
      if(lastFeed.source === 'bottle' && Number.isFinite(lastFeed.amountMl)){
        metaParts.push(`${formatNumber(lastFeed.amountMl)} ml`);
      }
      if(lastFeed.source === 'breast' && Number.isFinite(lastFeed.durationSec)){
        metaParts.push(`${formatMinutes(lastFeed.durationSec / 60)} min`);
      }
      if(sourceLabel) metaParts.push(sourceLabel);
      if(lastFeed.breastSide){
        metaParts.push(lastFeed.breastSide);
      }
      milkLastMetaEl.textContent = metaParts.length ? metaParts.join(' - ') : 'Derniere prise enregistree';
      if(milkSinceValueEl){
        const diffMin = Math.max(0, Math.round((Date.now() - lastTs) / 60000));
        milkSinceValueEl.textContent = diffMin === 0 ? 'Il y a 0 min' : `Il y a ${formatIntervalMinutes(diffMin)}`;
      }
      if(milkSinceMetaEl){
        milkSinceMetaEl.textContent = 'Temps ecoule';
      }
    }else{
      milkLastValueEl.textContent = '-';
      milkLastMetaEl.textContent = 'Aucun enregistrement';
      if(milkSinceValueEl) milkSinceValueEl.textContent = '-';
      if(milkSinceMetaEl) milkSinceMetaEl.textContent = 'Temps ecoule';
    }
  }

  const range = getMilkRangeByAge(today);

  if(milkTotalValueEl && milkTotalMetaEl){
    milkTotalValueEl.textContent = `Biberon aujourd hui: ${formatNumber(totalBottleMl)} ml`;
    const metaParts = [];
    if(range){
      metaParts.push(`Repere ${formatNumber(range.min)}-${formatNumber(range.max)} ml`);
    }
    if(todayBottleFeeds.length) metaParts.push(`${todayBottleFeeds.length} biberon(s)`);
    if(totalBreastMinutes > 0) metaParts.push(`Tetee ${formatMinutes(totalBreastMinutes)} min`);
    if(todayBreastFeeds.length) metaParts.push(`${todayBreastFeeds.length} tetee(s)`);
    milkTotalMetaEl.textContent = metaParts.length ? metaParts.join(' - ') : 'Aucune prise enregistree';
  }

  if(milkStatusEl || milkStatusMsgEl || milkStatusEmoteEl || milkRangeNumEl || milkStatusBarEl || milkStatusFillEl){
    const maxRange = range && range.max ? range.max : 0;
    const minRange = range && range.min ? range.min : 0;
    const progressPercent = maxRange > 0 ? Math.min(100, Math.round((totalBottleMl / maxRange) * 100)) : 0;
    if(milkStatusEl) milkStatusEl.style.setProperty('--progress', String(progressPercent / 100));
    if(milkStatusBarEl) milkStatusBarEl.setAttribute('aria-valuenow', String(progressPercent));
    if(milkRangeNumEl){
      milkRangeNumEl.textContent = range
        ? `Repere ${formatNumber(minRange)}-${formatNumber(maxRange)} ml`
        : 'Repere —';
    }

    let msg = 'Suivi en cours';
    let emote = 'Tout va bien';
    let state = 'none';

    if(range){
      if(totalBottleMl === 0){
        msg = totalBreastMinutes > 0 ? "Sein uniquement pour l'instant" : 'Aucun biberon encore';
        emote = 'Tout va bien, enregistrez quand vous voulez';
        state = 'none';
      }else if(totalBottleMl < minRange){
        msg = 'Encore sous le repere';
        emote = 'Pas de stress, ca va';
        state = 'low';
      }else if(totalBottleMl <= maxRange){
        msg = 'Dans la zone normale';
        emote = 'Tout va bien';
        state = 'in';
      }else{
        msg = 'Legerement au-dessus';
        emote = "Pas d'alarme, regardez la tendance";
        state = 'high';
      }
    }else{
      if(totalBottleMl === 0){
        msg = 'Pas encore de saisie';
        emote = 'Pret a commencer';
        state = 'none';
      }else{
        msg = 'Suivi en cours';
        emote = 'Tout va bien';
        state = 'in';
      }
    }

    if(milkStatusMsgEl) milkStatusMsgEl.textContent = msg;
    if(milkStatusEmoteEl) milkStatusEmoteEl.textContent = emote;
    if(milkStatusEl) milkStatusEl.dataset.state = state;
    if(milkStatusBarEl) milkStatusBarEl.setAttribute('aria-label', `Etat du jour: ${msg}`);
  }

  if(summarySleepEl){
    const todaySleep = state.sleepSessions
      .filter(s => {
        const ts = new Date(s.dateISO || s.endISO || s.startISO || '').getTime();
        return Number.isFinite(ts) && ts >= start;
      })
      .sort((a,b)=> (a.dateISO || a.endISO || '') < (b.dateISO || b.endISO || '') ? 1 : -1);
    if(!todaySleep.length){
      summarySleepEl.innerHTML = "<strong>Sommeil</strong><span class=\"kpi-pill\">Aucune sieste enregistrée</span>";
    }else{
      const minutesTotal = todaySleep.reduce((sum, session) => {
        if(Number.isFinite(session.durationSec)){
          return sum + (session.durationSec / 60);
        }
        const startDate = parseDateTimeInput(session.startISO);
        const endDate = parseDateTimeInput(session.endISO);
        if(startDate && endDate){
          return sum + Math.max(0, (endDate.getTime() - startDate.getTime()) / 60000);
        }
        return sum;
      }, 0);
      const avgMinutes = minutesTotal / Math.max(todaySleep.length, 1);
      const lastEnd = toValidDate(todaySleep[0].endISO || todaySleep[0].dateISO);
      const totalLabel = formatSleepMinutesLabel(minutesTotal);
      const avgLabel = formatSleepMinutesLabel(avgMinutes);
      summarySleepEl.innerHTML = `
        <strong>Sommeil</strong>
        <span class="kpi-pill">${todaySleep.length} sieste(s)</span>
        <span class="kpi-pill">Total ${totalLabel}</span>
        <span class="kpi-pill">Ø ${avgLabel}</span>
        ${lastEnd ? `<span class="kpi-pill">Dernier réveil ${lastEnd.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>` : ''}
      `;
    }
  }

  if(summaryElimEl || dashboardElimEl){
    const todayElims = state.elims.filter(e => new Date(e.dateISO).getTime() >= start);
    if(!todayElims.length){
      if(summaryElimEl) summaryElimEl.innerHTML = "<strong>Aujourd'hui</strong><span class=\"kpi-pill\">Aucune donnée</span>";
      if(dashboardElimEl) dashboardElimEl.innerHTML = "<strong>Pipi / Caca / Vomi</strong><span class=\"kpi-pill\">Aucune donnée aujourd'hui</span>";
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
          <span class="kpi-pill">Pipi ${totals.pee}</span>
          <span class="kpi-pill">Caca ${totals.poop}</span>
          <span class="kpi-pill">Vomi ${totals.vomit}</span>
          <span class="kpi-pill">${todayElims.length} entrée(s)</span>
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



initMilkDetailsModal();





bootstrap();



