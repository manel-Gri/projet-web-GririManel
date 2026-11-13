"use strict";

/* =====================================================================
   Quiz arcade — client JS
   Le navigateur n'affiche que ce que le serveur PHP lui donne :
   questions (sans la bonne réponse), correction, score, classement.
   ===================================================================== */

const API = "api/";

// Apparence uniquement : les questions sont dans la base MySQL
// Les catégories viennent de la table questions : la clé = le nom exact en base.
let CATEGORIES = {};
const CAT_COLORS = ["var(--cyan)", "var(--lime)", "var(--pink)", "var(--yellow)"];
const CAT_ICONS = [
  [/info|web|ordinateur/i, "💻"], [/program|code/i, "⌨️"], [/donn|sql|base/i, "🗄️"],
  [/scien|physi|chim|bio/i, "🧪"], [/sport/i, "⚽"], [/cultur|g[ée]o|histoire/i, "🌍"],
  [/musi/i, "🎵"], [/cin[ée]|film/i, "🎬"]
];
const CAT_FALLBACK_ICONS = ["🎯", "🧠", "📚", "🎮", "🏆", "⭐"];

async function loadCategories() {
  let names = [];
  try { names = await api("categories.php"); } catch (e) { names = []; }
  CATEGORIES = {};
  names.forEach((n, k) => {
    const hit = CAT_ICONS.find(([re]) => re.test(n));
    CATEGORIES[n] = {
      name: n.toUpperCase(),
      icon: hit ? hit[1] : CAT_FALLBACK_ICONS[k % CAT_FALLBACK_ICONS.length],
      color: CAT_COLORS[k % CAT_COLORS.length]
    };
  });
}

const TIME = 15;          // doit être identique à TIME_LIMIT dans bootstrap.php
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const BOARD_SHOW = 20;

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(4, "0");
const cleanName = (v, fallback) => (v || "").trim().replace(/\s+/g, " ").slice(0, 12) || fallback;

const state = {
  cat: null, list: [], i: 0, score: 0, good: 0, combo: 0, maxCombo: 0, lives: 3, finished: false,
  t: TIME, locked: false, busy: false, sound: true,
  mode: "solo",
  name: "JOUEUR",
  players: [],
  p: 0,
  filter: "all",
  fresh: [],     // ids des scores de la session (surlignés dans le classement)
  seed: 0        // même seed pour tous les joueurs d'un groupe => mêmes questions
};

/* ---------- Appels serveur ---------- */
async function api(file, { method = "GET", body } = {}) {
  const res = await fetch(API + file, {
    method,
    credentials: "same-origin",                       // nécessaire pour la session PHP
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* réponse non JSON */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || "HTTP " + res.status);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------- Sons ---------- */
let ctx;
function beep(freq, dur = 0.1, type = "square", delay = 0) {
  if (!state.sound) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.08, ctx.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + dur);
  } catch (e) { /* audio indisponible */ }
}
const sfx = {
  good: () => { beep(660, .08); beep(990, .12, "square", .08); },
  bad: () => { beep(200, .25, "sawtooth"); },
  click: () => beep(440, .05),
  win: () => [523, 659, 784, 1046].forEach((f, k) => beep(f, .15, "square", k * .12)),
  over: () => [400, 300, 200, 120].forEach((f, k) => beep(f, .2, "triangle", k * .15))
};

/* ---------- Stockage local (localStorage) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignoré */ } }
};

/* ---------- Classe : meilleurs scores en localStorage ----------
   Copie locale des scores de ce navigateur. Sert aussi de secours
   quand le serveur PHP est indisponible. */
class LocalScores {
  constructor(key = "arcade-scores", max = 50) {
    this.key = key;
    this.max = max;
  }
  all() {                                             // liste triée du meilleur au moins bon
    try {
      const v = JSON.parse(localStorage.getItem(this.key));
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  add(entry) {                                        // entry = { name, cat, score, date }
    const list = [...this.all(), entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, this.max);
    try { localStorage.setItem(this.key, JSON.stringify(list)); } catch (e) { /* ignoré */ }
  }
  bests() {                                           // même forme que scores.php?best=1
    const out = { hi: 0 };
    this.all().forEach((e) => {
      out[e.cat] = Math.max(out[e.cat] || 0, e.score);
      out.hi = Math.max(out.hi, e.score);
    });
    return out;
  }
}
const localScores = new LocalScores();

/* ---------- Classe : compte à rebours (setInterval) ----------
   Affichage uniquement : le serveur PHP mesure le vrai temps. */
class Countdown {
  constructor(seconds, onTick, onEnd) {
    this.total = seconds;
    this.left = seconds;
    this.onTick = onTick;                             // appelé à chaque seconde
    this.onEnd = onEnd;                               // appelé à zéro
    this.id = null;
  }
  start() { this.stop(); this.left = this.total; this.onTick(this.left); this.resume(); }
  resume() { clearInterval(this.id); this.id = setInterval(() => this.#step(), 1000); }
  stop() { clearInterval(this.id); this.id = null; }
  #step() {
    this.left--;
    this.onTick(this.left);
    if (this.left <= 0) { this.stop(); this.onEnd(); }
  }
}
const countdown = new Countdown(
  TIME,
  (t) => {
    state.t = t;
    updateTimer();
    if (t <= 3 && t > 0) beep(880, .04);
  },
  () => answer(-1)                                    // temps écoulé
);

/* ---------- Records (viennent de la base, secours : localStorage) ---------- */
let bests = {};                                       // { hi, culture, info, science, sport }
const best = (key) => Number(bests[key] || 0);
function refreshHi() { $("hiscore").textContent = pad(best("hi")); }
async function loadBests() {
  try { bests = await api("scores.php?best=1"); } catch (e) { bests = localScores.bests(); }
  refreshHi();
}

/* ---------- Écrans ---------- */
function show(name) {
  if (name !== "game") countdown.stop();
  document.body.dataset.screen = name;
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const el = $("screen-" + name);
  el.classList.add("active");
  if (name === "board") renderBoard();
  const h = el.querySelector("h1, h2");
  if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
}

function renderCats() {
  const box = $("cats");
  box.innerHTML = "";
  Object.entries(CATEGORIES).forEach(([key, c]) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "cat";
    b.style.setProperty("--c", c.color);

    const icon = document.createElement("span");
    icon.className = "cat-icon"; icon.setAttribute("aria-hidden", "true"); icon.textContent = c.icon;
    const name = document.createElement("span");
    name.className = "cat-name"; name.textContent = c.name;
    const rec = document.createElement("span");
    rec.className = "cat-best"; rec.textContent = "Record : " + pad(best(key));

    b.append(icon, name, rec);
    b.addEventListener("click", () => { sfx.click(); start(key); });
    box.appendChild(b);
  });
}

function showCats() {
  const hint = $("cat-hint");
  if (state.mode === "group") {
    hint.textContent = "👥 " + state.players.map((p) => p.name).join(" · ");
    hint.hidden = false;
  } else {
    hint.hidden = true;
  }
  show("cat");
}

/* ---------- Mode groupe : saisie des joueurs ---------- */
const readNames = () => [...document.querySelectorAll("#players input")].map((i) => i.value);

function renderPlayers(names) {
  const box = $("players");
  box.innerHTML = "";
  names.forEach((n, k) => {
    const row = document.createElement("div");
    row.className = "player-row";

    const label = document.createElement("label");
    label.className = "player-num"; label.htmlFor = "pl-" + k; label.textContent = "P" + (k + 1);

    const input = document.createElement("input");
    input.id = "pl-" + k; input.className = "input"; input.type = "text";
    input.maxLength = 12; input.autocomplete = "off";
    input.placeholder = "JOUEUR " + (k + 1); input.value = n;

    row.append(label, input);

    if (names.length > MIN_PLAYERS) {
      const rm = document.createElement("button");
      rm.type = "button"; rm.className = "icon-btn danger"; rm.textContent = "✕";
      rm.setAttribute("aria-label", "Retirer le joueur " + (k + 1));
      rm.addEventListener("click", () => {
        sfx.click();
        const cur = readNames(); cur.splice(k, 1);
        renderPlayers(cur);
      });
      row.append(rm);
    }
    box.appendChild(row);
  });
  $("btn-add-player").hidden = names.length >= MAX_PLAYERS;
}

function addPlayer() {
  const cur = readNames();
  if (cur.length >= MAX_PLAYERS) return;
  cur.push("");
  renderPlayers(cur);
  const last = document.querySelector("#players .player-row:last-child input");
  if (last) last.focus();
}

function confirmPlayers() {
  state.players = readNames().map((n, k) => ({
    name: cleanName(n, "JOUEUR " + (k + 1)), score: 0, good: 0, maxCombo: 0, lives: 3
  }));
  state.mode = "group";
  showCats();
}

/* ---------- Jeu ---------- */
function start(key) {
  state.cat = key;
  state.fresh = [];
  state.seed = 1 + Math.floor(Math.random() * 2147483000);   // utilisée seulement en groupe (le serveur décide en solo)
  if (state.mode === "group") {
    state.p = 0;
    state.players.forEach((p) => Object.assign(p, { score: 0, good: 0, maxCombo: 0, lives: 3 }));
    prepareTurn();
  } else {
    begin();
  }
}

function prepareTurn() {
  const p = state.players[state.p];
  $("turn-num").textContent = `${state.p + 1}/${state.players.length}`;
  $("t-turn").textContent = p.name;
  $("turn-info").textContent = `Stage ${CATEGORIES[state.cat].name} · passe l'appareil à ${p.name}, puis appuie sur GO.`;
  show("turn");
  $("btn-go").focus();
}

// Chaque partie (solo ou tour d'un joueur) ouvre une session de jeu côté serveur
async function begin() {
  if (state.busy) return;
  state.busy = true;
  const group = state.mode === "group";
  const who = group ? state.players[state.p].name : state.name;
  try {
    const data = await api("questions.php", {
      method: "POST",
      body: { cat: state.cat, name: who, mode: state.mode, seed: state.seed }
    });
    state.list = data.questions;                     // [{id, text, answers:[...], type}] sans correction
  } catch (e) {
    state.busy = false;
    alert("Impossible de charger les questions.");
    return;
  }
  state.busy = false;

  Object.assign(state, { i: 0, score: 0, good: 0, combo: 0, maxCombo: 0, lives: 3, finished: false });
  $("hud-cat").textContent = CATEGORIES[state.cat].name;
  $("hud-player-wrap").hidden = !group;
  if (group) $("hud-player").textContent = state.players[state.p].name;
  $("combo").textContent = "";
  show("game");
  loadQuestion();
}

/* Cœurs + libellé accessible */
function setLives() {
  $("hud-lives").textContent = "♥".repeat(state.lives) + "♡".repeat(3 - state.lives);
  $("hud-lives").parentElement.setAttribute("aria-label", state.lives + (state.lives > 1 ? " vies" : " vie"));
}

/* Barre de progression des questions (n = nombre de questions terminées) */
function setProgress(n) {
  const total = state.list.length;
  const bar = $("quiz-bar");
  bar.style.width = (n / total) * 100 + "%";
  bar.parentElement.setAttribute("aria-valuemax", total);
  bar.parentElement.setAttribute("aria-valuenow", n);
}

async function loadQuestion() {
  const { id, text, answers, type } = state.list[state.i];
  state.locked = true;                               // verrouillé jusqu'au feu vert du serveur
  $("question").textContent = text;
  $("q-type").textContent = type === "vf" ? "VRAI / FAUX" : "QCM";
  $("feedback").textContent = ""; $("feedback").className = "feedback";
  $("btn-next").hidden = true;
  $("hud-q").textContent = `${state.i + 1}/${state.list.length}`;
  $("hud-score").textContent = pad(state.score);
  setLives();
  setProgress(state.i);

  const box = $("answers");
  box.className = "answers " + (type || "qcm");
  box.innerHTML = "";
  answers.forEach((a, k) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ans";
    b.innerHTML = `<span class="letter">${"ABCD"[k]}</span><span></span>`;
    b.lastChild.textContent = a;
    b.addEventListener("click", () => answer(k));
    box.appendChild(b);
  });

  // Animation de transition entre les questions
  [$("question"), $("answers")].forEach((el) => {
    el.classList.remove("q-enter"); void el.offsetWidth; el.classList.add("q-enter");
  });

  // Le serveur démarre son propre chrono ici : le temps passé sur l'écran
  // de correction précédent ne compte donc pas.
  try {
    await api("ready.php", { method: "POST", body: { question_id: id } });
  } catch (e) {
    alert("Connexion perdue avec le serveur. La partie est annulée.");
    show("home");
    return;
  }
  state.locked = false;
  countdown.start();
}

function updateTimer() {
  const t = Math.max(0, state.t);
  const bar = $("timer-bar");
  bar.style.width = (t / TIME) * 100 + "%";
  bar.classList.toggle("low", t <= 5);
  bar.parentElement.setAttribute("aria-valuenow", t);
}

async function answer(k) {
  if (state.locked) return;
  state.locked = true;
  countdown.stop();
  const btns = [...document.querySelectorAll(".ans")];
  btns.forEach((b) => (b.disabled = true));
  const fb = $("feedback"), combo = $("combo"), game = $("screen-game");

  let r;
  try {
    r = await api("answer.php", {
      method: "POST",
      body: { question_id: state.list[state.i].id, answer: k }   // k = -1 si temps écoulé
    });
  } catch (e) {
    if (e.status && e.status >= 400 && e.status < 500) {          // session perdue, ordre invalide...
      alert("Partie invalide. Recommence une nouvelle partie.");
      show("home");
      return;
    }
    fb.textContent = "Erreur réseau, réessaie.";                  // simple coupure : on réessaie
    fb.className = "feedback bad";
    btns.forEach((b) => (b.disabled = false));
    state.locked = false;
    countdown.resume();
    return;
  }

  // Le serveur renvoie : correct, correct_index, points, mult, combo, score, lives, good, maxCombo, finished
  if (btns[r.correct_index]) btns[r.correct_index].classList.add("good");
  Object.assign(state, {
    score: r.score, lives: r.lives, combo: r.combo, good: r.good,
    maxCombo: r.maxCombo, finished: r.finished
  });

  if (r.correct) {
    fb.textContent = `+${r.points} PTS ! ` + ["NICE!", "GREAT!", "AWESOME!", "PERFECT!"][Math.min(3, r.combo - 1)];
    fb.classList.add("good");
    combo.textContent = r.combo > 1 ? `COMBO x${r.combo} · MULT x${r.mult}` : "";
    combo.classList.remove("pop"); void combo.offsetWidth; combo.classList.add("pop");
    game.classList.remove("flash-good"); void game.offsetWidth; game.classList.add("flash-good");
    sfx.good();
  } else {
    if (k >= 0 && btns[k]) btns[k].classList.add("bad");
    combo.textContent = "";
    fb.textContent = k < 0 ? "TIME UP ! -1 ♥" : "MISS ! -1 ♥";
    fb.classList.add("bad");
    game.classList.remove("screen-shake"); void game.offsetWidth; game.classList.add("screen-shake");
    sfx.bad();
  }
  $("hud-score").textContent = pad(state.score);
  setLives();
  setProgress(state.i + 1);

  const next = $("btn-next");
  next.textContent = state.finished ? (state.mode === "group" ? "SUIVANT ▶" : "RÉSULTATS ▶") : "NEXT ▶";
  next.hidden = false;
  next.focus();
}

function nextQ() {
  sfx.click();
  if (state.finished) return end();
  state.i++;
  loadQuestion();
}

async function end() {
  const total = state.list.length;
  const group = state.mode === "group";

  let res = { record: false, id: null };
  try {
    res = await api("finish.php", { method: "POST" });   // le serveur lit le score dans la SESSION
    state.score = res.score;                              // valeur officielle
    if (res.id) state.fresh.push(res.id);
    await loadBests();                                    // met à jour records + hi-score
  } catch (e) { /* on affiche quand même l'écran de fin */ }

  // Copie locale du score (localStorage)
  if (state.score > 0) {
    localScores.add({
      name: group ? state.players[state.p].name : state.name,
      cat: state.cat, score: state.score, date: Date.now()
    });
  }
  renderCats();

  if (group) {
    Object.assign(state.players[state.p], { score: state.score, good: state.good, maxCombo: state.maxCombo, lives: state.lives });
    state.p++;
    if (state.p < state.players.length) { sfx.click(); return prepareTurn(); }
    return showGroupEnd();
  }

  const ratio = state.good / total;
  const won = state.lives > 0;
  const rank = ratio === 1 ? "S" : ratio >= .75 ? "A" : ratio >= .5 ? "B" : ratio >= .25 ? "C" : "D";
  $("t-end").textContent = won ? "STAGE CLEAR !" : "GAME OVER";
  $("rank").textContent = rank;
  $("end-score").textContent = pad(state.score);
  $("end-good").textContent = `${state.good}/${total}`;
  $("end-combo").textContent = state.maxCombo;
  $("end-msg").textContent = {
    S: "Score parfait ! Tu es une légende de l'arcade.",
    A: "Excellent ! Encore un petit effort pour le rang S.",
    B: "Pas mal ! Rejoue pour monter de rang.",
    C: "Tu progresses, essaie encore !",
    D: "Ce n'est que le début, retente ta chance !"
  }[rank];
  $("new-record").hidden = !res.record || state.score === 0;
  won ? sfx.win() : sfx.over();
  show("end");
}

/* ---------- Fin de partie en groupe ---------- */
function showGroupEnd() {
  const total = state.list.length;
  const ranked = [...state.players].sort((a, b) => b.score - a.score || b.good - a.good);
  const top = ranked[0];
  const tie = ranked.length > 1 && ranked[1].score === top.score && ranked[1].good === top.good;
  $("t-group").textContent = tie ? "ÉGALITÉ !" : `${top.name} GAGNE !`;

  const list = $("group-rank");
  list.innerHTML = "";
  ranked.forEach((p, k) => {
    const li = document.createElement("li");
    li.className = "gr-item" + (k === 0 && !tie ? " first" : "");
    const cells = [
      ["gr-pos", ["🥇", "🥈", "🥉"][k] || `${k + 1}.`],
      ["gr-name", p.name],
      ["gr-good", `${p.good}/${total}`],
      ["gr-score", pad(p.score)]
    ];
    cells.forEach(([cls, text]) => {
      const s = document.createElement("span");
      s.className = cls; s.textContent = text;
      li.appendChild(s);
    });
    list.appendChild(li);
  });
  sfx.win();
  show("group");
}

/* ---------- Classement (depuis la base, secours : localStorage) ---------- */
function buildTabs() {
  const box = $("tabs");
  box.innerHTML = "";
  const items = [["all", "TOUS"], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.name])];
  items.forEach(([k, label]) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "tab"; b.dataset.k = k; b.textContent = label;
    b.addEventListener("click", () => { sfx.click(); state.filter = k; renderBoard(); });
    box.appendChild(b);
  });
}
function syncTabs() {
  document.querySelectorAll("#tabs .tab").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === state.filter)));
}

let boardReq = 0;                                     // ignore les réponses périmées
async function renderBoard() {
  syncTabs();
  const mine = ++boardReq;
  let list = [];
  try {
    list = await api(`scores.php?cat=${encodeURIComponent(state.filter)}&limit=${BOARD_SHOW}`);
  } catch (e) {
    // Serveur indisponible : on affiche les scores enregistrés dans ce navigateur
    list = localScores.all()
      .filter((s) => state.filter === "all" || s.cat === state.filter)
      .slice(0, BOARD_SHOW)
      .map((s, k) => ({ id: -k - 1, name: s.name, cat: s.cat, score: s.score, mode: "solo", date: s.date }));
  }
  if (mine !== boardReq) return;

  const body = $("board-body");
  body.innerHTML = "";
  document.querySelector(".table-wrap").hidden = list.length === 0;
  $("board-empty").hidden = list.length > 0;

  list.forEach((e, k) => {
    const tr = document.createElement("tr");
    if (state.fresh.includes(e.id)) tr.className = "me";
    const cat = CATEGORIES[e.cat];

    const rank = document.createElement("td");
    rank.className = "rk"; rank.textContent = ["🥇", "🥈", "🥉"][k] || String(k + 1);

    const name = document.createElement("td");
    name.textContent = String(e.name || "?") + (e.mode === "group" ? " 👥" : "");

    const stage = document.createElement("td");
    stage.className = "stage"; stage.textContent = cat ? cat.name : String(e.cat);
    if (cat) stage.style.color = cat.color;

    const score = document.createElement("td");
    score.className = "num"; score.textContent = pad(e.score);

    const date = document.createElement("td");
    date.className = "col-date";
    date.textContent = new Date(e.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });

    tr.append(rank, name, stage, score, date);
    body.appendChild(tr);
  });
}

/* ---------- Événements ---------- */
$("btn-play").addEventListener("click", () => {
  sfx.click();
  const raw = $("player-name").value;
  store.set("arcade-name", raw.trim());
  state.name = cleanName(raw, "JOUEUR");
  state.mode = "solo";
  showCats();
});
$("btn-group").addEventListener("click", () => {
  sfx.click();
  state.mode = "group";
  const names = state.players.length >= MIN_PLAYERS ? state.players.map((p) => p.name) : ["", ""];
  renderPlayers(names);
  show("players");
});
$("btn-add-player").addEventListener("click", () => { sfx.click(); addPlayer(); });
$("btn-players-ok").addEventListener("click", () => { sfx.click(); confirmPlayers(); });
$("cat-back").addEventListener("click", () => { sfx.click(); show(state.mode === "group" ? "players" : "home"); });
$("btn-go").addEventListener("click", () => { sfx.click(); begin(); });
$("btn-next").addEventListener("click", nextQ);
$("btn-retry").addEventListener("click", () => start(state.cat));
$("btn-group-again").addEventListener("click", () => { sfx.click(); showCats(); });
document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => {
  sfx.click();
  const target = b.dataset.go;
  if (target === "cat") return showCats();
  show(target);
}));
$("sound").addEventListener("click", (e) => {
  state.sound = !state.sound;
  e.currentTarget.textContent = state.sound ? "♪ ON" : "♪ OFF";
  e.currentTarget.setAttribute("aria-pressed", state.sound);
  e.currentTarget.setAttribute("aria-label", state.sound ? "Couper le son" : "Activer le son");
});
document.addEventListener("keydown", (e) => {
  if (!$("screen-game").classList.contains("active") || state.locked) return;
  const k = "ABCD".indexOf(e.key.toUpperCase());
  if (e.key.length === 1 && k >= 0) answer(k);
});

/* ---------- Init ---------- */
$("player-name").value = store.get("arcade-name", "");
Promise.all([loadCategories(), loadBests()]).then(() => {
  buildTabs();
  renderCats();
});