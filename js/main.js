const images = [
  "https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d",
  "https://images.unsplash.com/photo-1518770660439-4636190af475",
  "https://images.unsplash.com/photo-1558494949-ef010cbdcc31",
];

const titles = [
  "NEON SYSTEM ONLINE",
  "PI NEURAL NODE ACTIVE",
  "HOME LAB CONTROL GRID",
  "EXPERIMENTAL SERVER HUB",
];

/* ===== HERO ===== */
const img = images[Math.floor(Math.random() * images.length)];
const title = titles[Math.floor(Math.random() * titles.length)];

document.getElementById("heroImg").style.backgroundImage = `url('${img}')`;
document.getElementById("heroTitle").textContent = title;

/* ===== METRICS ===== */
async function updateMetrics() {
  try {
    const res = await fetch("http://reider:5050/api/stats");
    const data = await res.json();

    // CPU
    document.getElementById("cpuText").textContent = data.cpu_temp + "°C";
    document.getElementById("cpuBar").style.width =
      Math.min((data.cpu_temp / 85) * 100, 100) + "%";

    const cpuCard = document.getElementById("cpuCard");
    if (data.cpu_temp > 70) {
      cpuCard.classList.add("warning");
    } else {
      cpuCard.classList.remove("warning");
    }

    // UPTIME
    document.getElementById("uptimeText").textContent = data.uptime;

    // DISK
    const disk = parseInt(data.disk_usage);
    document.getElementById("diskText").textContent = data.disk_usage;
    document.getElementById("diskBar").style.width = disk + "%";

    // LOAD
    document.getElementById("loadText").textContent = data.load.join(" / ");
  } catch (e) {
    console.log("API offline", e);
  }
}

updateMetrics();
setInterval(updateMetrics, 3000);
