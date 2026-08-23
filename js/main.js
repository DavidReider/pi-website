const API = "http://192.168.1.222:5050";

let cpuHistory = [];

/* HERO IMAGE */
const images = [
  "https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d",
  "https://images.unsplash.com/photo-1518770660439-4636190af475",
];

document.getElementById("heroImg").style.backgroundImage =
  `url(${images[Math.floor(Math.random() * images.length)]})`;

/* =============================
   CPU GRAPH (FIXED SCALING)
============================= */

function drawGraph(data) {
  const canvas = document.getElementById("cpuGraph");
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!data || data.length < 2) return;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  ctx.beginPath();
  ctx.strokeStyle = "#3fb950";
  ctx.lineWidth = 1.5;

  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * canvas.width;
    const normalized = (v - min) / range;
    const y = canvas.height - normalized * canvas.height;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}

/* =============================
   EVENTS RENDER
============================= */

function renderEvents(events) {
  const box = document.getElementById("eventBox");
  if (!box) return;

  box.innerHTML = "";

  (events || []).forEach((e) => {
    const div = document.createElement("div");
    div.textContent = `[${e.time}] ${e.msg}`;
    box.appendChild(div);
  });
}

/* =============================
   MAIN LOOP
============================= */

async function update() {
  try {
    const res = await fetch(`${API}/api/stats`);
    const data = await res.json();

    document.getElementById("apiDot").classList.add("online");

    /* SAFE LOAD */
    const load = Array.isArray(data.load) ? data.load.join(" - ") : "--";

    /* HUD */
    document.getElementById("hudCpu").textContent = data.cpu_temp ?? "--";
    document.getElementById("hudLoad").textContent = load;
    document.getElementById("hudPing").textContent = data.ping ?? "--";

    /* MAIN METRICS */
    document.getElementById("cpuText").textContent =
      (data.cpu_temp ?? "--") + "°C";

    document.getElementById("uptimeText").textContent = data.uptime ?? "--";

    document.getElementById("diskText").textContent = data.disk_usage ?? "--";

    document.getElementById("loadText").textContent = load;

    /* GRAPH */
    cpuHistory = Array.isArray(data.cpu_history) ? data.cpu_history : [];

    drawGraph(cpuHistory);

    /* EVENTS */
    renderEvents(data.events);
  } catch (err) {
    console.log("API error:", err);
    document.getElementById("apiDot").classList.remove("online");
  }
}

/* =============================
   NETWORK / DEVICES
   Expects: GET {API}/api/devices
   -> { devices: [{ ip, hostname, mac }, ...] }
============================= */

async function updateDevices() {
  const box = document.getElementById("deviceBox");
  const countEl = document.getElementById("deviceCountText");
  try {
    const res = await fetch(`${API}/api/devices`);
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    const devices = Array.isArray(data.devices) ? data.devices : [];

    countEl.textContent = devices.length || "--";
    box.innerHTML = "";

    if (devices.length === 0) {
      box.innerHTML = '<div class="endpoint-hint">// no devices reported</div>';
      return;
    }

    devices.forEach((d) => {
      const div = document.createElement("div");
      div.textContent = `${d.ip || "?"}  ${d.hostname || "unknown"}  ${d.mac || ""}`;
      box.appendChild(div);
    });
  } catch (err) {
    countEl.textContent = "--";
    box.innerHTML =
      '<div class="endpoint-hint">// waiting on /api/devices</div>';
  }
}

/* =============================
   SECURITY / AUTH LOG
   Expects: GET {API}/api/auth-log
   -> { entries: [{ time, ip, status: "ok"|"fail", msg }, ...] }
============================= */

async function updateAuthLog() {
  const box = document.getElementById("authLogBox");
  try {
    const res = await fetch(`${API}/api/auth-log`);
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    const entries = Array.isArray(data.entries) ? data.entries : [];

    box.innerHTML = "";

    if (entries.length === 0) {
      box.innerHTML = '<div class="endpoint-hint">// no auth activity</div>';
      return;
    }

    entries.forEach((e) => {
      const div = document.createElement("div");
      div.className = e.status === "fail" ? "log-fail" : "log-ok";
      div.textContent = `[${e.time}] ${e.ip || "?"} ${e.msg || ""}`;
      box.appendChild(div);
    });
  } catch (err) {
    box.innerHTML =
      '<div class="endpoint-hint">// waiting on /api/auth-log</div>';
  }
}

/* =============================
   PACKAGE UPDATES
   Expects: GET {API}/api/updates -> { count: N }
============================= */

async function updatePackageCount() {
  const el = document.getElementById("updatesText");
  try {
    const res = await fetch(`${API}/api/updates`);
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    el.textContent = data.count ?? "--";
  } catch (err) {
    el.textContent = "--";
  }
}

async function applyUpdates() {
  try {
    await fetch(`${API}/api/apply-updates`);
  } catch (err) {
    console.log("apply-updates error:", err);
  }
}

/* =============================
   PUBLIC IP
   No Pi backend needed — hits an external service directly.
============================= */

async function updatePublicIp() {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    document.getElementById("publicIpText").textContent = data.ip || "--";
    document.getElementById("hudIp").textContent = data.ip || "--";
  } catch (err) {
    document.getElementById("publicIpText").textContent = "--";
  }
}

/* =============================
   BOOT SEQUENCE
============================= */

const bootScript = [
  "initializing core...",
  "mounting /dev/sda1...",
  "loading kernel modules...",
  "checking cpu thermal sensors...",
  "starting network interface eth0...",
  "handshaking with api.local:5050...",
  "link established.",
];

function runBootSequence() {
  const overlay = document.getElementById("bootOverlay");
  const linesEl = document.getElementById("bootLines");
  if (!overlay || !linesEl) return;

  bootScript.forEach((line, i) => {
    const div = document.createElement("div");
    div.className = "ok";
    div.textContent = line;
    div.style.animationDelay = `${i * 0.14}s`;
    linesEl.appendChild(div);
  });

  const totalTime = bootScript.length * 140 + 500;
  setTimeout(() => {
    overlay.classList.add("hidden");
  }, totalTime);
}

/* =============================
   ROTATING MOTD
============================= */

const motdLines = [
  "// monitoring raspberry pi",
  "// uptime is a personality trait",
  "// it works on my pi",
  "// 24/7, no cap",
  "// sudo make me a sandwich",
  "// there is no cloud, just someone else's pi",
];

function rotateMotd() {
  const el = document.getElementById("motd");
  if (!el) return;
  let i = 0;
  setInterval(() => {
    i = (i + 1) % motdLines.length;
    el.style.opacity = 0;
    setTimeout(() => {
      el.textContent = motdLines[i];
      el.style.opacity = 1;
    }, 300);
  }, 6000);
}

/* =============================
   IDLE SCREENSAVER (matrix rain)
============================= */

const IDLE_TIMEOUT_MS = 3 * 60 * 1000;
let idleTimer = null;
let matrixInterval = null;

function startMatrixRain() {
  const canvas = document.getElementById("matrixCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const chars = "01アイウエオカキクケコサシスセソ";
  const fontSize = 15;
  const columns = Math.floor(canvas.width / fontSize);
  const drops = new Array(columns).fill(1);

  matrixInterval = setInterval(() => {
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#3fb950";
    ctx.font = `${fontSize}px monospace`;

    drops.forEach((y, i) => {
      const char = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(char, i * fontSize, y * fontSize);
      if (y * fontSize > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    });
  }, 50);
}

function stopMatrixRain() {
  clearInterval(matrixInterval);
}

function updateScreensaverClock() {
  const now = new Date();
  document.getElementById("ssClock").textContent = now.toLocaleTimeString();
  document.getElementById("ssCpu").textContent =
    `cpu ${document.getElementById("hudCpu").textContent}°c  //  load ${document.getElementById("hudLoad").textContent}`;
}

function enterScreensaver() {
  const ss = document.getElementById("screensaver");
  ss.classList.add("active");
  startMatrixRain();
  updateScreensaverClock();
  ss._clockInterval = setInterval(updateScreensaverClock, 1000);
}

function exitScreensaver() {
  const ss = document.getElementById("screensaver");
  if (!ss.classList.contains("active")) return;
  ss.classList.remove("active");
  stopMatrixRain();
  clearInterval(ss._clockInterval);
}

function resetIdleTimer() {
  exitScreensaver();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(enterScreensaver, IDLE_TIMEOUT_MS);
}

["mousemove", "keydown", "click", "touchstart"].forEach((evt) =>
  window.addEventListener(evt, resetIdleTimer),
);

/* =============================
   EASTER EGGS
============================= */

/* Konami code -> instant matrix takeover, exits on next key */
const konamiSeq = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];
let konamiProgress = 0;

window.addEventListener("keydown", (e) => {
  const key = e.key;
  konamiProgress = key === konamiSeq[konamiProgress] ? konamiProgress + 1 : 0;

  if (konamiProgress === konamiSeq.length) {
    konamiProgress = 0;
    clearTimeout(idleTimer);
    enterScreensaver();
  }
});

/* Click the HUD status dot 5x fast -> brief glitch burst */
let dotClicks = 0;
let dotClickTimer = null;

const apiDotEl = document.getElementById("apiDot");
if (apiDotEl) {
  apiDotEl.style.cursor = "pointer";
  apiDotEl.addEventListener("click", () => {
    dotClicks++;
    clearTimeout(dotClickTimer);
    dotClickTimer = setTimeout(() => (dotClicks = 0), 1200);

    if (dotClicks >= 5) {
      dotClicks = 0;
      document.body.animate(
        [
          { filter: "none" },
          { filter: "hue-rotate(90deg) contrast(1.4)" },
          { filter: "none" },
        ],
        { duration: 260, iterations: 2 },
      );
    }
  });
}

/* =============================
   CONTROL ACTIONS
============================= */

async function restartApache() {
  await fetch(`${API}/api/restart-apache`);
}

async function rebootPi() {
  await fetch(`${API}/api/reboot`);
}

/* START */
runBootSequence();
rotateMotd();
resetIdleTimer();
updatePublicIp();

setInterval(update, 3000);
setInterval(updateDevices, 15000);
setInterval(updateAuthLog, 15000);
setInterval(updatePackageCount, 60000);

update();
updateDevices();
updateAuthLog();
updatePackageCount();
