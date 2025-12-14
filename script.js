// CONFIGURATION
const API_URL = "https://script.google.com/macros/s/AKfycbww8p0lReFHcGbS96z86iDUAMqJ8t1J_yi6XBfXAFQ3_mNRlFkYuPVm5c6MMiyy_ebxpw/exec"; 
const ADMIN_ID = "admin"; const ADMIN_PASS = "qc123";

// STATE VARIABLES
let myChart;
let globalConfig = { high: 190, low: 185 };
let isEditing = false;
let sessionData = [];
let audioEnabled = false;
let lastMidVal = 0;
let maintenanceHours = parseFloat(localStorage.getItem('petir_maint_hours')) || 0;

// SOUND ASSET
const alertSound = document.getElementById('alarmSound');

// --- 1. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Check Theme
    const savedTheme = localStorage.getItem('petir_theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    
    // Check Login
    if(localStorage.getItem('petir_session') === 'true') {
        document.getElementById('loginOverlay').style.display = 'none';
        startSystem();
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
    }
});

function startSystem() {
    initChart();
    fetchData(); // First load
    setInterval(fetchData, 3000); // Live loop
    
    // Clock
    setInterval(() => {
        const now = new Date();
        document.getElementById('clock').innerText = now.toLocaleTimeString('id-ID');
        
        // Update Session Time
        // (Simplified for demo)
    }, 1000);

    // Prevent Input Jump
    const inputs = document.querySelectorAll('input[type=number]');
    inputs.forEach(i => {
        i.addEventListener('focus', () => isEditing = true);
        i.addEventListener('blur', () => isEditing = false);
    });
    
    updateMaintUI();
}

// --- 2. CORE DATA FETCHING ---
async function fetchData() {
    try {
        const res = await fetch(API_URL + "?limit=50&nocache=" + Date.now());
        const json = await res.json();
        
        // A. SYNC CONFIG
        const cfg = json.config;
        globalConfig = cfg;
        if(!isEditing) {
            document.getElementById('inputHigh').value = cfg.high;
            document.getElementById('inputLow').value = cfg.low;
        }
        document.getElementById('configInfo').innerText = `Target: ${cfg.low} - ${cfg.high} °C`;

        // B. SYNC DATA
        if (json.data.length > 0) {
            updateConnectionStatus(true);
            const data = json.data;
            const latest = data[data.length - 1];
            const valMid = Number(latest.m);
            const valIn = Number(latest.i);
            const valOut = Number(latest.o);

            // Calculate Trend
            const trend = valMid - lastMidVal;
            updateTrendUI(trend);
            lastMidVal = valMid;

            // Increment Maintenance Counter (Simulated: 3 sec = 0.001 hour)
            maintenanceHours += 0.001;
            localStorage.setItem('petir_maint_hours', maintenanceHours);
            updateMaintUI();

            // Update UI Numbers
            updateValue('mainTemp', valMid.toFixed(1));
            updateValue('valIn', valIn.toFixed(1) + "°");
            updateValue('valOut', valOut.toFixed(1) + "°");

            // Status & Alarm Logic
            const statEl = document.getElementById('sysStatus');
            const mainCard = document.getElementById('cardMid');
            const tempEl = document.getElementById('mainTemp');

            if (valMid > cfg.high) {
                setAlarmState(true, "OVERHEAT", "#ef4444");
            } else if (valMid < cfg.low) {
                setAlarmState(true, "LOW TEMP", "#facc15");
            } else {
                setAlarmState(false, "NORMAL", "#4ade80");
            }

            // Chart Update
            const labels = data.map(d => new Date(d.t).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}));
            myChart.data.labels = labels;
            myChart.data.datasets[0].data = data.map(d => d.m);
            myChart.data.datasets[1].data = data.map(d => d.i);
            myChart.data.datasets[2].data = data.map(d => d.o);
            myChart.update();
        }
    } catch(e) {
        updateConnectionStatus(false);
    }
}

// --- 3. UI HELPERS ---
function updateValue(id, val) {
    const el = document.getElementById(id);
    el.innerText = val;
    el.classList.remove('skeleton', 'skeleton-text'); // Remove loading state
}

function setAlarmState(isAlarm, text, color) {
    const statEl = document.getElementById('sysStatus');
    const mainCard = document.getElementById('cardMid');
    const tempEl = document.getElementById('mainTemp');

    statEl.innerText = text;
    statEl.className = isAlarm ? "status-pill status-alarm" : "status-pill status-ok";
    tempEl.style.color = color;
    statEl.classList.remove('skeleton-pill');

    if(isAlarm) {
        mainCard.classList.add('alarm-active');
        if(audioEnabled) alertSound.play().catch(e=>{});
    } else {
        mainCard.classList.remove('alarm-active');
    }
}

function updateTrendUI(diff) {
    const el = document.getElementById('trendMid');
    if(diff > 0.1) {
        el.className = "trend-indicator trend-up";
        el.innerHTML = '<i class="fas fa-arrow-up"></i>';
    } else if(diff < -0.1) {
        el.className = "trend-indicator trend-down";
        el.innerHTML = '<i class="fas fa-arrow-down"></i>';
    } else {
        el.className = "trend-indicator flat";
        el.innerHTML = '<i class="fas fa-minus"></i>';
    }
}

function updateMaintUI() {
    const maxHours = 500;
    const percent = Math.min((maintenanceHours / maxHours) * 100, 100);
    document.getElementById('maintBar').style.width = percent + "%";
    document.getElementById('maintHours').innerText = Math.floor(maintenanceHours) + " Jam Run";
}

function updateConnectionStatus(online) {
    const dot = document.getElementById('connectionDot');
    const txt = document.getElementById('connectionText');
    if(online) {
        dot.className = "ping-dot online";
        txt.innerText = "Server Connected";
        txt.style.color = "#4ade80";
    } else {
        dot.className = "ping-dot";
        txt.innerText = "Reconnecting...";
        txt.style.color = "#ef4444";
    }
}

// --- 4. CHART SETUP ---
function initChart() {
    const ctx = document.getElementById('liveChart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(250, 204, 21, 0.4)');
    gradient.addColorStop(1, 'rgba(250, 204, 21, 0.0)');

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'MID', borderColor: '#facc15', backgroundColor: gradient, borderWidth: 3, fill: true, tension: 0.4, data: [] },
                { label: 'IN', borderColor: '#38bdf8', borderWidth: 1, borderDash: [5,5], tension: 0.4, pointRadius:0, data: [] },
                { label: 'OUT', borderColor: '#ef4444', borderWidth: 1, borderDash: [5,5], tension: 0.4, pointRadius:0, data: [] }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#64748b' } },
                y: { grid: { color: '#334155' }, ticks: { color: '#64748b' } }
            },
            plugins: { legend: { labels: { color: '#94a3b8' } } }
        }
    });
}

// --- 5. SYSTEM ACTIONS ---
function toggleSound() {
    audioEnabled = !audioEnabled;
    const btn = document.getElementById('btnSound');
    if(audioEnabled) {
        btn.innerHTML = '<i class="fas fa-volume-up" style="color:#4ade80"></i> <span>Suara Alarm: ON</span>';
        alertSound.play().then(()=>{alertSound.pause();alertSound.currentTime=0;}); // Unlock audio
    } else {
        btn.innerHTML = '<i class="fas fa-volume-mute"></i> <span>Suara Alarm: OFF</span>';
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        document.body.classList.add('kiosk-mode');
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
            document.body.classList.remove('kiosk-mode');
        }
    }
}

function toggleTheme() {
    const cur = document.body.getAttribute('data-theme');
    const next = cur === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('petir_theme', next);
}

function toggleSubmenu(id) {
    document.getElementById(id).classList.toggle('open');
    document.querySelector('.has-submenu').classList.toggle('open');
}

function switchTab(id) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.sidebar li').forEach(e => e.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
}

function attemptLogin() {
    const u = document.getElementById('userid').value;
    const p = document.getElementById('password').value;
    if(u===ADMIN_ID && p===ADMIN_PASS) {
        localStorage.setItem('petir_session', 'true');
        document.getElementById('loginOverlay').style.display = 'none';
        startSystem();
    } else {
        document.getElementById('loginError').innerText = "Access Denied";
    }
}

function logout() {
    localStorage.removeItem('petir_session');
    location.reload();
}

// --- 6. EXPORT & PDF (INDOFOOD STANDARD) ---
function exportCSV() {
    Swal.fire({title:'Exporting CSV...', didOpen:()=>Swal.showLoading()});
    fetch(API_URL + "?limit=2000").then(r=>r.json()).then(data=>{
        let csv = "Time,IN,MID,OUT,Status\n";
        data.forEach(d=>{
            csv += `${d.t},${d.i},${d.m},${d.o},${d.s}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'raw_data_petir.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        Swal.fire('Sukses', 'CSV Terdownload', 'success');
    });
}

function generateReport(hours) {
    // ... (GUNAKAN KODE PDF V10 DARI PESAN SEBELUMNYA DI SINI) ...
    // Saya ringkas agar tidak kepanjangan, tapi Anda tinggal copas fungsi createPDF yang sudah V10
    // dari history chat kita sebelumnya ke sini. Pastikan nama fungsinya generateReport.
    downloadPDF_V10(hours); 
}

// FUNGSI PDF V10 YG SUDAH FINAL (PASTE KE SINI)
async function downloadPDF_V10(hours) {
    Swal.fire({title:'Menyiapkan Laporan Resmi...', didOpen:()=>Swal.showLoading()});
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','mm','a4');
    
    const res = await fetch(API_URL + "?limit=2000");
    const json = await res.json();
    const data = json.data;
    
    const now = new Date();
    const cutoff = new Date(now.getTime() - (hours*3600000));
    const filtered = data.filter(d => new Date(d.t) >= cutoff);

    // HEADER
    doc.setFontSize(14); doc.setFont("helvetica","bold");
    doc.text("PT INDOFOOD CBP SUKSES MAKMUR Tbk", 14, 15);
    doc.setFontSize(10); doc.setFont("helvetica","normal");
    doc.text("DIVISI NOODLE - PABRIK CIBITUNG", 14, 20);
    
    doc.setFontSize(16); doc.setFont("helvetica","bold");
    doc.text("LAPORAN MONITORING SUHU FRYER", 105, 30, {align:"center"});
    doc.line(14, 33, 196, 33);

    // INFO
    doc.setFontSize(9); doc.setFont("helvetica","normal");
    doc.text(`Tanggal: ${now.toLocaleDateString('id-ID')}`, 14, 40);
    doc.text(`Line: PETIR-01`, 14, 45);
    doc.text(`Standar: ${globalConfig.low} - ${globalConfig.high} °C`, 120, 40);

    // TABLE
    const body = filtered.map(d => {
        let st = "OK";
        if(d.m > globalConfig.high) st="OVER"; else if(d.m < globalConfig.low) st="LOW";
        return [
            new Date(d.t).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}),
            "", Number(d.i).toFixed(1), Number(d.m).toFixed(1), Number(d.o).toFixed(1),
            "", "", "", "", "", "", st
        ];
    });

    doc.autoTable({
        startY: 50,
        head: [
            [{ content: 'FRYER (Monitoring CCP)', colSpan: 6, styles: { halign: 'center' } }, { content: 'Bukaan Valve', colSpan: 3, styles: { halign: 'center' } }, { content: 'Lainnya', colSpan: 3, styles: { halign: 'center' } }],
            ['Jam', 'RPM', 'In', 'Mid', 'Out', 'Lvl', 'In', 'Mid', 'Out', 'Goreng', 'Cooling', 'Ket']
        ],
        body: body,
        theme: 'grid',
        headStyles: {fillColor:[255,255,255], textColor:[0,0,0], lineColor:[0,0,0], lineWidth:0.1},
        styles: {lineColor:[0,0,0], lineWidth:0.1, textColor:[0,0,0], halign:'center', fontSize:7},
        didParseCell: function(data) {
            if(data.column.index===11 && data.cell.raw!=="OK") {
                data.cell.styles.textColor = [255,0,0]; data.cell.styles.fontStyle='bold';
            }
        }
    });

    // SIGNATURES
    let y = doc.lastAutoTable.finalY + 15;
    if(y > 250) { doc.addPage(); y=20; }
    
    doc.text("Dibuat Oleh,", 30, y); doc.text("Diperiksa Oleh,", 90, y); doc.text("Diketahui Oleh,", 150, y);
    y+=20;
    doc.setFont("helvetica","bold");
    doc.text("( Operator Fryer )", 30, y); 
    doc.text("( Section Produksi )", 90, y); 
    doc.text("( Supervisor QC )", 150, y);

    doc.save(`Laporan_Resmi_${now.getTime()}.pdf`);
    Swal.fire('Selesai', 'Laporan PDF Resmi Terunduh', 'success');
}

// Config Functions
function openSettings() { document.getElementById('settingsOverlay').style.display = 'flex'; }
function closeSettings() { document.getElementById('settingsOverlay').style.display = 'none'; }
async function saveConfig() {
    const h = document.getElementById('inputHigh').value;
    const l = document.getElementById('inputLow').value;
    try {
        await fetch(API_URL, { method:'POST', body:JSON.stringify({action:"updateConfig", high:h, low:l}) });
        Swal.fire('Sukses', 'Setting Tersimpan', 'success'); closeSettings();
    } catch(e) {}
}
function showShiftPopup(type) { document.getElementById('shiftOverlay').style.display = 'flex'; }
