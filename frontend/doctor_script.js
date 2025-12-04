// Final Doctor Portal Logic - Dedicated Script
const _DEFAULT_API = 'http://localhost:3000';
let API_BASE = _DEFAULT_API;
try {
    const origin = window.location && window.location.origin ? window.location.origin : '';
    // Common Live Server origin includes :5500; if detected, use backend default
    if (origin.includes(':5500') || origin.includes('127.0.0.1:5500')) {
        API_BASE = _DEFAULT_API;
        console.warn('Detected Live Server origin; using API_BASE fallback ->', API_BASE);
    } else if (origin) {
        API_BASE = origin;
    }
} catch (e) {
    API_BASE = _DEFAULT_API;
}
// Helpful debug: show exactly which API base the frontend will use
// DEV: force backend during local development to avoid Live Server origin problems
API_BASE = 'http://localhost:3000';
console.info('DEV FORCE: API_BASE resolved to ->', API_BASE);
let currentDoctor = null;

// --- Custom Modal Handlers (Uses Bootstrap modal) ---
let actionModalInstance = null;

function getModal() {
    if (!actionModalInstance) {
        const modalElement = document.getElementById('actionModal');
        const isBootstrapDefined = typeof bootstrap !== 'undefined';
        
        if (modalElement && isBootstrapDefined) {
            actionModalInstance = new bootstrap.Modal(modalElement);
        }
    }
    return actionModalInstance;
}

function showCustomModal(title, body, isConfirmation = false, onConfirm = () => {}) {
    const labelEl = document.getElementById('actionModalLabel');
    const bodyEl = document.getElementById('actionModalBody');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    if (!labelEl || !bodyEl || !confirmBtn || !cancelBtn) {
        if (isConfirmation) {
            const ok = window.confirm(stripHtml(body));
            if (ok) onConfirm();
        } else {
            window.alert(stripHtml(body));
        }
        return;
    }

    labelEl.textContent = title;
    bodyEl.innerHTML = body;

    if (isConfirmation) {
        confirmBtn.style.display = 'inline-block';
        cancelBtn.textContent = 'Cancel';
        confirmBtn.onclick = () => {
            const modal = getModal();
            if (modal) modal.hide();
            onConfirm();
        };
    } else {
        confirmBtn.style.display = 'none';
        cancelBtn.textContent = 'Close';
    }

    const modal = getModal();
    if (modal && typeof modal.show === 'function') modal.show();
}

function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

// Fallback HTML-escape helper in case the shared helper from script.js isn't loaded yet
if (typeof escapeHtml !== 'function') {
    function escapeHtml(unsafe) {
        return String(unsafe)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// ==========================================================
// 1. PORTAL INITIALIZATION & SETUP
// ==========================================================

function initializeDoctorPortal() {
    // Check if the current page is the Doctor Portal (based on element presence)
    // The main doctor login form must exist for this script to run its logic.
    if (!document.getElementById('doctor-login-form')) return;

    const doctorLoginForm = document.getElementById('doctor-login-form');
    // CRITICAL: Attach login listener
    if (doctorLoginForm) {
        doctorLoginForm.addEventListener('submit', handleDoctorLogin);
    }
    
    // Attach event listeners for dashboard features
    const dashboardSection = document.getElementById('doctor-dashboard-section');
    if (dashboardSection) {
        const searchForm = document.getElementById('patient-search-form');
        if (searchForm) searchForm.addEventListener('submit', searchPatientRecord);
        
        const diagnosisForm = document.getElementById('diagnosis-form');
        if (diagnosisForm) diagnosisForm.addEventListener('submit', submitDiagnosisAndPrescription);
        
        const summaryBtn = document.getElementById('generate-summary-btn');
        if (summaryBtn) summaryBtn.addEventListener('click', handleGenerateSummary);

        const logoutBtn = document.getElementById('doc-logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

        loadMedicines(); 
    }

    // Initial view setup
    if(dashboardSection) dashboardSection.style.display = 'none';

    // Ensure layout is centered for login
    adjustLayoutForLogin(true);
}

// CRITICAL FIX: Ensure the initialization function is called when the page is loaded
document.addEventListener('DOMContentLoaded', initializeDoctorPortal);

// ==========================================================
// 2. DOCTOR LOGIN & LOGOUT
// ==========================================================

async function handleDoctorLogin(event) {
    event.preventDefault(); // <-- GUARANTEED to run now
    
    const loginID = document.getElementById('doc-login-id').value.trim();
    const password = document.getElementById('doc-password').value;
    const messageDiv = document.getElementById('doc-login-message');
    const submitBtn = document.querySelector('#doctor-login-form button[type="submit"]');

    messageDiv.textContent = 'Verifying credentials...';
    messageDiv.className = 'mt-3 fw-bold text-warning';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/unifiedLogin`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loginID, password, userType: 'doctor' }) // Hardcoded userType
        });

        const data = await response.json();
        
        if (response.ok && data.success && data.role === 'doctor') {
            // --- Successful Login ---
            currentDoctor = data.user;
            document.getElementById('doctor-login-section').style.display = 'none';
            document.getElementById('doctor-dashboard-section').style.display = 'block';

            // Restore layout for dashboard
            adjustLayoutForLogin(false);

            document.getElementById('doc-welcome-message').textContent = `Welcome, Dr. ${currentDoctor.Name} (${currentDoctor.Specialization})! (ID: ${currentDoctor.Doctor_ID})`;
            loadDoctorAppointments(); 
            
        } else {
            // --- Failed Login ---
            let msg = `❌ Login failed: ${data.message || 'Check credentials.'}`;
            // Show server devInfo when present (developer mode) to aid debugging
            if (data && data.devInfo) {
                msg += ` (dev: matchedBy=${data.devInfo.matchedBy || 'none'})`;
            }
            messageDiv.textContent = msg;
            messageDiv.className = 'mt-3 fw-bold text-danger';
        }
        
    } catch (error) {
        messageDiv.textContent = `❌ Network error: Could not connect to the server (port 3000). Is Node server running?`;
        messageDiv.className = 'mt-3 fw-bold text-danger';
        console.error('Doctor login fetch error:', error);
    } finally {
        submitBtn.disabled = false;
    }
}

function handleLogout() {
    currentDoctor = null;
    
    const dashboardSection = document.getElementById('doctor-dashboard-section');
    const loginSection = document.getElementById('doctor-login-section');
    if(dashboardSection) dashboardSection.style.display = 'none';
    if(loginSection) loginSection.style.display = 'block';

    const messageDiv = document.getElementById('doc-login-message');
    if (messageDiv) {
        messageDiv.textContent = 'You have been successfully logged out.';
        messageDiv.className = 'mt-3 fw-bold text-success';
    }
    const loginForm = document.getElementById('doctor-login-form');
    if(loginForm) loginForm.reset();
    adjustLayoutForLogin(true);
}

// Same helper as patient portal: hide sidebar / remove left margin while login is visible
function adjustLayoutForLogin(showLogin) {
    const sidebar = document.getElementById('sidebar');
    const main = document.querySelector('.main-content');
    if (showLogin) {
        if (sidebar) sidebar.style.display = 'none';
        if (main) main.style.marginLeft = '0';
    } else {
        if (sidebar) sidebar.style.display = '';
        if (main) main.style.marginLeft = '';
    }
}

// ==========================================================
// 3. DOCTOR DASHBOARD FUNCTIONS 
// ==========================================================

async function loadMedicines() {
    const medicineSelect = document.getElementById('medicine-select');
    if (!medicineSelect) return;
    
    medicineSelect.innerHTML = '<option value="" disabled selected>Select Medication</option>'; 
    
    try {
        const response = await fetch(`${API_BASE}/medicines`);
        const allMedicines = await response.json();

        allMedicines.forEach(med => {
            if (med.Stock > 0) {
                medicineSelect.innerHTML += `<option value="${med.Medicine_ID}">
                    ${med.Name} (Stock: ${med.Stock})
                </option>`;
            }
        });
    } catch (error) {
        console.error('Error loading medicines:', error);
    }
}

async function searchPatientRecord(event) {
    event.preventDefault();
    const patientId = document.getElementById('search-patient-id').value;
    const statusDiv = document.getElementById('patient-search-status');
    const recordArea = document.getElementById('patient-record-area');
    const summaryBtn = document.getElementById('generate-summary-btn');
    const summaryOutputCard = document.getElementById('discharge-summary-output-card');
    
    statusDiv.textContent = 'Searching...';
    statusDiv.className = 'mt-2 text-warning';
    recordArea.style.display = 'none';
    if (summaryBtn) summaryBtn.disabled = true;
    if (summaryOutputCard) summaryOutputCard.style.display = 'none';

    try {
        const response = await fetch(`${API_BASE}/patient/record/${patientId}`);
        const contentType = response.headers.get('content-type') || '';
        let data = null;

        if (contentType.includes('application/json')) {
            // safe to parse JSON
            try { data = await response.json(); } catch (e) { data = null; }
        } else {
            // Non-JSON response (often HTML 404 from a server that doesn't have the endpoint)
            const txt = await response.text();
            if (!response.ok) {
                statusDiv.textContent = `❌ Patient not found or server error: ${txt}`;
                statusDiv.className = 'mt-2 text-danger';
                console.error('Patient record non-JSON response:', response.status, response.url, txt);
                return;
            }
            // Try parse JSON from text if possible
            try { data = JSON.parse(txt); } catch (e) { data = { raw: txt } }
        }

        if (response.ok && data) {
            const patient = data.patient || data.patientRecord || data;
            statusDiv.textContent = `✅ Patient ${patientId} (${patient.Name || patient.name || 'Unknown'}) found.`;
            statusDiv.className = 'mt-2 text-success';
            
            document.getElementById('current-patient-id').value = patientId;
            document.getElementById('record-patient-name').textContent = patient.Name || patient.name || 'Unknown';
            document.getElementById('current-patient-fullname').textContent = patient.Name || patient.name || 'Unknown';
            
            // Display latest record info 
            const latestRecord = data.record || data.latestRecord || {};
            document.getElementById('current-patient-allergies').textContent = latestRecord.Allergies || latestRecord.allergies || 'None recorded.';
            document.getElementById('current-patient-surgeries').textContent = latestRecord.Surgeries || latestRecord.surgeries || 'None recorded.';
            
            loadPastPrescriptions(patientId);
            recordArea.style.display = 'block';
            if (summaryBtn) summaryBtn.disabled = false;
        } else {
            // response not ok but handled earlier; fallback message
            statusDiv.textContent = `❌ Patient not found or server error.`;
            statusDiv.className = 'mt-2 text-danger';
            console.error('Patient record fetch failed:', response.status, response.url, data);
        }
    } catch (error) {
        statusDiv.textContent = `❌ Network error during search. Check Node server console.`;
        statusDiv.className = 'mt-2 text-danger';
        console.error('Search fetch error:', error);
    }
}

async function loadPastPrescriptions(patientId) {
    const listDiv = document.getElementById('past-prescriptions-list');
    listDiv.innerHTML = 'Loading prescriptions...';

    try {
        const response = await fetch(`${API_BASE}/prescriptions/${patientId}`);
        const prescriptions = await response.json();
        
        if (prescriptions.length === 0) {
            listDiv.innerHTML = 'None recorded.';
            return;
        }

        function formatDateLocal(dt) {
            if (!dt) return 'N/A';
            try {
                // some backends return YYYY-MM-DD, some return ISO with Z
                const d = new Date(dt);
                if (!isNaN(d.getTime())) return d.toLocaleDateString();
            } catch (e) { /* ignore */ }
            return dt;
        }

        let html = '<ul class="list-unstyled">';
        prescriptions.forEach(p => {
            const dateStr = formatDateLocal(p.Date_Prescribed || p.date || p.Date_Prescribed);
            html += `<li><span class="text-danger fw-bold">${p.Medicine_Name}</span> (Qty: ${p.Quantity}) on ${escapeHtml(dateStr)}</li>`;
        });
        html += '</ul>';
        listDiv.innerHTML = html;

    } catch (error) {
        listDiv.innerHTML = 'Error loading past prescriptions.';
        console.error('Prescription fetch error:', error);
    }
}

async function submitDiagnosisAndPrescription(event) {
    event.preventDefault();
    if (!currentDoctor) return;

    const patientId = document.getElementById('current-patient-id').value;
    const diagnosis = document.getElementById('new-diagnosis').value;
    const medicineId = document.getElementById('medicine-select').value;
    const quantity = document.getElementById('medicine-quantity').value;
    const statusDiv = document.getElementById('diagnosis-status');

    statusDiv.textContent = 'Submitting records...';
    statusDiv.className = 'mt-3 fw-bold text-warning';

    try {
        const response = await fetch(`${API_BASE}/submitDiagnosis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                Doctor_ID: currentDoctor.Doctor_ID,
                Patient_ID: parseInt(patientId),
                Diagnosis: diagnosis,
                Medicine_ID: medicineId ? parseInt(medicineId) : null,
                Quantity: medicineId ? parseInt(quantity) : 0
            })
        });

        // Read response body safely. If content-type is JSON, parse it; otherwise read text.
        let data = null;
        try {
            const ct = response.headers.get('content-type') || '';
            if (ct.includes('application/json')) data = await response.json();
            else data = { message: await response.text() };
        } catch (e) {
            data = { message: 'Unparseable server response' };
        }

        if (response.ok) {
            statusDiv.className = 'mt-3 fw-bold text-success';
            statusDiv.textContent = `🎉 Success! Record updated and ${data.prescriptionCount || 0} prescription(s) added.`;
            document.getElementById('diagnosis-form').reset();
            loadMedicines(); // Refresh medicine stock
            searchPatientRecord({ preventDefault: () => {} }); // Re-run search to refresh data
        } else {
            statusDiv.className = 'mt-3 fw-bold text-danger';
            statusDiv.textContent = `❌ Submission failed: ${data && data.message ? data.message : 'Server error'}`;
            console.error('submitDiagnosis server error:', response.status, data);
        }
    } catch (error) {
        statusDiv.className = 'mt-3 fw-bold text-danger';
        statusDiv.textContent = `❌ Network error during submission. Check Node server console.`;
        console.error('Diagnosis submit error:', error);
    }
}

async function loadDoctorAppointments() {
    const apptList = document.getElementById('doctor-appointments-list');
    if (!apptList) return;
    
    apptList.innerHTML = 'Fetching your schedule...';

    if (!currentDoctor) {
        apptList.innerHTML = 'Authentication required.';
        return;
    }

    try {
        // Quick health check so we can show an actionable error when the backend is down
        try {
            const healthResp = await fetch(`${API_BASE}/_health`, { cache: 'no-store' });
            if (!healthResp.ok) {
                apptList.innerHTML = `<p class="alert alert-danger">Server health check failed (status ${healthResp.status}). Is the Node backend running?<br/><small>Try starting it with: <code>node index.js</code></small> <button class="btn btn-sm btn-outline-secondary ms-2" id="appt-health-check-btn">Check</button></p>`;
                const checkBtn = document.getElementById('appt-health-check-btn');
                if (checkBtn) checkBtn.addEventListener('click', loadDoctorAppointments);
                console.error('Backend health check failed:', healthResp.status, healthResp.statusText);
                return;
            }
            // If JSON, we might log it for debugging
            try { const j = await healthResp.json(); console.debug('Backend _health:', j); } catch (e) { /* ignore */ }
        } catch (e) {
            // Network error contacting backend
            apptList.innerHTML = `<p class="alert alert-danger">Error loading appointments: Backend not reachable at ${escapeHtml(API_BASE)}. Is Node running? <br/><small>Start server in project root: <code>node index.js</code></small> <div class="mt-2"><button class="btn btn-sm btn-outline-secondary" id="appt-open-health">Open Health</button> <a class="btn btn-sm btn-outline-primary ms-2" href="${API_BASE}/debug/doctors" target="_blank">Open /debug/doctors</a></div></p>`;
            const hb = document.getElementById('appt-open-health');
            if (hb) hb.addEventListener('click', () => window.open(`${API_BASE}/_health`, '_blank'));
            console.error('Backend health fetch error:', e);
            return;
        }

        const response = await fetch(`${API_BASE}/appointments/doctor/${currentDoctor.Doctor_ID}`);
        const contentType = response.headers.get('content-type') || '';

        // When response is not ok, read body as text to avoid double-reading the stream later
        if (!response.ok) {
            let errMsg = '';
            try {
                if (contentType.includes('application/json')) {
                    const errBody = await response.json();
                    errMsg = errBody && errBody.message ? errBody.message : JSON.stringify(errBody);
                } else {
                    errMsg = await response.text();
                }
            } catch (e) {
                errMsg = `Status ${response.status} with unreadable body`;
            }
            // If the server returned an HTML page (e.g., "Cannot GET /appointments/doctor/201" from Express static server), shorten and give actionable hint
            let displayMsg = errMsg || 'Server error';
            if (typeof displayMsg === 'string' && (displayMsg.trim().startsWith('<!DOCTYPE') || displayMsg.includes('Cannot GET') || displayMsg.includes('<html'))) {
                displayMsg = 'Server not reachable or route missing (Cannot GET). Is the Node backend running on the expected port?';
            }
            apptList.innerHTML = `<p class="alert alert-danger">Error loading appointments: ${escapeHtml(displayMsg)} <button class="btn btn-sm btn-outline-secondary ms-2" id="appt-retry-btn">Retry</button></p>`;
            const retryBtn = document.getElementById('appt-retry-btn');
            if (retryBtn) retryBtn.addEventListener('click', loadDoctorAppointments);
            console.error('Doctor Appointments fetch non-ok:', response.status, errMsg, 'url:', response.url);
            return;
        }

        // The server may return different shapes: an array, or an object with a key like { appointments: [...] }
        let payload = null;
        try {
            if (contentType.includes('application/json')) payload = await response.json();
            else payload = (await response.text());
        } catch (e) { payload = null; }

        // Normalize to an array
        let appointments = [];
        if (Array.isArray(payload)) {
            appointments = payload;
        } else if (payload && Array.isArray(payload.appointments)) {
            appointments = payload.appointments;
        } else if (payload && Array.isArray(payload.data)) {
            appointments = payload.data;
        } else if (payload && typeof payload === 'object') {
            // Try to find the first array inside the object
            const arr = Object.values(payload).find(v => Array.isArray(v));
            if (Array.isArray(arr)) appointments = arr;
        }

        console.debug('Doctor appointments normalized:', appointments, 'rawPayload:', payload);

        if (!Array.isArray(appointments) || appointments.length === 0) {
            apptList.innerHTML = '<p class="alert alert-info">No upcoming appointments found in your schedule.</p>';
            return;
        }

        function safePatientName(a) {
            if (!a) return 'Unknown';
            return a.Name || a.name || a.Patient_Name || a.patient_name || (a.Patient ? (a.Patient.Name || a.Patient.name) : '') || 'Unknown';
        }

        function safeTime(a) {
            try {
                if (a.Time && typeof a.Time === 'string') return a.Time.slice(0,5);
                // Some APIs return datetime in ISO format
                const dt = a.DateTime || a.datetime || a.DateTimeISO || a.Date;
                if (dt && typeof dt === 'string') {
                    const d = new Date(dt);
                    if (!isNaN(d.getTime())) return d.toTimeString().slice(0,5);
                }
            } catch (e) {
                // ignore and fallback
            }
            return a.Time || '---';
        }

        let html = '<table class="table table-striped table-sm"><thead><tr><th>Appt ID</th><th>Patient Name</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>';
        appointments.forEach(appt => {
            const status = appt.Status || appt.status || appt.AppointmentStatus || 'Unknown';
            const statusClass = status === 'Scheduled' ? 'text-primary' : (status === 'Cancelled' ? 'text-danger' : 'text-success');
            const pid = appt.Patient_ID || appt.patientId || (appt.Patient && (appt.Patient.Patient_ID || appt.Patient.id)) || 'N/A';
            const patientName = safePatientName(appt);
            const date = appt.Date || appt.date || (appt.DateTime ? (new Date(appt.DateTime)).toLocaleDateString() : 'N/A');
            const time = safeTime(appt);

            html += `<tr>
                        <td>${appt.Appt_ID || appt.apptId || appt.id || '—'}</td>
                        <td class="fw-bold">${escapeHtml(patientName)} (ID: ${pid})</td>
                        <td>${escapeHtml(date)}</td>
                        <td>${escapeHtml(time)}</td>
                        <td class="${statusClass} fw-bold">${escapeHtml(status)}</td>
                    </tr>`;
        });
        html += '</tbody></table>';
        apptList.innerHTML = html;

    } catch (error) {
        apptList.innerHTML = '<p class="alert alert-danger">Error loading appointments. Check Node server console.</p>';
        console.error('Doctor Appointments fetch error:', error);
    }
}

async function handleGenerateSummary() {
    const patientId = document.getElementById('current-patient-id').value;
    const summaryBtn = document.getElementById('generate-summary-btn');
    const outputCard = document.getElementById('discharge-summary-output-card');
    const outputDiv = document.getElementById('discharge-summary-content');

    summaryBtn.disabled = true;
    if(outputCard) outputCard.style.display = 'block';
    outputDiv.innerHTML = '<div class="text-center text-primary"><span class="spinner-border spinner-border-sm me-2"></span>Generating summary with Gemini... (This may take a few seconds)</div>';

    try {
        const response = await fetch(`${API_BASE}/generateSummary/${patientId}`);
        const data = await response.json();

        summaryBtn.disabled = false;
        
        if (response.ok) {
            outputDiv.innerHTML = data.summary.replace(/\n/g, '<br>'); // Preserve line breaks
        } else {
            outputDiv.innerHTML = `<p class="alert alert-danger">LLM Generation Failed: ${data.message || 'Server error during API call.'}</p>`;
        }
        
    } catch (error) {
        summaryBtn.disabled = false;
        outputDiv.innerHTML = '<p class="alert alert-danger">Network error connecting to the generation service.</p>';
        console.error('LLM fetch error:', error);
    }
}

// Theme toggle setup (apply saved theme and wire #themeToggle)
(function setupThemeToggleDoctor(){
    const TOGGLE_ID = 'themeToggle';

    function applyTheme(name) {
        document.documentElement.classList.remove('theme-dark', 'theme-light');
        document.documentElement.classList.add(name === 'dark' ? 'theme-dark' : 'theme-light');
        try { localStorage.setItem('hms_theme', name); } catch(e) { /* ignore */ }

        // Update toggle visuals and ARIA state if present
        const btn = document.getElementById(TOGGLE_ID);
        if (btn) {
            const isLight = name === 'light';
            if (isLight) btn.classList.add('is-light'); else btn.classList.remove('is-light');
            btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
        }
    }

    function getSavedTheme() {
        return (localStorage.getItem('hms_theme') || 'dark');
    }

    function toggleTheme() {
        const current = getSavedTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
    }

    function onToggleKey(event) {
        // Activate on Enter or Space
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleTheme();
        }
    }

    window.addEventListener('load', () => {
        const saved = getSavedTheme();
        applyTheme(saved);
        const btn = document.getElementById(TOGGLE_ID);
        if (btn) {
            btn.addEventListener('click', toggleTheme);
            btn.addEventListener('keydown', onToggleKey);
            // ensure initial visual class matches saved theme
            if (saved === 'light') btn.classList.add('is-light'); else btn.classList.remove('is-light');
            btn.setAttribute('aria-pressed', saved === 'light' ? 'true' : 'false');
        }
    });
})();
