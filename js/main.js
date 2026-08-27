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
   THEME TOGGLE (dark / light / auto)
============================= */

const themeToggleBtn = document.getElementById("themeToggle");
const themeModeLabel = document.getElementById("themeModeLabel");

function applyComputedTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("pi-dashboard-theme-computed", theme);
}

async function applyAutoTheme() {
  try {
    const res = await fetch(`${API}/api/suntimes`);
    const data = await res.json();
    if (data.suntimes) {
      applyComputedTheme(data.suntimes.is_day ? "light" : "dark");
      return;
    }
  } catch (err) {
    // fall through to whatever theme was already showing
  }
}

function setThemeMode(mode) {
  document.documentElement.setAttribute("data-theme-mode", mode);
  localStorage.setItem("pi-dashboard-theme-mode", mode);
  if (themeModeLabel)
    themeModeLabel.textContent = mode === "auto" ? "auto" : "";

  if (mode === "auto") {
    applyAutoTheme();
  } else {
    applyComputedTheme(mode);
  }
}

if (themeToggleBtn) {
  const order = ["dark", "light", "auto"];
  themeToggleBtn.addEventListener("click", () => {
    const current =
      document.documentElement.getAttribute("data-theme-mode") || "dark";
    const next = order[(order.indexOf(current) + 1) % order.length];
    setThemeMode(next);
  });

  // re-sync label + re-check auto theme on load, since the head script
  // only had a cached guess to avoid a flash before this ran
  const initialMode =
    document.documentElement.getAttribute("data-theme-mode") || "dark";
  if (themeModeLabel)
    themeModeLabel.textContent = initialMode === "auto" ? "auto" : "";
  if (initialMode === "auto") applyAutoTheme();

  // re-check every 10 minutes in auto mode so it flips near actual sunset/sunrise
  setInterval(
    () => {
      if (document.documentElement.getAttribute("data-theme-mode") === "auto") {
        applyAutoTheme();
      }
    },
    10 * 60 * 1000,
  );
}

/* =============================
   CPU FLAVOR TEXT
============================= */

function cpuFlavor(temp) {
  if (temp == null) return "--";
  if (temp < 40) return "chill";
  if (temp < 50) return "comfortable";
  if (temp < 60) return "warm";
  if (temp < 70) return "toasty";
  if (temp < 80) return "hot";
  return "surface of the sun";
}

function formatKbps(v) {
  if (v == null) return "--";
  if (v >= 1024) return (v / 1024).toFixed(1) + " mb/s";
  return v + " kb/s";
}

/* =============================
   GAUGE RINGS
============================= */

const GAUGE_CIRCUMFERENCE = 100.53; // 2 * pi * r(16)

function setGauge(id, percent) {
  const el = document.getElementById(id);
  if (!el) return;
  const clamped = Math.max(0, Math.min(100, percent ?? 0));
  const offset = GAUGE_CIRCUMFERENCE * (1 - clamped / 100);
  el.style.strokeDashoffset = offset;

  let color = "#3fb950"; // green
  if (clamped >= 85)
    color = "#f85149"; // red
  else if (clamped >= 65) color = "#d29922"; // amber
  el.style.stroke = color;
}

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
   CPU STATS (min/avg/max)
============================= */

function updateGraphStats(data) {
  if (!data || data.length === 0) return;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const avg = data.reduce((a, b) => a + b, 0) / data.length;

  document.getElementById("cpuMin").textContent = min.toFixed(1) + "°c";
  document.getElementById("cpuAvg").textContent = avg.toFixed(1) + "°c";
  document.getElementById("cpuMax").textContent = max.toFixed(1) + "°c";
}

/* =============================
   NETWORK THROUGHPUT SPARKLINE
   (client-side rolling history — backend only gives a live snapshot)
============================= */

const netRxHistory = [];
const netTxHistory = [];
const NET_HISTORY_MAX = 120;

function pushNetHistory(rx, tx) {
  netRxHistory.push(rx ?? 0);
  netTxHistory.push(tx ?? 0);
  if (netRxHistory.length > NET_HISTORY_MAX) netRxHistory.shift();
  if (netTxHistory.length > NET_HISTORY_MAX) netTxHistory.shift();
}

function drawNetGraph() {
  const canvas = document.getElementById("netGraph");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (netRxHistory.length < 2) return;

  const allValues = [...netRxHistory, ...netTxHistory];
  const max = Math.max(...allValues, 1);

  const drawLine = (data, color) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.3;
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * canvas.width;
      const y = canvas.height - (v / max) * canvas.height * 0.9 - 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  drawLine(netRxHistory, "#3fb950");
  drawLine(netTxHistory, "#d29922");
}

/* =============================
   EVENTS RENDER
============================= */

let lastTopEventKey = null;

function typeLine(el, text, speed = 18) {
  el.textContent = "";
  el.classList.add("typing-cursor");
  let i = 0;
  const timer = setInterval(() => {
    el.textContent = text.slice(0, i + 1);
    i++;
    if (i >= text.length) {
      clearInterval(timer);
      el.classList.remove("typing-cursor");
    }
  }, speed);
}

function renderEvents(events) {
  const box = document.getElementById("eventBox");
  if (!box) return;

  const list = events || [];
  box.innerHTML = "";

  list.forEach((e, idx) => {
    const div = document.createElement("div");
    const text = `[${e.time}] ${e.msg}`;
    box.appendChild(div);

    const key = `${e.time}|${e.msg}`;
    if (idx === 0 && key !== lastTopEventKey && lastTopEventKey !== null) {
      typeLine(div, text);
    } else {
      div.textContent = text;
    }
  });

  if (list.length) {
    lastTopEventKey = `${list[0].time}|${list[0].msg}`;
  }
}

/* =============================
   MAIN LOOP
============================= */

/* =============================
   OPS FLOOR (digital office) — pulses tied to real poll activity
============================= */

function pulseWorker(name, duration = 900) {
  const screen = document.getElementById(`screen${name}`);
  const worker = document.getElementById(`worker${name}`);
  if (screen) screen.classList.add("active");
  if (worker) worker.classList.add("active");
  setTimeout(() => {
    if (screen) screen.classList.remove("active");
    if (worker) worker.classList.remove("active");
  }, duration);
}

/* =============================
   MARKET TICKER
============================= */

function formatUsd(v) {
  if (v == null) return "--";
  return v >= 1000
    ? v.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : v.toFixed(2);
}

function renderMarketTicker(crypto) {
  const track = document.getElementById("marketTickerTrack");
  if (!track) return;

  if (!crypto) {
    track.innerHTML =
      '<span class="market-ticker-item">// waiting on market data...</span>';
    return;
  }

  const line = (label, coin) => {
    const dir = coin.change24h >= 0 ? "up" : "down";
    const arrow = coin.change24h >= 0 ? "▲" : "▼";
    return `<span class="market-ticker-item">${label} $${formatUsd(coin.usd)} <span class="${dir}">${arrow} ${Math.abs(coin.change24h)}%</span></span>`;
  };

  const content = line("BTC", crypto.btc) + line("ETH", crypto.eth);
  // duplicate content so the marquee loops seamlessly at -50% translateX
  track.innerHTML = content + content;
}

async function updateMarketTicker() {
  try {
    const res = await fetch(`${API}/api/crypto`);
    const data = await res.json();
    renderMarketTicker(data.crypto);
  } catch (err) {
    renderMarketTicker(null);
  }
}

async function update() {
  try {
    const res = await fetch(`${API}/api/stats`);
    const data = await res.json();

    pulseWorker("Core");

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

    /* CPU FLAVOR */
    document.getElementById("cpuFlavor").textContent = cpuFlavor(data.cpu_temp);

    /* GAUGES */
    setGauge(
      "gaugeCpu",
      data.cpu_temp != null ? (data.cpu_temp / 85) * 100 : null,
    );
    const diskPercent = parseInt(data.disk_usage, 10);
    setGauge("gaugeDisk", isNaN(diskPercent) ? null : diskPercent);
    if (data.mem) setGauge("gaugeMem", data.mem.percent);

    /* UPTIME RECORD */
    const rec = data.uptime_record;
    const recordEl = document.getElementById("uptimeRecordText");
    if (rec) {
      recordEl.textContent = rec.is_record
        ? "new record streak"
        : `record: ${rec.record}`;
      recordEl.classList.toggle("record-live", !!rec.is_record);
    }

    /* MEMORY */
    const mem = data.mem;
    if (mem) {
      document.getElementById("memText").textContent =
        mem.percent != null ? `${mem.percent}%` : "--";
      document.getElementById("swapText").textContent =
        `swap: ${mem.swap_percent != null ? mem.swap_percent + "%" : "--"}`;
    }

    /* NETWORK THROUGHPUT */
    const net = data.net;
    if (net) {
      document.getElementById("netText").textContent =
        `↓${formatKbps(net.rx_kbps)} ↑${formatKbps(net.tx_kbps)}`;
      document.getElementById("hudNet").textContent =
        `${formatKbps(net.rx_kbps)}`;
    }

    /* GRAPH */
    cpuHistory = Array.isArray(data.cpu_history) ? data.cpu_history : [];

    drawGraph(cpuHistory);
    updateGraphStats(cpuHistory);

    if (net) {
      pushNetHistory(net.rx_kbps, net.tx_kbps);
      drawNetGraph();
    }

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

/* =============================
   NETWORK RADAR DIAGRAM
============================= */

let radarInitialized = false;

function initRadarDefs(svg) {
  const NS = "http://www.w3.org/2000/svg";
  const defs = document.createElementNS(NS, "defs");
  defs.innerHTML = `
    <radialGradient id="radarSweepGradient">
      <stop offset="0%" stop-color="#3fb950" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#3fb950" stop-opacity="0" />
    </radialGradient>
  `;
  svg.appendChild(defs);

  // background rings
  [60, 100, 140].forEach((r) => {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", 150);
    c.setAttribute("cy", 150);
    c.setAttribute("r", r);
    c.setAttribute("class", "radar-ring");
    svg.appendChild(c);
  });

  // rotating sweep wedge
  const sweep = document.createElementNS(NS, "path");
  sweep.setAttribute("d", "M150,150 L150,10 A140,140 0 0,1 220,35 Z");
  sweep.setAttribute("class", "radar-sweep");
  svg.appendChild(sweep);

  radarInitialized = true;
}

function renderRadar(devices) {
  const svg = document.getElementById("radarSvg");
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg";

  if (!radarInitialized) {
    svg.innerHTML = "";
    initRadarDefs(svg);
  } else {
    // remove previously drawn nodes/links/labels, keep defs/rings/sweep
    svg
      .querySelectorAll(".radar-node, .radar-link, .radar-label")
      .forEach((n) => n.remove());
  }

  // hub (the Pi itself)
  let hub = svg.querySelector(".radar-hub");
  if (!hub) {
    hub = document.createElementNS(NS, "circle");
    hub.setAttribute("cx", 150);
    hub.setAttribute("cy", 150);
    hub.setAttribute("r", 14);
    hub.setAttribute("class", "radar-hub");
    svg.appendChild(hub);

    const hubLabel = document.createElementNS(NS, "text");
    hubLabel.setAttribute("x", 150);
    hubLabel.setAttribute("y", 154);
    hubLabel.setAttribute("class", "radar-hub-label");
    hubLabel.textContent = "pi";
    svg.appendChild(hubLabel);
  }

  const count = devices.length;
  if (count === 0) return;

  const radius = 120;
  devices.slice(0, 16).forEach((d, i) => {
    const angle = (i / Math.min(count, 16)) * Math.PI * 2 - Math.PI / 2;
    const x = 150 + radius * Math.cos(angle);
    const y = 150 + radius * Math.sin(angle);

    const link = document.createElementNS(NS, "line");
    link.setAttribute("x1", 150);
    link.setAttribute("y1", 150);
    link.setAttribute("x2", x);
    link.setAttribute("y2", y);
    link.setAttribute("class", "radar-link");
    svg.appendChild(link);

    const node = document.createElementNS(NS, "circle");
    node.setAttribute("cx", x);
    node.setAttribute("cy", y);
    node.setAttribute("r", 4);
    node.setAttribute("class", "radar-node" + (d.new ? " is-new" : ""));
    svg.appendChild(node);

    const label = document.createElementNS(NS, "text");
    label.setAttribute("x", x);
    label.setAttribute("y", y - 9);
    label.setAttribute("class", "radar-label");
    label.textContent = d.ip.split(".").pop();
    svg.appendChild(label);
  });
}

async function updateDevices() {
  const box = document.getElementById("deviceBox");
  const countEl = document.getElementById("deviceCountText");
  pulseWorker("Network", 1400);
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
      div.className = "device-line";

      const badge = d.new ? '<span class="badge-new">new</span>' : "";
      div.innerHTML = `
        ${badge}
        <span class="device-ip">${d.ip || "?"}</span>
        <span class="device-vendor">${d.hostname || d.vendor || "unknown"}</span>
        <span class="device-mac">${d.mac || ""}</span>
      `;
      box.appendChild(div);

      if (d.new) {
        showToast(`new device joined: ${d.ip} (${d.vendor || d.mac})`);
      }
    });

    updateHostTicker(devices);
    renderRadar(devices);
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
  pulseWorker("Security", 1000);
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
  pulseWorker("Updates", 1400);
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
   TOASTS
============================= */

function showToast(msg) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 5200);
}

/* =============================
   HERO HOST TICKER
   Cycles through connected device IPs, one at a time, BBS-roll-call style.
============================= */

let tickerDevices = [];
let tickerIndex = 0;
let tickerInterval = null;

function updateHostTicker(devices) {
  tickerDevices = devices;
  if (!tickerInterval) {
    tickerInterval = setInterval(renderTickerLine, 3200);
    renderTickerLine();
  }
}

function renderTickerLine() {
  const el = document.getElementById("hostTicker");
  if (!el) return;

  if (!tickerDevices.length) {
    el.textContent = "// scanning network...";
    return;
  }

  const d = tickerDevices[tickerIndex % tickerDevices.length];
  tickerIndex++;

  el.style.opacity = 0;
  setTimeout(() => {
    el.textContent = `// host online: ${d.ip}  ${d.hostname || d.vendor || ""}`;
    el.style.opacity = 1;
  }, 250);
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

/* rm -rf / -> a joke "deleting" sequence, self-dismisses */
let rmrfBuffer = "";
const rmrfScript = [
  "rm -rf / --no-preserve-root",
  "removing /bin...",
  "removing /etc...",
  "removing /home...",
  "removing /usr...",
];

window.addEventListener("keydown", (e) => {
  if (e.key.length === 1) {
    rmrfBuffer = (rmrfBuffer + e.key).slice(-24);
  }
  if (rmrfBuffer.replace(/\s/g, "").includes("rm-rf/")) {
    rmrfBuffer = "";
    triggerRmrfJoke();
  }
});

function triggerRmrfJoke() {
  const overlay = document.getElementById("rmrfOverlay");
  const linesEl = document.getElementById("rmrfLines");
  if (!overlay || !linesEl) return;

  linesEl.innerHTML = "";
  overlay.classList.add("active");

  rmrfScript.forEach((line, i) => {
    setTimeout(() => {
      const div = document.createElement("div");
      div.textContent = line;
      linesEl.appendChild(div);
    }, i * 350);
  });

  setTimeout(
    () => {
      const joke = document.createElement("div");
      joke.className = "rmrf-joke";
      joke.textContent = "just kidding — your pi is fine.";
      linesEl.appendChild(joke);

      const hint = document.createElement("div");
      hint.className = "rmrf-hint";
      hint.textContent = "// click anywhere to continue";
      linesEl.appendChild(hint);
    },
    rmrfScript.length * 350 + 300,
  );

  const dismiss = () => {
    overlay.classList.remove("active");
    overlay.removeEventListener("click", dismiss);
  };
  overlay.addEventListener("click", dismiss);
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
setInterval(updateMarketTicker, 60000);

update();
updateDevices();
updateAuthLog();
updatePackageCount();
updateMarketTicker();
