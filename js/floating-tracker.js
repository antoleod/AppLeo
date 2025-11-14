const MODE_CONFIG = {
  sein: {
    label: 'Sein',
    summaryLabel: 'Tétée (sein)',
    accent: '#f58fb7',
    background: '#fff4f9'
  },
  biberon: {
    label: 'Biberon',
    summaryLabel: 'Biberon',
    accent: '#7bb9ff',
    background: '#f0f7ff'
  }
};

const BOTTLE_DEFAULT_KEY = 'appleo:bottleDefaultQuantity';
const BOTTLE_COUNTS_KEY = 'appleo:bottleQuantityCounts';
const INITIAL_BOTTLE_DEFAULT = 90;
const inMemoryStorage = Object.create(null);

function safeStorageGet(key) {
  try {
    const value = window.localStorage?.getItem(key);
    if (value !== null && value !== undefined) {
      inMemoryStorage[key] = value;
      return value;
    }
  } catch {
    // Storage might be unavailable (private mode, etc.)
  }
  return Object.prototype.hasOwnProperty.call(inMemoryStorage, key)
    ? inMemoryStorage[key]
    : null;
}

function safeStorageSet(key, value) {
  inMemoryStorage[key] = value;
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // Ignore storage failures
  }
}

function getBottleDefaultPreference() {
  const raw = safeStorageGet(BOTTLE_DEFAULT_KEY);
  if (!raw) {
    return INITIAL_BOTTLE_DEFAULT;
  }
  try {
    const parsed = JSON.parse(raw);
    const value = Number(parsed);
    return Number.isFinite(value) && value > 0 ? value : INITIAL_BOTTLE_DEFAULT;
  } catch {
    return INITIAL_BOTTLE_DEFAULT;
  }
}

function persistBottleDefaultPreference(value) {
  safeStorageSet(BOTTLE_DEFAULT_KEY, JSON.stringify(value));
}

function loadBottleQuantityCounts() {
  const raw = safeStorageGet(BOTTLE_COUNTS_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistBottleQuantityCounts(counts) {
  safeStorageSet(BOTTLE_COUNTS_KEY, JSON.stringify(counts));
}

function updateBottleDefaultPreference(finalAmount) {
  const normalized = Math.max(0, Math.round(finalAmount));
  if (normalized <= 0) {
    return getBottleDefaultPreference();
  }
  const counts = loadBottleQuantityCounts();
  const key = String(normalized);
  counts[key] = (counts[key] || 0) + 1;
  persistBottleQuantityCounts(counts);
  const currentDefault = getBottleDefaultPreference();
  if (normalized > currentDefault && counts[key] >= 2) {
    persistBottleDefaultPreference(normalized);
    return normalized;
  }
  return currentDefault;
}

class FloatingFeedController {
  constructor() {
    this.windowRef = null;
    this.inlineMode = false;
    this.overlayRoot = null;
    this.inlineFrame = null;
    this.mode = null;
    this.doc = null;
    this.timerHandle = null;
    this.startTimestamp = null;
    this.lastResume = null;
    this.elapsedMs = 0;
    this.baseElapsed = 0;
    this.running = false;
    this.side = 'left';
    this.ml = 0;
    this.milkType = 'maternal';
    this.activeSession = false;
    this.lastContext = {};
    this.announcedStart = false;
    this.autoStart = true;
    this.boundCleanup = () => this.cleanupSession();
    this.startBtn = null;
    this.stopBtn = null;
    this.durationEl = null;
    this.startLabel = null;
    this.statusEl = null;
    this.sideOutput = null;
    this.mlValueEl = null;
    this.mlInputEl = null;
    this.milkTypeSelect = null;
    this.defaultBottleQuantity = getBottleDefaultPreference();
  }

  async open(mode, context = {}) {
    if (!MODE_CONFIG[mode]) {
      console.warn('Mode non pris en charge pour la fenêtre flottante :', mode);
      return false;
    }

    const enrichedContext = {
      autoStart: true,
      ...context
    };

    if (this.windowRef && !this.windowRef.closed) {
      if (this.inlineMode) {
        this.focusInlineOverlay();
        this.overlayRoot?.classList?.add('floating-inline-overlay--pulse');
        window.setTimeout(() => this.overlayRoot?.classList?.remove('floating-inline-overlay--pulse'), 600);
      } else {
        this.windowRef.focus();
      }
      return true;
    }

    return await this.prepareWindow(mode, enrichedContext);
  }

  async prepareWindow(mode, context = {}) {
    this.resetSession(mode, context);
    try {
      let targetWindow = await this.requestWindow();
      if (targetWindow) {
        this.inlineMode = false;
      } else {
        this.inlineMode = true;
        targetWindow = this.renderInlineOverlay(mode);
        if (!targetWindow) {
          throw new Error('Inline overlay indisponible');
        }
      }
      this.windowRef = targetWindow;
      this.renderWindow(targetWindow, mode);
      this.captureElements();
      this.bindEvents();
      this.updateSideUI();
      this.updateMlUI();
      if (this.autoStart) {
        this.startTimer();
      } else {
        this.updateStatus('Prêt à démarrer');
      }
      if (!this.inlineMode && targetWindow?.focus) {
        targetWindow.focus();
      } else {
        this.focusInlineOverlay();
      }
      this.activeSession = true;
      this.announcedStart = true;
      window.dispatchEvent(new CustomEvent('appleo:floating-feed:session-started', { detail: { mode } }));
      return true;
    } catch (error) {
      console.error('Impossible d’ouvrir la fenêtre flottante', error);
      alert('Impossible d’ouvrir la fenêtre flottante. Activez le Picture-in-Picture ou autorisez les popups.');
      this.cleanupSession();
      return false;
    }
  }

  async requestWindow() {
    if ('documentPictureInPicture' in window && window.documentPictureInPicture?.requestWindow) {
      try {
        return await window.documentPictureInPicture.requestWindow({ width: 320, height: 420 });
      } catch (err) {
        console.warn('Échec de la demande Document Picture-in-Picture, utilisation d’une popup.', err);
      }
    }

    const popup = window.open('', 'appleo-floating-feed', 'width=360,height=520,menubar=0,toolbar=0,status=0');
    if (!popup) {
      return null;
    }
    return popup;
  }

  resetSession(mode, context = {}) {
    this.mode = mode;
    this.doc = null;
    this.timerHandle = null;
    this.startTimestamp = null;
    this.lastResume = null;
    this.elapsedMs = 0;
    this.baseElapsed = 0;
    this.running = false;
    this.defaultBottleQuantity = getBottleDefaultPreference();
    const allowedSides = ['left', 'right', 'both'];
    this.side = allowedSides.includes(context.side) ? context.side : 'left';
    const providedAmount = Number.isFinite(context.amount) ? context.amount : null;
    if (mode === 'biberon') {
      this.ml = providedAmount !== null ? providedAmount : this.defaultBottleQuantity;
    } else {
      this.ml = 0;
    }
    this.milkType = context.milkType || 'maternal';
    this.lastContext = context;
    this.autoStart = context.autoStart !== false;
  }

  renderWindow(win, mode) {
    const config = MODE_CONFIG[mode];
    const doc = win.document;
    const title = mode === 'sein' ? 'Suivi tétée' : 'Suivi biberon';
    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>
    :root {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      color: #1f1f29;
    }
    body {
      margin: 0;
      background: ${config.background};
      --accent: ${config.accent};
      color: #1f1f29;
    }
    * {
      box-sizing: border-box;
    }
    .pip-shell {
      min-height: 100vh;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .pip-card {
      background: rgba(255, 255, 255, 0.9);
      border-radius: 20px;
      padding: 16px;
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
      backdrop-filter: blur(8px);
    }
    .pip-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }
    .pip-eyebrow {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.7rem;
      color: #666;
    }
    .pip-head h1 {
      margin: 2px 0 0;
      font-size: 1.1rem;
    }
    .pip-chip {
      padding: 0.2rem 0.8rem;
      border-radius: 99px;
      font-size: 0.8rem;
      font-weight: 600;
      background: var(--accent);
      color: #fff;
    }
    .pip-highlights {
      display: flex;
      gap: 12px;
      align-items: stretch;
      flex-wrap: wrap;
    }
    .pip-duration-card {
      flex: 1;
      border-radius: 16px;
      border: 1px solid rgba(0,0,0,0.08);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .pip-duration-card span {
      font-size: 0.75rem;
      color: #666;
    }
    #floating-duration {
      font-size: 1.8rem;
      font-weight: 700;
    }
    #floating-start-time {
      font-size: 0.8rem;
      color: #666;
    }
    .pip-controls {
      flex: 0 0 140px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pip-primary,
    .pip-stop {
      border: none;
      border-radius: 16px;
      font-size: 1rem;
      font-weight: 600;
      padding: 12px;
      box-shadow: 0 12px 20px rgba(0, 0, 0, 0.12);
    }
    .pip-primary {
      background: var(--accent);
      color: #fff;
    }
    .pip-stop {
      background: #ff6b6b;
      color: #fff;
    }
    .pip-status {
      font-size: 0.85rem;
      color: #4a5568;
    }
    .pip-side,
    .pip-biberon {
      border-radius: 16px;
      border: 1px solid rgba(0,0,0,0.08);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pip-side-buttons {
      display: flex;
      gap: 8px;
    }
    .pip-side-buttons button {
      flex: 1;
      border-radius: 12px;
      border: 1px solid rgba(0,0,0,0.1);
      padding: 10px;
      background: #fff;
      font-weight: 600;
    }
    .pip-side-buttons button.active {
      border-color: var(--accent);
      color: var(--accent);
      background: rgba(0,0,0,0.04);
      background: color-mix(in srgb, var(--accent) 15%, transparent);
    }
    .pip-side-swap {
      border: none;
      background: transparent;
      color: var(--accent);
      font-weight: 600;
      text-align: left;
      padding: 0;
    }
    .pip-amount {
      display: flex;
      justify-content: space-between;
      font-size: 1rem;
      font-weight: 600;
    }
    .pip-amount-controls {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .pip-amount-controls button {
      border-radius: 12px;
      border: 1px solid rgba(0,0,0,0.1);
      background: #fff;
      padding: 10px;
      font-weight: 600;
    }
    .pip-amount-controls .pip-amount-minus {
      color: #e25555;
    }
    .pip-amount-controls .pip-amount-plus {
      color: #1f8a58;
    }
    .pip-input {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.85rem;
    }
    .pip-input input,
    .pip-input select {
      border-radius: 12px;
      border: 1px solid rgba(0,0,0,0.12);
      padding: 10px;
      font-size: 1rem;
    }
  </style>
</head>
<body>
  <main class="pip-shell">
    <section class="pip-card">
      <header class="pip-head">
        <div>
          <p class="pip-eyebrow">AppLeo</p>
          <h1>${title}</h1>
        </div>
        <span class="pip-chip" id="pip-mode-chip">${config.label}</span>
      </header>
      <div class="pip-highlights">
        <div class="pip-duration-card">
          <span>Durée</span>
          <strong id="floating-duration">00:00</strong>
          <small id="floating-start-time">En attente</small>
        </div>
        <div class="pip-controls">
          <button type="button" class="pip-primary" id="floating-start-btn">Démarrer</button>
          <button type="button" class="pip-stop" id="floating-stop-btn">Terminer</button>
        </div>
      </div>
      <div class="pip-status" id="floating-status-text">Prêt à démarrer</div>
    </section>
    <section class="pip-card pip-side" id="floating-side-panel" style="${mode === 'sein' ? '' : 'display:none'}">
      <strong>Sein actif</strong>
      <div class="pip-side-buttons">
        <button type="button" data-side="left" class="active" id="floating-side-left">Gauche</button>
        <button type="button" data-side="right" id="floating-side-right">Droite</button>
        <button type="button" data-side="both" id="floating-side-both">Les deux</button>
      </div>
      <button type="button" class="pip-side-swap" id="floating-side-swap">Alterner gauche/droite/les deux</button>
      <small id="floating-current-side">Gauche en cours</small>
    </section>
    <section class="pip-card pip-biberon" id="floating-biberon-panel" style="${mode === 'biberon' ? '' : 'display:none'}">
      <div class="pip-amount">
        <span>Pris</span>
        <strong id="floating-ml-value">0 ml</strong>
      </div>
      <div class="pip-amount-controls">
        <button type="button" data-delta="-10" class="pip-amount-minus">-10 ml</button>
        <button type="button" data-delta="10" class="pip-amount-plus">+10 ml</button>
      </div>
      <label class="pip-input">
        <span>Saisir manuellement</span>
        <input type="number" min="0" step="5" id="floating-ml-input" value="0" inputmode="numeric" />
      </label>
      <label class="pip-input">
        <span>Type de lait</span>
        <select id="floating-milk-type">
          <option value="maternal" selected>Maternel</option>
          <option value="formula">Formule</option>
          <option value="mixta">Mixte</option>
        </select>
      </label>
    </section>
  </main>
</body>
</html>`;
    doc.open();
    doc.write(html);
    doc.close();
  }

  renderInlineOverlay(mode) {
    this.removeInlineOverlay();
    const config = MODE_CONFIG[mode];
    const title = mode === 'sein' ? 'Suivi tétée' : 'Suivi biberon';
    const overlay = document.createElement('div');
    overlay.id = 'floating-inline-overlay';
    overlay.innerHTML = `
      <div class="floating-inline-backdrop" data-inline-dismiss="true"></div>
      <div class="floating-inline-frame" role="dialog" aria-label="${title}">
        <iframe id="floating-inline-frame" title="${title}" allow="autoplay"></iframe>
        <button type="button" class="floating-inline-close" data-inline-dismiss="true" aria-label="Fermer la fenêtre flottante">×</button>
      </div>`;
    const style = document.createElement('style');
    style.textContent = `
      html.floating-inline-open {
        overflow: hidden;
      }
      #floating-inline-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #floating-inline-overlay .floating-inline-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(6px);
      }
      #floating-inline-overlay .floating-inline-frame {
        position: relative;
        width: min(420px, calc(100% - 24px));
        border-radius: 28px;
        overflow: hidden;
        box-shadow: 0 24px 50px rgba(15, 23, 42, 0.35);
        background: transparent;
      }
      #floating-inline-overlay iframe {
        width: 100%;
        height: min(600px, calc(100vh - 32px));
        border: none;
        border-radius: inherit;
        background: transparent;
        display: block;
      }
      #floating-inline-overlay .floating-inline-close {
        position: absolute;
        top: 10px;
        right: 12px;
        border: none;
        width: 36px;
        height: 36px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.9);
        font-size: 1.2rem;
        font-weight: 600;
        color: #111;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
      }
      .floating-inline-overlay--pulse .floating-inline-frame {
        animation: floating-inline-pulse 0.6s ease;
      }
      @keyframes floating-inline-pulse {
        0% { transform: scale(0.96); opacity: 0.8; }
        60% { transform: scale(1.02); opacity: 1; }
        100% { transform: scale(1); }
      }
    `;
    overlay.appendChild(style);
    document.body.appendChild(overlay);
    document.documentElement.classList.add('floating-inline-open');
    const iframe = overlay.querySelector('#floating-inline-frame');
    if (!iframe || !iframe.contentWindow) {
      console.error('Impossible de créer la fenêtre inline pour le suivi');
      overlay.remove();
      document.documentElement.classList.remove('floating-inline-open');
      return null;
    }
    this.overlayRoot = overlay;
    this.inlineFrame = iframe;
    // Propagate accent/background via inline styles on iframe body once chargé
    iframe.addEventListener('load', () => {
      try {
        const frameDoc = iframe.contentDocument;
        frameDoc?.body?.setAttribute('style', `--accent:${config.accent};background:${config.background};`);
      } catch (err) {
        console.warn('Impossible de styler l\'iframe inline', err);
      }
    }, { once: true });
    overlay.querySelectorAll('[data-inline-dismiss]').forEach((node) => {
      node.addEventListener('click', (event) => {
        event.preventDefault();
        this.closeWindow();
      });
    });
    return iframe.contentWindow;
  }

  focusInlineOverlay() {
    this.inlineFrame?.focus();
  }

  removeInlineOverlay() {
    if (this.overlayRoot) {
      this.overlayRoot.remove();
      this.overlayRoot = null;
    }
    this.inlineFrame = null;
    document.documentElement.classList.remove('floating-inline-open');
  }

  captureElements() {
    if (!this.windowRef) return;
    this.doc = this.windowRef.document;
    this.startBtn = this.doc.getElementById('floating-start-btn');
    this.stopBtn = this.doc.getElementById('floating-stop-btn');
    this.durationEl = this.doc.getElementById('floating-duration');
    this.startLabel = this.doc.getElementById('floating-start-time');
    this.statusEl = this.doc.getElementById('floating-status-text');
    this.sideOutput = this.doc.getElementById('floating-current-side');
    this.mlValueEl = this.doc.getElementById('floating-ml-value');
    this.mlInputEl = this.doc.getElementById('floating-ml-input');
    this.milkTypeSelect = this.doc.getElementById('floating-milk-type');
    if (this.milkTypeSelect && this.milkType) {
      this.milkTypeSelect.value = this.milkType;
    }
    if (this.mlInputEl) {
      this.mlInputEl.value = String(this.ml);
    }
  }

  bindEvents() {
    if (!this.windowRef || !this.doc) return;
    this.startBtn?.addEventListener('click', () => this.toggleTimer());
    this.stopBtn?.addEventListener('click', () => this.handleStop());

    const sideLeft = this.doc.getElementById('floating-side-left');
    const sideRight = this.doc.getElementById('floating-side-right');
    const sideBoth = this.doc.getElementById('floating-side-both');
    sideLeft?.addEventListener('click', () => this.setSide('left'));
    sideRight?.addEventListener('click', () => this.setSide('right'));
    sideBoth?.addEventListener('click', () => this.setSide('both'));
    this.doc.getElementById('floating-side-swap')?.addEventListener('click', () => {
      const order = ['left', 'right', 'both'];
      const currentIdx = order.indexOf(this.side);
      const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % order.length;
      this.setSide(order[nextIdx]);
    });

    this.doc.querySelectorAll('[data-delta]').forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = Number(btn.getAttribute('data-delta')) || 0;
        this.adjustMl(delta);
      });
    });

    this.mlInputEl?.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      if (Number.isFinite(value) && value >= 0) {
        this.ml = value;
        this.updateMlUI();
      }
    });

    this.milkTypeSelect?.addEventListener('change', (event) => {
      this.milkType = event.target.value;
    });

    if (!this.inlineMode) {
      this.windowRef.addEventListener('pagehide', this.boundCleanup);
      this.windowRef.addEventListener('beforeunload', this.boundCleanup);
    }
  }

  toggleTimer() {
    if (this.running) {
      this.pauseTimer();
    } else {
      this.startTimer();
    }
  }

  startTimer() {
    const now = Date.now();
    if (!this.startTimestamp) {
      this.startTimestamp = now;
      this.startLabel && (this.startLabel.textContent = formatTime(now));
    }
    this.lastResume = now;
    this.running = true;
    this.timerHandle = window.setInterval(() => {
      this.elapsedMs = this.baseElapsed + (Date.now() - (this.lastResume || Date.now()));
      this.updateDurationUI();
    }, 500);
    if (this.startBtn) this.startBtn.textContent = 'Mettre en pause';
    this.updateStatus(this.mode === 'sein' ? 'Tétée en cours' : 'Biberon en cours');
  }

  pauseTimer() {
    if (!this.running) return;
    const now = Date.now();
    this.elapsedMs = this.baseElapsed + (now - (this.lastResume || now));
    this.baseElapsed = this.elapsedMs;
    if (this.timerHandle) {
      window.clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
    this.running = false;
    if (this.startBtn) this.startBtn.textContent = 'Reprendre';
    this.updateDurationUI();
    this.updateStatus(this.mode === 'sein' ? 'Tétée en pause' : 'Biberon en pause');
  }

  updateDurationUI() {
    if (this.durationEl) {
      this.durationEl.textContent = formatDuration(this.elapsedMs);
    }
  }

  adjustMl(delta) {
    if (this.mode !== 'biberon') return;
    this.ml = Math.max(0, this.ml + delta);
    this.updateMlUI();
  }

  updateMlUI() {
    if (this.mode !== 'biberon') return;
    if (this.mlValueEl) {
      this.mlValueEl.textContent = `${this.ml} ml`;
    }
    if (this.mlInputEl) {
      this.mlInputEl.value = String(this.ml);
    }
  }

  setSide(nextSide) {
    if (this.mode !== 'sein') return;
    const allowedSides = ['left', 'right', 'both'];
    const normalized = allowedSides.includes(nextSide) ? nextSide : 'left';
    this.side = normalized;
    const buttons = this.doc?.querySelectorAll('[data-side]');
    buttons?.forEach(btn => {
      const isActive = btn.getAttribute('data-side') === normalized;
      btn.classList.toggle('active', isActive);
    });
    if (this.sideOutput) {
      let label = 'Gauche en cours';
      if (normalized === 'right') {
        label = 'Droite en cours';
      } else if (normalized === 'both') {
        label = 'Les deux en cours';
      }
      this.sideOutput.textContent = label;
    }
  }

  updateSideUI() {
    if (this.mode !== 'sein') return;
    this.setSide(this.side);
  }

  updateStatus(text) {
    if (this.statusEl) {
      this.statusEl.textContent = text;
    }
  }

  handleStop() {
    if (this.running) {
      this.pauseTimer();
    }
    const now = Date.now();
    if (!this.startTimestamp) {
      this.startTimestamp = now;
    }
    const duration = this.elapsedMs || (now - this.startTimestamp);
    const draft = {
      id: `floating-${now}`,
      mode: this.mode,
      label: MODE_CONFIG[this.mode].summaryLabel,
      startTimestamp: this.startTimestamp,
      endTimestamp: now,
      durationMs: duration,
      side: this.mode === 'sein' ? this.side : null,
      amountMl: this.mode === 'biberon' ? this.ml : null,
      milkType: this.mode === 'biberon' ? this.milkType : null,
      createdAt: now
    };
    if (this.mode === 'biberon' && Number.isFinite(this.ml) && this.ml > 0) {
      this.defaultBottleQuantity = updateBottleDefaultPreference(this.ml);
    }
    const completeEvent = new CustomEvent('appleo:floating-draft:complete', { detail: draft });
    window.dispatchEvent(completeEvent);
    this.closeWindow();
    window.focus();
  }

  closeWindow() {
    if (this.inlineMode) {
      this.removeInlineOverlay();
    } else if (this.windowRef && !this.windowRef.closed) {
      this.windowRef.removeEventListener('pagehide', this.boundCleanup);
      this.windowRef.removeEventListener('beforeunload', this.boundCleanup);
      this.windowRef.close();
    }
    this.cleanupSession();
  }

  cleanupSession() {
    const endedMode = this.mode;
    if (this.timerHandle) {
      window.clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
    if (this.windowRef && !this.inlineMode) {
      this.windowRef.removeEventListener('pagehide', this.boundCleanup);
      this.windowRef.removeEventListener('beforeunload', this.boundCleanup);
    }
    if (this.inlineMode) {
      this.removeInlineOverlay();
    }
    this.windowRef = null;
    this.inlineFrame = null;
    this.inlineMode = false;
    this.doc = null;
    this.running = false;
    if (this.announcedStart && endedMode) {
      window.dispatchEvent(new CustomEvent('appleo:floating-feed:session-ended', { detail: { mode: endedMode } }));
    }
    this.activeSession = false;
    this.announcedStart = false;
    this.autoStart = true;
  }
}

function initFloatingTracker() {
  const controller = new FloatingFeedController();

  window.appleoFloatingTracker = {
    openSession: (mode, context = {}) => controller.open(mode, context),
    clearDraft: () => {},
    hasActiveSession: () => controller.activeSession
  };
}

function formatDuration(ms = 0) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    hours > 0 ? String(hours).padStart(2, '0') : null,
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0')
  ].filter(Boolean);
  return parts.join(':');
}

function formatTime(timestamp) {
  try {
    const formatter = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
    return formatter.format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleTimeString();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFloatingTracker);
} else {
  initFloatingTracker();
}
