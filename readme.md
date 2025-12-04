
# Hospital Management (Simple Demo)

This repository contains a small hospital management demo (Node.js + Express backend, MySQL database, and a static frontend). It includes a simple doctor and patient portal, appointment booking, prescriptions, and a pluggable LLM assistant integration. Notifications are implemented in-memory for development; see the Notifications section for how to wire a real provider.

## Quick start

Prerequisites:
- Node.js 18+ (for native fetch) or add a fetch polyfill
- MySQL server with a database and schema matching the app (see SQL/seed if available)
- npm

1) Install dependencies

```cmd
npm install
```

2) Create `.env` in project root (do not commit it). Minimal values:

```properties
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=hms_db

# Gemini (Google) API key (optional). If you prefer OpenAI, set OPENAI_API_KEY instead and switch code.
GEMINI_API_KEY=
# GEMINI_MODEL=models/gemini-2.5

# Example optional: Twilio for SMS (not enabled by default)
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_FROM=+1234567890
```

3) Start the server

```cmd
node index.js
```

4) Open the frontend in your browser (served from the same server):

http://localhost:3000/


## Important endpoints

- GET /_health — basic health check
- POST /unifiedLogin — doctor/patient login (payload: { loginID, password, userType })
- GET /departments, /wards, /medicines, etc. — frontend data
- GET /appointments/:patientId — patient appointments
- GET /appointments/doctor/:doctorId — doctor schedule
- POST /submitDiagnosis — submit prescription/diagnosis (keeps backward-compat)
- GET /prescriptions/:patientId — past prescriptions
- POST /chat — patient LLM assistant (payload: { patientId, message })

Dev-only debug endpoints (disabled in production):
- GET /debug/geminiModels — list Gemini generative models accessible to the API key
- POST /debug/gemini-test — forward a raw payload to Gemini for debugging
- POST /debug/runReminders — trigger reminder scheduling & sending immediately (useful for testing)


## Notifications (development)

- Notifications are stored in-memory by default (non-persistent) and will be lost when the server restarts. The demo's `sendPendingNotifications()` function only logs sends.
- To test immediately:

  1) Create a notification (replace patient id):

	  ```cmd
	  curl -i -X POST http://localhost:3000/notifications -H "Content-Type: application/json" -d "{\"Patient_ID\":1,\"Title\":\"Test reminder\",\"Body\":\"This is a test.\"}"
	  ```

  2) Trigger the scheduler & sender now:

	  ```cmd
	  curl -i -X POST http://localhost:3000/debug/runReminders
	  ```

  3) View notifications for a patient:

	  ```cmd
	  curl -i http://localhost:3000/notifications/1
	  ```

### Sending real SMS/email

To deliver real messages to phones you must integrate a provider (Twilio, AWS SNS, SendGrid, etc.). Steps:

1) Add provider credentials to `.env` (example Twilio vars above).
2) Install SDK (e.g., `npm install twilio`).
3) Update `sendPendingNotifications()` in `index.js` to call the provider API and mark notifications `sentAt` on success.
4) Persist notifications in a `Notifications` DB table (recommended) so sends survive restarts and can be retried.


## LLM / Assistant

- The server contains a pluggable LLM integration. Set `GEMINI_API_KEY` for Gemini or `OPENAI_API_KEY` for OpenAI (the code includes both variants in different branches — currently the repo uses Gemini by default).
- Endpoints:
  - POST /chat — sends patient context to the LLM and returns a short, numbered bullet reply
  - POST /debug/gemini-test — forward custom payload to the provider for debugging

Notes:
- If your LLM calls return 4xx errors (e.g., 429 insufficient_quota), the server returns a safe fallback reply and a descriptive error so the frontend can show a user-friendly banner.


## Troubleshooting

- Server not reachable on localhost:3000: ensure you started `node index.js` in the project root and MySQL is reachable.
- LLM returns 404 / model not found: use `/debug/geminiModels` to list models available to your API key and set `GEMINI_MODEL` accordingly.
- SMS not delivered: ensure provider credentials are valid, sender number authorized, and your `sendPendingNotifications()` is wired to the provider.


## Development notes

- Notifications are intentionally in-memory for the demo to keep the focus on features. For production you must persist notifications and implement retries.
- Appointment booking is validated in the frontend to allowed windows (09:00-12:00 and 13:00-16:00) and 10-minute boundaries.

"# hospital-management-system" 
