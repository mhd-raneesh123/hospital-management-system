# Hospital Management System

This repository contains a small, full-stack hospital management demo featuring a Node.js + Express backend, MySQL database, and a static frontend. It includes dedicated portals for doctors and patients, appointment booking, prescriptions, and a pluggable LLM assistant integration.

> **Note:** This is a demo project. Notifications are implemented in-memory for development simplicity. See the "Notifications" section for details on wiring a real provider.

##  Features
* **Dual Portals:** Separate login and interfaces for Doctors and Patients.
* **Appointment Management:** Book, view, and manage appointments with validation windows.
* **Prescriptions & Diagnosis:** Doctors can submit diagnoses and prescriptions directly to the database.
* **LLM Assistant:** A pluggable AI chat interface for patients (supports Gemini and OpenAI).
* **Inventory & Wards:** View available medicines, wards, and room availability.

##  Technology Stack
* **Backend:** Node.js (v18+), Express.js
* **Database:** MySQL
* **Frontend:** HTML, CSS, JavaScript (Vanilla)
* **AI Integration:** Google Gemini API (Default) or OpenAI API

##  Quick Start

### Prerequisites
* Node.js 18+ (for native fetch support)
* MySQL Server
* npm

### Installation

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Configure Environment:**
    Create a `.env` file in the project root (do not commit this file). Use the following template:
    ```properties
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
    ```

3.  **Database Setup:**
    Ensure your MySQL server is running. Import the provided SQL file to create the database and tables:
    ```bash
    mysql -u root -p hms_db < hms_seed_data.sql
    ```

4.  **Start the Server:**
    ```bash
    node index.js
    ```

5.  **Access the Application:**
    Open your browser and navigate to: [http://localhost:3000/](http://localhost:3000/)

##  Default Login Credentials
Use these credentials to test the application after importing the database.
*(Note: Please verify these IDs match the data in your `doctors` and `patients` tables)*

| Role | Login ID | Password |
| :--- | :--- | :--- |
| **Doctor** | `101` | `password123` |
| **Patient** | `1` | `password123` |

##  Important Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/_health` | Basic health check to verify server status. |
| **POST** | `/unifiedLogin` | Authentication for doctors/patients. Payload: `{ loginID, password, userType }` |
| **GET** | `/appointments/:patientId` | Retrieve appointments for a specific patient. |
| **POST** | `/submitDiagnosis` | Submit a new diagnosis and prescription. |
| **POST** | `/chat` | Send a message to the LLM assistant. Payload: `{ patientId, message }` |

**Dev-only Debug Endpoints:**
* `GET /debug/geminiModels`: List available Gemini models.
* `POST /debug/runReminders`: Trigger immediate notification processing.


##  LLM / Assistant
The server supports a pluggable LLM integration. By default, it is configured for Google Gemini.
* **Setup:** Add your `GEMINI_API_KEY` to the `.env` file.
* **Troubleshooting:** If the LLM returns 404, verify your API key permissions and model availability using the `/debug/geminiModels` endpoint.

##  Development Notes
* **Time Windows:** Appointment booking on the frontend is restricted to specific windows (09:00-12:00 and 13:00-16:00) and enforces 10-minute slot boundaries.
* **Security:** This is a demo application. For production, implement password hashing (e.g., bcrypt), rate limiting, and proper session management.
