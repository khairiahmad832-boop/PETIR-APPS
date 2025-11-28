const ADMIN_ID = "admin"; const ADMIN_PASS = "qc123"; 
const BLYNK_TOKEN = "_Uc_SlWvcnKwlaBGhY5e0nv-_K6J4YGY";
const PINS = { MID_H: "V1", MID_L: "V2", IN_H: "V5", IN_L: "V6", OUT_H: "V7", OUT_L: "V8", VAL_MID: "V0" };
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzXnP7_5PSGM-UgE9wu8SaN6zyD5sCfso3FFWsITGroP8zTDgWxv6Z-RDIhE9OnMiWWzA/exec";

let cfg = JSON.parse(localStorage.getItem('petir_cfg')) || { inH: 190, inL: 160, midH: 190, midL: 160, outH: 190, outL: 160 };
let sessionData = [];
let chartInstance = null;
let currentDateKey = new Date().toISOString().slice(0, 10); 
let selectedReportType = '';

// 1. CLOUD SYNC
async function loadCloudHistory() {
    document.getElementById('statusBadge').innerText = "SINKRONISASI CLOUD...";
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json(); 
        chartInstance.data.labels = []; chartInstance.data.datasets[0].data = []; 
        chartInstance.data.datasets[1].data = []; chartInstance.data.datasets[2].data = [];
        sessionData = []; 

        data.forEach(d => {
            chartInstance.data.labels.push(d.time);
            chartInstance.data.datasets[0].data.push(d.mid);
            chartInstance.data.datasets[1].data.push(d.in);
            chartInstance.data.datasets[2].data.push(d.out);
            sessionData.push(d);
        });
        chartInstance.update(); calculateStats();
        document.getElementById('statusBadge').innerText = "DATA TERHUBUNG";
    } catch (e) { document.getElementById('statusBadge').innerText = "CLOUD OFFLINE"; }
}

// 2. SETTINGS
function openSettings() {
    document.getElementById('inH').value = cfg.inH; document.getElementById('inL').value = cfg.inL;
    document.getElementById('midH').value = cfg.midH; document.getElementById('midL').value = cfg.midL;
    document.getElementById('outH').value = cfg.outH; document.getElementById('outL').value = cfg.outL;
    document.getElementById('settingsOverlay').style.display = 'flex';
}
function closeSettings() { document.getElementById('settingsOverlay').style.display = 'none'; }

async function saveSettings() {
    let newCfg = {
        inH: parseFloat(document.getElementById('inH').value), inL: parseFloat(document.getElementById('inL').value),
        midH: parseFloat(document.getElementById('midH').value), midL: parseFloat(document.getElementById('midL').value),
        outH: parseFloat(document.getElementById('outH').value), outL: parseFloat(document.getElementById('outL').value)
    };
    Swal.fire({ title: 'Sync ke Alat...', didOpen: () => Swal.showLoading() });
    try {
        const updates = [
            fetch(`https://blynk.cloud/external/api/update?token=${BLYNK_TOKEN}&${PINS.IN_H}=${newCfg.inH}`),
            fetch(`https://blynk.cloud/external/api/update?token=${BLYNK_TOKEN}&${PINS.IN_L}=${newCfg.inL}`),
            fetch(`https://blynk.cloud/external/api/update?token=${BLYNK_TOKEN}&${PINS.MID_H}=${newCfg.midH}`),
            fetch(`https://blynk.cloud/external/api/update?token=${BLYNK_TOKEN}&${PINS.MID_L}=${newCfg.midL}`),
            fetch(`https://blynk.cloud/external/api/update?token=${BLYNK_TOKEN}&${PINS.OUT_H}=${newCfg.outH}`),
            fetch(`https://blynk.cloud/external/api/update?token=${BLYNK_TOKEN}&${PINS.OUT_L}=${newCfg.outL}`)
        ];
        await Promise.all(updates);
        cfg = newCfg; localStorage.setItem('petir_cfg', JSON.stringify(cfg));
        Swal.fire({ icon: 'success', title: 'Sukses!', timer: 2000, showConfirmButton: false }); closeSettings();
    } catch (e) { Swal.fire('Error', 'Gagal koneksi Cloud.', 'error'); }
}

// 3. LAPORAN SHIFT
function showShiftPopup(type) {
    if (sessionData.length === 0) { Swal.fire('Info', 'Belum ada data.', 'info'); return; }
    selectedReportType = type; document.getElementById('shiftOverlay').style.display = 'flex';
}

function generateShiftReport(hours) {
    document.getElementById('shiftOverlay').style.display = 'none';
    Swal.fire({ title: `Memproses Laporan ${hours} Jam...`, didOpen: () => Swal.showLoading() });

    let reportData = [];
    let count = 0;
    let lastHour = -1;

    sessionData.forEach(d => {
        if (count >= hours) return;
        let parts = d.time.split(":");
        let jam = parseInt(parts[0]);
        let menit = parseInt(parts[1]);

        if (jam !== lastHour && menit <= 10) { // Toleransi 10 menit awal jam
            reportData.push(d);
            lastHour = jam;
            count++;
        }
    });

    if (selectedReportType === 'excel') createExcel(reportData, hours);
    else createPDF(reportData, hours);
}

function createExcel(data, hours) {
    const ws_data = [
        ["PT INDOFOOD CBP SUKSES MAKMUR Tbk", "", "", "", "", "", "", "", "", "Kode Form : PROD - 158"],
        ["DIVISI NOODLE - PABRIK CIBITUNG", "", "", "", "", "", "", "", "", "No. Terbitan : 1.0"],
        [""], ["LAPORAN SHIFT (" + hours + " JAM KERJA)", "", "", "", "", "", "", "", "", ""], 
        ["Interval: 1 Jam Sekali"], 
        ["Line : PETIR-01", "", "Tanggal : " + new Date().toLocaleDateString('id-ID'), "", "", "", "Flavour : ...................."], 
        ["Regu : A / B / C", "", "Shift : I / II / III", "", "", "", "          ...................."], [""]
        ["Jam", "RPM", "FRYER (Monitoring CCP)", "", "", "", "Bukaan Valve", "", "", "Waktu", "COOLER", "Jenis Cemaran"],
        ["", "Cutter", "Suhu In", "Suhu Mid", "Suhu Out", "Level MG", "In (%)", "Mid (%)", "Out (%)", "Goreng", "Waktu Cooling", ""],
        ["", "", "(°C)", "(°C)", "(°C)", "(cm)", "", "", "", "(detik)", "(detik)", ""]
    ];
    data.forEach(d => {
        ws_data.push([ d.time.substring(0,5), "", d.in, d.mid, d.out, "", "", "", "", "", "", "" ]);
    });
    ws_data.push([""]); ws_data.push(["Dibuat Oleh,", "", "", "Diperiksa Oleh,", "", "", "Diketahui Oleh,"]);
    ws_data.push(["", "", "", "", "", "", ""]); ws_data.push(["", "", "", "", "", "", ""]);
    ws_data.push(["( Fryer )", "", "", "( Section Produksi )", "", "", "( Supervisor Produksi )"]);

    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!merges'] = [ { s: {r:0, c:0}, e: {r:0, c:3} }, { s: {r:3, c:0}, e: {r:3, c:8} }, { s: {r:4, c:0}, e: {r:4, c:3} }, { s: {r:9, c:2}, e: {r:9, c:5} }, { s: {r:9, c:6}, e: {r:9, c:8} }, { s: {r:ws_data.length-4, c:0}, e: {r:ws_data.length-4, c:2} }, { s: {r:ws_data.length-4, c:3}, e: {r:ws_data.length-4, c:5} } ];
    ws['!cols'] = [ { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 15 } ];
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Shift");
    XLSX.writeFile(wb, `Laporan_Shift_${hours}Jam.xlsx`);
    Swal.fire('Selesai', 'Laporan Excel Terunduh', 'success');
}

function createPDF(data, hours) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("PT INDOFOOD CBP SUKSES MAKMUR Tbk", 14, 15);
    doc.setFont("helvetica", "normal"); doc.text("DIVISI NOODLE - PABRIK CIBITUNG", 14, 20);
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text(`LAPORAN PRODUKSI SHIFT (${hours} JAM)`, 105, 30, null, null, "center");
    let tgl = new Date().toLocaleDateString('id-ID');
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(`Line: PETIR-01 | Tanggal: ${tgl} | Shift: I/II/III`, 14, 40);

    let tableBody = data.map(d => [ d.time.substring(0,5), "", d.in, d.mid, d.out, "", "", "", "", "", "", "" ]);
    doc.autoTable({
        startY: 45,
        head: [
            [{ content: 'FRYER (Monitoring CCP)', colSpan: 6, styles: { halign: 'center' } }, { content: 'Bukaan Valve', colSpan: 3, styles: { halign: 'center' } }, { content: 'Lainnya', colSpan: 3, styles: { halign: 'center' } }],
            ['Jam', 'RPM', 'In', 'Mid', 'Out', 'Lvl', 'In', 'Mid', 'Out', 'Goreng', 'Cooling', 'Ket'],
            ['', '', '(°C)', '(°C)', '(°C)', '(cm)', '%', '%', '%', 'Detik', 'Detik', '']
        ],
        body: tableBody, theme: 'grid', styles: { fontSize: 8, cellPadding: 1, halign: 'center' },
        headStyles: { fillColor: [22, 160, 133] }
    });
    
    let finalY = doc.lastAutoTable.finalY + 20;
    doc.text("Dibuat Oleh,", 30, finalY); doc.text("Diperiksa Oleh,", 90, finalY); doc.text("Diketahui Oleh,", 150, finalY);
    doc.setFont("helvetica", "bold"); doc.text("( Fryer )", 30, finalY + 20); doc.text("( Section Prod )", 90, finalY + 20); doc.text("( SPV Prod )", 150, finalY + 20);
    doc.save(`Laporan_Shift_${hours}Jam.pdf`);
    Swal.fire('Selesai', 'Laporan PDF Terunduh', 'success');
}

// 4. CORE
function initDashboard() {
    document.getElementById('datePicker').value = currentDateKey;
    const ctx = document.getElementById('tempChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'MID', data: [], borderColor: '#facc15', borderWidth: 2, fill: false },
                { label: 'IN', data: [], borderColor: '#38bdf8', borderWidth: 2, borderDash: [5, 5], fill: false },
                { label: 'OUT', data: [], borderColor: '#ef4444', borderWidth: 2, borderDash: [5, 5], fill: false }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { grid: { color: '#334155' } } } }
    });
    loadCloudHistory();
    setInterval(fetchBlynkData, 2000); setInterval(updateClock, 1000);
}

async function fetchBlynkData() {
    try {
        const response = await fetch(`https://blynk.cloud/external/api/get?token=${BLYNK_TOKEN}&${PINS.VAL_MID}`);
        const text = await response.text(); const temp = parseFloat(text);
        if (!isNaN(temp)) {
            document.getElementById('tempValue').innerText = temp.toFixed(1);
            let badge = document.getElementById('statusBadge');
            if(temp >= cfg.midH) { badge.className="badge badge-danger"; badge.innerText="OVERHEAT"; }
            else if(temp <= cfg.midL && temp > 40) { badge.className="badge badge-warning"; badge.innerText="DROP"; }
            else { badge.className="badge badge-normal"; badge.innerText="STABIL"; }
        }
    } catch (e) {}
}

function calculateStats() {
    if (sessionData.length === 0) return;
    let min=999, max=0, total=0;
    sessionData.forEach(d => { if(d.mid<min) min=d.mid; if(d.mid>max) max=d.mid; total+=d.mid; });
    document.getElementById('minTemp').innerText = min.toFixed(1)+"°"; document.getElementById('maxTemp').innerText = max.toFixed(1)+"°";
    document.getElementById('avgTemp').innerText = (total/sessionData.length).toFixed(1)+"°";
}

function attemptLogin() {
    if (document.getElementById('userid').value === ADMIN_ID && document.getElementById('password').value === ADMIN_PASS) {
        document.getElementById('loginOverlay').style.display = 'none'; localStorage.setItem('petir_session', 'true'); initDashboard();
    } else document.getElementById('loginError').innerText = "Gagal Login";
}
function logout() { localStorage.removeItem('petir_session'); location.reload(); }
function checkSession() { if (localStorage.getItem('petir_session') === 'true') { document.getElementById('loginOverlay').style.display = 'none'; initDashboard(); } }
function updateClock() { document.getElementById('clock').innerText = new Date().toLocaleTimeString(); }
function toggleMenu() { document.getElementById('sidebar').classList.toggle('open'); }
function exportChart() {
    const canvas = document.getElementById('tempChart'); const link = document.createElement('a');
    link.download = `Grafik_PETIR_${Date.now()}.png`; link.href = canvas.toDataURL('image/png', 1.0); link.click();
}

checkSession();
