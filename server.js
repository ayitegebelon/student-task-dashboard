const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend assets from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Connect to SQLite Database
const db = new sqlite3.Database('./tasks.db', (err) => {
    if (err) console.error("Database error:", err);
    else console.log("Connected to SQLite Database.");
});

// Create Table matching text and priority
db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// --- REST API ENDPOINTS ---

// GET Tasks
app.get('/api/tasks', (req, res) => {
    db.all('SELECT * FROM tasks ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const formattedRows = rows.map(r => ({ ...r, completed: Boolean(r.completed) }));
        res.json(formattedRows);
    });
});

// POST Task
app.post('/api/tasks', (req, res) => {
    const { text, priority } = req.body;
    if (!text) return res.status(400).json({ error: "Task text is required" });

    db.run(
        'INSERT INTO tasks (text, priority) VALUES (?, ?)',
        [text, priority || 'medium'],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, text, priority: priority || 'medium', completed: false });
        }
    );
});

// PUT Toggle Task
app.put('/api/tasks/:id', (req, res) => {
    const { completed } = req.body;
    db.run(
        'UPDATE tasks SET completed = ? WHERE id = ?',
        [completed ? 1 : 0, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        }
    );
});

// DELETE Task
app.delete('/api/tasks/:id', (req, res) => {
    db.run('DELETE FROM tasks WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// Fallback route to deliver index.html for root requests
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));