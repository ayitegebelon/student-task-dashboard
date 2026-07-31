const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(session({
    secret: 'student-task-dashboard-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static frontend assets from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Connect to SQLite Database
const db = new sqlite3.Database('./tasks.db', (err) => {
    if (err) console.error("Database error:", err);
    else console.log("Connected to SQLite Database.");
});

// Safe Column Migration Wrapper
const safeAddColumn = (tableName, columnName, columnType) => {
    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`, (err) => {
        if (err && !err.message.includes("duplicate column name")) {
            console.error(`Migration notice for ${columnName}:`, err.message);
        }
    });
};

// Create users table
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Check if tasks table exists and has the right structure
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'", (err, row) => {
    if (err) {
        console.error("Error checking tasks table:", err);
        return;
    }
    
    if (!row) {
        // Create new tasks table with user_id
        db.run(`
            CREATE TABLE tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                text TEXT NOT NULL,
                priority TEXT DEFAULT 'medium',
                completed INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                due_date TEXT,
                subject TEXT DEFAULT 'General',
                attachments TEXT DEFAULT '[]',
                subtasks TEXT DEFAULT '[]',
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);
    } else {
        // Existing table - add missing columns
        safeAddColumn('tasks', 'due_date', "TEXT");
        safeAddColumn('tasks', 'subject', "TEXT DEFAULT 'General'");
        safeAddColumn('tasks', 'attachments', "TEXT DEFAULT '[]'");
        safeAddColumn('tasks', 'subtasks', "TEXT DEFAULT '[]'");
        safeAddColumn('tasks', 'user_id', "INTEGER");
    }
});

// --- AUTHENTICATION ENDPOINTS ---

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ message: 'Username or email already exists' });
                    }
                    return res.status(500).json({ message: 'Registration failed' });
                }
                
                const user = { id: this.lastID, username, email };
                req.session.user = user;
                res.json({ message: 'Registration successful', user });
            }
        );
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
    const { identifier, password } = req.body;
    
    if (!identifier || !password) {
        return res.status(400).json({ message: 'Identifier and password are required' });
    }
    
    db.get(
        'SELECT * FROM users WHERE username = ? OR email = ?',
        [identifier, identifier],
        async (err, user) => {
            if (err) {
                return res.status(500).json({ message: 'Server error' });
            }
            
            if (!user) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }
            
            try {
                const validPassword = await bcrypt.compare(password, user.password);
                
                if (!validPassword) {
                    return res.status(401).json({ message: 'Invalid credentials' });
                }
                
                req.session.user = { id: user.id, username: user.username, email: user.email };
                res.json({ message: 'Login successful', user: req.session.user });
            } catch (error) {
                res.status(500).json({ message: 'Server error' });
            }
        }
    );
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed' });
        }
        res.json({ message: 'Logout successful' });
    });
});

// Check session endpoint
app.get('/api/auth/check', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

// --- REST API ENDPOINTS ---

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    next();
};

// GET Tasks (authenticated)
app.get('/api/tasks', requireAuth, (req, res) => {
    const userId = req.session.user.id;
    
    // Get tasks with user_id OR tasks without user_id (for backward compatibility)
    db.all('SELECT * FROM tasks WHERE user_id = ? OR user_id IS NULL ORDER BY id DESC', [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const formattedRows = rows.map(r => ({ ...r, completed: Boolean(r.completed), attachments: r.attachments ? JSON.parse(r.attachments) : [], subtasks: r.subtasks ? JSON.parse(r.subtasks) : [] }));
        res.json(formattedRows);
    });
});

// POST Task (authenticated)
app.post('/api/tasks', requireAuth, (req, res) => {
    const { text, priority, due_date, subject, attachments, subtasks } = req.body;
    if (!text) return res.status(400).json({ error: "Task text is required" });

    const userId = req.session.user.id;
    const attachmentsJson = attachments ? JSON.stringify(attachments) : '[]';
    const subtasksJson = subtasks ? JSON.stringify(subtasks) : '[]';

    db.run(
        'INSERT INTO tasks (user_id, text, priority, due_date, subject, attachments, subtasks) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, text, priority || 'medium', due_date || null, subject || 'General', attachmentsJson, subtasksJson],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ 
                id: this.lastID, 
                text, 
                priority: priority || 'medium', 
                due_date, 
                subject: subject || 'General', 
                completed: false,
                attachments: attachments || [],
                subtasks: subtasks || []
            });
        }
    );
});

// PUT Toggle Task (authenticated)
app.put('/api/tasks/:id', requireAuth, (req, res) => {
    const { completed, due_date, subject, attachments, subtasks } = req.body;
    const userId = req.session.user.id;
    
    // Build dynamic update query based on provided fields
    let updateFields = [];
    let updateValues = [];
    
    if (completed !== undefined) {
        updateFields.push('completed = ?');
        updateValues.push(completed ? 1 : 0);
    }
    if (due_date !== undefined) {
        updateFields.push('due_date = ?');
        updateValues.push(due_date);
    }
    if (subject !== undefined) {
        updateFields.push('subject = ?');
        updateValues.push(subject);
    }
    if (attachments !== undefined) {
        updateFields.push('attachments = ?');
        updateValues.push(attachments ? JSON.stringify(attachments) : null);
    }
    if (subtasks !== undefined) {
        updateFields.push('subtasks = ?');
        updateValues.push(subtasks ? JSON.stringify(subtasks) : null);
    }
    
    if (updateFields.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
    }
    
    // Also update user_id if it's NULL (migrate legacy tasks)
    updateFields.push('user_id = ?');
    updateValues.push(userId);
    
    updateValues.push(req.params.id);
    
    db.run(
        `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues,
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        }
    );
});

// DELETE Task (authenticated)
app.delete('/api/tasks/:id', requireAuth, (req, res) => {
    const userId = req.session.user.id;
    db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, userId], function (err) {
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