// Final Node.js Express Backend with MySQL and LLM Integration
// Load .env for local development (DOTENV)
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2/promise"); 
// --- MySQL pool and helper (required for DB operations) ---
// Configure via environment variables: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    // Default password set per request (can still be overridden by env var)
    password: process.env.DB_PASSWORD || 'Raneesh@123',
    // Default database name set per request (can still be overridden by env var)
    database: process.env.DB_NAME || 'hms_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Simple query wrapper used across the app. Uses pool.execute to get rows.
async function query(sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return rows;
}
const app = express();
const path = require('path');
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Simple request logger (dev) to make incoming requests visible in server logs
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.info(`[REQ] ${new Date().toISOString()} - ${req.method} ${req.originalUrl} from ${req.ip}`);
        next();
    });
}

// Lightweight health endpoint so the frontend can quickly verify the backend is reachable
app.get('/_health', (req, res) => {
    try {
        return res.json({ ok: true, uptime: process.uptime() });
    } catch (e) {
        return res.status(500).json({ ok: false, error: String(e) });
    }
});

// Serve frontend static files from /frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// Runtime check: global fetch availability (Node 18+). If missing, warn the user.
if (typeof fetch === 'undefined') {
    console.warn('Warning: global.fetch is not available in this Node runtime. Gemini API calls will fail unless you run Node >= 18 or install a fetch polyfill (e.g., node-fetch).');
}

// --- Gemini Configuration (read from environment variable) ---
// IMPORTANT: Do NOT hard-code API keys in source. Set GEMINI_API_KEY in your environment before starting the server.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || '';

/**
 * Build a Gemini API URL for the provided model/method.
 * If GEMINI_MODEL env var is set it will be preferred. If no key is available, returns null.
 * The env var can be set to either a short model name (e.g. "text-bison-001") or a full model id
 * (e.g. "models/text-bison-001"). This helper will default to calling the generateText method.
 */
function getGeminiUrl() {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') return null;

    // Prefer explicit env override so deployers can pick the right model/version
    const modelEnv = GEMINI_MODEL && GEMINI_MODEL.trim() !== '' ? GEMINI_MODEL.trim() : null;

    // If an explicit model was provided, normalize into a URL that calls generateText by default.
    if (modelEnv) {
        // If the user provided a full resource path (starts with 'models/'), use it; otherwise build one.
        const modelPath = modelEnv.startsWith('models/') ? modelEnv : `models/${modelEnv}`;
        // Default to the generateText method which is commonly supported; some models support generateContent instead.
        return `https://generativelanguage.googleapis.com/v1/${modelPath}:generateText?key=${GEMINI_API_KEY}`;
    }

    // No explicit model chosen - fall back to a sensible default used by older examples.
    // Note: different Google Cloud accounts / API versions may expose different model names; if you see 404
    // errors, use the /debug/geminiModels endpoint (below) or set GEMINI_MODEL to a model returned by ListModels.
    return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5:generateText?key=${GEMINI_API_KEY}`;
}

// Helper: list available models from the API (requires a valid GEMINI_API_KEY)
async function listAvailableGeminiModels() {
    if (!GEMINI_API_KEY) return null;
    try {
        const url = `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`;
        const resp = await fetch(url);
        if (!resp.ok) {
            try { const txt = await resp.text(); console.warn('ListModels non-ok response:', resp.status, txt); } catch (e) { /* ignore */ }
            return null;
        }
        const j = await resp.json();
        // j.models is typically an array of model descriptors
        return j.models || j;
    } catch (err) {
        console.error('Failed to list Gemini models:', err && err.message ? err.message : err);
        return null;
    }
}

// Debug-only endpoint to show available Gemini models (useful when configuring GEMINI_MODEL)
app.get('/debug/geminiModels', async (req, res) => {
    if (!GEMINI_API_KEY) return res.status(403).json({ message: 'GEMINI_API_KEY not configured on the server.' });
    try {
        const models = await listAvailableGeminiModels();
        return res.json({ models });
    } catch (err) {
        console.error('/debug/geminiModels error:', err);
        return res.status(500).json({ message: 'Failed to list Gemini models.' });
    }
});

/**
 * Try to pick a usable model URL automatically by calling ListModels and selecting
 * the first suitable model. Returns an object { modelPath, textUrl, contentUrl }
 * or null if nothing suitable found.
 */
async function autoSelectModelUrl() {
    if (!GEMINI_API_KEY) return null;
    try {
        const models = await listAvailableGeminiModels();
        if (!models || !Array.isArray(models) || models.length === 0) return null;

        // Try to choose a model that looks like a text/generative model.
        // Model descriptors can vary; check common fields.
        let choice = null;
        for (const m of models) {
            const name = m.name || m.model || m.displayName || m.id || '';
            if (!name) continue;
            const lname = String(name).toLowerCase();
            // prefer models that contain keywords
            if (lname.includes('bison') || lname.includes('text') || lname.includes('gemini')) { choice = name; break; }
            if (!choice) choice = name; // fallback to first
        }

        if (!choice) return null;

        const modelPath = String(choice).startsWith('models/') ? String(choice) : `models/${String(choice)}`;
        const textUrl = `https://generativelanguage.googleapis.com/v1/${modelPath}:generateText?key=${GEMINI_API_KEY}`;
        const contentUrl = `https://generativelanguage.googleapis.com/v1/${modelPath}:generateContent?key=${GEMINI_API_KEY}`;
        console.info('Auto-selected Gemini model:', modelPath);
        return { modelPath, textUrl, contentUrl };
    } catch (err) {
        console.error('autoSelectModelUrl failed:', err && err.message ? err.message : err);
        return null;
    }
}



// ==========================================================
// 3. PATIENT PORTAL ENDPOINTS
// ==========================================================

// API: Get All Departments and their Doctors (GET /departments)
app.get("/departments", async (req, res) => {
    try {
        // First get all departments
        const departments = await query("SELECT * FROM Departments");
        
        // For each department, get its doctors
        for (const dept of departments) {
            const doctors = await query(
                "SELECT Doctor_ID, Name, Specialization FROM Doctors WHERE Dept_ID = ?",
                [dept.Dept_ID]
            );
            dept.doctors = doctors;
        }
        
        res.json(departments);
    } catch (error) {
        console.error("Error loading departments:", error);
        res.status(500).json({ message: "Error loading departments and doctors." });
    }
});

// API: Get Doctor Appointments (GET /appointments/doctor/:doctorId)
app.get("/appointments/doctor/:doctorId", async (req, res) => {
    const doctorId = parseInt(req.params.doctorId);

    // Add logic to ensure the ID is valid if needed

    try {
        const sql = `
            SELECT 
                A.Appt_ID, A.Date, TIME_FORMAT(A.Time, '%H:%i') as Time, A.Status, P.Name, P.Patient_ID
            FROM Appointments A
            JOIN Patients P ON A.Patient_ID = P.Patient_ID
            WHERE A.Doctor_ID = ?
            ORDER BY A.Date ASC, A.Time ASC
        `;
        const appointments = await query(sql, [doctorId]);
        
        // Return the array of appointments
        res.json(appointments); 

    } catch (error) {
        console.error("Error fetching doctor appointments:", error);
        // Return a clean 500 error response instead of the default HTML
        res.status(500).json({ message: "Internal server error loading doctor's schedule." });
    }
});

// API: Unified Login for patients and doctors (used by frontend)
app.post('/unifiedLogin', async (req, res) => {
    const { loginID, password, userType } = req.body || {};
    if (!loginID || !password || !userType) return res.status(400).json({ success: false, message: 'Missing credentials.' });

    try {
        if (process.env.NODE_ENV !== 'production') {
            console.info('/unifiedLogin attempt from', req.ip, 'loginID=', String(loginID).slice(0,50), 'userType=', userType);
        }
        if (userType === 'patient') {
            // For patients the frontend sends Name as loginID and DOB as password
                const rows = await query('SELECT Patient_ID, Name, DOB, Gender, Address, Primary_Doctor_ID FROM Patients WHERE Name = ? AND DOB = ? LIMIT 1', [loginID, password]);
            if (rows.length > 0) {
                return res.json({ success: true, role: 'patient', user: rows[0] });
            }
            // Not found -> ask frontend to show registration form
            return res.json({ success: false, registrationNeeded: true, message: 'Patient not found.' });
        } else if (userType === 'doctor') {
            // For doctors allow login by Login_ID, numeric Doctor_ID, or by Name; validate password
            try {
                const loginTrim = String(loginID || '').trim();
                const pwd = String(password || '');

                let rows = [];
                let devInfo = { matchedBy: null };

                // 1) If numeric, try Doctor_ID lookup
                if (/^\d+$/.test(loginTrim)) {
                    rows = await query('SELECT Doctor_ID, Name, Specialization, Dept_ID, Login_ID, Password FROM Doctors WHERE Doctor_ID = ? LIMIT 1', [parseInt(loginTrim)]);
                    if (rows.length) devInfo.matchedBy = 'Doctor_ID';
                }

                // 2) Try Login_ID match (common case: 'charles', 'diana')
                if (rows.length === 0) {
                    rows = await query('SELECT Doctor_ID, Name, Specialization, Dept_ID, Login_ID, Password FROM Doctors WHERE Login_ID = ? LIMIT 1', [loginTrim]);
                    if (rows.length) devInfo.matchedBy = 'Login_ID';
                }

                // 3) Try exact name match
                if (rows.length === 0) {
                    rows = await query('SELECT Doctor_ID, Name, Specialization, Dept_ID, Login_ID, Password FROM Doctors WHERE Name = ? LIMIT 1', [loginTrim]);
                    if (rows.length) devInfo.matchedBy = 'Name';
                }

                // 4) Case-insensitive name match as fallback
                if (rows.length === 0) {
                    rows = await query('SELECT Doctor_ID, Name, Specialization, Dept_ID, Login_ID, Password FROM Doctors WHERE LOWER(Name) = LOWER(?) LIMIT 1', [loginTrim]);
                    if (rows.length) devInfo.matchedBy = 'lower(Name)';
                }

                if (rows.length === 0) {
                    console.info('/unifiedLogin: doctor not found for', loginTrim);
                    const resp = { success: false, message: 'Doctor not found. Check Login ID, Name or numeric Doctor ID.' };
                    if (process.env.NODE_ENV !== 'production') resp.devInfo = devInfo;
                    return res.status(404).json(resp);
                }

                const doctor = rows[0];
                // Simple password check (plaintext in DB for this demo). In production use hashed passwords.
                if (!pwd || pwd !== String(doctor.Password)) {
                    console.info('/unifiedLogin: incorrect password for', loginTrim);
                    const resp = { success: false, message: 'Incorrect password.' };
                    if (process.env.NODE_ENV !== 'production') resp.devInfo = { matchedBy: devInfo.matchedBy || 'found' };
                    return res.status(401).json(resp);
                }

                // Remove password before sending user object
                const safeUser = { Doctor_ID: doctor.Doctor_ID, Name: doctor.Name, Specialization: doctor.Specialization, Dept_ID: doctor.Dept_ID, Login_ID: doctor.Login_ID };
                console.info('/unifiedLogin: doctor login success for', safeUser.Name || safeUser.Doctor_ID);
                const resp = { success: true, role: 'doctor', user: safeUser };
                if (process.env.NODE_ENV !== 'production') resp.devInfo = { matchedBy: devInfo.matchedBy || 'found' };
                return res.json(resp);
            } catch (e) {
                console.error('/unifiedLogin doctor lookup error:', e);
                return res.status(500).json({ success: false, message: 'Server error during doctor login.' });
            }
        }

        return res.status(400).json({ success: false, message: 'Unsupported userType.' });
    } catch (error) {
        console.error('/unifiedLogin error:', error);
        return res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

// API: Register patient and login (used when registrationNeeded is returned)
app.post('/registerAndLogin', async (req, res) => {
    const { Name, DOB, Gender, Address } = req.body || {};
    if (!Name || !DOB || !Gender || !Address) return res.status(400).json({ success: false, message: 'Missing registration fields.' });

    try {
        const insertSql = 'INSERT INTO Patients (Name, DOB, Gender, Address) VALUES (?, ?, ?, ?)';
        const result = await query(insertSql, [Name, DOB, Gender, Address]);
        const patientId = result && result.insertId ? result.insertId : null;
            const patientRows = await query('SELECT Patient_ID, Name, DOB, Gender, Address, Primary_Doctor_ID FROM Patients WHERE Patient_ID = ? LIMIT 1', [patientId]);
        return res.json({ success: true, patient: patientRows[0] });
    } catch (error) {
        console.error('/registerAndLogin error:', error);
        return res.status(500).json({ success: false, message: 'Failed to register patient.' });
    }
});

// API: Get patient summary and latest record for doctor portal (GET /patient/record/:patientId)
app.get('/patient/record/:patientId', async (req, res) => {
    const patientId = parseInt(req.params.patientId);
    if (Number.isNaN(patientId)) return res.status(400).json({ message: 'Invalid patient ID.' });

    try {
        const patients = await query('SELECT Patient_ID, Name, DOB, Gender, Address, Primary_Doctor_ID FROM Patients WHERE Patient_ID = ? LIMIT 1', [patientId]);
        if (!patients || patients.length === 0) return res.status(404).json({ message: 'Patient not found.' });
        const patient = patients[0];

        const recRows = await query('SELECT Diagnosis, Allergies, Surgeries, Date FROM Medical_Record WHERE Patient_ID = ? ORDER BY Date DESC LIMIT 1', [patientId]);
        const latestRecord = recRows.length ? recRows[0] : { Diagnosis: null, Allergies: null, Surgeries: null };

        res.json({ patient, record: latestRecord });
    } catch (error) {
        console.error('/patient/record error:', error);
        res.status(500).json({ message: 'Failed to load patient record.' });
    }
});

// API 10: Get Wards and Rooms (GET /wards)
app.get("/wards", async (req, res) => {
    try {
        const wards = await query("SELECT Ward_ID, Ward_Name FROM Wards");
        const rooms = await query("SELECT Room_ID, Ward_ID, Type, Availability, Patient_ID_Occupying FROM Rooms");

        const result = wards.map(ward => ({
            ...ward,
            rooms: rooms.filter(r => r.Ward_ID === ward.Ward_ID).map(r => ({
                Room_ID: r.Room_ID,
                Type: r.Type,
                Availability: r.Availability,
                Patient_ID_Occupying: r.Patient_ID_Occupying
            }))
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error loading wards and rooms." });
    }
});

// API 11: Book Room (POST /bookRoom)
app.post("/bookRoom", async (req, res) => {
    const { Patient_ID, Room_ID } = req.body;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Check if room is available and get Ward_ID
        // Room_ID is VARCHAR in your schema, so we use it directly
        const [roomCheck] = await connection.execute("SELECT Ward_ID, Availability FROM Rooms WHERE Room_ID = ?", [Room_ID]);
        if (roomCheck.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Room not found." });
        }
        if (roomCheck[0].Availability !== "Available") {
            await connection.rollback();
            return res.status(400).json({ message: "Room is already occupied." });
        }

        // 2. Update Room Status
        const patId = parseInt(Patient_ID); // Patient_ID is INT
        const updateRoomSql = "UPDATE Rooms SET Availability = 'Unavailable', Patient_ID_Occupying = ? WHERE Room_ID = ?";
        await connection.execute(updateRoomSql, [patId, Room_ID]);

        // 3. Create Bill
        const item = `Room Booking (${Room_ID} - Ward ${roomCheck[0].Ward_ID})`;
        const insertBillSql = "INSERT INTO Bills (Patient_ID, Item, Amount, Payment_Status, Date_Issued) VALUES (?, ?, ?, 'Pending', CURDATE())";
        const [billResult] = await connection.execute(insertBillSql, [patId, item, 5000.00]);

        await connection.commit();
        res.json({ message: "Room booked successfully. Bill generated.", Room_ID: Room_ID, Bill_ID: billResult.insertId });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Room booking transaction failed:", error);
        res.status(500).json({ message: "Failed to book room due to a database error." });
    } finally {
        if (connection) connection.release();
    }
});

// API: List available medicines (GET /medicines)
app.get('/medicines', async (req, res) => {
    try {
        // Try to read from Medicine table if present
        const meds = await query('SELECT Medicine_ID, Name, Stock FROM Medicine');
        // If database returned an array, send it; otherwise fallback to a safe empty array
        if (Array.isArray(meds)) return res.json(meds);
    } catch (err) {
        // If the DB table doesn't exist or query fails, fall back to a small stub list for dev
        console.warn('/medicines fallback activated (DB query failed):', err && err.message ? err.message : err);
    }

    // Safe stub data so frontend can function during development without a populated DB
    return res.json([
        { Medicine_ID: 1, Name: 'Paracetamol 500mg', Stock: 100 },
        { Medicine_ID: 2, Name: 'Amoxicillin 250mg', Stock: 25 },
        { Medicine_ID: 3, Name: 'Cetirizine 10mg', Stock: 50 }
    ]);
});

// API: Get prescription history for a patient
app.get('/prescriptions/:patientId', async (req, res) => {
    const patientId = parseInt(req.params.patientId);
    if (Number.isNaN(patientId)) {
        return res.status(400).json({ message: 'Invalid patient ID.' });
    }

    try {
        // Query prescriptions with medicine names
        const sql = `
            SELECT 
                PR.Prescription_ID,
                M.Name AS Medicine_Name,
                PR.Quantity,
                DATE_FORMAT(PR.Date_Prescribed, '%Y-%m-%d') AS Date_Prescribed
            FROM Prescription PR
            JOIN Medicine M ON PR.Medicine_ID = M.Medicine_ID
            WHERE PR.Patient_ID = ?
            ORDER BY PR.Date_Prescribed DESC`;

        const rows = await query(sql, [patientId]);
        
        // During development, if tables don't exist, return empty array
        if (!Array.isArray(rows)) {
            console.warn('Prescription query returned non-array:', rows);
            return res.json([]);
        }

        return res.json(rows);
    } catch (error) {
        console.error('Error fetching prescriptions:', error);
        // During development, return empty array on error for graceful fallback
        if (process.env.NODE_ENV !== 'production') {
            console.warn('Returning empty array for prescriptions in development');
            return res.json([]);
        }
        return res.status(500).json({ message: 'Failed to load prescriptions.' });
    }
});

// API: Get prescriptions for a patient (GET /prescriptions/:patientId)
app.get('/prescriptions/:patientId', async (req, res) => {
    const patientId = parseInt(req.params.patientId);
    if (Number.isNaN(patientId)) return res.status(400).json({ message: 'Invalid patient ID.' });

    try {
        const sql = `SELECT PR.Record_ID, PR.Patient_ID, PR.Medicine_ID, M.Name AS Medicine_Name, PR.Quantity, DATE_FORMAT(PR.Date_Prescribed, '%Y-%m-%d') AS Date_Prescribed
                     FROM Prescription PR
                     LEFT JOIN Medicine M ON PR.Medicine_ID = M.Medicine_ID
                     WHERE PR.Patient_ID = ?
                     ORDER BY PR.Date_Prescribed DESC`;
        const rows = await query(sql, [patientId]);
        return res.json(rows || []);
    } catch (error) {
        console.error('/prescriptions error:', error);
        return res.status(500).json({ message: 'Failed to load prescriptions.' });
    }
});

// API: Submit a new prescription (POST /submitPrescription)
app.post('/submitDiagnosis', async (req, res) => { // keeping old URL for compatibility
    const { Doctor_ID, Patient_ID, Diagnosis, Medicine_ID, Quantity } = req.body || {};

    console.log('submitDiagnosis request:', { Doctor_ID, Patient_ID, Diagnosis, Medicine_ID, Quantity });

    if (!Doctor_ID || !Patient_ID) {
        console.log('Missing required fields:', { Doctor_ID, Patient_ID });
        return res.status(400).json({ message: 'Doctor_ID and Patient_ID are required.' });
    }

    // Validate data types
    if (!Number.isInteger(parseInt(Doctor_ID)) || !Number.isInteger(parseInt(Patient_ID))) {
        console.log('Invalid ID format:', { Doctor_ID, Patient_ID });
        return res.status(400).json({ message: 'Invalid Doctor_ID or Patient_ID format.' });
    }

    if (Medicine_ID && (!Number.isInteger(parseInt(Medicine_ID)) || !Number.isInteger(parseInt(Quantity)))) {
        console.log('Invalid medicine data:', { Medicine_ID, Quantity });
        return res.status(400).json({ message: 'Invalid Medicine_ID or Quantity format.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        let prescriptionCount = 0;
        // Only handle prescription if medicine and quantity are provided
        if (Medicine_ID && parseInt(Quantity) > 0) {
            const qty = parseInt(Quantity);

            // Check stock
            const [medRows] = await connection.execute('SELECT Medicine_ID, Stock FROM Medicine WHERE Medicine_ID = ? FOR UPDATE', [Medicine_ID]);
            if (medRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'Medicine not found.' });
            }
            const med = medRows[0];
            if (med.Stock < qty) {
                await connection.rollback();
                return res.status(400).json({ message: 'Insufficient medicine stock.' });
            }

            const insertPresSql = 'INSERT INTO Prescription (Patient_ID, Medicine_ID, Quantity, Date_Prescribed, Doctor_ID) VALUES (?, ?, ?, CURDATE(), ?)';
            const [presResult] = await connection.execute(insertPresSql, [Patient_ID, Medicine_ID, qty, Doctor_ID]);
            prescriptionCount = presResult && presResult.affectedRows ? 1 : 0;

            // Decrement stock
            await connection.execute('UPDATE Medicine SET Stock = Stock - ? WHERE Medicine_ID = ?', [qty, Medicine_ID]);
            
            await connection.commit();
            return res.json({ success: true, prescriptionCount });
        } else {
            await connection.rollback();
            return res.status(400).json({ message: 'No medicine or quantity specified for prescription.' });
        }
    } catch (error) {
        try { if (connection) await connection.rollback(); } catch (e) { console.error('Rollback failed:', e); }
        
        // Log detailed error information
        console.error('/submitDiagnosis error details:', {
            error: error.message,
            sqlMessage: error.sqlMessage,
            sqlState: error.sqlState,
            errno: error.errno,
            code: error.code
        });

        // Provide more specific error messages based on the error type
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ message: 'Invalid Doctor_ID or Patient_ID (not found in database).' });
        } else if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Record already exists.' });
        } else if (error.code === 'ER_DATA_TOO_LONG') {
            return res.status(400).json({ message: 'Diagnosis text is too long.' });
        }
        
        return res.status(500).json({ 
            message: 'Failed to submit diagnosis.',
            details: error.sqlMessage || error.message 
        });
    } finally {
        try { if (connection) connection.release(); } catch (e) { /* ignore */ }
    }
});

// API 12: Cancel Room Booking (DELETE /room/:roomId/:patientId)
app.delete("/room/:roomId/:patientId", async (req, res) => {
    const { roomId, patientId } = req.params;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Check ownership and update Room Status
        // Validate patientId
        const patId = parseInt(patientId);
        if (Number.isNaN(patId)) {
            return res.status(400).json({ message: "Invalid patient ID." });
        }

        const resetRoomSql = "UPDATE Rooms SET Availability = 'Available', Patient_ID_Occupying = NULL WHERE Room_ID = ? AND Patient_ID_Occupying = ?";
        const [roomUpdateResult] = await connection.execute(resetRoomSql, [roomId, patId]);

        if (roomUpdateResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Room was not occupied by this patient or room not found." });
        }

        // 2. Find associated PENDING Bill and remove it
        const findBillSql = "SELECT Bill_ID FROM Bills WHERE Patient_ID = ? AND Payment_Status = 'Pending' AND Item LIKE ? LIMIT 1";
        const itemPattern = `Room Booking (${roomId} - %`;
        const [foundBills] = await connection.execute(findBillSql, [patId, itemPattern]);

        let billStatus = 'but no pending bill was found to remove.';
        let deletedBillId = null;

        if (foundBills.length > 0) {
            deletedBillId = foundBills[0].Bill_ID;
            const deleteBillSql = "DELETE FROM Bills WHERE Bill_ID = ? LIMIT 1";
            const [deleteResult] = await connection.execute(deleteBillSql, [deletedBillId]);
            if (deleteResult.affectedRows > 0) {
                billStatus = 'and pending bill removed.';
            } else {
                // If delete failed for some reason, roll back
                await connection.rollback();
                return res.status(500).json({ message: 'Failed to remove pending bill during cancellation.' });
            }
        }

        await connection.commit();

        res.json({ message: `Room ${roomId} booking successfully cancelled ${billStatus}`, Room_ID: roomId, Bill_ID: deletedBillId });

    } catch (error) {
        try { if (connection) await connection.rollback(); } catch (e) { console.error('Rollback failed:', e); }
        console.error("Room cancellation transaction failed:", error);
        res.status(500).json({ message: "Failed to cancel room due to a database error.", error: error.message });
    } finally {
        try { if (connection) connection.release(); } catch (e) { console.error('Connection release failed:', e); }
    }
});

// API 13: Create Appointment (POST /appointments)
app.post("/appointments", async (req, res) => {
    const { Patient_ID, Doctor_ID, Date, Time } = req.body;
    
    if (!Patient_ID || !Doctor_ID || !Date || !Time) {
        return res.status(400).json({ message: "Missing required appointment fields" });
    }

    // Ensure IDs are integers for SQL safety
    const patId = parseInt(Patient_ID);
    const docId = parseInt(Doctor_ID);
    
    // Validate time falls into allowed booking windows: 09:00-12:00 and 13:00-16:00
    function timeToMinutes(t) {
        if (!t || typeof t !== 'string') return null;
        const m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (!m) return null;
        const hh = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
        return hh * 60 + mm;
    }

    const minutes = timeToMinutes(Time);
    if (minutes === null) {
        return res.status(400).json({ message: 'Invalid time format. Use HH:MM (24-hour).' });
    }

    // Enforce 10-minute slot granularity
    if (minutes % 10 !== 0) {
        return res.status(400).json({ message: 'Appointments must be on 10-minute boundaries (e.g., 09:00, 09:10).'});
    }

    const morningStart = 9 * 60; // 09:00
    const morningEnd = 12 * 60;  // 12:00 (exclusive)
    const afternoonStart = 13 * 60; // 13:00
    const afternoonEnd = 16 * 60;   // 16:00 (exclusive)

    const inAllowedWindow = (minutes >= morningStart && minutes < morningEnd) || (minutes >= afternoonStart && minutes < afternoonEnd);
    if (!inAllowedWindow) {
        return res.status(400).json({ message: 'Appointments can only be booked between 09:00-12:00 and 13:00-16:00.' });
    }
    try {
        // 1. Prevent double-booking: check if the doctor already has a Scheduled appointment at this Date+Time
        const conflictSql = "SELECT Appt_ID FROM Appointments WHERE Doctor_ID = ? AND Date = ? AND Time = ? AND Status = 'Scheduled' LIMIT 1";
        const conflicts = await query(conflictSql, [docId, Date, Time]);
        if (conflicts.length > 0) {
            return res.status(409).json({ message: "Selected time slot is no longer available for this doctor." });
        }

        const sql = "INSERT INTO Appointments (Patient_ID, Doctor_ID, Date, Time, Status) VALUES (?, ?, ?, ?, 'Scheduled')";
        const result = await query(sql, [patId, docId, Date, Time]);

        const insertId = result && result.insertId ? result.insertId : null;
        const newAppointment = { Appt_ID: insertId, Patient_ID: patId, Doctor_ID: docId, Date, Time, Status: 'Scheduled' };
        res.status(201).json({ message: "Appointment booked successfully", appointment: newAppointment });

    } catch (error) {
        console.error("Failed to book appointment:", error);
        res.status(500).json({ message: "Failed to book appointment.", error: error.message });
    }
});

// API 14: Update Appointment Status (PUT /appointments/:apptId)
app.put("/appointments/:apptId", async (req, res) => {
    const apptId = parseInt(req.params.apptId);
    const { Status } = req.body;

    if (Number.isNaN(apptId)) {
        return res.status(400).json({ message: "Invalid appointment ID." });
    }
    if (!Status) {
        return res.status(400).json({ message: "Missing Status in request body." });
    }

    try {
        const conn = await pool.getConnection();
        try {
            const [result] = await conn.execute("UPDATE Appointments SET Status = ? WHERE Appt_ID = ?", [Status, apptId]);
            // result.affectedRows is available on OkPacket
            if (!result || result.affectedRows === 0) {
                return res.status(404).json({ message: `Appointment ID ${apptId} not found.` });
            }
            res.json({ message: `Appointment ID ${apptId} status updated to ${Status}.` });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Failed to update appointment status:', error);
        res.status(500).json({ message: "Failed to update appointment status.", error: error.message });
    }
});

// API 15: Get Patient Appointments (GET /appointments/:patientId)
app.get("/appointments/:patientId", async (req, res) => {
    const patientId = parseInt(req.params.patientId);

    try {
        const sql = `
            SELECT 
                A.Appt_ID, A.Date, TIME_FORMAT(A.Time, '%H:%i') as Time, A.Status, D.Name AS Doctor_Name
            FROM Appointments A
            JOIN Doctors D ON A.Doctor_ID = D.Doctor_ID
            WHERE A.Patient_ID = ?
            ORDER BY A.Date DESC, A.Time DESC
        `;
        const appointments = await query(sql, [patientId]);
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: "Error loading appointments." });
    }
});

// Function to handle fetching appointments by DOCTOR ID
app.get("/appointments/doctor/:doctorId", async (req, res) => {
    // 1. Extract and validate the Doctor ID from the URL parameters
    const doctorId = parseInt(req.params.doctorId);

    // Basic validation to ensure a valid number was passed
    if (isNaN(doctorId)) {
        return res.status(400).json({ message: "Invalid Doctor ID format." });
    }

    try {
        // 2. SQL Query: Select appointments based on Doctor_ID
        const sql = `
            SELECT 
                A.Appt_ID, A.Date, TIME_FORMAT(A.Time, '%H:%i') as Time, A.Status, 
                P.Name, P.Patient_ID
            FROM Appointments A
            JOIN Patients P ON A.Patient_ID = P.Patient_ID
            WHERE A.Doctor_ID = ?
            ORDER BY A.Date ASC, A.Time ASC
        `;
        
        // Assuming 'query' is your database utility function
        const appointments = await query(sql, [doctorId]);
        
        // 3. Success Response: Return the data
        res.json(appointments); 

    } catch (error) {
        console.error("Error fetching doctor appointments:", error);
        // 4. Error Response: Return a clean JSON error response (not HTML)
        res.status(500).json({ message: "Internal server error loading doctor's schedule." });
    }
});


// Your existing route for patient appointments should remain:
app.get("/appointments/:patientId", async (req, res) => {
    const patientId = parseInt(req.params.patientId);

    try {
        const sql = `
            SELECT 
                A.Appt_ID, A.Date, TIME_FORMAT(A.Time, '%H:%i') as Time, A.Status, D.Name AS Doctor_Name
            FROM Appointments A
            JOIN Doctors D ON A.Doctor_ID = D.Doctor_ID
            WHERE A.Patient_ID = ?
            ORDER BY A.Date DESC, A.Time DESC
        `;
        const appointments = await query(sql, [patientId]);
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: "Error loading appointments." });
    }
});
// API 16: Get All Medical Records for Patient (GET /records/:patientId)
app.get("/records/:patientId", async (req, res) => {
    const patientId = parseInt(req.params.patientId);
    
    try {
        const sql = "SELECT Record_ID, Diagnosis, Allergies, Surgeries, Date FROM Medical_Record WHERE Patient_ID = ? ORDER BY Date DESC";
        const records = await query(sql, [patientId]);
        res.json(records);
    } catch (error) {
        res.status(500).json({ message: "Error loading medical records." });
    }
});
// Function to handle fetching a single patient record by ID
app.get("/patient/record/:patientId", async (req, res) => {
    // 1. Extract and convert the patient ID from the URL
    const patientId = parseInt(req.params.patientId);

    // Basic validation
    if (isNaN(patientId)) {
        return res.status(400).json({ message: "Invalid Patient ID format." });
    }

    try {
        // 2. SQL Query: Select patient data based on Patient_ID
        //    NOTE: Adjust the SQL query to match your actual table and column names
        const sql = `
            SELECT * FROM Patients 
            WHERE Patient_ID = ?
        `;
        
        // Assuming 'query' is your database utility function
        const patientRecord = await query(sql, [patientId]);
        
        // 3. Handle 'Patient Not Found' cleanly
        if (patientRecord.length === 0) {
            // Return a 404 with a JSON message, NOT the default HTML error
            return res.status(404).json({ message: `Patient with ID ${patientId} not found.` });
        }
        
        // 4. Success Response: Return the data
        res.json(patientRecord[0]); // Assuming Patient_ID is unique, return the single object

    } catch (error) {
        console.error("Error fetching patient record:", error);
        // 5. Error Response: Return a clean JSON error for server issues
        res.status(500).json({ message: "Internal server error loading patient record." });
    }
});
// API 17: Get Latest Medical Record for Patient Profile (GET /records/latest/:patientId)
app.get("/records/latest/:patientId", async (req, res) => {
    const patientId = parseInt(req.params.patientId);
    const sql = "SELECT Diagnosis, Allergies, Surgeries FROM Medical_Record WHERE Patient_ID = ? ORDER BY Date DESC LIMIT 1";
    try {
        const records = await query(sql, [patientId]);
        res.json({ record: records[0] });
    } catch (error) {
        res.status(500).json({ message: "Error fetching latest record." });
    }
});

// API 18: Get Bills (GET /bills/:patientId)
app.get("/bills/:patientId", async (req, res) => {
    const patientId = parseInt(req.params.patientId);
    if (Number.isNaN(patientId)) {
        return res.status(400).json({ message: "Invalid patient ID." });
    }

    // Format Date_Issued for client consumption (ISO YYYY-MM-DD)
    const sql = `SELECT Bill_ID, Item, Amount, Payment_Status, DATE_FORMAT(Date_Issued, '%Y-%m-%d') AS Date_Issued FROM Bills WHERE Patient_ID = ? ORDER BY Date_Issued DESC`;
    try {
        const bills = await query(sql, [patientId]);
        res.json(bills);
    } catch (error) {
        console.error("Error fetching bills for patient", patientId, error);
        res.status(500).json({ message: "Error fetching bills." });
    }
});

// API 19: Chat Assistant for Patients (POST /chat)
// This endpoint collects patient context (latest medical record, prescriptions, appointments)
// and constructs a prompt for an LLM. If GEMINI_API_KEY is empty, it returns a safe fallback reply.
app.post('/chat', async (req, res) => {
    const { patientId, message } = req.body || {};
    if (!patientId || !message) return res.status(400).json({ message: 'patientId and message are required.' });

    try {
        // 1. Gather patient basic info
        const patientRows = await query('SELECT Patient_ID, Name, DOB, Gender FROM Patients WHERE Patient_ID = ?', [patientId]);
        if (patientRows.length === 0) return res.status(404).json({ message: 'Patient not found.' });
        const patient = patientRows[0];

        // 2. Latest medical record
        const recRows = await query('SELECT Diagnosis, Allergies, Surgeries, Date FROM Medical_Record WHERE Patient_ID = ? ORDER BY Date DESC LIMIT 1', [patientId]);
        const latestRecord = recRows.length ? recRows[0] : { Diagnosis: 'N/A', Allergies: 'N/A', Surgeries: 'N/A' };

        // 3. Recent prescriptions (last 10)
        const pres = await query(`SELECT PR.Date_Prescribed, M.Name AS Medicine_Name, PR.Quantity
                                  FROM Prescription PR JOIN Medicine M ON PR.Medicine_ID = M.Medicine_ID
                                  WHERE PR.Patient_ID = ? ORDER BY PR.Date_Prescribed DESC LIMIT 10`, [patientId]);

        // 4. Upcoming appointments
        const appts = await query(`SELECT Date, TIME_FORMAT(Time, '%H:%i') as Time, Status, D.Name as Doctor_Name
                                   FROM Appointments A JOIN Doctors D ON A.Doctor_ID = D.Doctor_ID
                                   WHERE A.Patient_ID = ? ORDER BY Date DESC LIMIT 10`, [patientId]);

        // 5. Build a short context payload for the LLM
        const contextParts = [];
        contextParts.push(`Patient Name: ${patient.Name}, DOB: ${patient.DOB}, Gender: ${patient.Gender}`);
        contextParts.push(`Latest Diagnosis: ${latestRecord.Diagnosis || 'N/A'} (on ${latestRecord.Date || 'N/A'})`);
        contextParts.push(`Allergies: ${latestRecord.Allergies || 'None'}`);
        contextParts.push(`Past Surgeries: ${latestRecord.Surgeries || 'None'}`);
        if (pres.length) {
            contextParts.push('Recent Prescriptions: ' + pres.map(p => `${p.Medicine_Name} (Qty: ${p.Quantity}) on ${p.Date_Prescribed}`).join('; '));
        }
        if (appts.length) {
            contextParts.push('Appointments: ' + appts.map(a => `${a.Date} ${a.Time} (${a.Status}) with Dr. ${a.Doctor_Name}`).join('; '));
        }

        const systemInstruction = `You are a supportive medical assistant. Use the provided patient context (medical history, diagnoses, allergies, prescriptions, recent appointments) and publicly available medical knowledge to: 1) analyze symptoms described by the user, 2) suggest a non-prescriptive diet plan and general lifestyle recommendations, and 3) answer basic medical questions. Always include safety disclaimers, avoid providing prescriptions or diagnoses that require in-person evaluation, and encourage consultation with the patient's physician where appropriate.`;

        const prompt = `Patient Context:\n${contextParts.join('\n')}\n\nUser Message:\n${message}\n\nAssistant:`;

        // Helper: format text into numbered bullet points (keeps first few sentences)
        function toNumberedBullets(text, maxItems = 5) {
            if (!text) return '';
            // Split into sentences by punctuation (simple heuristic)
            const parts = String(text).split(/(?<=[\.\!\?])\s+/).map(s => s.trim()).filter(Boolean);
            const items = parts.slice(0, maxItems);
            return items.map((it, i) => `${i+1}) ${it.replace(/\n+/g, ' ').trim()}`).join('\n');
        }

        // Prepare a concise, redacted fallback summary for the client (always defined)
        const medNames = pres && pres.length ? pres.map(p => p.Medicine_Name).slice(0,3).join(', ') : 'None';
        const shortContext = `Latest Diagnosis: ${latestRecord.Diagnosis || 'N/A'}; Allergies: ${latestRecord.Allergies || 'None'}; Recent Medications: ${medNames}`;
        const fallbackPlain = `I can help with general, non-prescriptive advice based on your record. Summary: ${shortContext}. Based on your message: ${message}. Recommended next steps: If symptoms are severe or worsening seek immediate care. For diet recommendations, prefer balanced meals, hydration, and avoid known allergens. Book an appointment with your doctor for personalized medical advice.`;
        const fallback = toNumberedBullets(fallbackPlain, 5);

        // If Gemini API key is not configured, return the fallback and log context server-side
        let geminiUrl = getGeminiUrl();
        let geminiTextUrl = null;
        let geminiContentUrl = null;
        if (!GEMINI_API_KEY || !geminiUrl) {
            // try auto-selecting a model from the API
            const picked = await autoSelectModelUrl();
            if (picked) {
                geminiTextUrl = picked.textUrl;
                geminiContentUrl = picked.contentUrl;
                // prefer the text endpoint first
                geminiUrl = geminiTextUrl;
            }
        } else {
            // GEMINI_MODEL or default getGeminiUrl() returned a text-style URL
            geminiTextUrl = geminiUrl;
            // derive a content URL variant for fallback
            geminiContentUrl = geminiTextUrl.replace(':generateText', ':generateContent');
        }

        if (!GEMINI_API_KEY || !geminiUrl) {
            console.info('Chat fallback invoked. Full patient context (server-side):', contextParts.join(' | '));
            return res.json({ reply: fallback, source: 'fallback' });
        }

        // 6. Call Gemini API
        // Try a primary payload (for generateText/gemini text endpoints) then fallback to content-style endpoint
        const candidatePayloads = [
            // Gemini Pro API format
            { 
                contents: [{
                    parts: [{
                        text: systemInstruction + '\n\n' + prompt
                    }]
                }],
                generationConfig: {
                    maxOutputTokens: 512,
                    temperature: 0.2
                }
            },
            // Fallback format
            { 
                contents: [{
                    parts: [{
                        text: systemInstruction + '\n\n' + prompt
                    }]
                }]
            }
        ];

        let finalApiResult = null;
        let generated = null;

    for (const pld of candidatePayloads) {
            if (process.env.NODE_ENV !== 'production') {
                console.info('Trying Gemini payload shape (dev-only):', Object.keys(pld));
            }

            try {
                const resp = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pld)
                });

                let result = null;
                try { result = await resp.json(); } catch (err) {
                    // If not JSON, try raw text for debugging
                    const raw = await resp.text();
                    console.error('Gemini non-JSON response for payload shape', Object.keys(pld), 'status', resp.status, 'text:', raw);
                    if (!resp.ok) continue; else continue;
                }

                if (!resp.ok) {
                    console.error('Gemini returned non-OK for payload shape', Object.keys(pld), 'status', resp.status, result);
                    continue;
                }

                // Get text from Gemini API response
                generated = result.candidates?.[0]?.content?.parts?.[0]?.text || null;

                finalApiResult = result;

                if (generated) break; // success
            } catch (err) {
                console.error('Exception while calling Gemini for payload shape', Object.keys(pld), err);
                continue;
            }
        }

        if (!generated && geminiContentUrl) {
            // Try the content-style endpoint as a fallback (some models expose generateContent instead)
            console.info('Primary Gemini attempts failed; trying content endpoint fallback.');
            geminiUrl = geminiContentUrl;
            for (const pld of candidatePayloads) {
                if (process.env.NODE_ENV !== 'production') console.info('Trying Gemini content payload shape (dev-only):', Object.keys(pld));
                try {
                    const resp = await fetch(geminiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(pld)
                    });
                    let result = null;
                    try { result = await resp.json(); } catch (err) { const raw = await resp.text(); console.error('Gemini non-JSON response for content endpoint', raw); continue; }
                    if (!resp.ok) { console.error('Gemini content endpoint non-ok:', resp.status, result); continue; }
                    generated = result.candidates?.[0]?.content?.parts?.[0]?.text || null;
                    finalApiResult = result;
                    if (generated) break;
                } catch (err) {
                    console.error('Exception while calling Gemini content endpoint', err);
                    continue;
                }
            }
        }

        if (!generated) {
            console.error('All Gemini payload attempts failed. Last API result:', finalApiResult);
            return res.json({ reply: fallback, source: 'fallback' });
        }

        // Ensure the assistant reply is concise bullet points. If the model didn't return bullets,
        // convert top sentences into numbered bullets for consistency.
        const generatedBullets = toNumberedBullets(generated, 6);

        return res.json({ reply: generatedBullets || generated, source: 'gemini' });

    } catch (error) {
        console.error('Chat assistant error:', error);
        return res.status(500).json({ message: 'Failed to produce assistant response.' });
    }
});

// API 20: Patient Timeline (GET /timeline/:patientId)
// Returns aggregated events (medical records, prescriptions, appointments) ordered by date desc
app.get('/timeline/:patientId', async (req, res) => {
    const patientId = parseInt(req.params.patientId);
    const page = parseInt(req.query.page || '1');
    const pageSize = Math.min(50, Math.max(5, parseInt(req.query.pageSize || '10')));

    if (Number.isNaN(patientId)) return res.status(400).json({ message: 'Invalid patient ID.' });

    try {
        // 1. Medical records
        const records = await query(`SELECT Record_ID as id, Date as date, Diagnosis as title, Allergies, Surgeries, 'record' as type FROM Medical_Record WHERE Patient_ID = ?`, [patientId]);

        // 2. Prescriptions
        const prescriptions = await query(`SELECT PR.Record_ID as id, PR.Date_Prescribed as date, M.Name as title, PR.Quantity, 'prescription' as type FROM Prescription PR JOIN Medicine M ON PR.Medicine_ID = M.Medicine_ID WHERE PR.Patient_ID = ?`, [patientId]);

        // 3. Appointments
        const appointments = await query(`SELECT Appt_ID as id, Date as date, TIME_FORMAT(Time, '%H:%i') as time, Status, 'appointment' as type FROM Appointments WHERE Patient_ID = ?`, [patientId]);

        // Normalize events into a single array
        const events = [];
        records.forEach(r => events.push({ type: 'record', id: r.id, date: r.date, title: r.title, details: { Allergies: r.Allergies, Surgeries: r.Surgeries } }));
        prescriptions.forEach(p => events.push({ type: 'prescription', id: p.id, date: p.date, title: p.title, details: { Quantity: p.Quantity } }));
        appointments.forEach(a => events.push({ type: 'appointment', id: a.id, date: a.date + ' ' + (a.time || '00:00'), title: `Appointment (${a.Status})`, details: { Time: a.time, Status: a.Status } }));

        // Sort by date desc
        events.sort((a,b) => new Date(b.date) - new Date(a.date));

        // Pagination
        const total = events.length;
        const start = (page - 1) * pageSize;
        const pageEvents = events.slice(start, start + pageSize);

        res.json({ total, page, pageSize, events: pageEvents });
    } catch (error) {
        console.error('Timeline error:', error);
        res.status(500).json({ message: 'Failed to load timeline.' });
    }
});

// Dev-only: debug endpoint to test OpenAI Chat Completions payloads
// POST /debug/openai-test with JSON body { payload: {...}, model?: 'model-id' }
// Returns raw provider response (status, headers, body) to aid iterative debugging.
app.post('/debug/gemini-test', async (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ message: 'Debug endpoint disabled in production.' });

    const { payload, modelUrl, modelPath } = req.body || {};
    if (!payload) return res.status(400).json({ message: 'payload field is required in JSON body.' });

    let geminiUrl = null;
    if (modelUrl) {
        geminiUrl = modelUrl;
    } else if (modelPath) {
        // Build the full URL server-side using the configured GEMINI_API_KEY to avoid exposing the key
        if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') return res.status(400).json({ message: 'No GEMINI_API_KEY configured in .env.' });
        geminiUrl = `https://generativelanguage.googleapis.com/${modelPath}?key=${GEMINI_API_KEY}`;
    } else {
        geminiUrl = getGeminiUrl();
    }

    if (!geminiUrl) return res.status(400).json({ message: 'No Gemini URL configured (set GEMINI_API_KEY in .env or provide modelUrl/modelPath).' });

    try {
        // Limit fetch to 12 seconds so the debug endpoint doesn't hang indefinitely
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const resp = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeout);

        const text = await resp.text();
        // Try to parse JSON but fall back to raw text
        let body = text;
        try { body = JSON.parse(text); } catch (e) { /* leave as raw text */ }

        return res.json({ status: resp.status, ok: resp.ok, headers: Object.fromEntries(resp.headers.entries ? resp.headers.entries() : []), body });
    } catch (err) {
        console.error('Debug gemini test error:', err && err.stack ? err.stack : err);
        return res.status(500).json({ message: 'Failed to call Gemini URL', error: (err && err.message) || String(err) });
    }
});

// Dev-only: list doctors (no passwords) for debugging login issues
app.get('/debug/doctors', async (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ message: 'Debug endpoint disabled in production.' });
    try {
        const rows = await query('SELECT Doctor_ID, Name, Login_ID, Specialization, Dept_ID FROM Doctors');
        return res.json(rows || []);
    } catch (err) {
        console.error('/debug/doctors error:', err);
        return res.status(500).json({ message: 'Failed to fetch doctors.' });
    }
});

// ---------------------------
// Notifications & Alerts (in-memory)
// ---------------------------
// This implementation keeps notifications in-process (non-persistent). It intentionally
// does NOT create or reference any database table named `Notifications`.

const inMemoryNotifications = [];
let _nextNotificationId = 1;

function createNotificationInMemory(patientId, type, title, body, scheduledAt = null) {
    const n = {
        id: _nextNotificationId++,
        patientId: Number(patientId),
        type: type || 'general',
        title: title || '',
        body: body || '',
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        sentAt: null,
        isRead: false,
        createdAt: new Date().toISOString()
    };
    inMemoryNotifications.push(n);
    return n.id;
}

// API: Create notification (admin/doctor tools can use this)
app.post('/notifications', (req, res) => {
    const { Patient_ID, Type, Title, Body, Scheduled_At } = req.body || {};
    if (!Patient_ID || !Title) return res.status(400).json({ message: 'Patient_ID and Title are required.' });
    try {
        const id = createNotificationInMemory(Patient_ID, Type || 'general', Title, Body || '', Scheduled_At || null);
        res.status(201).json({ Notification_ID: id });
    } catch (error) {
        console.error('Create notification (in-memory) error:', error);
        res.status(500).json({ message: 'Failed to create notification.' });
    }
});

// API: List notifications for patient
app.get('/notifications/:patientId', (req, res) => {
    const patientId = parseInt(req.params.patientId);
    if (Number.isNaN(patientId)) return res.status(400).json({ message: 'Invalid patient ID.' });
    try {
        const rows = inMemoryNotifications
            .filter(n => n.patientId === patientId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(rows);
    } catch (error) {
        console.error('List notifications (in-memory) error:', error);
        res.status(500).json({ message: 'Failed to list notifications.' });
    }
});

// API: Mark notification as read
app.put('/notifications/:id/read', (req, res) => {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid notification ID.' });
    try {
        const idx = inMemoryNotifications.findIndex(n => n.id === id);
        if (idx === -1) return res.status(404).json({ message: 'Notification not found.' });
        inMemoryNotifications[idx].isRead = true;
        res.json({ message: 'Marked as read.' });
    } catch (error) {
        console.error('Mark read (in-memory) error:', error);
        res.status(500).json({ message: 'Failed to mark read.' });
    }
});

// Simple in-process notification sender (stubbed email/SMS).
// In production use a job queue and robust delivery (Redis, Bull, external SMTP/SMS provider).
async function sendPendingNotifications() {
    try {
        const now = Date.now();
        const toSend = inMemoryNotifications.filter(n => !n.sentAt && (!n.scheduledAt || Date.parse(n.scheduledAt) <= now)).slice(0, 50);
        for (const n of toSend) {
            // Fetch patient contact info (email/phone) if available - using DB for patient lookup
            const patients = await query('SELECT Patient_ID, Name, Address FROM Patients WHERE Patient_ID = ?', [n.patientId]);
            const patient = patients[0] || { Name: 'Patient' };

            // Placeholder: send email/SMS - replace with real provider integration
            console.log(`Sending notification ${n.id} to patient ${n.patientId}: ${n.title} - ${n.body}`);

            // Mark sentAt timestamp
            n.sentAt = new Date().toISOString();
        }
    } catch (error) {
        console.error('sendPendingNotifications (in-memory) error:', error);
    }
}

// Appointment reminder scheduler: find appointments within next 48 hours and create reminders if none exist
async function scheduleAppointmentReminders() {
    try {
        const appts = await query(`SELECT A.Appt_ID, A.Patient_ID, A.Date, TIME_FORMAT(A.Time, '%H:%i') as Time, A.Status, P.Name as PatientName
                                   FROM Appointments A JOIN Patients P ON A.Patient_ID = P.Patient_ID
                                   WHERE A.Status = 'Scheduled' AND CONCAT(A.Date, ' ', A.Time) > NOW() AND CONCAT(A.Date, ' ', A.Time) <= DATE_ADD(NOW(), INTERVAL 48 HOUR)`);

        for (const a of appts) {
            // Parse appointment datetime (assumes A.Date is YYYY-MM-DD and A.Time is HH:MM)
            try {
                const dateParts = String(a.Date).split('-').map(p => parseInt(p, 10)); // [YYYY,MM,DD]
                const timeParts = String(a.Time || '00:00').split(':').map(p => parseInt(p, 10)); // [HH,MM]
                if (dateParts.length < 3 || timeParts.length < 2) continue;
                const apptDateObj = new Date(dateParts[0], (dateParts[1] || 1) - 1, dateParts[2], timeParts[0] || 0, timeParts[1] || 0, timeParts[2] || 0);
                const apptTs = apptDateObj.getTime();
                if (Number.isNaN(apptTs)) continue;
            } catch (e) {
                continue;
            }

            const reminders = [
                { label: '24h', offsetMs: 24 * 3600 * 1000 },
                { label: '1h', offsetMs: 1 * 3600 * 1000 }
            ];

            for (const r of reminders) {
                const remTs = apptDateObj.getTime() - r.offsetMs;
                if (remTs <= Date.now()) continue; // don't schedule reminders in the past

                const remDate = new Date(remTs);
                const pad = (n) => String(n).padStart(2, '0');
                const scheduledAt = `${remDate.getFullYear()}-${pad(remDate.getMonth()+1)}-${pad(remDate.getDate())} ${pad(remDate.getHours())}:${pad(remDate.getMinutes())}:${pad(remDate.getSeconds())}`;

                const title = `Appointment Reminder (${r.label}): Appt ${a.Appt_ID}`;
                const body = `Reminder: Appointment on ${a.Date} at ${a.Time}. This reminder is ${r.label} before the appointment.`;

                // Ensure we don't create duplicate reminders for the same appointment+label
                const exists = inMemoryNotifications.some(n => n.patientId === Number(a.Patient_ID) && n.title === title);
                if (exists) continue;

                createNotificationInMemory(a.Patient_ID, 'appointment_reminder', title, body, scheduledAt);
            }
        }
    } catch (error) {
        console.error('scheduleAppointmentReminders (in-memory) error:', error);
    }
}

// Periodic runner (every minute)
setInterval(async () => {
    await scheduleAppointmentReminders();
    await sendPendingNotifications();
}, 60 * 1000);

// Dev-only: trigger reminder scheduling and sending on-demand
app.post('/debug/runReminders', async (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ message: 'Debug endpoint disabled in production.' });
    try {
        await scheduleAppointmentReminders();
        await sendPendingNotifications();
        return res.json({ ok: true, message: 'Triggered scheduleAppointmentReminders and sendPendingNotifications.' });
    } catch (err) {
        console.error('/debug/runReminders error:', err);
        return res.status(500).json({ ok: false, message: 'Failed to run reminders.', error: String(err) });
    }
});


// ==========================================================
// Start the Server
// ==========================================================

async function startServer() {
    try {
        // Test connection pool
        const conn = await pool.getConnection();
        conn.release();
        console.log("✅ MySQL database connection successful.");

    // Notifications are managed in-memory (no DB table required)

        app.listen(PORT, () => {
            console.log(`✅ Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ CRITICAL ERROR: Failed to connect to MySQL database.");
        console.error("Please check your host, user, and password settings in index.js.");
        console.error("Error details:", error.message);
    }
}

startServer();

// Dev-only: return JSON 404 for unmatched API routes to avoid static HTML "Cannot GET" pages
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        // Only handle API-ish routes so normal static site routing is unaffected
        if (req.path.startsWith('/appointments') || req.path.startsWith('/patient') || req.path.startsWith('/bills') || req.path.startsWith('/chat') || req.path.startsWith('/medicines') || req.path.startsWith('/prescriptions') || req.path.startsWith('/submitDiagnosis')) {
            console.warn('[UNMATCHED API]', req.method, req.originalUrl);
            return res.status(404).json({ message: 'API route not found (dev fallback)', path: req.originalUrl });
        }
        next();
    });
}
