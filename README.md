# ⚡ TaskFlow Pro — Full-Stack Student Task & Productivity Suite

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=for-the-badge)
![NodeJS](https://img.shields.io/badge/Node.js-v18%2B-green.svg?style=for-the-badge&logo=nodedotjs)
![Express](https://img.shields.io/badge/Express-v4.x-000000.svg?style=for-the-badge&logo=express)
![SQLite3](https://img.shields.io/badge/SQLite-v3.x-003B57.svg?style=for-the-badge&logo=sqlite)
![License](https://img.shields.io/badge/license-MIT-orange.svg?style=for-the-badge)

**TaskFlow Pro** is an enterprise-grade, high-performance academic management system designed to replace basic CRUD task managers. Built with a modular full-stack architecture, high-contrast dark-mode aesthetics, and built-in focus tools, TaskFlow Pro empowers students to plan, estimate, analyze, and execute their academic workload with precision.

---

## 📸 Overview & Architecture

TaskFlow Pro shifts away from standard single-page forms toward a structured, session-protected multi-page user journey:

                      ┌─────────────────────────┐
                      │   Landing Page          │
                      │   (public/index.html)   │
                      └────────────┬────────────┘
                                   │
                  ┌────────────────┴────────────────┐
                  ▼                                 ▼
       ┌─────────────────────┐           ┌────────────────────┐
       │   Login Portal      │           │  Register Portal   │
       │  (public/login.html)│           │(public/register.html)
       └──────────┬──────────┘           └─────────┬──────────┘
                  │                                │
                  └────────────────┬───────────────┘
                                   │ (Authenticated Session)
                                   ▼
                      ┌─────────────────────────┐
                      │  Student Dashboard      │
                      │(public/dashboard.html)  │
                      └─────────────────────────┘

---

## ✨ Key Features

### 🔐 1. Authentication & Session Security
* **Dedicated Auth Portals**: Independent `login.html` and `register.html` pages keep marketing and security logic isolated.
* **Client-Side Auth Guard**: `auth-guard.js` prevents unauthenticated access to `dashboard.html`, automatically redirecting guests to the login page.
* **Encrypted User Management**: SQLite backend provisions isolated task contexts per user identifier.

### ⚡ 2. Smart Workload Estimator
* **Complexity Analysis Algorithm**: Evaluates assignment text complexity, volume, and academic context.
* **Focus Session Allocation**: Dynamically assigns recommended 25-minute Pomodoro sessions and assigns energy badges (e.g., *Quick Win*, *Medium Focus*, *Deep Focus Work*).

### ⏱️ 3. Pomodoro Focus Engine & Custom Audio
* **Custom Countdown Interval**: Supports custom focus session lengths (1–180 minutes) with pause, resume, and reset functionality.
* **Hybrid Alarm System**: Supports custom user-uploaded `.mp3`/`.wav` alarms stored locally, with a synthesized multi-frequency Web Audio API (`AudioContext`) fallback.

### 📊 4. Analytics & Progress Tracking
* **Header Stats Bar**: Real-time aggregation of completed tasks, active study streaks (consecutive calendar days), and overall completion percentages.
* **Visual Progress Rings**: SVG and HTML5-based progress meters that adjust as tasks and sub-tasks are completed.

### 📎 5. Sub-Tasks & Resource Attachments
* **Breakout Checklists**: Inline sub-task checkboxes inside task cards that recalculate card completion metrics in real time.
* **Resource Linking**: Attach external study resources (PDFs, Google Docs, lecture slides) displayed as interactive UI pills that open safely via `target="_blank"`.

---

## 🛠️ Tech Stack

| Domain | Technology | Description |
| :--- | :--- | :--- |
| **Backend Runtime** | Node.js | Asynchronous JavaScript runtime engine |
| **Web Framework** | Express.js | REST API routing and static file server |
| **Database** | SQLite3 | File-based, relational database with safe migration scripts |
| **Frontend Stack** | HTML5 / CSS3 / ES6+ JS | Native glassmorphic UI, CSS Variables, async fetch API |
| **Styling Concept** | Slate / Indigo Theme | High-contrast Dark Mode (`#0F172A` / `#2563EB`) inspired by Tailwind CSS |

---

## 📁 Repository Structure

```text
├── server.js               # Express server & SQLite database schema migrations
├── tasks.db                # SQLite database (auto-generated on launch)
├── package.json            # Project dependencies and operational scripts
└── public/
    ├── index.html          # Public Landing Page (Hero, Features, CTAs)
    ├── login.html          # Authentication portal (Sign In)
    ├── register.html       # User registration portal
    ├── dashboard.html      # Main protected student workspace
    ├── style.css           # Slate/Indigo CSS variable system & glassmorphism cards
    └── js/
        ├── auth-guard.js   # Session verification middleware script
        └── script.js       # Focus timer, estimator engine, and task rendering logic
🚀 Installation & QuickstartPrerequisitesNode.js: v18.0.0 or highernpm: v9.0.0 or higherStep-by-Step SetupClone the repository:Bashgit clone [https://github.com/your-username/student-task-dashboard.git](https://github.com/your-username/student-task-dashboard.git)
cd student-task-dashboard
Install dependencies:Bashnpm install
Launch the application server:Bashnode server.js
Access the application:Open your browser and navigate to http://localhost:3000.📡 REST API ReferenceAuthentication RoutesMethodEndpointPayload ExampleResponsePOST/api/auth/register{ "username": "alex", "email": "alex@school.edu", "password": "..." }{ "success": true, "user": {...} }POST/api/auth/login{ "identifier": "alex@school.edu", "password": "..." }{ "success": true, "user": {...} }Task Management RoutesMethodEndpointDescriptionGET/api/tasksRetrieves all tasks for the logged-in user context.POST/api/tasksCreates a new task record with attachments and sub-tasks.PUT/api/tasks/:idUpdates task status, sub-tasks, or details.DELETE/api/tasks/:idPermanently deletes a task record from SQLite.🗄️ Database Schema (tasks.db)SQLCREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT NOT NULL,
  subject TEXT DEFAULT 'General',
  priority TEXT DEFAULT 'Medium',
  due_date TEXT,
  completed INTEGER DEFAULT 0,
  attachments TEXT DEFAULT '[]',
  subtasks TEXT DEFAULT '[]',
  group_code TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);