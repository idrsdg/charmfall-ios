/* Mountlayer Arcade shared helpers: master volume (same setting in every game) + Share on X.
   Load in <head> BEFORE the game script so every AudioContext the game creates is routed through the master gain. */
(function () {
  "use strict";
  var KEY = "arcade_vol", MAX = 10, DEF = 8;
  var level = DEF;
  try { var s = localStorage.getItem(KEY); if (s !== null && !isNaN(+s)) level = Math.max(0, Math.min(MAX, Math.round(+s))); } catch (e) {}
  var gainFor = function (l) { return l <= 0 ? 0 : Math.pow(l / DEF, 1.5); };   // 8 = the game's original loudness
  var masters = [];

  // ---- route every AudioContext through one master gain
  var Base = window.AudioContext || window.webkitAudioContext;
  if (Base) {
    var proto = window.BaseAudioContext ? window.BaseAudioContext.prototype : Base.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, "destination") || Object.getOwnPropertyDescriptor(Base.prototype, "destination");
    var realDest = function (ctx) { return desc && desc.get ? desc.get.call(ctx) : null; };
    try {
      var Patched = class extends Base {
        constructor(o) {
          super(o);
          try { var d = realDest(this); if (d) { var g = Base.prototype.createGain.call(this); g.gain.value = gainFor(level); g.connect(d); this.__arcadeMaster = g; masters.push(g); } } catch (e) {}
        }
        get destination() { return this.__arcadeMaster || realDest(this); }
      };
      var shared = null, getShared = function () { if (!shared) { try { shared = new Patched(); } catch (e) { shared = null; } } return shared; };
      var Shim = function () { return getShared() || new Patched(); }; Shim.prototype = Patched.prototype;
      window.AudioContext = Shim; if (window.webkitAudioContext) window.webkitAudioContext = Shim;
      var warm = function () { getShared(); }; if (window.requestIdleCallback) requestIdleCallback(warm, { timeout: 1200 }); else setTimeout(warm, 400);
      var wake = function () { var c = getShared(); if (c && c.state === "suspended") { try { c.resume(); } catch (e) {} } };
      ["pointerdown", "touchend", "keydown", "click"].forEach(function (t) { addEventListener(t, wake, true); });
    } catch (e) {}
  }

  // ---- volume state
  var widgets = [], blipCtx = null;
  function apply() {
    var g = gainFor(level);
    masters.forEach(function (m) { try { m.gain.setTargetAtTime(g, m.context.currentTime, 0.02); } catch (e) { try { m.gain.value = g; } catch (e2) {} } });
    try { localStorage.setItem(KEY, String(level)); } catch (e) {}
    widgets.forEach(paint);
  }
  function blip() {
    try {
      blipCtx = blipCtx || new (window.AudioContext || window.webkitAudioContext)(); if (blipCtx.state === "suspended") blipCtx.resume();
      var o = blipCtx.createOscillator(), v = blipCtx.createGain(), t = blipCtx.currentTime; o.type = "triangle"; o.frequency.value = 520 + level * 40;
      v.gain.setValueAtTime(0.14, t); v.gain.exponentialRampToValueAtTime(0.0005, t + 0.12); o.connect(v).connect(blipCtx.destination); o.start(t); o.stop(t + 0.13);
    } catch (e) {}
  }
  function set(l, quiet) { l = Math.max(0, Math.min(MAX, Math.round(l))); if (l === level) { widgets.forEach(paint); return level; } level = l; apply(); if (!quiet) blip(); return level; }

  // ---- widget
  var css = ".avol{display:inline-flex;align-items:center;gap:8px;padding:7px 10px;border-radius:999px;background:#120a38;border:2px solid #fff;box-shadow:0 4px 0 #05031a;font:900 13px/1 ui-rounded,system-ui,-apple-system,'Segoe UI',sans-serif;color:#fff;user-select:none;-webkit-user-select:none;touch-action:manipulation;vertical-align:middle}" +
    ".avol-wrap{display:flex;justify-content:center;margin:10px 0 4px}" +
    ".avol b{font-size:11px;letter-spacing:.08em;color:#ffd200;margin:0 2px 0 4px}" +
    ".avol button{all:unset;box-sizing:border-box;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font:900 22px/1 ui-rounded,system-ui,sans-serif;color:#fff;cursor:pointer;border:2px solid #fff;transition:transform .08s}" +
    ".avol button:active{transform:translateY(2px)}.avol .dn{background:#ff2d55;box-shadow:0 3px 0 #8a0a2a}.avol .up{background:#22c55e;box-shadow:0 3px 0 #0a6a2e}" +
    ".avol .bar{display:flex;gap:3px;align-items:flex-end;height:26px;cursor:pointer;padding:0 2px}.avol .bar i{display:block;width:8px;border-radius:2px;background:#3a2a8a;transition:background .12s,transform .12s}" +
    ".avol .bar i.on{background:#ffd200}.avol .bar i.on.hi{background:#ff8a00}.avol .num{min-width:20px;text-align:center;font-size:15px}" +
    "#avolFloat{position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translate(-50%,24px);opacity:0;pointer-events:none;z-index:2147483000;transition:opacity .18s,transform .22s cubic-bezier(.2,1.4,.4,1)}" +
    "#avolFloat.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}" +
    "#avolPop{position:fixed;left:0;top:0;z-index:2147483050;opacity:0;pointer-events:none;transition:opacity .15s}#avolPop.on{opacity:1;pointer-events:auto}" +
    "[data-arcade-share]{cursor:pointer}" +
    "[data-arcade-roast]{text-align:center;align-self:stretch}[data-arcade-roast]:empty{display:none}" +
    ".aroast{display:inline-block;max-width:94%;margin:10px auto 12px;padding:8px 14px;border-radius:10px;background:#ffd200;color:#120a38;border:2px solid #120a38;box-shadow:0 4px 0 #05031a;font:900 15px/1.25 ui-rounded,system-ui,-apple-system,'Segoe UI',sans-serif;transform:rotate(-1.5deg)}";
  function paint(w) {
    var segs = w.querySelectorAll(".bar i"); for (var i = 0; i < segs.length; i++) { segs[i].className = (i < level ? "on" : "") + (i < level && i >= 8 ? " hi" : ""); }
    var n = w.querySelector(".num"); if (n) n.textContent = level === 0 ? "🔇" : String(level);
  }
  function build() {
    var w = document.createElement("div"); w.className = "avol"; w.setAttribute("role", "group"); w.setAttribute("aria-label", "Volume");
    var bar = ""; for (var i = 0; i < MAX; i++) bar += '<i style="height:' + (8 + i * 2) + 'px" data-l="' + (i + 1) + '"></i>';
    w.innerHTML = '<b>VOL</b><button type="button" class="dn" aria-label="Volume down">−</button><div class="bar">' + bar + '</div><button type="button" class="up" aria-label="Volume up">+</button><span class="num"></span>';
    var stop = function (e) { e.stopPropagation(); };
    ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend", "click"].forEach(function (t) { w.addEventListener(t, stop); });
    w.querySelector(".dn").addEventListener("click", function () { set(level - 1); });
    w.querySelector(".up").addEventListener("click", function () { set(level + 1); });
    w.querySelector(".bar").addEventListener("click", function (e) { var l = e.target && e.target.getAttribute && e.target.getAttribute("data-l"); if (l) set(+l); });
    widgets.push(w); paint(w); return w;
  }
  var floatEl = null, floatFn = null, toastUntil = 0;
  function ensureFloat() { if (!floatEl) { floatEl = document.createElement("div"); floatEl.id = "avolFloat"; floatEl.appendChild(build()); document.body.appendChild(floatEl); } return floatEl; }
  function inlineVisible() { for (var i = 0; i < widgets.length; i++) { var w = widgets[i]; if (floatEl && floatEl.contains(w)) continue; if (w.offsetParent !== null) return true; } return false; }
  function tick() {
    var want = false; try { want = !!(floatFn && floatFn()); } catch (e) {}
    if (Date.now() < toastUntil && !inlineVisible()) want = true;
    if (want || floatEl) ensureFloat().classList.toggle("on", want);
  }
  // ---- sound icons: a click toggles mute (handled by each game); hovering the icon, or just having clicked it, opens the volume bar next to it
  var pop = null, popT = 0, SND = ".snd, .sndBtn, #bSound, [data-snd], [data-arcade-sound]";
  function hidePop(ms) { clearTimeout(popT); popT = setTimeout(function () { if (pop) pop.classList.remove("on"); }, ms || 0); }
  function showPop(rect, hold) {
    if (!pop) { pop = document.createElement("div"); pop.id = "avolPop"; pop.appendChild(build()); document.body.appendChild(pop);
      pop.addEventListener("mouseenter", function () { clearTimeout(popT); }); pop.addEventListener("mouseleave", function () { hidePop(500); });
      pop.addEventListener("click", function () { clearTimeout(popT); if (matchMedia("(hover: none)").matches) hidePop(2600); }); }
    var pw = pop.offsetWidth || 292, ph = pop.offsetHeight || 54, x = Math.max(6, Math.min(innerWidth - pw - 6, rect.left + rect.width / 2 - pw / 2)), y = rect.bottom + 8; if (y + ph > innerHeight - 6) y = rect.top - ph - 8;
    pop.style.left = Math.round(x) + "px"; pop.style.top = Math.round(Math.max(6, y)) + "px"; pop.classList.add("on"); clearTimeout(popT); if (hold) hidePop(hold);
  }
  function sndEl(t) { var el = t && t.closest ? t.closest(SND) : null; if (!el || (pop && pop.contains(el))) return null; for (var i = 0; i < widgets.length; i++) { var w = widgets[i]; if (!(pop && pop.contains(w)) && !(floatEl && floatEl.contains(w)) && w.offsetParent !== null) return null; } return el; }   // skip when an inline volume bar is already on screen
  function initPop() {
    document.addEventListener("mouseover", function (e) { var el = sndEl(e.target); if (el) showPop(el.getBoundingClientRect()); });
    document.addEventListener("mouseout", function (e) { if (pop && e.target && e.target.closest && e.target.closest(SND)) hidePop(600); });
    document.addEventListener("click", function (e) { var el = sndEl(e.target); if (el) showPop(el.getBoundingClientRect(), 2600); }, true);
    // canvas-drawn icons report their rectangle through window.__arcadeSoundRect()
    var over = false;
    addEventListener("pointermove", function (e) { if (typeof window.__arcadeSoundRect !== "function" || e.pointerType === "touch") return; var r = null; try { r = window.__arcadeSoundRect(); } catch (x) {}
      var inside = !!r && e.clientX >= r.left && e.clientX <= r.left + r.width && e.clientY >= r.top && e.clientY <= r.top + r.height;
      if (inside) { over = true; showPop(r); } else if (over) { over = false; hidePop(600); } });
    addEventListener("pointerup", function (e) { if (typeof window.__arcadeSoundRect !== "function") return; var r = null; try { r = window.__arcadeSoundRect(); } catch (x) {}
      if (r && e.clientX >= r.left && e.clientX <= r.left + r.width && e.clientY >= r.top && e.clientY <= r.top + r.height) showPop(r, 2600); });
  }
  function init() {
    initPop();
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    var mounts = document.querySelectorAll("[data-arcade-vol]"); for (var i = 0; i < mounts.length; i++) { mounts[i].classList.add("avol-wrap"); mounts[i].appendChild(build()); }
    if (typeof window.__arcadePaused === "function") floatFn = window.__arcadePaused;
    setInterval(tick, 150);
    setInterval(paintRoast, 200);
    document.addEventListener("click", function (e) {
      var el = e.target && e.target.closest ? e.target.closest("[data-arcade-share]") : null; if (!el) return; e.preventDefault();
      var txt = ""; try { txt = typeof window.__shareText === "function" ? window.__shareText() : ""; } catch (x) {}
      share(txt);
    });
    addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return; var t = e.target && e.target.tagName; if (t === "INPUT" || t === "TEXTAREA") return;
      if (e.key === "-" || e.key === "_") { set(level - 1); toastUntil = Date.now() + 1400; tick(); }
      else if (e.key === "=" || e.key === "+") { set(level + 1); toastUntil = Date.now() + 1400; tick(); }
    });
  }
  // ---- end-of-game verdict: one cheeky line picked from the result. Shown in [data-arcade-roast] and added to the share text.
  // A game opts in with window.__roastTier = () => 0 (bad) | 1 (okay) | 2 (great) | null (no verdict).
  var ROASTS = {
    prism: [
      ["The gems felt nothing. Not even a scratch.", "Out of moves, out of excuses.", "Matching three is the whole job.", "The board is filing a complaint.", "A coin flip would have played that better."],
      ["Passed. Barely. The gems are unimpressed.", "Not three stars. We both noticed.", "Fine. Not good. Fine.", "You won the way a draw wins."],
      ["Three stars. Go outside.", "Okay, that was actually good. Annoying.", "Flawless. Do you have a job?"]
    ],
    football: [
      ["The keeper sends his thanks.", "Your defence was a suggestion.", "Even the corner flag played better.", "Have you considered chess?", "The ball spent the match in your net."],
      ["A draw. Nobody lost. Nobody cared.", "Sharing the points like it's charity.", "The most forgettable match ever played."],
      ["You won. Screenshot it, it may not happen again.", "Fine, you can play. Don't get loud about it.", "A win. The other team wants a word with the ref."]
    ],
    race: [
      ["The pace car lapped you.", "You drove like the rental was due back.", "Scenic route, was it?", "The back of the grid has a lovely view.", "Fun fact: the right pedal makes it go."],
      ["Podium. The small step.", "Close enough to smell the winner's exhaust.", "Almost fast."],
      ["First place. The rivals want a recount.", "Fast. Suspiciously fast.", "You won. Now try it without the walls helping."]
    ],
    words: [
      ["The dictionary is embarrassed for you.", "Words. They're made of letters. Try some.", "Spelling: still undefeated against you.", "Alphabet soup has a bigger vocabulary.", "Three lives, all spent on guessing."],
      ["Decent. A crossword would still beat you.", "You know some words. Not the good ones.", "Mid-table vocabulary."],
      ["Okay, nerd.", "Somebody reads. Show-off.", "Great run. The dictionary wants its words back."]
    ],
    breakout: [
      ["The bricks barely noticed you.", "The paddle moves, you know.", "One job: don't miss the ball.", "The wall wins. The wall always wins.", "Gravity 1, you 0."],
      ["Cleared. The bricks were going easy.", "Not bad. The ball did most of the work."],
      ["Every brick gone. Seek sunlight.", "All cleared. The bricks have unionised."]
    ]
  };
  function roast() {
    var m = location.pathname.match(/\/(prism|football|race|words|breakout)\//), pools = m && ROASTS[m[1]]; if (!pools || typeof window.__roastTier !== "function") return "";
    var t = null, key = ""; try { t = window.__roastTier(); key = typeof window.__shareText === "function" ? String(window.__shareText()) : ""; } catch (e) { return ""; }
    if (t === null || t === undefined || !pools[t]) return "";
    var h = 0; for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;   // same result, same line; next result, maybe another
    return pools[t][h % pools[t].length];
  }
  function paintRoast() {
    var els = document.querySelectorAll("[data-arcade-roast]"); if (!els.length) return;
    for (var i = 0; i < els.length; i++) { var el = els[i], shown = el.parentElement && el.parentElement.getClientRects().length > 0, line = shown ? roast() : el.__line || ""; if (line === el.__line) continue; el.__line = line;
      el.textContent = ""; if (line) { var b = document.createElement("span"); b.className = "aroast"; b.textContent = line; el.appendChild(b); } }
  }
  function pageUrl() { return "https://launch.mountlayer.com" + location.pathname.replace(/index\.html$/, ""); }
  function share(text) {
    text = (text || document.title + " on Mountlayer Arcade").replace(/\s+/g, " ").trim(); if (text.length > 220) text = text.slice(0, 217) + "...";
    var verdict = roast(); if (verdict && text.length + verdict.length <= 236) text += ' The game says: "' + verdict + '"';
    var u = "https://x.com/intent/post?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(pageUrl());
    var w = null; try { w = window.open(u, "_blank", "noopener"); } catch (e) {} if (!w) { try { location.href = u; } catch (e) {} }
  }
  window.Arcade = { get volume() { return level; }, setVolume: set, up: function () { return set(level + 1); }, down: function () { return set(level - 1); }, max: MAX, share: share, roast: roast, shareUrl: pageUrl,
    floatWhen: function (fn) { floatFn = fn; }, widget: build, _masters: masters };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* ---------------------------------------------------------------------------------------------------------------
   Rooms: play the same round with friends. A room is a short code; the link is <game>/?room=CODE.
   Players sign in with email + password (accounts live in the Worker); the session token stays in this browser. The host starts the round for everyone at once,
   every player sees a live scoreboard. Games plug in through window.__arcade = { start(seed,cfg), score(), status(), done(), config() }.
   Games with real-time play can also use Arcade.rooms.send(msg) / Arcade.rooms.on(type, fn). */
(function () {
  "use strict";
  var A = window.Arcade; if (!A) return;
  var H = location.hostname, LOCAL = /^(localhost$|127\.0\.0\.1$|192\.168\.|10\.)/.test(H);
  var WSBASE = LOCAL ? "ws://" + H + ":8787/rooms/" : "wss://launch.mountlayer.com/rooms/";
  var ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; };
  var AU = null; try { AU = JSON.parse(ls("arcade_auth") || "null"); } catch (e) {} if (AU && !(AU.token && AU.uid)) AU = null;
  var uid = AU ? AU.uid : "", authMode = "login", busy = false, resetTok = "", MAILON = null;
  var API = LOCAL && location.port !== "8787" ? "http://" + H + ":8787" : "";
  function setAuth(o) { AU = o ? { token: o.token || (AU && AU.token), email: o.email, name: o.name, uid: o.uid, verified: !!o.verified, mail: !!o.mail, require: !!o.require } : null; uid = AU ? AU.uid : ""; R.name = AU ? AU.name : ""; try { if (AU) localStorage.setItem("arcade_auth", JSON.stringify(AU)); else localStorage.removeItem("arcade_auth"); } catch (e) {} }
  function api(path, body, cb) { var x = { method: body ? "POST" : "GET", headers: { "content-type": "application/json" } }; if (AU && AU.token) x.headers.authorization = "Bearer " + AU.token; if (body) x.body = JSON.stringify(body);
    fetch(API + "/api/auth/" + path, x).then(function (r) { return r.json().catch(function () { return { ok: false, error: "Server error." }; }); }).then(cb, function () { cb({ ok: false, error: "Could not reach the server." }); }); }
  var R = { code: null, ws: null, players: [], host: null, scores: {}, round: null, name: "", status: "", tries: 0, handlers: {}, wantOpen: false };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var game = function () { return window.__arcade || null; };
  var isHost = function () { return R.host === uid; };
  var link = function () { return location.origin + location.pathname.replace(/index\.html$/, "") + "?room=" + R.code; };
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  A.seeded = function (seed, fn) { var r = Math.random; Math.random = mulberry(seed >>> 0); try { return fn(); } finally { Math.random = r; } };
  A.rng = mulberry;

  var css = "#arLobby{position:fixed;inset:0;z-index:2147483200;display:none;place-items:center;background:rgba(4,3,18,.82);padding:14px;font:700 15px/1.35 ui-rounded,system-ui,-apple-system,'Segoe UI',sans-serif;color:#fff}#arLobby.on{display:grid}" +
    "#arLobby .c{width:min(380px,100%);max-height:calc(100dvh - 28px);overflow:auto;background:#1c1460;border:3px solid #fff;border-radius:22px;padding:18px 18px 16px;box-shadow:0 10px 0 #0a0630;text-align:center}" +
    "#arLobby h2{margin:0 0 4px;font-size:24px;font-weight:900;letter-spacing:-.02em}#arLobby p{margin:0 0 10px;font-size:13px;color:#cfd6ff}" +
    "#arLobby label{display:block;text-align:left;font-size:11px;font-weight:900;letter-spacing:.08em;color:#ffd200;margin:8px 2px 4px;text-transform:uppercase}" +
    "#arLobby input{box-sizing:border-box;width:100%;font:800 17px ui-rounded,system-ui,sans-serif;color:#fff;background:#0d0838;border:2px solid #7a6cff;border-radius:12px;padding:10px 12px;outline:none;text-align:center}#arLobby input:focus{border-color:#ffd200}" +
    "#arLobby .b{all:unset;box-sizing:border-box;display:inline-block;cursor:pointer;font:900 15px ui-rounded,system-ui,sans-serif;padding:11px 16px;border-radius:999px;border:2px solid #fff;margin:6px 3px 0;color:#1b1030;background:#ffc21a;box-shadow:0 4px 0 #9a5b00;transition:transform .08s}#arLobby .b:active{transform:translateY(2px)}" +
    "#arLobby .b.g{background:#22c55e;box-shadow:0 4px 0 #0a6a2e;color:#04220f}#arLobby .b.v{background:#6a52e8;box-shadow:0 4px 0 #2a1a7a;color:#fff}#arLobby .b.r{background:#ff2d55;box-shadow:0 4px 0 #8a0a2a;color:#fff}#arLobby .b[disabled]{opacity:.5;cursor:default}" +
    "#arLobby .code{font-size:36px;font-weight:900;letter-spacing:.18em;color:#19e0f0;margin:2px 0 6px}#arLobby .row{display:flex;gap:6px;align-items:center}#arLobby .row input{font-size:12px;text-align:left}" +
    "#arLobby ul{list-style:none;margin:8px 0 2px;padding:0;text-align:left}#arLobby li{display:flex;justify-content:space-between;gap:8px;background:#0d0838;border:2px solid #3a2a9e;border-radius:12px;padding:8px 12px;margin:5px 0;font-weight:800}#arLobby li.me{border-color:#ffd200}#arLobby li small{color:#9fe8ff;font-weight:800}" +
    "#arLobby .st{min-height:18px;font-size:13px;color:#ffd200;margin-top:8px}" +
    "#arBoard{position:fixed;left:6px;top:34%;z-index:2147483100;display:none;min-width:112px;max-width:150px;background:#120a38;border:2px solid #fff;border-radius:12px;box-shadow:0 3px 0 #05031a;font:800 11px/1.25 ui-rounded,system-ui,sans-serif;color:#fff;pointer-events:none;overflow:hidden}#arBoard.on{display:block}" +
    "#arBoard .h{pointer-events:auto;cursor:pointer;background:#6a52e8;padding:4px 8px;font-weight:900;letter-spacing:.06em}#arBoard .r{display:flex;justify-content:space-between;gap:6px;padding:3px 8px;border-top:1px solid #2a1f6e}#arBoard .r.me{color:#ffd200}#arBoard .r span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#arBoard .r i{font-style:normal;color:#22e65a}" +
    "[data-arcade-room]{cursor:pointer}";

  var lobby = null, board = null;
  function ensureUI() {
    if (lobby) return; var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    lobby = document.createElement("div"); lobby.id = "arLobby"; lobby.innerHTML = '<div class="c"></div>'; document.body.appendChild(lobby);
    board = document.createElement("div"); board.id = "arBoard"; document.body.appendChild(board);
    ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend", "keydown", "keyup", "keypress"].forEach(function (t) { lobby.addEventListener(t, function (e) { e.stopPropagation(); }); });
    lobby.addEventListener("keydown", function (e) { if (e.key === "Enter" && (lobby.querySelector("#arEmail") || lobby.querySelector("#arPass"))) act("auth"); else if (e.key === "Enter" && lobby.querySelector("#arCode") && document.activeElement === lobby.querySelector("#arCode")) act("join"); });
    lobby.addEventListener("click", function (e) { e.stopPropagation(); var a = e.target.closest && e.target.closest("[data-a]"); if (a) { if (a.tagName === "A") e.preventDefault(); act(a.getAttribute("data-a")); } else if (e.target === lobby) close(); });
    board.addEventListener("click", function (e) { if (e.target.closest(".h")) open(); });
  }
  function nameVal() { var i = lobby.querySelector("#arName"); if (i) { R.name = i.value.replace(/\s+/g, " ").trim().slice(0, 16); ls("arcade_name", R.name); } return R.name; }
  function ranked() { return R.players.map(function (p) { var s = R.scores[p.id] || {}; return { id: p.id, name: p.name, v: s.v || 0, s: s.s || "", d: !!s.d }; }).sort(function (a, b) { return b.v - a.v; }); }
  function render() {
    if (!lobby) return; var c = lobby.querySelector(".c"), h = "";
    R.name = AU ? AU.name : "";
    var pre = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (!AU && authMode === "reset") {
      h = '<h2>New password</h2><p>Choose a new password for your arcade account.</p>' +
        '<label>New password</label><input id="arPass" type="password" autocomplete="new-password" maxlength="200" placeholder="At least 8 characters">' +
        '<div><button class="b" data-a="auth"' + (busy ? " disabled" : "") + '>Save new password</button></div><div class="st">' + esc(R.status) + '</div><div><button class="b v" data-a="tab-login">Back to sign in</button></div>';
    } else if (!AU && authMode === "forgot") {
      h = '<h2>Forgot password</h2><p>Type the email of your account. We will send a link to choose a new password.</p>' +
        '<label>Email</label><input id="arEmail" type="email" inputmode="email" autocomplete="email" maxlength="120" placeholder="you@example.com">' +
        '<div><button class="b" data-a="auth"' + (busy ? " disabled" : "") + '>Send reset link</button></div><div class="st">' + esc(R.status) + '</div><div><button class="b v" data-a="tab-login">Back to sign in</button></div>';
    } else if (!AU) {
      var reg = authMode === "register";
      h = '<h2>Play with friends</h2><p>' + (pre ? "You were invited to room <b>" + esc(pre) + "</b>. " : "") + 'Sign in with your email, then open a room and share the link. Whoever opens it joins your game.</p>' +
        '<div><button class="b ' + (reg ? "v" : "g") + '" data-a="tab-login">Sign in</button><button class="b ' + (reg ? "g" : "v") + '" data-a="tab-register">Create account</button></div>' +
        '<label>Email</label><input id="arEmail" type="email" inputmode="email" autocomplete="email" maxlength="120" placeholder="you@example.com">' +
        '<label>Password</label><input id="arPass" type="password" autocomplete="' + (reg ? "new-password" : "current-password") + '" maxlength="200" placeholder="At least 8 characters">' +
        (reg ? '<label>Player name</label><input id="arName" maxlength="16" autocomplete="nickname" placeholder="Shown to your friends">' : "") +
        '<div><button class="b" data-a="auth"' + (busy ? " disabled" : "") + '>' + (reg ? "Create account" : "Sign in") + '</button></div>' +
        (reg || !MAILON ? "" : '<div><a href="#" data-a="tab-forgot" style="color:#9fe8ff;font-size:13px;display:inline-block;margin-top:10px">Forgot password?</a></div>') +
        '<div class="st">' + esc(R.status) + '</div><p style="font-size:11px;margin:8px 0 0">We store your email, player name and a salted password hash. Nothing else.</p><div><button class="b v" data-a="close">Close</button></div>';
    } else if (!R.code) {
      var waitV = AU.mail && !AU.verified, block = waitV && AU.require, canRoom = !!game() && !block;
      h = '<h2>' + (game() ? "Play with friends" : "Your account") + '</h2><p>Signed in as <b>' + esc(AU.name) + '</b> · ' + esc(AU.email) + (AU.mail ? (AU.verified ? " · confirmed" : "") : "") + '</p>' +
        (waitV ? '<p style="background:#0d0838;border:2px solid #ffd200;border-radius:12px;padding:10px;color:#fff">We sent a confirmation link to your inbox. Open it to confirm your email' + (block ? ", then you can open rooms." : ".") + '</p><div><button class="b" data-a="recheck">I confirmed it</button><button class="b v" data-a="resend">Send it again</button></div>' : "") +
        (canRoom ? '<div><button class="b g" data-a="create">Create a room</button></div>' +
          '<label>Or join with a code</label><div class="row"><input id="arCode" maxlength="8" placeholder="CODE" value="' + esc(pre) + '" style="text-transform:uppercase;letter-spacing:.14em"><button class="b" data-a="join" style="margin:0;white-space:nowrap">Join</button></div>'
          : (!game() && !block ? '<p>Open any game and tap “Play with friends” to create a room.</p>' : "")) +
        '<div class="st">' + esc(R.status) + '</div><div><button class="b v" data-a="close">Close</button><button class="b r" data-a="signout">Sign out</button></div>';
    } else {
      var rows = ranked().map(function (p, i) { return '<li class="' + (p.id === uid ? "me" : "") + '"><span>' + (p.id === R.host ? "👑 " : "") + esc(p.name) + (p.id === uid ? " (you)" : "") + '</span><small>' + (R.round ? (game() && game().showStatus ? esc(p.s || "") : (p.v ? p.v.toLocaleString("en") : "0") + (p.s ? " · " + esc(p.s) : "")) + (p.d ? " ✓" : "") : "ready") + '</small></li>'; }).join("");
      var g = game(), can = isHost();
      h = '<h2>Room</h2><div class="code">' + esc(R.code) + '</div>' +
        '<div class="row"><input readonly id="arLink" value="' + esc(link()) + '"><button class="b" data-a="copy" style="margin:0;white-space:nowrap">Copy link</button></div>' +
        '<label>Players ' + R.players.length + ' / 10' + (R.round ? " · round " + R.round.n : "") + '</label><ul>' + rows + '</ul>' +
        (g ? (can ? '<div><button class="b g" data-a="start">▶ ' + (R.round ? "Start next round" : "Start round for everyone") + '</button></div>' : '<p style="margin-top:8px">Waiting for the host to start the round.</p>') : '<p>This game cannot start rooms yet.</p>') +
        '<div class="st">' + esc(R.status) + '</div><div><button class="b v" data-a="close">' + (R.round ? "Back to game" : "Close") + '</button><button class="b r" data-a="leave">Leave room</button></div>';
    }
    c.innerHTML = h;
  }
  function renderBoard() {
    if (!board) return; var on = !!(R.code && R.round); board.classList.toggle("on", on); if (!on) return;
    board.innerHTML = '<div class="h">👥 ' + esc(R.code) + '</div>' + ranked().slice(0, 6).map(function (p, i) { return '<div class="r' + (p.id === uid ? " me" : "") + '"><span>' + (i + 1) + ". " + esc(p.name) + '</span><b>' + (p.s && (!p.v || (game() && game().showStatus)) ? esc(p.s) : p.v.toLocaleString("en")) + (p.d ? " <i>✓</i>" : "") + '</b></div>'; }).join("");
  }
  function open() { ensureUI(); if (MAILON === null) { MAILON = false; api("me", null, function (r) { MAILON = !!(r && r.mail); if (lobby && lobby.classList.contains("on")) { var e = lobby.querySelector("#arEmail"), v = e ? e.value : null; if (!e || !e.value) render(); } }); } R.wantOpen = true; try { var g = window.__g; if (g && g.pause) g.pause(); } catch (e) {} render(); lobby.classList.add("on"); }
  function close() { if (lobby) lobby.classList.remove("on"); R.wantOpen = false; }
  function act(a) {
    if (a === "close") return close();
    if (a === "tab-login" || a === "tab-register" || a === "tab-forgot") { authMode = a.slice(4); R.status = ""; return render(); }
    if (a === "resend") { R.status = "Sending…"; render(); return api("resend", {}, function (r) { if (r && r.ok) { setAuth(r); R.status = AU.verified ? "Your email is confirmed." : "Sent. Check your inbox and spam folder."; } else R.status = (r && r.error) || "Could not send it."; render(); }); }
    if (a === "recheck") { return api("me", null, function (r) { if (r && r.ok) { setAuth(r); R.status = AU.verified ? "Email confirmed. You are all set." : "Not confirmed yet. Open the link in the email first."; var q = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (AU.verified && q.length >= 4 && game()) return connect(q); } render(); }); }
    if (a === "auth" && authMode === "forgot") { if (busy) return; var fe = (lobby.querySelector("#arEmail").value || "").trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fe)) { R.status = "Enter a valid email address."; return render(); }
      busy = true; R.status = "One moment…"; render(); return api("forgot", { email: fe }, function (r) { busy = false; R.status = r && r.ok ? "If that email has an account, a reset link is on its way. Check your inbox and spam folder." : (r && r.error) || "Something went wrong."; render(); if (r && r.debugToken) window.__arcadeDebugToken = r.debugToken; }); }
    if (a === "auth" && authMode === "reset") { if (busy) return; var np = lobby.querySelector("#arPass").value || ""; if (np.length < 8) { R.status = "Password must be at least 8 characters."; return render(); }
      busy = true; R.status = "One moment…"; render(); return api("reset", { token: resetTok, password: np }, function (r) { busy = false; if (!r || !r.ok) { R.status = (r && r.error) || "Something went wrong."; return render(); } authMode = "login"; resetTok = ""; setAuth(r); R.status = "Password changed. You are signed in."; try { history.replaceState(null, "", location.pathname); } catch (e) {} render(); }); }
    if (a === "signout") { api("logout", {}, function () {}); leave(); setAuth(null); R.status = ""; return render(); }
    if (a === "auth") {
      if (busy) return; var em = (lobby.querySelector("#arEmail").value || "").trim(), pw = lobby.querySelector("#arPass").value || "", nm = authMode === "register" ? (lobby.querySelector("#arName").value || "").trim() : "";
      var keep = function () { var e = lobby.querySelector("#arEmail"), n = lobby.querySelector("#arName"); if (e) e.value = em; if (n) n.value = nm; };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { R.status = "Enter a valid email address."; render(); return keep(); }
      if (pw.length < 8) { R.status = "Password must be at least 8 characters."; render(); return keep(); }
      if (authMode === "register" && nm.length < 2) { R.status = "Pick a player name."; render(); return keep(); }
      busy = true; R.status = "One moment…"; render(); keep();
      return api(authMode, { email: em, password: pw, name: nm }, function (r) { busy = false; if (!r || !r.ok) { R.status = (r && r.error) || "Something went wrong."; render(); return keep(); }
        setAuth(r); R.status = ""; if (r.debugToken) window.__arcadeDebugToken = r.debugToken; var q = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (q.length >= 4 && game() && !(AU.require && AU.mail && !AU.verified)) connect(q); else render(); });
    }
    if (a === "create" || a === "join") {
      if (!AU) { R.status = "Sign in first."; return render(); }
      var code = a === "create" ? Array.from({ length: 5 }, function () { return "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]; }).join("") : (lobby.querySelector("#arCode").value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (code.length < 4) { R.status = "Enter the room code."; return render(); }
      return connect(code);
    }
    if (a === "copy") { var t = link(); var done = function () { R.status = "Link copied. Send it to your friends."; render(); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { var i = lobby.querySelector("#arLink"); i.select(); try { document.execCommand("copy"); } catch (e) {} done(); }); else { var i = lobby.querySelector("#arLink"); i.select(); try { document.execCommand("copy"); } catch (e) {} done(); } return; }
    if (a === "leave") { leave(); R.status = ""; return render(); }
    if (a === "start" && isHost()) { var g = game(); if (!g) return; var cfg = null; try { cfg = g.config ? g.config() : null; } catch (e) {} var m = { t: "start", n: (R.round ? R.round.n : 0) + 1, seed: (Math.random() * 4294967296) >>> 0, cfg: cfg }; send(m); begin(m); }
  }
  function send(m) { if (R.ws && R.ws.readyState === 1) { try { R.ws.send(JSON.stringify(m)); return true; } catch (e) {} } return false; }
  function begin(m) {
    R.round = { n: m.n, seed: m.seed, cfg: m.cfg }; R.scores = {}; R.sentDone = false; close(); renderBoard();
    var g = game(); if (g && g.start) { try { g.start(m.seed, m.cfg || {}); } catch (e) { if (window.console) console.error(e); } }
  }
  function connect(code) {
    leave(true); R.code = code; R.status = "Connecting…"; render();
    var ws; try { ws = new WebSocket(WSBASE + code + "?token=" + encodeURIComponent(AU ? AU.token : "")); } catch (e) { R.code = null; R.status = "Could not reach the room server."; return render(); }
    R.ws = ws; var opened = false;
    ws.onopen = function () { opened = true; R.tries = 0; R.status = ""; try { history.replaceState(null, "", location.pathname + "?room=" + code); } catch (e) {} render(); };
    ws.onmessage = function (ev) { var m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
    ws.onclose = function () { if (R.ws !== ws) return; R.ws = null; if (!R.code) return;
      if (opened && R.tries < 6) { R.tries++; R.status = "Reconnecting…"; render(); setTimeout(function () { if (R.code === code && !R.ws) connect(code); }, 1200); }
      else { R.code = null; R.players = []; R.round = null; R.status = opened ? "Connection lost." : (AU && AU.require && AU.mail && !AU.verified) ? "Confirm your email first, then try again." : "Could not join that room. Check the code, or the room server may be offline."; render(); renderBoard(); } };
  }
  function leave(keepUrl) { var ws = R.ws; R.ws = null; R.code = null; R.players = []; R.host = null; R.round = null; R.scores = {}; if (ws) { try { ws.close(); } catch (e) {} } if (!keepUrl) { try { history.replaceState(null, "", location.pathname); } catch (e) {} } renderBoard(); }
  function onMsg(m) {
    if (m.t === "roster") { var had = R.players.length; R.players = m.players || []; R.host = m.host; if (isHost() && R.round && R.players.length > had) send({ t: "sync", round: R.round }); render(); renderBoard(); fire("roster", m); return; }
    if (m.t === "start") { begin(m); fire("start", m); return; }
    if (m.t === "sync") { if (m.round && (!R.round || R.round.n < m.round.n)) begin({ n: m.round.n, seed: m.round.seed, cfg: m.round.cfg }); return; }
    if (m.t === "score") { R.scores[m.from] = { v: +m.v || 0, s: String(m.s || "").slice(0, 24), d: !!m.d }; renderBoard(); if (lobby && lobby.classList.contains("on")) render(); return; }
    fire(m.t, m);
  }
  function fire(t, m) { var hs = R.handlers[t]; if (hs) for (var i = 0; i < hs.length; i++) { try { hs[i](m); } catch (e) { if (window.console) console.error(e); } } }
  var lastSent = "";
  setInterval(function () {
    if (!R.code || !R.round) return; var g = game(); if (!g) return; var v = 0, s = "", d = false;
    try { v = Math.round(+g.score() || 0); s = g.status ? String(g.status() || "") : ""; d = g.done ? !!g.done() : false; } catch (e) { return; }
    R.scores[uid] = { v: v, s: s, d: d }; var k = v + "|" + s + "|" + d; if (k !== lastSent) { lastSent = k; send({ t: "score", v: v, s: s, d: d }); renderBoard(); if (lobby && lobby.classList.contains("on")) render(); }
  }, 700);
  A.rooms = { open: open, close: close, leave: leave, send: send, on: function (t, fn) { (R.handlers[t] = R.handlers[t] || []).push(fn); }, get code() { return R.code; }, get players() { return R.players; }, get isHost() { return isHost(); }, get me() { return uid; }, get round() { return R.round; }, _state: R };
  function boot() {
    document.addEventListener("click", function (e) { var el = e.target && e.target.closest ? e.target.closest("[data-arcade-room]") : null; if (el) { e.preventDefault(); open(); } });
    var q = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (AU) api("me", null, function (r) { if (r && r.ok) setAuth(r); else if (r && r.error === "Not signed in.") { setAuth(null); if (lobby && lobby.classList.contains("on")) render(); } });
    var P = new URLSearchParams(location.search), vt = P.get("verify"), rt = P.get("reset");
    if (vt) { ensureUI(); R.status = "Confirming your email…"; open(); api("verify", { token: vt }, function (r) { try { history.replaceState(null, "", location.pathname); } catch (e) {}
      if (r && r.ok) { if (AU && AU.email === r.email) setAuth(r); R.status = "Email confirmed. You are all set."; } else R.status = (r && r.error) || "This link did not work."; render(); }); }
    else if (rt) { ensureUI(); resetTok = rt; if (AU) setAuth(null); authMode = "reset"; R.status = ""; open(); }
    else if (q.length >= 4) { ensureUI(); open(); if (AU && game() && !(AU.require && AU.mail && !AU.verified)) connect(q); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();


/* ---------------------------------------------------------------------------------------------------------------
   Graphics quality. Games size their canvas with Arcade.gfx.dpr(cssW, cssH). A frame monitor watches real frame
   pacing; when the device cannot keep up, the render resolution steps down (and games re-layout via onChange).
   FPS meter: add ?fps=1 to the address, or press Shift+F. */
(function () {
  "use strict";
  var A = window.Arcade; if (!A) return;
  var MINQ = 0.3, q = 1, subs = [], stat = { fps: 0, med: 0, p90: 0, worst: 0, refresh: 0 };
  try { var sv = +sessionStorage.getItem("arcade_q"); if (sv >= MINQ && sv <= 1) q = sv; } catch (e) {}
  function dpr(cssW, cssH, maxDpr) { var d = Math.min(window.devicePixelRatio || 1, maxDpr || 2); var px = Math.max(1, cssW * cssH) * d * d, cap = 9.5e6; if (px > cap) d *= Math.sqrt(cap / px); return Math.max(0.7, d * Math.sqrt(q)); }
  function setQ(v) { v = Math.max(MINQ, Math.min(1, v)); if (Math.abs(v - q) < 0.01) return; q = v; try { sessionStorage.setItem("arcade_q", String(q)); } catch (e) {} for (var i = 0; i < subs.length; i++) { try { subs[i](q); } catch (e) {} } }
  var buf = [], last = 0, t0 = performance.now(), slow = 0, lastChange = 0, worstWin = 0, secT = 0, secN = 0, secWorst = 0;
  function mon(t) {
    (window.__rawRaf || requestAnimationFrame)(mon); if (document.hidden) { last = 0; return; }
    if (last) { var d = t - last; if (d < 250) { buf.push(d); secT += d; secN++; if (d > secWorst) secWorst = d; if (on) { hist.push(d); histT += d; while (histT > 5000 && hist.length > 1) histT -= hist.shift(); }
      if (secT >= 500) { stat.fps = Math.round(1000 * secN / secT); stat.worst = Math.round(secWorst); secT = 0; secN = 0; secWorst = 0; paintMeter(); }
      if (buf.length >= 90) { var a = buf.slice().sort(function (x, y) { return x - y; }), med = a[45], p90 = a[81]; buf.length = 0; stat.med = med; stat.p90 = p90;
        if (!stat.refresh || med < stat.refresh) stat.refresh = Math.max(4, med);
        var steady30 = med > 31 && med < 35.5 && p90 < 37.5;                      // capped at 30 fps by the system (low power mode): not a performance problem
        var bad = t - t0 > 3500 && !steady30 && med > Math.max(stat.refresh * 1.15, 9.6) && (med > 19.5 || p90 > Math.max(stat.refresh * 1.7, 14) && med > 12);
        if (bad) { slow++; if (slow >= 2 && q > MINQ && t - lastChange > 2500) { slow = 0; lastChange = t; setQ(q * 0.72); } } else slow = 0; } } }
    last = t;
  }
  window.__rawRaf = window.__rawRaf || window.requestAnimationFrame.bind(window); window.__rawRaf(mon);
  // ---- matte finish: colours stay distinct but lose their glare. One rule for every game; tune with Arcade.gfx.matte(sat, bright).
  var matteEl = document.createElement("style"); function matte(sv, bv) { matteEl.textContent = "canvas,.arcade-matte{filter:saturate(" + sv + ") brightness(" + bv + ")}"; } matte(0.84, 0.93); (document.head || document.documentElement).appendChild(matteEl);
  // ---- FPS meter
  var meter = null, on = false, hist = [], histT = 0, gpuName = null;
  function gpu() { if (gpuName !== null) return gpuName; gpuName = "?"; try { var c = document.createElement("canvas"), g = c.getContext("webgl") || c.getContext("experimental-webgl"); if (!g) gpuName = "no WebGL"; else { var x = g.getExtension("WEBGL_debug_renderer_info"); var r = x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); gpuName = String(r).replace(/ANGLE \(|\)$/g, "").replace(/, Unspecified Version|, OpenGL[^,)]*|Direct3D11[^,)]*/g, "").slice(0, 46); } } catch (e) {} return gpuName; }
  try { var P = new URLSearchParams(location.search).get("fps"); if (P === "1") localStorage.setItem("arcade_fps", "1"); else if (P === "0") localStorage.removeItem("arcade_fps"); on = localStorage.getItem("arcade_fps") === "1"; } catch (e) {}
  function paintMeter() {
    if (!on) { if (meter) meter.style.display = "none"; return; }
    if (!meter) { if (!document.body) return; meter = document.createElement("div"); meter.style.cssText = "position:fixed;left:50%;bottom:4px;transform:translateX(-50%);z-index:2147483600;background:#000;color:#3dff7a;font:700 12px/1.3 ui-monospace,Menlo,monospace;padding:4px 8px;border:1px solid #3dff7a;border-radius:6px;pointer-events:none;white-space:nowrap"; document.body.appendChild(meter); }
    var cv = null, cs = document.querySelectorAll("canvas"); for (var i = 0; i < cs.length; i++) if (!cv || cs[i].width * cs[i].height > cv.width * cv.height) cv = cs[i];
    meter.style.display = "block"; meter.style.color = stat.fps >= 55 ? "#3dff7a" : stat.fps >= 40 ? "#ffd200" : "#ff5a6a";
    var n = hist.length || 1, b = [0, 0, 0, 0, 0], mx = 0; for (var k = 0; k < hist.length; k++) { var h = hist[k]; if (h > mx) mx = h; b[h <= 10.5 ? 0 : h <= 19 ? 1 : h <= 27.5 ? 2 : h <= 36 ? 3 : 4]++; } var pc = function (v) { return Math.round(v / n * 100); };
    meter.style.whiteSpace = "pre"; meter.style.textAlign = "center";
    meter.textContent = stat.fps + " fps now · worst " + stat.worst + " ms · screen up to " + (stat.refresh ? Math.round(1000 / stat.refresh) + " Hz" : "?") + (cv ? " · " + cv.width + "×" + cv.height : "") + " · q " + q.toFixed(2) +
      "\nlast 5 s: 8ms " + pc(b[0]) + "% | 17ms " + pc(b[1]) + "% | 25ms " + pc(b[2]) + "% | 33ms " + pc(b[3]) + "% | slower " + pc(b[4]) + "% | max " + Math.round(mx) + " ms" +
      "\n" + gpu() + " · dpr " + (window.devicePixelRatio || 1) + " · " + innerWidth + "×" + innerHeight + (document.hasFocus() ? "" : " · NOT FOCUSED");
  }
  addEventListener("keydown", function (e) { if (e.shiftKey && (e.key === "F" || e.key === "f") && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) { on = !on; try { if (on) localStorage.setItem("arcade_fps", "1"); else localStorage.removeItem("arcade_fps"); } catch (x) {} paintMeter(); } });
  // ---- steady frame clock. The browser's frame timestamp wobbles by about a millisecond at 120 Hz while the screen shows frames
  // at perfectly even intervals; motion computed from the raw timestamp therefore trembles. time(raw) returns a clock that advances
  // by exact multiples of the display's refresh period (and follows real time through a slow drift correction).
  var RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240], rec = [], per = 0, fRaw = 0, fNow = 0, cRaw = -1, cVal = 0;
  function ftime(raw) {
    if (raw === cRaw || raw === cVal) return cVal; var out, d = raw - fRaw;
    if (!fRaw || d <= 0 || d > 200) { fNow = raw; out = raw; }
    else {
      rec.push(d); if (rec.length > 40) rec.shift();
      if (rec.length >= 12 && (rec.length % 8 === 0 || !per)) { var srt = rec.slice().sort(function (x, y) { return x - y; }), m = srt[srt.length >> 1], hz = 1000 / m, best = 0, bd = 9; for (var i = 0; i < RATES.length; i++) { var df = Math.abs(RATES[i] - hz) / RATES[i]; if (df < bd) { bd = df; best = RATES[i]; } } per = bd < 0.045 ? 1000 / best : m; }
      if (per) { var n = Math.round(d / per); if (n >= 1 && n <= 4 && Math.abs(d - n * per) < per * 0.35) d = n * per; }
      fNow += d; var err = raw - fNow; if (!per || Math.abs(err) > per * 3) fNow = raw; else fNow += err * 0.015;
      out = fNow;
    }
    fRaw = raw; cRaw = raw; cVal = out; return out;
  }
  var rawRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) { return rawRaf(function (t) { cb(ftime(t)); }); };
  A.gfx = { matte: matte, time: ftime, get period() { return per; }, dpr: dpr, onChange: function (fn) { subs.push(fn); }, get quality() { return q; }, set quality(v) { setQ(v); }, stats: stat };
})();
