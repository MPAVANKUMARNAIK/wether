const API_KEY = "253702dc28ac2b78f0e64655eb0902db";
const GEO_KEY = "2245068427404af0b92ed9183b90f889";

const aqiEl = document.getElementById("aqi");
const statusTitle = document.getElementById("statusTitle");
const pollutantsDiv = document.getElementById("pollutants");
const historyTable = document.querySelector("#historyTable tbody");
const chartCanvas = document.getElementById("chart");
const aqiThreshold = document.getElementById("aqiThreshold");

let map, marker, chart;

navigator.geolocation.getCurrentPosition((pos) => {
    fetchAirData(pos.coords.latitude, pos.coords.longitude);
    initMap(pos.coords.latitude, pos.coords.longitude);
});

document.getElementById("citySearch").addEventListener("input", async (e) => {
    const text = e.target.value;
    const res = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${text}&limit=5&apiKey=${GEO_KEY}`
    );
    const data = await res.json();
    const suggestions = document.getElementById("suggestions");
    suggestions.innerHTML = "";
    data.features.forEach((f) => {
        const li = document.createElement("li");
        li.textContent = f.properties.formatted;
        li.onclick = () => {
            e.target.value = f.properties.formatted;
            suggestions.innerHTML = "";
            fetchAirData(f.properties.lat, f.properties.lon);
            map.setView([f.properties.lat, f.properties.lon], 11);
            marker.setLatLng([f.properties.lat, f.properties.lon]);
        };
        suggestions.appendChild(li);
    });
});

function fetchAirData(lat, lon) {
    fetch(
        `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`
    )
        .then((res) => res.json())
        .then((data) => {
            const d = data.list[0];
            updateUI(d, lat, lon);
            saveHistory(d.main.aqi, lat, lon);
            renderHistory();
        });
}

function updateUI(data, lat, lon) {
    const aqi = data.main.aqi;
    aqiEl.textContent = aqi;
    const colors = ["", "green", "yellow", "orange", "red", "purple"];
    statusTitle.style.color = colors[aqi];

    let html = "";
    for (let [key, val] of Object.entries(data.components)) {
        html += `<p>${key.toUpperCase()}: ${val}</p>`;
    }
    pollutantsDiv.innerHTML = html;

    if (aqi >= parseInt(aqiThreshold.value)) {
        if (Notification.permission === "granted") {
            new Notification("⚠️ Air Quality Alert", {
                body: `AQI is ${aqi} - Take precautions!`,
            });
        } else {
            Notification.requestPermission();
        }
    }

    drawChart(data.components);
}

function drawChart(components) {
    const labels = Object.keys(components);
    const values = Object.values(components);

    if (chart) chart.destroy();

    chart = new Chart(chartCanvas, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Pollutants",
                    data: values,
                    backgroundColor: "#87cefa",
                },
            ],
        },
    });
}

function initMap(lat, lon) {
    map = L.map("map").setView([lat, lon], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    marker = L.marker([lat, lon]).addTo(map);
}

function saveHistory(aqi, lat, lon) {
    const data = JSON.parse(localStorage.getItem("aqi_history") || "[]");
    data.unshift({ aqi, lat, lon, date: new Date().toLocaleString() });
    localStorage.setItem("aqi_history", JSON.stringify(data.slice(0, 10)));
}

function renderHistory() {
    const data = JSON.parse(localStorage.getItem("aqi_history") || "[]");
    historyTable.innerHTML = "";
    data.forEach((d) => {
        const row = `<tr><td>${d.date}</td><td>${d.lat.toFixed(2)},${d.lon.toFixed(
            2
        )}</td><td>${d.aqi}</td></tr>`;
        historyTable.innerHTML += row;
    });
}

document.getElementById("exportCSV").onclick = () => {
    const rows = [["Date", "Lat", "Lon", "AQI"]];
    const data = JSON.parse(localStorage.getItem("aqi_history") || "[]");
    data.forEach((d) => rows.push([d.date, d.lat, d.lon, d.aqi]));
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "air_quality_data.csv";
    link.click();
};

document.getElementById("exportPDF").onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Air Quality Report", 10, 10);
    const data = JSON.parse(localStorage.getItem("aqi_history") || "[]");
    data.forEach((d, i) => {
        doc.text(
            `${d.date} - (${d.lat.toFixed(2)}, ${d.lon.toFixed(2)}) AQI: ${d.aqi}`,
            10,
            20 + i * 10
        );
    });
    doc.save("air_quality_report.pdf");
};

document.getElementById("toggleDark").onclick = () => {
    document.body.classList.toggle("dark");
};
