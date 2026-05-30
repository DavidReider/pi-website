const API = "http://192.168.1.222:5050";

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
    document.getElementById("apiDot").classList.add("offline");
    document.getElementById("apiDot").classList.remove("online");
  }

  lock = false;
}

updateMetrics();
setInterval(updateMetrics, 3000);

/* CONTROL ACTIONS */

async function restartApache() {
  await fetch(`${API}/api/restart-apache`);
}

async function rebootPi() {
  await fetch(`${API}/api/reboot`);
}

async function triggerDeploy() {
  console.log("Deploy hook placeholder");
}
