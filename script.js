"use strict";

const CATEGORIES = {
  culture: {
    name: "CULTURE", icon: "🌍", color: "var(--cyan)",
    q: [
      ["Quel est le plus grand pays d'Afrique par sa superficie ?", ["Algérie", "RD Congo", "Soudan", "Libye"], 0],
      ["Quel peintre a réalisé « La Nuit étoilée » ?", ["Claude Monet", "Vincent van Gogh", "Paul Cézanne", "Edvard Munch"], 1],
      ["Quel est le plus grand océan du monde ?", ["Atlantique", "Indien", "Pacifique", "Arctique"], 2],
      ["Quelle ville tunisienne abrite une grande mosquée fondée en 670 ?", ["Sousse", "Monastir", "Bizerte", "Kairouan"], 3],
      ["Qui a écrit « Le Petit Prince » ?", ["Jules Verne", "Antoine de Saint-Exupéry", "Albert Camus", "Alexandre Dumas"], 1],
      ["Quel pays est surnommé le « pays du Soleil-Levant » ?", ["Chine", "Corée du Sud", "Japon", "Thaïlande"], 2],
      ["Quel est le plus petit pays du monde ?", ["Monaco", "Saint-Marin", "Vatican", "Liechtenstein"], 2],
      ["Combien de touches compte un piano standard ?", ["76", "88", "92", "100"], 1]
    ]
  },
  info: {
    name: "WEB / INFO", icon: "💻", color: "var(--lime)",
    q: [
      ["Que signifie CSS ?", ["Cascading Style Sheets", "Computer Style System", "Creative Style Syntax", "Colored Style Sheets"], 0],
      ["Quel langage permet de rendre une page web interactive dans le navigateur ?", ["Python", "C++", "SQL", "JavaScript"], 3],
      ["Quelle balise HTML crée un lien hypertexte ?", ["<link>", "<img>", "<a>", "<href>"], 2],
      ["Que signifie « www » dans une adresse web ?", ["World Wide Web", "Web Wide World", "World Web Wire", "Wide World Web"], 0],
      ["Quel symbole débute un sélecteur d'identifiant en CSS ?", [".", "#", "@", "&"], 1],
      ["Quelle méthode JS ajoute un élément à la fin d'un tableau ?", ["pop()", "shift()", "push()", "slice()"], 2],
      ["Que signifie « HTTP » ?", ["High Transfer Text Protocol", "HyperText Transmission Process", "Host Transfer Text Protocol", "HyperText Transfer Protocol"], 3],
      ["Quelle commande Git enregistre les changements dans l'historique ?", ["git push", "git clone", "git pull", "git commit"], 3]
    ]
  },
  science: {
    name: "SCIENCES", icon: "🧪", color: "var(--pink)",
    q: [
      ["Quelle planète est surnommée la planète rouge ?", ["Mars", "Jupiter", "Vénus", "Saturne"], 0],
      ["Quel élément chimique a pour symbole O ?", ["Or", "Osmium", "Oxygène", "Oganesson"], 2],
      ["Combien de planètes compte le système solaire ?", ["7", "8", "9", "10"], 1],
      ["Quelle est la formule chimique de l'eau ?", ["CO₂", "H₂O", "O₂", "NaCl"], 1],
      ["Quel est le plus grand organe du corps humain ?", ["Le foie", "Le cerveau", "La peau", "L'intestin"], 2],
      ["Quel scientifique a découvert la pénicilline ?", ["Louis Pasteur", "Alexander Fleming", "Marie Curie", "Isaac Newton"], 1],
      ["Quel est l'animal terrestre le plus rapide ?", ["Le guépard", "Le lion", "Le cheval", "L'antilope"], 0],
      ["Comment s'appelle la galaxie qui contient notre système solaire ?", ["Andromède", "Triangulum", "Magellan", "La Voie lactée"], 3]
    ]
  },
  sport: {
    name: "SPORT", icon: "⚽", color: "var(--yellow)",
    q: [
      ["Combien de sets faut-il gagner pour remporter un match masculin de Grand Chelem ?", ["2", "3", "4", "5"], 1],
      ["Quel pays a organisé la Coupe du monde de football 2018 ?", ["Brésil", "Allemagne", "Russie", "Qatar"], 2],
      ["Dans quel sport utilise-t-on un volant ?", ["Squash", "Tennis", "Ping-pong", "Badminton"], 3],
      ["Combien de joueurs par équipe sur le terrain au volley-ball ?", ["5", "7", "6", "8"], 2],
      ["Quel athlète jamaïcain détient le record du monde du 100 m ?", ["Yohan Blake", "Asafa Powell", "Usain Bolt", "Justin Gatlin"], 2],
      ["Dans quelle ville se trouve le stade Camp Nou ?", ["Madrid", "Séville", "Barcelone", "Valence"], 2],
      ["En quelle année la Tunisie a-t-elle remporté la CAN de football ?", ["1998", "2012", "2019", "2004"], 3],
      ["Quel sport se pratique lors du Tour de France ?", ["Cyclisme", "Course à pied", "Natation", "Aviron"], 0]
    ]
  }
};

const TIME = 15;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const BOARD_KEEP = 100;   
const BOARD_SHOW = 20;   

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(4, "0");
const cleanName = (v, fallback) => (v || "").trim().replace(/\s+/g, " ").slice(0, 12) || fallback;

const state = {
  cat: null, list: [], i: 0, score: 0, good: 0, combo: 0, maxCombo: 0, lives: 3,
  t: TIME, timer: null, locked: false, sound: true,
  mode: "solo",      
  name: "JOUEUR",   
  players: [],      
  p: 0,              
  filter: "all",     
  fresh: []         
};


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

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignoré */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignoré */ } }
};
const best = (key) => Number(store.get("arcade-" + key, 0));
const setBest = (key, v) => store.set("arcade-" + key, v);
function refreshHi() { $("hiscore").textContent = pad(best("hi")); }

function loadBoard() {
  try {
    const d = JSON.parse(store.get("arcade-board", "[]"));
    return Array.isArray(d) ? d : [];
  } catch (e) { return []; }
}
function addScore(entry) {
  const list = loadBoard();
  list.push(entry);
  list.sort((a, b) => b.score - a.score || b.date - a.date);
  store.set("arcade-board", JSON.stringify(list.slice(0, BOARD_KEEP)));
}

function show(name) {
  if (name !== "game") clearInterval(state.timer);
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
    b.innerHTML = `<span class="cat-icon" aria-hidden="true">${c.icon}</span><span class="cat-name">${c.name}</span><span class="cat-best">Record : ${pad(best(key))}</span>`;
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
function shuffle(a) { return a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]); }

function start(key) {
  state.cat = key;
  state.list = shuffle(CATEGORIES[key].q);   // même ordre pour tous les joueurs d'un groupe
  state.fresh = [];
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

function begin() {
  Object.assign(state, { i: 0, score: 0, good: 0, combo: 0, maxCombo: 0, lives: 3 });
  const group = state.mode === "group";
  $("hud-cat").textContent = CATEGORIES[state.cat].name;
  $("hud-player-wrap").hidden = !group;
  if (group) $("hud-player").textContent = state.players[state.p].name;
  $("combo").textContent = "";
  show("game");
  loadQuestion();
}

function loadQuestion() {
  const [text, answers] = state.list[state.i];
  state.locked = false;
  $("question").textContent = text;
  $("feedback").textContent = ""; $("feedback").className = "feedback";
  $("btn-next").hidden = true;
  $("hud-q").textContent = `${state.i + 1}/${state.list.length}`;
  $("hud-score").textContent = pad(state.score);
  $("hud-lives").textContent = "♥".repeat(state.lives) + "♡".repeat(3 - state.lives);
  const box = $("answers");
  box.innerHTML = "";
  answers.forEach((a, k) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ans";
    b.innerHTML = `<span class="letter">${"ABCD"[k]}</span><span></span>`;
    b.lastChild.textContent = a;
    b.addEventListener("click", () => answer(k));
    box.appendChild(b);
  });
  startTimer();
}

function startTimer() {
  clearInterval(state.timer);
  state.t = TIME;
  updateTimer();
  state.timer = setInterval(() => {
    state.t--;
    updateTimer();
    if (state.t <= 3 && state.t > 0) beep(880, .04);
    if (state.t <= 0) answer(-1);
  }, 1000);
}
function updateTimer() {
  const bar = $("timer-bar");
  bar.style.width = (state.t / TIME) * 100 + "%";
  bar.classList.toggle("low", state.t <= 5);
  bar.parentElement.setAttribute("aria-valuenow", state.t);
}

function answer(k) {
  if (state.locked) return;
  state.locked = true;
  clearInterval(state.timer);
  const correct = state.list[state.i][2];
  const btns = [...document.querySelectorAll(".ans")];
  btns.forEach((b) => (b.disabled = true));
  btns[correct].classList.add("good");
  const fb = $("feedback"), combo = $("combo"), game = $("screen-game");

  if (k === correct) {
    state.combo++; state.good++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    const mult = Math.min(3, 1 + Math.floor((state.combo - 1) / 2));
    const pts = (100 + state.t * 10) * mult;
    state.score += pts;
    fb.textContent = `+${pts} PTS ! ` + ["NICE!", "GREAT!", "AWESOME!", "PERFECT!"][Math.min(3, state.combo - 1)];
    fb.classList.add("good");
    combo.textContent = state.combo > 1 ? `COMBO x${state.combo} · MULT x${mult}` : "";
    combo.classList.remove("pop"); void combo.offsetWidth; combo.classList.add("pop");
    game.classList.remove("flash-good"); void game.offsetWidth; game.classList.add("flash-good");
    sfx.good();
  } else {
    if (k >= 0) btns[k].classList.add("bad");
    state.combo = 0; state.lives--;
    combo.textContent = "";
    fb.textContent = k < 0 ? "TIME UP ! -1 ♥" : "MISS ! -1 ♥";
    fb.classList.add("bad");
    game.classList.remove("screen-shake"); void game.offsetWidth; game.classList.add("screen-shake");
    sfx.bad();
  }
  $("hud-score").textContent = pad(state.score);
  $("hud-lives").textContent = "♥".repeat(state.lives) + "♡".repeat(3 - state.lives);

  const last = state.i === state.list.length - 1 || state.lives <= 0;
  const next = $("btn-next");
  next.textContent = last ? (state.mode === "group" ? "SUIVANT ▶" : "RÉSULTATS ▶") : "NEXT ▶";
  next.hidden = false;
  next.focus();
}

function nextQ() {
  sfx.click();
  if (state.lives <= 0 || state.i === state.list.length - 1) return end();
  state.i++;
  loadQuestion();
}

function end() {
  const total = state.list.length;
  const group = state.mode === "group";
  const who = group ? state.players[state.p].name : state.name;

  // Records + classement (communs au solo et au groupe)
  const rec = state.score > best(state.cat);
  if (rec) setBest(state.cat, state.score);
  if (state.score > best("hi")) setBest("hi", state.score);
  if (state.score > 0) {
    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    state.fresh.push(id);
    addScore({ id, name: who, cat: state.cat, score: state.score, good: state.good, total, mode: state.mode, date: Date.now() });
  }
  refreshHi(); renderCats();

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
  $("new-record").hidden = !rec || state.score === 0;
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

/* ---------- Classement ---------- */
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

function renderBoard() {
  syncTabs();
  const all = loadBoard();
  const list = all.filter((e) => state.filter === "all" || e.cat === state.filter).slice(0, BOARD_SHOW);
  const body = $("board-body");
  body.innerHTML = "";

  document.querySelector(".table-wrap").hidden = list.length === 0;
  $("board-empty").hidden = list.length > 0;
  $("btn-clear").hidden = all.length === 0;

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

function clearBoard() {
  if (!confirm("Effacer le classement et tous les records ?")) return;
  store.del("arcade-board");
  ["hi", ...Object.keys(CATEGORIES)].forEach((k) => store.del("arcade-" + k));
  state.fresh = [];
  refreshHi(); renderCats(); renderBoard();
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
$("btn-clear").addEventListener("click", clearBoard);
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
buildTabs();
refreshHi();
renderCats();