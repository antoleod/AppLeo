import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db, ensureAuth } from "./firebase.js";

const COLLECTION = "babyLogs";
const TYPE_KEYS = [
  "feeds",
  "elims",
  "meds",
  "measurements",
  "sleepSessions",
  "pumpSessions",
  "milestones"
];

const statusEl = document.getElementById("status");
const jsonInput = document.getElementById("jsonInput");
const jsonFile = document.getElementById("jsonFile");
const docIdInput = document.getElementById("docId");
const importBtn = document.getElementById("importBtn");

const logStatus = (message) => {
  statusEl.textContent = message;
};

const baseSnapshot = () => ({
  feeds: [],
  elims: [],
  meds: [],
  measurements: [],
  sleepSessions: [],
  pumpSessions: [],
  milestones: [],
  activeTimers: {}
});

const normalizeSnapshot = (raw) => {
  const snapshot = baseSnapshot();
  if (!raw || typeof raw !== "object") return snapshot;
  TYPE_KEYS.forEach((key) => {
    snapshot[key] = Array.isArray(raw[key]) ? raw[key] : [];
  });
  snapshot.activeTimers = raw.activeTimers && typeof raw.activeTimers === "object"
    ? raw.activeTimers
    : {};
  return snapshot;
};

const mergeById = (currentList, incomingList) => {
  const map = new Map();
  currentList.forEach((item) => {
    if (item && item.id != null) map.set(String(item.id), item);
  });
  incomingList.forEach((item) => {
    if (item && item.id != null) map.set(String(item.id), item);
  });
  return Array.from(map.values());
};

const mergeSnapshots = (current, incoming) => {
  const merged = baseSnapshot();
  TYPE_KEYS.forEach((key) => {
    merged[key] = mergeById(current[key] || [], incoming[key] || []);
  });
  merged.activeTimers = Object.assign({}, current.activeTimers || {}, incoming.activeTimers || {});
  return merged;
};

jsonFile.addEventListener("change", async () => {
  const file = jsonFile.files && jsonFile.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    jsonInput.value = text;
    logStatus(`Archivo cargado: ${file.name} (${file.size} bytes).`);
  } catch (err) {
    logStatus(`No se pudo leer el archivo: ${err.message || err}`);
  }
});

importBtn.addEventListener("click", async () => {
  const docId = docIdInput.value.trim();
  if (!docId) {
    logStatus("Falta docId.");
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonInput.value);
  } catch (err) {
    logStatus(`JSON invalido: ${err.message}`);
    return;
  }

  try {
    importBtn.disabled = true;
    logStatus("Autenticando...");
    await ensureAuth();
    logStatus("Cargando documento actual...");
    const ref = doc(db, COLLECTION, docId);
    const snap = await getDoc(ref);
    const current = snap.exists() ? normalizeSnapshot(snap.data()?.snapshot || snap.data()) : baseSnapshot();
    const incoming = normalizeSnapshot(parsed.snapshot ? parsed.snapshot : parsed);
    const merged = mergeSnapshots(current, incoming);
    const counts = TYPE_KEYS.reduce((acc, key) => {
      acc[key] = merged[key].length;
      return acc;
    }, {});

    await setDoc(ref, {
      snapshot: merged,
      metadata: {
        updatedAt: serverTimestamp(),
        lastReason: "Import merge"
      }
    }, { merge: true });

    logStatus(`Importacion completada.\nConteo: ${JSON.stringify(counts)}`);
  } catch (err) {
    logStatus(`Error: ${err.message || err}`);
  } finally {
    importBtn.disabled = false;
  }
});
