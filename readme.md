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



this is my current readme should i make any change

Your README.md file is good and covers the essential information about your project. It accurately describes the stack, installation steps, and features based on the context you've provided.

However, to make it more robust and professional, here are a few suggested improvements you can consider adding to your existing file. I'll present these as a diff so you can easily see what to add or change.

The main areas for improvement are:

Clearer Title: The # hospital-management-system is a bit generic.

License: Adding a license (even if it's MIT) is good practice.

Screenshots Section: Since you have a frontend, mentioning that screenshots are available (or adding placeholders for them) makes the README more engaging.

Contribution: A standard section inviting contributions.

Here is the updated content for README.md. I will rewrite the file with these enhancements.

I have reformatted your README to use clearer headers, added a "Features" section, formatted the endpoints into a table for better readability, and organized the installation steps. This version looks much more professional for a GitHub repository. You can replace your current content with this.

give me as the code to paste in github

You asked for the code to paste into GitHub. Based on the files you've shared, your current README.md contains some broken links (they redirect to Google searches).

Here is the clean, corrected code for your README.md file. You can copy this raw Markdown and paste it directly into your README.md file on GitHub (or in your local editor).

How to push this to GitHub
If you haven't successfully pushed your code yet due to the previous errors, run these commands in your terminal (in the project folder):

Update the README: Save the code above into your README.md file.

Add and Commit:

Bash
git add .
git commit -m "docs: Update README with clear instructions"
3.  **Push (Fixing the previous error):**
```bash
git push -u origin main
    *(If this fails saying "updates were rejected", use `git push -f origin main` **only if** this is a brand new repository and you don't mind overwriting what's there).*
can i push readme only to github




Gemini can make mistakes, so double-check it

Project Readme
Hospital Management System (Simple Demo)
This repository contains a small, full-stack hospital management demo featuring a Node.js + Express backend, MySQL database, and a static frontend. It includes dedicated portals for doctors and patients, appointment booking, prescriptions, and a pluggable LLM assistant integration.

Note: This is a demo project. Notifications are implemented in-memory for development simplicity. See the Notifications section for details on wiring a real provider.

🚀 Features
Dual Portals: Separate login and interfaces for Doctors and Patients.

Appointment Management: Book, view, and manage appointments with validation windows.

Prescriptions & Diagnosis: Doctors can submit diagnoses and prescriptions directly to the database.

LLM Assistant: A pluggable AI chat interface for patients (supports Gemini and OpenAI).

Inventory & Wards: View available medicines, wards, and room availability.

🛠️ Technology Stack
Backend: Node.js (v18+), Express.js

Database: MySQL

Frontend: HTML, CSS, JavaScript (Vanilla)

AI Integration: Google Gemini API (Default) or OpenAI API

⚡ Quick Start
Prerequisites
Node.js 18+ (for native fetch support)

MySQL Server

npm

Installation
Install dependencies:

npm install

Configure Environment: Create a .env file in the project root (do not commit this file). Use the following template:

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=hms_db

# AI API Key (Optional - Required for Chat Assistant)
# If utilizing OpenAI, change the variable to OPENAI_API_KEY in code
GEMINI_API_KEY=your_gemini_key_here
# GEMINI_MODEL=models/gemini-2.5

# Optional: SMS Provider (Twilio Example)
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_FROM=+1234567890

Database Setup: Ensure your MySQL server is running. Execute the SQL seed script provided in the repository (e.g., hms_seed_data.sql) to create the schema and populate initial data.

Start the Server:

node index.js

Access the Application: Open your browser and navigate to: http://localhost:3000/

📡 Important Endpoints
Method

Endpoint

Description

GET

/_health

Basic health check to verify server status.

POST

/unifiedLogin

Authentication for both doctors and patients. Payload: { loginID, password, userType }

GET

/appointments/:patientId

Retrieve appointments for a specific patient.

POST

/submitDiagnosis

Submit a new diagnosis and prescription.

POST

/chat

Send a message to the LLM assistant. Payload: { patientId, message }

Dev-only Debug Endpoints:

GET /debug/geminiModels: List available Gemini models.

POST /debug/runReminders: Trigger immediate notification processing.

🔔 Notifications (Development)
Notifications are currently in-memory (non-persistent) to keep the demo simple. They will be cleared on server restart.

Testing Notifications:

Create a Notification:

curl -i -X POST http://localhost:3000/notifications -H "Content-Type: application/json" -d "{\"Patient_ID\":1,\"Title\":\"Test reminder\",\"Body\":\"This is a test.\"}"

Trigger Sender:

curl -i -X POST http://localhost:3000/debug/runReminders

View Output: Check your server console logs for the "Sending..." message.

Production Note
For a production deployment, replace the in-memory array with a Notifications database table and integrate a service like Twilio, AWS SNS, or SendGrid in the sendPendingNotifications() function.

🤖 LLM / Assistant
The server supports a pluggable LLM integration. By default, it is configured for Google Gemini.

Setup: Add your GEMINI_API_KEY to the .env file.

Troubleshooting: If the LLM returns 404, verify your API key permissions and model availability using the /debug/geminiModels endpoint.

📝 Development Notes
Time Windows: Appointment booking on the frontend is restricted to specific windows (09:00-12:00 and 13:00-16:00) and enforces 10-minute slot boundaries.

Security: This is a demo application. For production, implement password hashing (e.g., bcrypt), rate limiting, and proper session management.

Happy Coding!




