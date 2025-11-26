const ADMIN_ID = "admin";
const ADMIN_PASS = "qc123"; 
const BLYNK_TOKEN = "_Uc_SlWvcnKwlaBGhY5e0nv-_K6J4YGY";
const VIRTUAL_PIN_TEMP = "V0";
const VIRTUAL_PIN_HIGH = "V1";
const VIRTUAL_PIN_LOW  = "V2";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzXnP7_5PSGM-UgE9wu8SaN6zyD5sCfso3FFWsITGroP8zTDgWxv6Z-RDIhE9OnMiWWzA/exec";

let TEMP_HIGH = parseFloat(localStorage.getItem('conf_high')) || 190.0;
let TEMP_LOW  = parseFloat(localStorage.getItem('conf_low'))  || 160.0;
let sessionData = [];
let chartInstance = null;
let currentDateKey = new Date().toISOString().slice(0, 10); 
let selectedReportType = ''; // Menyimpan tipe laporan yang dipilih (excel/pdf)

// === 1. CLOUD SYNC ===
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
    } catch (error) { console.error(error); document.getElementById('statusBadge').innerText = "CLOUD OFFLINE"; }
}

// === 2. SETTINGS & SYNC ===
async function syncSettingsFromBlynk() {
    try {
        const resHigh = await fetch(`https://blynk.cloud/external/api/get?token=${BLYNK_TOKEN}&${VIRTUAL_PIN_HIGH}`);
        const valHigh = parseFloat(await resHigh.text());
        const resLow = await fetch(`https://blynk.cloud/external/api/get?token=${BLYNK_TOKEN}&${VIRTUAL_PIN_LOW}`);
        const valLow = parseFloat(await resLow.text());
        let updated = false;
        if (!isNaN(valHigh) && valHigh !== TEMP_HIGH && valHigh > 0) { TEMP_HIGH = valHigh; localStorage.setItem('conf_high', valHigh); updated = true; }
        if (!isNaN(valLow) && valLow !== TEMP_LOW && valLow > 0) { TEMP_LOW = valLow; localStorage.setItem('conf_low', valLow); updated = true; }
        if (updated) {
            if(document.getElementById('settingsOverlay').style.display === 'flex') { document.getElementById('inputHigh').value = TEMP_HIGH; document.getElementById('inputLow').value = TEMP_LOW; }
            Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'info', title: 'Konfigurasi Diupdate', text: `Batas Suhu disinkronkan: ${TEMP_LOW}°C - ${TEMP_HIGH}°C` });
        }
    } catch (error) { console.warn("Gagal sync setting dari Blynk"); }
}

function openSettings() { document.getElementById('inputHigh').value = TEMP_HIGH; document.getElementById('inputLow').value = TEMP_LOW; document.getElementById('settingsOverlay').style.display = 'flex'; }
function closeSettings() { document.getElementById('settingsOverlay').style.display = 'none'; }
async function saveSettings() {
    const h = parseFloat(document.getElementById('inputHigh').value); const l = parseFloat(document.getElementById('inputLow').value);
    if (!isNaN(h) && !isNaN(l) && h > l) {
        TEMP_HIGH = h; TEMP_LOW = l; localStorage.setItem('conf_high', h); localStorage.setItem('conf_low', l);
        Swal.fire({ title: 'Menyimpan...', didOpen: () => { Swal.showLoading() } });
        try {
            await fetch(`https://blynk.cloud/external/api/update?token=${BLYNK_TOKEN}&${VIRTUAL_PIN_HIGH}=${h}`);
            await fetch(`https://blynk.cloud/external/api/update?token=${BLYNK_TOKEN}&${VIRTUAL_PIN_LOW}=${l}`);
            Swal.fire({icon: 'success', title: 'Tersimpan & Sinkron!', text: `Setting aktif: ${l}°C - ${h}°C`, timer: 2000, showConfirmButton: false}); closeSettings();
        } catch (error) { Swal.fire('Warning', 'Tersimpan di sini, tapi gagal kirim ke Cloud.', 'warning'); closeSettings(); }
    } else { Swal.fire('Error', 'Angka tidak valid!', 'error'); }
}

// === 3. LOGIN ===
function attemptLogin() {
    const u = document.getElementById('userid').value; const p = document.getElementById('password').value;
    if (u === ADMIN_ID && p === ADMIN_PASS) {
        document.getElementById('loginOverlay').style.display = 'none'; localStorage.setItem('petir_session', 'true'); initDashboard();
        Swal.fire({ icon: 'success', title: 'Welcome to PETIR', timer: 2000, showConfirmButton: false });
    } else { document.getElementById('loginError').innerText = "Akses Ditolak!"; }
}
function logout() { localStorage.removeItem('petir_session'); location.reload(); }
function checkSession() { if (localStorage.getItem('petir_session') === 'true') { document.getElementById('loginOverlay').style.display = 'none'; initDashboard(); } }

// === 4. DASHBOARD ===
function initDashboard() {
    document.getElementById('datePicker').value = currentDateKey;
    const ctx = document.getElementById('tempChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Suhu (°C)', data: [], borderColor: '#facc15', backgroundColor: 'rgba(250, 204, 21, 0.1)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { grid: { color: '#334155' } } }, plugins: { legend: { display: false } } }
    });
    loadCloudHistory();
    setInterval(fetchBlynkData, 2000); setInterval(syncSettingsFromBlynk, 5000); setInterval(updateClock, 1000);
}

async function fetchBlynkData() {
    const today = new Date().toISOString().slice(0, 10);
    if (document.getElementById('datePicker').value !== today) return;
    try {
        const response = await fetch(`https://blynk.cloud/external/api/get?token=${BLYNK_TOKEN}&${VIRTUAL_PIN_TEMP}`);
        const text = await response.text(); const temp = parseFloat(text);
        if (!isNaN(temp)) updateUI(temp);
    } catch (error) { console.log("Offline mode"); }
}

function updateUI(temp) {
    const display = document.getElementById('tempValue'); const badge = document.getElementById('statusBadge');
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour12: false });
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
function exportChart() {
    const canvas = document.getElementById('tempChart'); const link = document.createElement('a');
    link.download = `Grafik_PETIR_${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.png`;
    link.href = canvas.toDataURL('image/png', 1.0); link.click();
    Swal.fire({ icon: 'success', title: 'Tersimpan!', timer: 1500, showConfirmButton: false, toast: true, position: 'top-end' });
}

// ============================================================
// E. FITUR LAPORAN (DENGAN PILIHAN INTERVAL) - BARU!
// ============================================================

// 1. Tampilkan Pop-up Pilihan
function showIntervalPopup(type) {
    if (sessionData.length === 0) { Swal.fire('Info', 'Belum ada data untuk dilaporkan.', 'info'); return; }
    selectedReportType = type; // Simpan tipe (excel/pdf)
    document.getElementById('intervalOverlay').style.display = 'flex';
}

function closeIntervalPopup() {
    document.getElementById('intervalOverlay').style.display = 'none';
}

// 2. Eksekusi Laporan Berdasarkan Pilihan
function generateReportWithInterval(intervalMinutes) {
    closeIntervalPopup();
    Swal.fire({ title: 'Memproses Laporan...', text: `Interval: ${intervalMinutes} Menit`, didOpen: () => { Swal.showLoading() } });

    // Filter data berdasarkan interval yang dipilih
    let filteredData = filterDataByInterval(sessionData, intervalMinutes);

    if (selectedReportType === 'excel') {
        processExcelDownload(filteredData, intervalMinutes);
    } else if (selectedReportType === 'pdf') {
        processPDFDownload(filteredData, intervalMinutes);
    }
}

// --- Fungsi Filter Dinamis (The Magic!) ---
function filterDataByInterval(data, interval) {
    let filtered = [];
    let lastTimeBucket = "";

    data.forEach(d => {
        let parts = d.time.split(":");
        let menit = parseInt(parts[1]);
        let jam = parts[0];
        
        // Hitung "Bucket" waktu. Contoh interval 30 menit: Bucket 0 (menit 0-29), Bucket 1 (menit 30-59)
        let bucketIndex = Math.floor(menit / interval);
        let timeBucket = jam + ":" + bucketIndex;

        // Ambil data pertama yang masuk ke bucket ini
        if (timeBucket !== lastTimeBucket) {
            filtered.push(d);
            lastTimeBucket = timeBucket;
        }
    });
    // Fallback jika data sangat sedikit
    return filtered.length > 0 ? filtered : data;
}


// 3. Proses Download Excel
function processExcelDownload(filteredData, interval) {
    const ws_data = [
        ["PT INDOFOOD CBP SUKSES MAKMUR Tbk", "", "", "", "", "", "", "", "", "Kode Form : PROD - 158"],
        ["DIVISI NOODLE - PABRIK CIBITUNG", "", "", "", "", "", "", "", "", "No. Terbitan : 1.0"],
        [""], ["LAPORAN MONITORING PROSES FRYER & COOLER (SISTEM PETIR)", "", "", "", "", "", "", "", "", ""], 
        ["Interval Data: Setiap " + interval + " Menit"], 
        ["Line : PETIR-01", "", "Tanggal : " + new Date().toLocaleDateString('id-ID'), "", "", "", "Flavour : 1. ...................."], 
        ["Regu : A / B / C", "", "Shift : I / II / III", "", "", "", "          2. ...................."],
        [""], 
        ["Jam", "RPM", "FRYER (Monitoring CCP)", "", "", "", "Bukaan Valve", "", "", "Waktu", "COOLER", "Jenis Cemaran"],
        ["", "Cutter", "Suhu In", "Suhu Mid", "Suhu Out", "Level MG", "In (%)", "Mid (%)", "Out (%)", "Goreng", "Waktu Cooling", ""],
        ["", "", "(°C)", "(°C)", "(°C)", "(cm)", "", "", "", "(detik)", "(detik)", ""]
    ];
    filteredData.forEach(data => { ws_data.push([data.time.substring(0, 5), "", "", data.temp, "", "", "", "", "", "", "", ""]); });
    ws_data.push([""]); ws_data.push(["Standard Proses :", "", "", "", "", "", "Bukaan Valve", "In =", "%"]);
    ws_data.push(["RPM Cutter =", "", "", "", "", "", "", "Mid =", "%"]);
    ws_data.push(["Suhu Fryer", "In =", "°C", "", "", "", "", "Out =", "%"]);
    ws_data.push(["(PETIR AUTO)", "Mid =", TEMP_LOW + "-" + TEMP_HIGH, "", "", "", "Waktu goreng =", "detik"]);
    ws_data.push(["", "Out =", "°C", "", "", "", "Waktu cooling =", "detik"]);
    ws_data.push(["Level MG =", "cm"]);
    ws_data.push([""]); ws_data.push(["Dibuat Oleh,", "", "", "Diperiksa Oleh,", "", "", "Diketahui Oleh,"]);
    ws_data.push(["", "", "", "", "", "", ""]); ws_data.push(["", "", "", "", "", "", ""]);
    ws_data.push(["( Opr. Fryer )", "", "", "( Section Produksi )", "", "", "( Supervisor Produksi )"]);

    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!merges'] = [ { s: {r:0, c:0}, e: {r:0, c:3} }, { s: {r:3, c:0}, e: {r:3, c:8} }, { s: {r:4, c:0}, e: {r:4, c:3} }, { s: {r:9, c:2}, e: {r:9, c:5} }, { s: {r:9, c:6}, e: {r:9, c:8} }, { s: {r:ws_data.length-4, c:0}, e: {r:ws_data.length-4, c:2} }, { s: {r:ws_data.length-4, c:3}, e: {r:ws_data.length-4, c:5} } ];
    ws['!cols'] = [ { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 15 } ];
    XLSX.utils.book_append_sheet(wb, ws, "Laporan QC");
    XLSX.writeFile(wb, `Laporan_PETIR_(${interval}min)_${currentDateKey}.xlsx`);
    Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Laporan Excel diunduh!' });
}

// 4. Proses Download PDF
function processPDFDownload(filteredData, interval) {
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("PT INDOFOOD CBP SUKSES MAKMUR Tbk", 14, 15);
    doc.setFont("helvetica", "normal"); doc.text("DIVISI NOODLE - PABRIK CIBITUNG", 14, 20);
    doc.setFontSize(9); doc.text("Kode Form : PROD - 158", 150, 15); doc.text("No. Terbitan : 1.0", 150, 20);
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("LAPORAN MONITORING PROSES FRYER & COOLER", 105, 30, null, null, "center");
    doc.text("(SISTEM PETIR)", 105, 35, null, null, "center");
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(`Interval Data: Setiap ${interval} Menit`, 105, 40, null, null, "center");
    doc.setLineWidth(0.5); doc.line(14, 42, 196, 42);

    let tgl = new Date().toLocaleDateString('id-ID');
    doc.text(`Line : PETIR-01`, 14, 50); doc.text(`Tanggal : ${tgl}`, 80, 50);
    doc.text(`Regu : A / B / C`, 14, 55); doc.text(`Shift : I / II / III`, 14, 60);

    let tableBody = filteredData.map(d => [ d.time.substring(0, 5), "", "", d.temp, "", "", "", "", "", "", "", "" ]);
    doc.autoTable({
        startY: 65,
        head: [
            [{ content: 'FRYER (Monitoring CCP)', colSpan: 6, styles: { halign: 'center' } }, { content: 'Bukaan Valve', colSpan: 3, styles: { halign: 'center' } }, { content: 'Lainnya', colSpan: 3, styles: { halign: 'center' } }],
            ['Jam', 'RPM', 'In', 'Mid', 'Out', 'Lvl', 'In', 'Mid', 'Out', 'Goreng', 'Cooling', 'Ket'],
            ['', '', '(°C)', '(°C)', '(°C)', '(cm)', '%', '%', '%', 'Detik', 'Detik', '']
        ],
        body: tableBody, theme: 'grid', styles: { fontSize: 8, cellPadding: 1, halign: 'center' },
        headStyles: { fillColor: [22, 160, 133], textColor: 255, fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 12 }, 3: { fontStyle: 'bold', textColor: [0, 0, 0] } }
    });

    let finalY = doc.lastAutoTable.finalY + 10;
    doc.setDrawColor(0); doc.setFillColor(240, 240, 240); doc.rect(14, finalY, 182, 35, 'FD');
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text("STANDARD PROSES ( AUTO CHECK):", 16, finalY + 5);
    doc.setFont("helvetica", "normal"); doc.text(`1. Suhu Fryer MID : ${TEMP_LOW} - ${TEMP_HIGH} °C`, 16, finalY + 12);
    doc.text("2. Suhu Fryer IN  : ........ °C", 16, finalY + 17); doc.text("3. Suhu Fryer OUT : ........ °C", 16, finalY + 22);
    doc.text("5. RPM Cutter     : ........", 90, finalY + 12); doc.text("6. Waktu Goreng   : ........ detik", 90, finalY + 17);
    
    let ttdY = finalY + 45;
    doc.text("Dibuat Oleh,", 30, ttdY); doc.text("Diperiksa Oleh,", 90, ttdY); doc.text("Diketahui Oleh,", 150, ttdY);
    doc.setFont("helvetica", "bold"); doc.text("( Opr. Fryer )", 30, ttdY + 20); doc.text("( Section Produksi )", 90, ttdY + 20); doc.text("( Supervisor Produksi )", 150, ttdY + 20);
    doc.save(`Laporan_PETIR_PDF_(${interval}min)_${currentDateKey}.pdf`);
    Swal.fire({ icon: 'success', title: 'PDF Siap!', text: 'Laporan PDF berhasil di-generate.' });
}

checkSession();
