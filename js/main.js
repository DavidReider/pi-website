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
  ctx.strokeStyle = "#00f5ff";
  ctx.lineWidth = 2;

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
   CONTROL ACTIONS
============================= */

async function restartApache() {
  await fetch(`${API}/api/restart-apache`);
}

async function rebootPi() {
  await fetch(`${API}/api/reboot`);
}

/* START */
setInterval(update, 3000);
update();
