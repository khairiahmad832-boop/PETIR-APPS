const ADMIN_ID = "admin";
const ADMIN_PASS = "qc123"; 
const BLYNK_TOKEN = "_Uc_SlWvcnKwlaBGhY5e0nv-_K6J4YGY";
const VIRTUAL_PIN = "V0";
// URL SCRIPT BARU ANDA
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzXnP7_5PSGM-UgE9wu8SaN6zyD5sCfso3FFWsITGroP8zTDgWxv6Z-RDIhE9OnMiWWzA/exec";

let TEMP_HIGH = parseFloat(localStorage.getItem('conf_high')) || 190.0;
let TEMP_LOW  = parseFloat(localStorage.getItem('conf_low'))  || 160.0;
let sessionData = [];
let chartInstance = null;
let currentDateKey = new Date().toISOString().slice(0, 10); 

async function loadCloudHistory() {
    document.getElementById('statusBadge').innerText = "SINKRONISASI CLOUD...";
    document.getElementById('statusBadge').className = "badge badge-loading";
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json(); 
        chartInstance.data.labels = []; chartInstance.data.datasets[0].data = []; sessionData = []; 
        data.forEach(d => {
            chartInstance.data.labels.push(d.time); chartInstance.data.datasets[0].data.push(d.temp);
            sessionData.push({ time: d.time, temp: d.temp });
        });
        chartInstance.update(); calculateStats();
        document.getElementById('statusBadge').innerText = "DATA TERHUBUNG";
    } catch (error) {
        console.error(error); document.getElementById('statusBadge').innerText = "CLOUD OFFLINE";
    }
}

function openSettings() { document.getElementById('inputHigh').value = TEMP_HIGH; document.getElementById('inputLow').value = TEMP_LOW; document.getElementById('settingsOverlay').style.display = 'flex'; }
function closeSettings() { document.getElementById('settingsOverlay').style.display = 'none'; }
function saveSettings() {
    const h = parseFloat(document.getElementById('inputHigh').value);
    const l = parseFloat(document.getElementById('inputLow').value);
    if (!isNaN(h) && !isNaN(l) && h > l) {
        TEMP_HIGH = h; TEMP_LOW = l; localStorage.setItem('conf_high', h); localStorage.setItem('conf_low', l);
        Swal.fire({icon: 'success', title: 'Tersimpan!', text: `Alarm: ${l}°C - ${h}°C`, timer: 2000, showConfirmButton: false});
        closeSettings();
    } else { Swal.fire('Error', 'Batas Atas harus lebih tinggi dari Bawah.', 'error'); }
}

function attemptLogin() {
    const u = document.getElementById('userid').value; const p = document.getElementById('password').value;
    if (u === ADMIN_ID && p === ADMIN_PASS) {
        document.getElementById('loginOverlay').style.display = 'none'; localStorage.setItem('petir_session', 'true'); initDashboard();
        Swal.fire({ icon: 'success', title: 'Welcome to PETIR', timer: 2000, showConfirmButton: false });
    } else { document.getElementById('loginError').innerText = "Akses Ditolak!"; }
}
function logout() { localStorage.removeItem('petir_session'); location.reload(); }
function checkSession() { if (localStorage.getItem('petir_session') === 'true') { document.getElementById('loginOverlay').style.display = 'none'; initDashboard(); } }

function initDashboard() {
    document.getElementById('datePicker').value = currentDateKey;
    const ctx = document.getElementById('tempChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Suhu (°C)', data: [], borderColor: '#facc15', backgroundColor: 'rgba(250, 204, 21, 0.1)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { grid: { color: '#334155' } } }, plugins: { legend: { display: false } } }
    });
    loadCloudHistory();
    setInterval(fetchBlynkData, 2000); setInterval(updateClock, 1000);
}

async function fetchBlynkData() {
    try {
        const response = await fetch(`https://blynk.cloud/external/api/get?token=${BLYNK_TOKEN}&${VIRTUAL_PIN}`);
        const text = await response.text(); const temp = parseFloat(text);
        if (!isNaN(temp)) updateUI(temp);
    } catch (error) { console.log("Offline mode"); }
}

function updateUI(temp) {
    const display = document.getElementById('tempValue'); const badge = document.getElementById('statusBadge');
    const timeStr = new Date().toLocaleTimeString();
    display.innerText = temp.toFixed(1); badge.className = "badge";
    if (temp >= TEMP_HIGH) { display.style.color = "#ef4444"; badge.classList.add("badge-danger"); badge.innerText = `BAHAYA: > ${TEMP_HIGH}°C`; }
    else if (temp <= TEMP_LOW && temp > 40) { display.style.color = "#facc15"; badge.classList.add("badge-warning"); badge.innerText = `WARNING: < ${TEMP_LOW}°C`; }
    else if (temp <= 40) { display.style.color = "#94a3b8"; badge.classList.add("badge-loading"); badge.innerText = "MODE: DINGIN"; }
    else { display.style.color = "#facc15"; badge.classList.add("badge-normal"); badge.innerText = "PETIR: STABIL"; }

    if (temp > 40) {
        chartInstance.data.labels.push(timeStr); chartInstance.data.datasets[0].data.push(temp);
        if (chartInstance.data.labels.length > 50) { chartInstance.data.labels.shift(); chartInstance.data.datasets[0].data.shift(); }
        chartInstance.update(); sessionData.push({ time: timeStr, temp: temp }); calculateStats();
    }
}

function calculateStats() {
    if (sessionData.length === 0) return;
    let min = 999, max = 0, total = 0;
    sessionData.forEach(d => { if (d.temp < min) min = d.temp; if (d.temp > max) max = d.temp; total += d.temp; });
    document.getElementById('minTemp').innerText = min.toFixed(1) + "°"; document.getElementById('maxTemp').innerText = max.toFixed(1) + "°";
    document.getElementById('avgTemp').innerText = (total / sessionData.length).toFixed(1) + "°";
}

function updateClock() { document.getElementById('clock').innerText = new Date().toLocaleTimeString(); }
function toggleMenu() { document.getElementById('sidebar').classList.toggle('open'); }
function downloadReport() {
    if (sessionData.length === 0) { Swal.fire('Info', 'Belum ada data.', 'info'); return; }
    const ws = XLSX.utils.json_to_sheet(sessionData); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data QC"); XLSX.writeFile(wb, `Laporan_PETIR_QC_${currentDateKey}.xlsx`);
}
function exportChart() {
    const canvas = document.getElementById('tempChart'); const link = document.createElement('a');
    link.download = `Grafik_PETIR_${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.png`;
    link.href = canvas.toDataURL('image/png', 1.0); link.click();
    Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'Grafik berhasil disimpan ke Galeri.', timer: 1500, showConfirmButton: false, toast: true, position: 'top-end' });
}
checkSession();
