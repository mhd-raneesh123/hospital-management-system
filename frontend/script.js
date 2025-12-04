// Final Patient Portal Logic - Robust Initialization, Booking Fixes (Data Type Casting)
const _DEFAULT_API = 'http://localhost:3000';
let API_BASE = _DEFAULT_API;
try {
    const origin = window.location && window.location.origin ? window.location.origin : '';
    if (origin.includes(':5500') || origin.includes('127.0.0.1:5500')) {
        API_BASE = _DEFAULT_API;
        console.warn('Detected Live Server origin; using API_BASE fallback ->', API_BASE);
    } else if (origin) {
        API_BASE = origin;
    }
} catch (e) { API_BASE = _DEFAULT_API; }
let currentPatient = null;

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
    // Get modal elements; if not found, gracefully fall back to native dialogs
    const labelEl = document.getElementById('actionModalLabel');
    const bodyEl = document.getElementById('actionModalBody');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    // If required modal parts are missing, use native alert/confirm as fallback
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
        // Remove previous handler then set new one
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

// Helper to strip HTML tags for native dialogs
function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

// ==========================================================
// 1. PORTAL INITIALIZATION & SETUP
// ==========================================================

function initializePatientPortal() {
    // Attach login listener only if the form exists
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handlePatientLogin);
    }
    
    // Attach dashboard listeners (must exist on the page)
    const apptForm = document.getElementById('appointment-form');
    if (apptForm) apptForm.addEventListener('submit', bookAppointment); 

    // Replace time input with a controlled select of allowed 10-minute slots
    populateTimeSlotSelect();

    // Wire up listeners to disable already-booked slots when doctor or date changes
    const doctorSelect = document.getElementById('doctor-select');
    const apptDateInput = document.getElementById('appt-date');
    if (doctorSelect) doctorSelect.addEventListener('change', () => disableBookedSlots(doctorSelect.value, apptDateInput ? apptDateInput.value : ''));
    if (apptDateInput) apptDateInput.addEventListener('change', () => disableBookedSlots(doctorSelect ? doctorSelect.value : '', apptDateInput.value));
    
    const logoutBtn = document.getElementById('logout-btn-sidebar');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    
    setupNavigation(); 
        // Ensure layout adjusted for initial login view
        adjustLayoutForLogin(true);
}

// Populate appointment time select with allowed 10-minute slots
function populateTimeSlotSelect() {
    const timeInput = document.getElementById('appt-time');
    if (!timeInput) return;

    // Create select element
    const select = document.createElement('select');
    select.id = 'appt-time';
    select.className = timeInput.className || 'form-control';

    // Helper to format HH:MM
    function fmt(h, m) {
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    // Generate slots 09:00-11:50 and 13:00-15:50 at 10-minute intervals
    const slots = [];
    for (let h = 9; h < 12; h++) {
        for (let m = 0; m < 60; m += 10) slots.push(fmt(h, m));
    }
    for (let h = 13; h < 16; h++) {
        for (let m = 0; m < 60; m += 10) slots.push(fmt(h, m));
    }

    // Add placeholder option
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '-- Select time --';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    slots.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        select.appendChild(opt);
    });

    // Replace the input with the select in the DOM
    timeInput.parentNode.replaceChild(select, timeInput);
}

// Disable options that are already booked for the selected doctor+date
async function disableBookedSlots(doctorId, date) {
    const select = document.getElementById('appt-time');
    if (!select) return;
    // First, re-enable all options
    Array.from(select.options).forEach(opt => opt.disabled = false);

    if (!doctorId || !date) return; // nothing to check

    try {
        const response = await fetch(`${API_BASE}/appointments/doctor/${doctorId}`);
        if (!response.ok) return;
        const appointments = await response.json();

        // Find appointments for the selected date and mark those times disabled
        const bookedTimes = new Set(appointments.filter(a => a.Date === date && a.Status === 'Scheduled').map(a => a.Time.slice(0,5)));
        Array.from(select.options).forEach(opt => {
            if (bookedTimes.has(opt.value)) opt.disabled = true;
        });
    } catch (error) {
        console.error('Error fetching doctor appointments for disabling slots:', error);
    }
}

// Hide sidebar while login is shown to center the login card
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

document.addEventListener('DOMContentLoaded', initializePatientPortal);

// Theme toggle: persist selection in localStorage and apply theme class
(function setupThemeToggle(){
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
            const track = btn.querySelector('.toggle-track');
            if (track) track.setAttribute('aria-checked', isLight ? 'true' : 'false');
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
            if (saved === 'light') btn.classList.add('is-light'); else btn.classList.remove('is-light');
            btn.setAttribute('aria-pressed', saved === 'light' ? 'true' : 'false');
            const track = btn.querySelector('.toggle-track');
            if (track) track.setAttribute('aria-checked', saved === 'light' ? 'true' : 'false');
        }
    });
})();


// ==========================================================
// 2. PATIENT LOGIN & LOGOUT
// ==========================================================

async function handlePatientLogin(event) {
    event.preventDefault(); 
    
    const name = document.getElementById('name').value;
    const dob = document.getElementById('dob').value;
    const messageDiv = document.getElementById('login-message');
    const submitBtn = document.querySelector('#login-form button[type="submit"]');

    messageDiv.textContent = 'Verifying credentials...';
    messageDiv.className = 'mt-3 fw-bold text-warning';
    submitBtn.disabled = true;

    let userType = 'patient'; 
    let loginID = name;
    let password = dob;

    const registrationFields = document.getElementById('registration-fields');
    if (registrationFields && !registrationFields.classList.contains('d-none')) {
        const gender = document.getElementById('gender').value;
        const address = document.getElementById('address').value;
        if (!gender || !address) {
            messageDiv.textContent = '❌ Please complete Gender and Address fields to register.';
            messageDiv.className = 'mt-3 fw-bold text-danger';
            submitBtn.disabled = false;
            return;
        }
        return handleRegistrationSubmit(name, dob, gender, address);
    }

    try {
        const response = await fetch(`${API_BASE}/unifiedLogin`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loginID, password, userType })
        });

        const data = await response.json();
        
        if (response.ok && data.success && data.role === 'patient') {
            currentPatient = data.user;
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('dashboard-section').style.display = 'block';
            
            loadProfileData(); 
            adjustLayoutForLogin(false);
        } else if (data.registrationNeeded) {
            messageDiv.textContent = `⚠️ Patient record not found. Please provide details to register.`;
            messageDiv.className = 'mt-3 fw-bold text-warning';
            if(registrationFields) registrationFields.classList.remove('d-none');
            submitBtn.textContent = 'Register & Sign In';
            
        } else {
            messageDiv.textContent = `❌ Sign In failed: ${data.message || 'Check credentials.'}`;
            messageDiv.className = 'mt-3 fw-bold text-danger';
        }
        
    } catch (error) {
        messageDiv.textContent = `❌ Network error: Could not connect to the server (port 3000).`;
        messageDiv.className = 'mt-3 fw-bold text-danger';
        console.error('Patient login fetch error:', error);
    } finally {
        submitBtn.disabled = false;
    }
}

async function handleRegistrationSubmit(name, dob, gender, address) {
    event.preventDefault();
    const messageDiv = document.getElementById('login-message');
    const submitBtn = document.querySelector('#login-form button[type="submit"]');

    messageDiv.textContent = 'Registering patient...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/registerAndLogin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Name: name, DOB: dob, Gender: gender, Address: address })
        });
        
        const data = await response.json();

        if (response.ok && data.success) {
            currentPatient = data.patient;
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('dashboard-section').style.display = 'block';
            
            showCustomModal('Success', `🎉 Registration successful! Your ID is **${data.patient.Patient_ID}**.`, false);
            loadProfileData(); 
            
        } else {
            messageDiv.textContent = `❌ Registration failed: ${data.message || 'Server error'}`;
            messageDiv.className = 'mt-3 fw-bold text-danger';
        }

    } catch (error) {
        messageDiv.textContent = `❌ Network error during registration.`;
            messageDiv.className = 'mt-3 fw-bold text-danger';
            console.error('Registration fetch error:', error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
        const registrationFields = document.getElementById('registration-fields');
        if(registrationFields) registrationFields.classList.add('d-none');
    }
}

function handleLogout() {
    currentPatient = null;
    const dashboardSection = document.getElementById('dashboard-section');
    const loginSection = document.getElementById('login-section');
    if(dashboardSection) dashboardSection.style.display = 'none';
    if(loginSection) loginSection.style.display = 'block';
        adjustLayoutForLogin(true);

    const messageDiv = document.getElementById('login-message');
    if (messageDiv) {
        messageDiv.textContent = 'You have been successfully logged out.';
        messageDiv.className = 'mt-3 fw-bold text-success';
    }
    const loginForm = document.getElementById('login-form');
    if(loginForm) loginForm.reset();
    document.getElementById('sidebar-id').textContent = 'Guest';
}


// ==========================================================
// 3. DASHBOARD FUNCTIONS (Data Fetching and Display)
// ==========================================================

function setupNavigation() {
    const navTabs = document.getElementById('nav-tabs');
    const welcomeMessage = document.getElementById('welcome-message');

    if (!navTabs) return; 

    navTabs.querySelectorAll('.nav-link-custom').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('data-target');
            const linkText = this.textContent.trim().split(/\s+/).slice(1).join(' '); 
            
            navTabs.querySelectorAll('.nav-link-custom').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            if(welcomeMessage) welcomeMessage.textContent = linkText;
            
            document.querySelectorAll('.dashboard-view').forEach(view => {
                view.classList.add('d-none');
            });
            const targetView = document.getElementById(targetId);
            if(targetView) targetView.classList.remove('d-none');
            
            // Fetch data based on the view selected
            if (targetId === 'profile-view') loadProfileData();
            if (targetId === 'appointments-view') loadAppointments();
            if (targetId === 'records-view') loadRecords();
            if (targetId === 'bills-view') loadBills();
            if (targetId === 'rooms-view') loadWards();
            if (targetId === 'departments-view') loadDepartments();
        });
    });
}

async function loadProfileData() {
    if (!currentPatient) return;
    
    const p = currentPatient;
    const sidebarId = document.getElementById('sidebar-id');
    if (sidebarId) sidebarId.textContent = `ID: ${p.Patient_ID}`;

    const welcomeMessage = document.getElementById('welcome-message');
    if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${p.Name}`;

    // Format DOB as YYYY-MM-DD for display (handle ISO timestamps)
    let dobDisplay = p.DOB || '';
    try {
        const d = new Date(p.DOB);
        if (!isNaN(d.getTime())) {
            dobDisplay = d.toISOString().split('T')[0];
        }
    } catch (e) {
        // leave dobDisplay as-is
    }

    const personalHtml = `
        <div class="row">
            <div class="col-6">
                <p class="data-label">Full Name</p><p class="data-value">${p.Name}</p>
                <p class="data-label">Date of Birth</p><p class="data-value">${dobDisplay}</p>
                <p class="data-label">Gender</p><p class="data-value">${p.Gender || 'N/A'}</p>
            </div>
            <div class="col-6">
                <p class="data-label">Patient ID</p><p class="data-value text-accent">${p.Patient_ID}</p>
                <p class="data-label">Primary Doctor ID</p><p class="data-value">${p.Primary_Doctor_ID !== null && p.Primary_Doctor_ID !== undefined ? p.Primary_Doctor_ID : 'Unassigned'}</p>
                <p class="data-label">Address</p><p class="data-value">${p.Address || 'N/A'}</p>
            </div>
        </div>
    `;
    const personalInfoDisplay = document.getElementById('personal-info-display');
    if(personalInfoDisplay) personalInfoDisplay.innerHTML = personalHtml;
    
    // Fetch latest record for medical info display
    fetch(`${API_BASE}/records/latest/${p.Patient_ID}`)
        .then(res => res.json())
        .then(data => {
            const medicalInfoDisplay = document.getElementById('medical-info-display');
            if (!medicalInfoDisplay) return; 

            const latestRecord = data.record || {};
            medicalInfoDisplay.innerHTML = `
                <p class="data-label">Latest Diagnosis</p>
                <p class="data-value text-danger">${latestRecord.Diagnosis || 'None recorded.'}</p>
                <p class="data-label mt-2">Allergies</p>
                <p class="data-value">${latestRecord.Allergies || 'None recorded.'}</p>
                <p class="data-label mt-2">Past Surgeries</p>
                <p class="data-value">${latestRecord.Surgeries || 'None recorded.'}</p>
            `;
        })
        .catch(error => {
            const medicalInfoDisplay = document.getElementById('medical-info-display');
            if(medicalInfoDisplay) medicalInfoDisplay.innerHTML = '<p class="text-danger">Error loading medical history.</p>';
            console.error('Profile medical fetch error:', error);
        });

    const emergencyContactDisplay = document.getElementById('emergency-contact-display');
    if(emergencyContactDisplay) emergencyContactDisplay.innerHTML = `
        <p class="data-label">Contact Name</p><p class="data-value">John Doe (Placeholder)</p>
        <p class="data-label">Contact Phone</p><p class="data-value">+1-555-0124 (Placeholder)</p>
    `;
}

async function loadDepartments() {
    const deptList = document.getElementById('departments-list');
    const doctorSelect = document.getElementById('doctor-select');
    if (!deptList) return;

    deptList.innerHTML = 'Fetching data...';
    if (doctorSelect) doctorSelect.innerHTML = '<option value="">-- Select a Doctor --</option>'; 
    
    try {
        const response = await fetch(`${API_BASE}/departments`);
        const departments = await response.json();

        if (departments.length === 0) {
            deptList.innerHTML = '<p class="alert alert-warning">No departments found.</p>';
            return;
        }

        let html = '';
        departments.forEach(dept => {
            html += `<div class="custom-card mb-3">
                        <h4 class="card-title-custom">${dept.Dept_Name}</h4>
                        <ul class="list-unstyled mt-2 list-group list-group-flush">`;
            
            if (dept.doctors && dept.doctors.length > 0) {
                dept.doctors.forEach(doc => {
                    html += `<li class="list-group-item bg-transparent border-0">${doc.Name} - <small class="text-secondary">${doc.Specialization}</small></li>`;
                    if (doctorSelect) doctorSelect.innerHTML += `<option value="${doc.Doctor_ID}">Dr. ${doc.Name} (${doc.Specialization})</option>`;
                });
            } else {
                html += '<li class="list-group-item bg-transparent text-secondary">No doctors listed.</li>';
            }
            html += `</ul></div>`;
        });
        deptList.innerHTML = html;

    } catch (error) {
        deptList.innerHTML = '<p class="alert alert-danger">Error loading departments. Check Node server console.</p>';
        console.error('Dept fetch error:', error);
    }
}

// ---------------------------
// Patient Timeline
// ---------------------------
let timelineState = { page: 1, pageSize: 8 };
async function loadTimeline(page = 1) {
    const container = document.getElementById('timeline-list');
    const pager = document.getElementById('timeline-pager');
    if (!container || !currentPatient) return;
    container.innerHTML = '<div class="text-muted">Loading timeline...</div>';

    try {
        const response = await fetch(`${API_BASE}/timeline/${currentPatient.Patient_ID}?page=${page}&pageSize=${timelineState.pageSize}`);
        if (!response.ok) {
            container.innerHTML = `<div class="text-danger">Failed to load timeline: ${response.statusText}</div>`;
            return;
        }
        const data = await response.json();
        timelineState.page = data.page || page;

        if (!data.events || data.events.length === 0) {
            container.innerHTML = '<div class="text-info">No timeline events found.</div>';
            if (pager) pager.textContent = `Page ${timelineState.page}`;
            return;
        }

        // Render events
        const html = data.events.map(ev => renderTimelineEvent(ev)).join('\n');
        container.innerHTML = `<div class="timeline-list">${html}</div>`;
        if (pager) pager.textContent = `Page ${timelineState.page} / ${Math.ceil((data.total || 0) / timelineState.pageSize) || 1}`;

        // Wire expand handlers
        document.querySelectorAll('.timeline-event-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.getAttribute('data-id');
                const detail = document.getElementById(`timeline-detail-${id}`);
                if (detail) detail.classList.toggle('d-none');
            });
        });

    } catch (error) {
        container.innerHTML = '<div class="text-danger">Network error loading timeline.</div>';
        console.error('Timeline fetch error:', error);
    }
}

function renderTimelineEvent(ev) {
    const id = `${ev.type}-${ev.id}`;
    const dateStr = new Date(ev.date).toLocaleString();
    let summary = '';
    let detailsHtml = '';

    if (ev.type === 'record') {
        summary = `${ev.title || 'Medical Record'}`;
        detailsHtml = `<p><strong>Allergies:</strong> ${ev.details?.Allergies || 'N/A'}</p><p><strong>Surgeries:</strong> ${ev.details?.Surgeries || 'N/A'}</p>`;
    } else if (ev.type === 'prescription') {
        summary = `Prescription: ${ev.title}`;
        detailsHtml = `<p><strong>Quantity:</strong> ${ev.details?.Quantity || 'N/A'}</p>`;
    } else if (ev.type === 'appointment') {
        summary = `${ev.title}`;
        detailsHtml = `<p><strong>Time:</strong> ${ev.details?.Time || 'N/A'}</p><p><strong>Status:</strong> ${ev.details?.Status || 'N/A'}</p>`;
    } else {
        summary = ev.title || 'Event';
        detailsHtml = JSON.stringify(ev.details || {});
    }

    return `
        <div class="timeline-event p-2 mb-2 border rounded">
            <div class="d-flex justify-content-between align-items-center">
                <div><strong>${escapeHtml(summary)}</strong><div class="small text-secondary">${escapeHtml(dateStr)}</div></div>
                <div><button class="btn btn-sm btn-outline-light timeline-event-toggle" data-id="${id}">Toggle</button></div>
            </div>
            <div id="timeline-detail-${id}" class="timeline-detail mt-2 d-none">${detailsHtml}</div>
        </div>
    `;
}

// Wire pager buttons
document.addEventListener('click', (e) => {
    const prev = document.getElementById('timeline-prev');
    const next = document.getElementById('timeline-next');
    if (e.target === prev) {
        const p = Math.max(1, (timelineState.page || 1) - 1);
        loadTimeline(p);
    } else if (e.target === next) {
        const p = (timelineState.page || 1) + 1;
        loadTimeline(p);
    }
});

// Ensure timeline is loaded when timeline view is shown
const origSetupNavigation2 = setupNavigation;
setupNavigation = function() {
    origSetupNavigation2();
    // load timeline when timeline view becomes visible
    document.querySelectorAll('.nav-link-custom').forEach(link => {
        link.addEventListener('click', function(){
            const targetId = this.getAttribute('data-target');
            if (targetId === 'timeline-view') loadTimeline(1);
        });
    });
};

// ---------------------------
// Patient Chat Assistant UI
// ---------------------------
// Show a persistent banner at top of page for assistant-level errors (billing/quota)
function showAssistantBanner(msg) {
    try {
        let banner = document.getElementById('assistant-error-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'assistant-error-banner';
            banner.className = 'alert alert-danger';
            banner.style.position = 'sticky';
            banner.style.top = '0';
            banner.style.zIndex = '9999';
            banner.style.margin = '0';
            banner.style.borderRadius = '0';
            // Insert at top of body so it's visible across views
            const body = document.querySelector('body');
            if (body && body.firstChild) body.insertBefore(banner, body.firstChild);
            else if (body) body.appendChild(banner);
        }
        banner.textContent = msg;
    } catch (e) {
        console.error('Failed to show assistant banner:', e);
    }
}

function setupPatientChatUI() {
    const sendBtn = document.getElementById('chat-send');
    const input = document.getElementById('chat-input');
    const messages = document.getElementById('chat-messages');
    if (!sendBtn || !input || !messages) return;

    function appendMessage(who, text) {
        const el = document.createElement('div');
        el.className = who === 'user' ? 'chat-bubble user' : 'chat-bubble assistant';
        el.style.marginBottom = '8px';
        el.innerHTML = `<strong>${who === 'user' ? 'You' : 'Assistant'}:</strong> <div>${escapeHtml(text)}</div>`;
        messages.appendChild(el);
        messages.scrollTop = messages.scrollHeight;
    }

    async function sendMessage() {
        const text = input.value && input.value.trim();
        if (!text) return;
        appendMessage('user', text);
        input.value = '';

        // Show spinner placeholder from assistant
        appendMessage('assistant', 'Thinking...');

        try {
            const response = await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patientId: currentPatient ? currentPatient.Patient_ID : null, message: text })
            });

            const data = await response.json();
            // Remove last assistant placeholder
            const last = messages.querySelector('.chat-bubble.assistant:last-child');
            if (last) last.remove();

            if (response.ok) {
                appendMessage('assistant', data.reply || 'No reply');
            } else {
                // Special-case: OpenAI quota / billing
                if (response.status === 429 || (data && data.error === 'insufficient_quota')) {
                    const userMsg = 'Error: Assistant temporarily unavailable due to billing/quota limits. Please contact the administrator.';
                    appendMessage('assistant', userMsg);
                    // Show persistent banner with more admin-facing guidance
                    showAssistantBanner('Assistant disabled: OpenAI quota exceeded or billing issue. Please check the OPENAI account plan/billing.');
                } else {
                    appendMessage('assistant', `Error: ${data.message || 'Server error'}`);
                }
            }
        } catch (error) {
            const last = messages.querySelector('.chat-bubble.assistant:last-child');
            if (last) last.remove();
            appendMessage('assistant', 'Network error while contacting assistant.');
            console.error('Chat send error:', error);
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
}

// Simple HTML-escape helper
function escapeHtml(unsafe) {
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Ensure chat UI is initialized when assistant view is shown or after login
const origSetupNavigation = setupNavigation;
setupNavigation = function() {
    origSetupNavigation();
    // Initialize chat UI handlers (idempotent)
    setupPatientChatUI();
};

async function loadWards() {
    const wardList = document.getElementById('wards-list');
    if (!wardList) return; 
    
    wardList.innerHTML = 'Fetching data...';

    if (!currentPatient) return; 

    try {
        const response = await fetch(`${API_BASE}/wards`);
        const wards = await response.json();

        if (wards.length === 0) {
            wardList.innerHTML = '<p class="alert alert-warning">No wards found.</p>';
            return;
        }

        let html = '';
        wards.forEach(ward => {
            html += `<div class="ward-header alert alert-secondary" role="alert">
                        <span class="material-icons me-2">hotel</span> ${ward.Ward_Name} (Ward ID: ${ward.Ward_ID})
                    </div>`;
            html += `<div class="p-3 border-bottom mb-2 d-flex flex-wrap gap-2">`;
            
            if (ward.rooms && ward.rooms.length > 0) {
                ward.rooms.forEach(room => {
                    let statusClass = '';
                    let buttonText = '';
                    let disabled = true;
                    const isOccupying = room.Patient_ID_Occupying == currentPatient.Patient_ID;

                    if (room.Availability === 'Available') {
                        statusClass = 'room-available';
                        buttonText = `Book Room ${room.Room_ID} (${room.Type})`;
                        disabled = false;
                    } else if (isOccupying) {
                        statusClass = 'room-booked-by-self';
                        buttonText = `Your Room ${room.Room_ID} - Cancel`; 
                        disabled = false; 
                    } else {
                        statusClass = 'room-unavailable';
                        buttonText = `Room ${room.Room_ID} (Occupied)`;
                        disabled = true;
                    }

                    let actionAttr = '';
                    if (!disabled && room.Availability === 'Available') {
                        actionAttr = 'data-action="book"';
                    } else if (isOccupying) {
                        actionAttr = 'data-action="cancel"';
                    }

                    html += `<button 
                                class="room-btn ${statusClass} btn btn-sm" 
                                data-room-id="${room.Room_ID}" 
                                ${actionAttr}
                                ${disabled && !isOccupying ? 'disabled' : ''}
                            >
                                ${buttonText}
                            </button>`;
                });
            } else {
                html += 'No rooms in this ward.';
            }
            html += '</div>';
        });
        wardList.innerHTML = html;

    } catch (error) {
        wardList.innerHTML = '<p class="alert alert-danger">Error loading wards. Check Node server console.</p>';
        console.error('Ward fetch error:', error);
    }
}

// Delegated click listener for room buttons (handles booking and cancellation)
document.addEventListener('click', function (e) {
    // Support clicks on inner text/icons by walking up to the closest .room-btn
    const el = e.target;
    const btn = (el.closest && el.closest('.room-btn')) || (el.parentNode && el.parentNode.closest && el.parentNode.closest('.room-btn')) || null;
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const roomId = btn.getAttribute('data-room-id');

    // Click handled for room buttons
    if (action === 'book') {
        handleRoomBooking(roomId);
    } else if (action === 'cancel') {
        cancelRoomBooking(roomId);
    }
});

function handleRoomBooking(roomId) {
    showCustomModal(
        'Confirm Room Booking',
        `Confirm booking Room <b>${roomId}</b>? A pending bill of $5000 will be generated.`,
        true,
        () => confirmBooking(roomId)
    );
}

async function confirmBooking(roomId) {
    const bookingMessage = document.getElementById('booking-message');
    if (!bookingMessage) return;

    bookingMessage.textContent = `Attempting to book Room ${roomId}...`;
    bookingMessage.className = 'alert alert-warning mt-3';

    try {
        const response = await fetch(`${API_BASE}/bookRoom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                Patient_ID: parseInt(currentPatient.Patient_ID), 
                Room_ID: roomId 
            })
        });

        const data = await response.json();

        if (response.ok) {
            bookingMessage.className = 'alert alert-success mt-3';
            bookingMessage.textContent = `🎉 Success: ${data.message}. Room ID is ${data.Room_ID}.`;
            loadWards(); 
            loadBills(); 
        } else {
            bookingMessage.className = 'alert alert-danger mt-3';
            bookingMessage.textContent = `❌ Booking failed: ${data.message || 'Server error'}`;
        }
    } catch (error) {
        bookingMessage.className = 'alert alert-danger mt-3';
        bookingMessage.textContent = `❌ Network error while booking. Check Node server console.`;
        console.error('Booking fetch error:', error);
    }
}

function cancelRoomBooking(roomId) {
    showCustomModal(
        'Confirm Cancellation',
        `Are you sure you want to cancel the booking for Room <b>${roomId}</b>? Any pending room bills will be removed.`,
        true,
        () => confirmCancelRoom(roomId)
    );
}

async function confirmCancelRoom(roomId) {
    const bookingMessage = document.getElementById('booking-message');
    if (!bookingMessage) return;
    
    bookingMessage.textContent = `Attempting to cancel booking for Room ${roomId}...`;
    bookingMessage.className = 'alert alert-warning mt-3';

    try {
        const response = await fetch(`${API_BASE}/room/${roomId}/${currentPatient.Patient_ID}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            bookingMessage.className = 'alert alert-success mt-3';
            bookingMessage.textContent = `Success! ${data.message}`;
            loadWards(); 
            loadBills();
        } else {
            bookingMessage.className = 'alert alert-danger mt-3';
            bookingMessage.textContent = `❌ Cancellation failed: ${data.message || 'Server error'}`;
        }
    } catch (error) {
        bookingMessage.className = 'alert alert-danger mt-3';
        bookingMessage.textContent = `❌ Network error during room cancellation. Check Node server console.`;
        console.error('Room cancellation fetch error:', error);
    }
}


async function loadAppointments() {
    const apptList = document.getElementById('appointments-list');
    if (!apptList) return;
    
    apptList.innerHTML = 'Fetching appointments...';

    if (!currentPatient) return;

    try {
        const response = await fetch(`${API_BASE}/appointments/${currentPatient.Patient_ID}`);
        const appointments = await response.json();

        if (appointments.length === 0) {
            apptList.innerHTML = '<p class="alert alert-info">No appointment history found.</p>';
            return;
        }

        let html = '<table class="table table-striped table-sm"><thead><tr><th>Appt ID</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th><th>Action</th></tr></thead><tbody>';
        appointments.forEach(appt => {
            const statusClass = appt.Status === 'Scheduled' ? 'text-primary' : (appt.Status === 'Completed' ? 'text-success' : 'text-danger');

            const actionButton = appt.Status === 'Scheduled'
                ? `<button onclick="cancelAppointment(${appt.Appt_ID})" class="btn btn-sm btn-danger">Cancel</button>`
                : `<span class="text-success">Done</span>`;

            // Normalize date/time: backend may return Date as ISO string (e.g. 2025-10-29T18:30:00.000Z)
            let dateStr = 'N/A';
            let timeStr = '---';

            try {
                // If the server returned a full ISO timestamp in Date, parse it
                if (appt.Date && typeof appt.Date === 'string' && (appt.Date.includes('T') || appt.Date.endsWith('Z'))) {
                    const d = new Date(appt.Date);
                    if (!isNaN(d.getTime())) {
                        dateStr = d.toLocaleDateString();
                        timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } else {
                        dateStr = appt.Date;
                    }
                } else if (appt.Date) {
                    // If Date is already a plain date string (YYYY-MM-DD), show as-is but localize
                    const d2 = new Date(appt.Date + 'T00:00:00');
                    if (!isNaN(d2.getTime())) dateStr = d2.toLocaleDateString(); else dateStr = appt.Date;
                }

                // Time field may be a simple HH:MM:SS string or may be missing if Date contained time
                if (appt.Time && typeof appt.Time === 'string') {
                    // If it's like '18:30:00' or '18:30:00.000Z'
                    const t = appt.Time.trim();
                    if (t.includes(':')) {
                        // Prefer HH:MM portion
                        timeStr = t.slice(0,5);
                    } else if (t.endsWith('Z')) {
                        const dt = new Date(t);
                        if (!isNaN(dt.getTime())) timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                }
            } catch (e) {
                console.error('Failed to format appointment date/time:', e, appt);
                dateStr = appt.Date || 'N/A';
                timeStr = (appt.Time && appt.Time.slice ? appt.Time.slice(0,5) : (appt.Time || '---'));
            }

            html += `<tr>
                        <td>${appt.Appt_ID}</td>
                        <td>Dr. ${escapeHtml(appt.Doctor_Name || '')}</td>
                        <td>${escapeHtml(dateStr)}</td>
                        <td>${escapeHtml(timeStr)}</td>
                        <td class="${statusClass} fw-bold">${escapeHtml(appt.Status)}</td>
                        <td>${actionButton}</td>
                    </tr>`;
        });
        html += '</tbody></table>';
        apptList.innerHTML = html;

    } catch (error) {
        apptList.innerHTML = '<p class="alert alert-danger">Error loading appointments. Check Node server console.</p>';
        console.error('Appointments fetch error:', error);
    }
}

function cancelAppointment(apptId) {
    showCustomModal(
        'Confirm Cancellation',
        `Are you sure you want to cancel Appointment ID <b>${apptId}</b>? This action cannot be easily undone.`,
        true,
        () => confirmCancelAppointment(apptId)
    );
}

async function confirmCancelAppointment(apptId) {
    try {
        const response = await fetch(`${API_BASE}/appointments/${apptId}`, {
            method: 'PUT', // Use PUT or PATCH for status change
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Status: 'Cancelled' })
        });

        const data = await response.json();

        if (response.ok) {
            showCustomModal('Success', `✅ Appointment ID ${apptId} successfully cancelled.`);
            loadAppointments(); 
        } else {
            showCustomModal('Cancellation Failed', `❌ Cancellation failed: ${data.message || 'Server error'}`);
            console.error(`❌ Cancellation failed: ${data.message || 'Server error'}`);
        }
    } catch (error) {
        showCustomModal('Network Error', `❌ Network error during cancellation. Check Node server console.`);
        console.error('❌ Network error during cancellation:', error);
    }
}

async function bookAppointment(event) {
    event.preventDefault();
    if (!currentPatient) return;

    const doctorId = document.getElementById('doctor-select').value;
    const date = document.getElementById('appt-date').value;
    const time = document.getElementById('appt-time').value;
    const messageDiv = document.getElementById('appointment-message');
    
    if (!doctorId || !date || !time) {
        messageDiv.textContent = "Please fill all appointment fields.";
        messageDiv.className = 'alert alert-danger mt-3';
        return;
    }

    // Client-side time window validation: allow 09:00-12:00 and 13:00-16:00 only
    function timeToMinutes(t) {
        const m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (!m) return null;
        const hh = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        return hh * 60 + mm;
    }

    const minutes = timeToMinutes(time);
    const inWindow = minutes !== null && ((minutes >= 9*60 && minutes < 12*60) || (minutes >= 13*60 && minutes < 16*60));
    if (!inWindow) {
        messageDiv.textContent = "Appointments allowed only between 09:00-12:00 and 13:00-16:00.";
        messageDiv.className = 'alert alert-danger mt-3';
        return;
    }

    // Enforce 10-minute slot granularity on client
    if (minutes % 10 !== 0) {
        messageDiv.textContent = 'Please select a time on a 10-minute boundary (e.g., 09:00, 09:10).';
        messageDiv.className = 'alert alert-danger mt-3';
        return;
    }

    messageDiv.textContent = 'Booking appointment...';
    messageDiv.className = 'alert alert-warning mt-3';

    try {
        const response = await fetch(`${API_BASE}/appointments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                Patient_ID: parseInt(currentPatient.Patient_ID), 
                Doctor_ID: parseInt(doctorId),
                Date: date,
                Time: time
            })
        });

        const data = await response.json();

        if (response.ok) {
            messageDiv.className = 'alert alert-success mt-3';
            messageDiv.textContent = `🎉 Success! Appointment booked with ID ${data.appointment.Appt_ID}.`;
            loadAppointments(); 
            // Refresh available slots for the selected doctor/date so the booked time is disabled
            const doctorSelect = document.getElementById('doctor-select');
            const apptDateInput = document.getElementById('appt-date');
            disableBookedSlots(doctorSelect ? doctorSelect.value : '', apptDateInput ? apptDateInput.value : '');
            document.getElementById('appointment-form').reset(); 
        } else {
            messageDiv.className = 'alert alert-danger mt-3';
            messageDiv.textContent = `❌ Booking failed: ${data.message || 'Server error'}`;
        }
    } catch (error) {
        messageDiv.className = 'alert alert-danger mt-3';
        messageDiv.textContent = `❌ Network error while booking. Check Node server console.`;
        console.error('Booking fetch error:', error);
    }
}

async function loadRecords() {
    const recordList = document.getElementById('records-list');
    if (!recordList) return;
    
    recordList.innerHTML = 'Fetching records...';

    if (!currentPatient) return;

    try {
        const response = await fetch(`${API_BASE}/records/${currentPatient.Patient_ID}`);
        const records = await response.json();

        if (records.length === 0) {
            recordList.innerHTML = '<p class="alert alert-info">No medical records found.</p>';
            return;
        }

        let html = '<table class="table table-striped table-sm"><thead><tr><th>Record ID</th><th>Date</th><th>Diagnosis</th><th>Allergies</th><th>Surgeries</th></tr></thead><tbody>';
        records.forEach(rec => {
            html += `<tr>
                        <td>${rec.Record_ID}</td>
                        <td>${rec.Date}</td>
                        <td>${rec.Diagnosis}</td>
                        <td>${rec.Allergies || 'N/A'}</td>
                        <td>${rec.Surgeries || 'N/A'}</td>
                    </tr>`;
        });
        recordList.innerHTML = html;

    } catch (error) {
        recordList.innerHTML = '<p class="alert alert-danger">Error loading records. Check Node server console.</p>';
        console.error('Records fetch error:', error);
    }
}

async function loadBills() {
    const billsList = document.getElementById('bills-list');
    if (!billsList) return;
    
    billsList.innerHTML = 'Fetching bills...';

    if (!currentPatient) return;

    try {
        const response = await fetch(`${API_BASE}/bills/${currentPatient.Patient_ID}`);
        const bills = await response.json();

        if (bills.length === 0) {
            billsList.innerHTML = '<p class="alert alert-info">No bills found.</p>';
            return;
        }

        // Remove cancelled bills (e.g., cancelled room bookings) from display and totals
        const visibleBills = bills.filter(b => (b.Payment_Status || '').toLowerCase() !== 'cancelled');

        if (visibleBills.length === 0) {
            billsList.innerHTML = '<p class="alert alert-info">No active bills found.</p>';
            return;
        }

        let html = '<table class="table table-striped table-sm"><thead><tr><th>Bill ID</th><th>Item</th><th>Amount</th><th>Status</th><th>Date Issued</th></tr></thead><tbody>';
        let totalPending = 0;

        visibleBills.forEach(bill => {
            const status = (bill.Payment_Status || '').toLowerCase();
            const statusClass = status === 'paid' ? 'text-success' : (status === 'pending' ? 'text-warning' : 'text-muted');
            if (status === 'pending') {
                totalPending += parseFloat(bill.Amount || 0);
            }

            html += `<tr>
                        <td>${bill.Bill_ID}</td>
                        <td>${bill.Item}</td>
                        <td>$${(parseFloat(bill.Amount || 0)).toFixed(2)}</td>
                        <td class="${statusClass} fw-bold">${bill.Payment_Status}</td>
                        <td>${bill.Date_Issued}</td>
                    </tr>`;
        });
        html += '</tbody></table>';

        if (totalPending > 0) {
            html += `<p class="mt-3 fw-bold text-danger">Total Pending: $${totalPending.toFixed(2)}</p>`;
        }
        
        billsList.innerHTML = html;

    } catch (error) {
        billsList.innerHTML = '<p class="alert alert-danger">Error loading bills. Check Node server console.</p>';
        console.error('Bills fetch error:', error);
    }
}

// ---------------------------
// Notifications (Patient)
// ---------------------------
async function loadNotifications() {
    const list = document.getElementById('notifications-list');
    if (!list || !currentPatient) return;
    list.innerHTML = 'Loading notifications...';

    try {
        const response = await fetch(`${API_BASE}/notifications/${currentPatient.Patient_ID}`);
        if (!response.ok) {
            list.innerHTML = '<div class="text-danger">Failed to load notifications.</div>';
            return;
        }
        const notifs = await response.json();
        if (!notifs || notifs.length === 0) {
            list.innerHTML = '<div class="text-muted">No notifications.</div>';
            return;
        }

        let html = '<ul class="list-group">';
        notifs.forEach(n => {
            const readClass = n.isRead ? 'text-secondary' : 'fw-bold text-light';
            html += `<li class="list-group-item bg-transparent d-flex justify-content-between align-items-start">
                        <div>
                            <div class="${readClass}">${escapeHtml(n.Title)}</div>
                            <div class="small text-secondary">${n.scheduledAt || n.createdAt || ''}</div>
                            <div class="small mt-1">${escapeHtml(n.Body || '')}</div>
                        </div>
                        <div>
                            ${n.isRead ? '' : `<button class="btn btn-sm btn-outline-light mark-read-btn" data-id="${n.id}">Mark read</button>`}
                        </div>
                    </li>`;
        });
        html += '</ul>';
        list.innerHTML = html;

        // Wire mark-read buttons
        document.querySelectorAll('.mark-read-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                try {
                    const r = await fetch(`${API_BASE}/notifications/${id}/read`, { method: 'PUT' });
                    if (r.ok) loadNotifications();
                } catch (e) { console.error('Mark read error', e); }
            });
        });

    } catch (error) {
        list.innerHTML = '<div class="text-danger">Network error loading notifications.</div>';
        console.error('Notifications fetch error:', error);
    }
}

// Hook notifications load when view selected
const origSetupNavigation3 = setupNavigation;
setupNavigation = function() {
    origSetupNavigation3();
    document.querySelectorAll('.nav-link-custom').forEach(link => {
        link.addEventListener('click', function(){
            const targetId = this.getAttribute('data-target');
            if (targetId === 'notifications-view') loadNotifications();
        });
    });
};


// ==========================================================
// 4. DOCTOR PORTAL FUNCTIONS 
// (Stubs maintained for completeness, though not called in Patient Portal)
// ==========================================================

async function loadMedicines() {
    console.log("Loading medicines stub.");
}
async function searchPatientRecord(event) {
    console.log("Searching patient record stub.");
}
async function submitDiagnosisAndPrescription(event) {
    console.log("Submitting diagnosis stub.");
}
async function loadDoctorAppointments() {
    console.log("Loading doctor appointments stub.");
}
async function handleGenerateSummary() {
    console.log("Generating summary stub.");
}
