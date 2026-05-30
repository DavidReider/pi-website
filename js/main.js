const API = "http://192.168.1.222:5050";

/* HERO */
const images = [
  "https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc?auto=format&fit=crop&w=1200&q=60",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=60",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=60",
];

document.getElementById("heroImg").style.backgroundImage =
  `url('${images[Math.floor(Math.random() * images.length)]}')`;

/* METRICS LOOP */
let lock = false;

async function updateMetrics() {
  if (lock) return;
  lock = true;

  try {
    const res = await fetch(`${API}/api/stats`);
    const data = await res.json();

    document.getElementById("apiDot").classList.add("online");

    document.getElementById("hudCpu").textContent = data.cpu_temp;
    document.getElementById("hudLoad").textContent = data.load.join("-");
    document.getElementById("hudPing").textContent = data.ping;

    document.getElementById("cpuText").textContent = data.cpu_temp + "°C";

    const circle = document.getElementById("cpuCircle");
    const percent = Math.min(data.cpu_temp / 85, 1);
    circle.style.strokeDashoffset = 251 - 251 * percent;

    document.getElementById("uptimeText").textContent = data.uptime;

    const disk = parseInt(data.disk_usage);
    document.getElementById("diskBar").style.width = disk + "%";
    document.getElementById("diskText").textContent = data.disk_usage;

    document.getElementById("loadText").textContent = data.load.join(" / ");
  } catch (e) {
    document.getElementById("apiDot").classList.remove("online");
  }

  lock = false;
}

/* CONTROLS */
async function restartApache() {
  await fetch(`${API}/api/restart-apache`);
}

async function rebootPi() {
  await fetch(`${API}/api/reboot`);
}

async function triggerDeploy() {
  console.log("deploy");
}

updateMetrics();
setInterval(updateMetrics, 3000);
