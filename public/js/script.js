const API_URL = '/api/tasks';

let tasks = [];
let activeFilter = 'all';
let searchQuery = '';
let activeSubjectFilter = null;
let customSubjects = JSON.parse(localStorage.getItem('customSubjects')) || [];
let customAlarmAudio = localStorage.getItem('customAlarmAudio') || null;
let currentEstimation = null;
let pendingAttachments = [];

// Timer variables
let timerInterval = null;
let timerSeconds = 25 * 60; // 25 minutes default
let timerRunning = false;

// Theme Management
const themeToggle = document.getElementById("themeToggle");
const accentPreset = document.getElementById("accentPreset");

function applyTheme(theme, accent) {
    document.documentElement.setAttribute('data-theme', theme);
    if (accent && accent !== 'default') {
        document.documentElement.setAttribute('data-accent', accent);
    } else {
        document.documentElement.removeAttribute('data-accent');
    }
    
    const icon = themeToggle.querySelector('i');
    if (theme === 'dark') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const savedAccent = localStorage.getItem('accent') || 'default';
    
    if (savedTheme) {
        applyTheme(savedTheme, savedAccent);
        accentPreset.value = savedAccent;
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark ? 'dark' : 'light', savedAccent);
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme, localStorage.getItem('accent') || 'default');
}

function changeAccent() {
    const newAccent = accentPreset.value;
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    
    localStorage.setItem('accent', newAccent);
    applyTheme(currentTheme, newAccent);
}

// Theme event listeners
themeToggle.addEventListener("click", toggleTheme);
accentPreset.addEventListener("change", changeAccent);

// Analytics Functions
function calculateStudyStreak() {
    const completedDates = JSON.parse(localStorage.getItem('completedDates')) || [];
    const today = new Date().toDateString();
    
    const todayCompleted = tasks.filter(t => t.completed).length > 0;
    if (todayCompleted && !completedDates.includes(today)) {
        completedDates.push(today);
        localStorage.setItem('completedDates', JSON.stringify(completedDates));
    }
    
    let streak = 0;
    const sortedDates = [...completedDates].sort((a, b) => new Date(b) - new Date(a));
    
    for (let i = 0; i < sortedDates.length; i++) {
        const currentDate = new Date(sortedDates[i]);
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() - i);
        
        if (sortedDates[i] === expectedDate.toDateString()) {
            streak++;
        } else {
            break;
        }
    }
    
    return streak;
}

function calculateCompletionRate() {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.completed).length;
    return Math.round((completed / tasks.length) * 100);
}

function updateProgressRing(percentage) {
    const circle = document.querySelector('.progress-ring-circle');
    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    
    circle.style.strokeDashoffset = offset;
    document.getElementById("progressRingValue").textContent = percentage + '%';
}

function updateWeeklyChart() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const weekData = {};
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - today.getDay() + i);
        weekData[date.toDateString()] = 0;
    }
    
    const completedDates = JSON.parse(localStorage.getItem('completedDates')) || [];
    completedDates.forEach(date => {
        if (weekData.hasOwnProperty(date)) {
            weekData[date]++;
        }
    });
    
    const bars = document.getElementById("weeklyChart").querySelectorAll('.chart-bar');
    const maxCount = Math.max(...Object.values(weekData), 1);
    
    bars.forEach((bar, index) => {
        const dayName = bar.getAttribute('data-day');
        const date = new Date(today);
        const dayIndex = days.indexOf(dayName);
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - today.getDay() + dayIndex);
        const count = weekData[targetDate.toDateString()] || 0;
        const height = (count / maxCount) * 100;
        
        bar.querySelector('.bar-fill').style.height = Math.max(height, 4) + '%';
    });
}

function updateAnalytics() {
    const completedCount = tasks.filter(t => t.completed).length;
    const streak = calculateStudyStreak();
    const rate = calculateCompletionRate();
    
    document.getElementById("totalCompleted").textContent = completedCount;
    document.getElementById("studyStreak").textContent = streak + ' day' + (streak !== 1 ? 's' : '');
    document.getElementById("completionRate").textContent = rate + '%';
    
    updateProgressRing(rate);
    updateWeeklyChart();
}

// --- SMART WORKLOAD ESTIMATOR ---

function calculateWorkload(taskName, estimatedHours) {
    let sessions = 1;
    let energyLevel = "Low Energy / Quick Win";
    let energyIcon = "⚡";
    
    // Complex keywords that indicate deep focus work
    const complexKeywords = ['project', 'exam', 'research', 'paper', 'calculus', 'thesis', 'dissertation', 'analysis', 'development', 'implementation', 'study', 'review'];
    
    if (estimatedHours) {
        // Use provided hours
        const hours = parseFloat(estimatedHours);
        sessions = Math.ceil(hours / 0.5); // 1 session = 25 mins ~ 0.5 hours
    } else {
        // Estimate based on task name complexity
        const wordCount = taskName.split(/\s+/).length;
        const hasComplexKeywords = complexKeywords.some(keyword => taskName.toLowerCase().includes(keyword));
        
        if (wordCount <= 3 && !hasComplexKeywords) {
            sessions = 1;
        } else if (wordCount <= 6 || (hasComplexKeywords && wordCount <= 4)) {
            sessions = 2;
        } else if (wordCount <= 10 || hasComplexKeywords) {
            sessions = 3;
        } else {
            sessions = Math.ceil(wordCount / 3);
        }
    }
    
    // Determine energy level based on sessions
    if (sessions === 1) {
        energyLevel = "Low Energy / Quick Win";
        energyIcon = "⚡";
    } else if (sessions <= 3) {
        energyLevel = "Medium Focus";
        energyIcon = "🧠";
    } else {
        energyLevel = "Deep Focus Work";
        energyIcon = "🔥";
    }
    
    return { sessions, energyLevel, energyIcon };
}

function showEstimationResult(taskName, estimatedHours) {
    const result = calculateWorkload(taskName, estimatedHours);
    currentEstimation = { taskName, ...result };
    
    const resultEl = document.getElementById("estimatorResult");
    if (!resultEl) return;
    
    resultEl.innerHTML = `
        <div class="estimation-card">
            <div class="energy-badge ${result.sessions === 1 ? 'low' : result.sessions <= 3 ? 'medium' : 'high'}">
                ${result.energyIcon} ${result.energyLevel}
            </div>
            <div class="sessions-badge">
                <i class="fa-solid fa-clock"></i> ${result.sessions} Session${result.sessions !== 1 ? 's' : ''}
            </div>
            <div class="estimation-details">
                <p>Estimated time: ${result.sessions * 25} minutes</p>
            </div>
        </div>
    `;
    
    const splitBtn = document.getElementById("splitTaskBtn");
    if (splitBtn) {
        splitBtn.style.display = result.sessions > 1 ? "inline-block" : "none";
    }
}

function handleEstimateClick() {
    const taskInput = document.getElementById("estimatorTaskInput");
    const hoursInput = document.getElementById("estimatorHoursInput");
    
    if (!taskInput) return;
    
    const taskName = taskInput.value.trim();
    const estimatedHours = hoursInput ? hoursInput.value.trim() : null;
    
    if (!taskName) {
        alert("Please enter a task name");
        return;
    }
    
    showEstimationResult(taskName, estimatedHours);
}

function splitTaskIntoSessions() {
    if (!currentEstimation || currentEstimation.sessions <= 1) return;
    
    const taskInput = document.getElementById("taskInput");
    const modal = document.getElementById("smartEstimatorModal");
    const estimatorTaskInput = document.getElementById("estimatorTaskInput");
    const estimatorHoursInput = document.getElementById("estimatorHoursInput");
    const resultEl = document.getElementById("estimatorResult");
    const splitBtn = document.getElementById("splitTaskBtn");
    
    if (!taskInput || !estimatorTaskInput) return;
    
    const baseTask = estimatorTaskInput.value.trim();
    
    for (let i = 1; i <= currentEstimation.sessions; i++) {
        taskInput.value = `${baseTask} - Part ${i}`;
        addTask();
    }
    
    // Close modal and reset
    if (modal) modal.style.display = "none";
    if (estimatorTaskInput) estimatorTaskInput.value = "";
    if (estimatorHoursInput) estimatorHoursInput.value = "";
    if (resultEl) resultEl.innerHTML = "";
    if (splitBtn) splitBtn.style.display = "none";
    
    currentEstimation = null;
}

// --- FOCUS TIMER ---

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById("pomodoroTimer");
    if (timerDisplay) {
        timerDisplay.textContent = formatTime(timerSeconds);
    }
}

function startTimer() {
    if (timerRunning) {
        console.log("Timer already running");
        return;
    }
    
    console.log("Starting timer...");
    timerRunning = true;
    timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerDisplay();
        
        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            timerRunning = false;
            console.log("Timer finished, playing alarm");
            playAlarm();
            
            // Show notification if permitted
            if (Notification.permission === "granted") {
                new Notification("Focus Session Complete!", {
                    body: "Great job! Take a break.",
                    icon: "https://img.icons8.com/color/48/000000/task--v1.png"
                });
            }
        }
    }, 1000);
}

function pauseTimer() {
    if (!timerRunning) return;
    
    clearInterval(timerInterval);
    timerRunning = false;
}

function resetTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    timerSeconds = 25 * 60;
    updateTimerDisplay();
}

function setTimerDuration(minutes) {
    clearInterval(timerInterval);
    timerRunning = false;
    timerSeconds = minutes * 60;
    updateTimerDisplay();
}

function playAlarm() {
    // Try to play custom alarm first
    if (customAlarmAudio) {
        try {
            const audio = new Audio(customAlarmAudio);
            audio.volume = 1.0;
            audio.play().then(() => {
                console.log("Custom alarm playing successfully");
            }).catch((error) => {
                console.log("Custom alarm failed, falling back to Web Audio:", error);
                playWebAudioChime();
            });
        } catch (error) {
            console.log("Custom alarm error, falling back to Web Audio:", error);
            playWebAudioChime();
        }
    } else {
        console.log("No custom alarm, using Web Audio chime");
        playWebAudioChime();
    }
}

function playWebAudioChime() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Resume audio context if suspended (required by modern browsers)
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        // Create a pleasant chime sound
        const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (C major chord + octave)
        
        frequencies.forEach((freq, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start(audioContext.currentTime + index * 0.15);
            oscillator.stop(audioContext.currentTime + index * 0.15 + 0.8);
        });
        
        console.log("Web Audio chime playing");
    } catch (error) {
        console.error("Web Audio API error:", error);
        // Fallback: try to play a simple beep using HTML5 Audio
        try {
            const beep = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU');
            beep.play().catch(e => console.error("Fallback beep also failed:", e));
        } catch (e) {
            console.error("All audio methods failed");
        }
    }
}

function handleCustomAlarmUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        customAlarmAudio = e.target.result;
        localStorage.setItem('customAlarmAudio', customAlarmAudio);
        console.log("Custom alarm sound saved successfully");
        alert("Custom alarm sound saved!");
    };
    reader.onerror = (error) => {
        console.error("Error reading audio file:", error);
        alert("Error reading audio file. Please try a different file.");
    };
    reader.readAsDataURL(file);
}

function testAlarmSound() {
    console.log("Testing alarm sound...");
    playAlarm();
}

function openPomodoroModal(taskName = "") {
    const modal = document.getElementById("pomodoroModal");
    const taskNameEl = document.getElementById("pomodoroTaskName");
    
    if (modal) {
        modal.style.display = "flex";
    }
    if (taskNameEl) {
        taskNameEl.textContent = taskName || "Focus Session";
    }
    updateTimerDisplay();
}

function closePomodoroModal() {
    const modal = document.getElementById("pomodoroModal");
    if (modal) {
        modal.style.display = "none";
    }
    pauseTimer();
}

function openEstimatorModal() {
    const modal = document.getElementById("smartEstimatorModal");
    const taskInput = document.getElementById("estimatorTaskInput");
    
    if (modal) {
        modal.style.display = "flex";
    }
    if (taskInput) {
        taskInput.value = document.getElementById("taskInput").value;
        taskInput.focus();
    }
}

function closeEstimatorModal() {
    const modal = document.getElementById("smartEstimatorModal");
    const resultEl = document.getElementById("estimatorResult");
    const splitBtn = document.getElementById("splitTaskBtn");
    
    if (modal) {
        modal.style.display = "none";
    }
    if (resultEl) {
        resultEl.innerHTML = "";
    }
    if (splitBtn) {
        splitBtn.style.display = "none";
    }
    currentEstimation = null;
}

// Focus Mode Functions
function startFocusMode(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Open Spotify in new tab for focus music
    window.open('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', '_blank');
    
    // Open Pomodoro modal with task name
    openPomodoroModal(task.title);
}

// Attachment Functions
function addAttachment() {
    const url = document.getElementById("attachmentUrl").value.trim();
    const name = document.getElementById("attachmentName").value.trim();
    
    if (!url || !name) return;
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        alert('Please enter a valid URL starting with http:// or https://');
        return;
    }
    
    const attachment = { url, name, id: Date.now() };
    pendingAttachments.push(attachment);
    
    renderAttachmentsList();
    document.getElementById("attachmentUrl").value = '';
    document.getElementById("attachmentName").value = '';
}

function renderAttachmentsList() {
    const attachmentsListEl = document.getElementById("attachmentsList");
    attachmentsListEl.innerHTML = '';
    
    pendingAttachments.forEach((attachment, index) => {
        const pill = document.createElement('div');
        pill.className = 'attachment-pill remove-attachment';
        pill.innerHTML = `<i class="fa-solid fa-link"></i> ${attachment.name} <i class="fa-solid fa-xmark"></i>`;
        pill.onclick = () => removeAttachment(index);
        attachmentsListEl.appendChild(pill);
    });
}

function removeAttachment(index) {
    pendingAttachments.splice(index, 1);
    renderAttachmentsList();
}

function renderTaskAttachments(task) {
    if (!task.attachments || task.attachments.length === 0) return '';
    
    return task.attachments.map(attachment => {
        const icon = attachment.url.includes('pdf') ? 'fa-file-pdf' : 'fa-link';
        return `<a href="${attachment.url}" target="_blank" class="attachment-pill">
            <i class="fa-solid ${icon}"></i> ${attachment.name}
        </a>`;
    }).join('');
}

// Subtask Functions
function renderSubtasks(task) {
    if (!task.subtasks || task.subtasks.length === 0) return '';
    
    const completedCount = task.subtasks.filter(s => s.completed).length;
    const progress = Math.round((completedCount / task.subtasks.length) * 100);
    
    let html = `
        <div class="task-subtasks">
            <div class="subtask-progress">
                <span>${completedCount}/${task.subtasks.length} completed</span>
                <div class="subtask-progress-bar">
                    <div class="subtask-progress-fill" style="width: ${progress}%"></div>
                </div>
            </div>
            <div class="subtask-list">
    `;
    
    task.subtasks.forEach((subtask, index) => {
        html += `
            <div class="subtask-item ${subtask.completed ? 'completed' : ''}">
                <input type="checkbox" class="subtask-checkbox" 
                    ${subtask.completed ? 'checked' : ''} 
                    data-task-id="${task.id}" 
                    data-subtask-index="${index}">
                <span class="subtask-text">${subtask.text}</span>
            </div>
        `;
    });
    
    html += `
            </div>
            <button class="add-subtask-btn" data-task-id="${task.id}">+ Add Subtask</button>
        </div>
    `;
    
    return html;
}

// Subtask event handlers
async function handleSubtaskToggle(e) {
    const taskId = parseInt(e.target.dataset.taskId);
    const subtaskIndex = parseInt(e.target.dataset.subtaskIndex);
    const task = tasks.find(t => t.id === taskId);
    
    if (!task || !task.subtasks[subtaskIndex]) return;
    
    task.subtasks[subtaskIndex].completed = e.target.checked;
    
    try {
        await fetch(`${API_URL}/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subtasks: task.subtasks })
        });
        fetchTasks();
    } catch (error) {
        console.error("Error updating subtask:", error);
    }
}

async function handleAddSubtask(e) {
    const taskId = parseInt(e.target.dataset.taskId);
    const subtaskText = prompt("Enter subtask text:");
    
    if (!subtaskText) return;
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    if (!task.subtasks) task.subtasks = [];
    task.subtasks.push({ text: subtaskText, completed: false });
    
    try {
        await fetch(`${API_URL}/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subtasks: task.subtasks })
        });
        fetchTasks();
    } catch (error) {
        console.error("Error adding subtask:", error);
    }
}

// Display user info and handle logout
function displayUserInfo() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.getElementById("userDisplay").textContent = `Hello, ${user.username}`;
    }
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }
}

// --- API FUNCTIONS ---

async function fetchTasks() {
    try {
        const response = await fetch(API_URL);
        tasks = await response.json();
        render();
    } catch (error) {
        console.error("Error fetching tasks:", error);
    }
}

async function addTask() {
    const text = document.getElementById("taskInput").value.trim();
    if (!text) return;

    let subjectValue = document.getElementById("subjectSelect").value;
    if (subjectValue === "custom") {
        subjectValue = document.getElementById("customSubjectInput").value.trim() || "General";
        saveCustomSubject(subjectValue);
    }

    const newTask = {
        text: text,
        priority: document.getElementById("prioritySelect").value,
        subject: subjectValue,
        due_date: document.getElementById("dueDateInput").value || null,
        attachments: pendingAttachments.length > 0 ? pendingAttachments : [],
        subtasks: []
    };

    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTask)
        });
        document.getElementById("taskInput").value = "";
        document.getElementById("dueDateInput").value = "";
        document.getElementById("customSubjectInput").value = "";
        document.getElementById("customSubjectInput").style.display = "none";
        document.getElementById("subjectSelect").value = "General";
        pendingAttachments = [];
        renderAttachmentsList();
        fetchTasks();
    } catch (error) {
        console.error("Error adding task:", error);
    }
}

async function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    try {
        await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: !task.completed })
        });
        
        const completedDates = JSON.parse(localStorage.getItem('completedDates')) || [];
        const today = new Date().toDateString();
        
        if (!task.completed) {
            if (!completedDates.includes(today)) {
                completedDates.push(today);
            }
        } else {
            const otherCompletedToday = tasks.filter(t => t.id !== id && t.completed).length === 0;
            if (otherCompletedToday) {
                const index = completedDates.indexOf(today);
                if (index > -1) completedDates.splice(index, 1);
            }
        }
        localStorage.setItem('completedDates', JSON.stringify(completedDates));
        
        fetchTasks();
    } catch (error) {
        console.error("Error updating task status:", error);
    }
}

async function deleteTask(id) {
    try {
        await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });
        fetchTasks();
    } catch (error) {
        console.error("Error deleting task:", error);
    }
}

// --- UI RENDER FUNCTIONS ---

function updateStatistics() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const remaining = total - completed;

    document.getElementById("total").textContent = total;
    document.getElementById("completed").textContent = completed;
    document.getElementById("remaining").textContent = remaining;
}

function render() {
    const taskList = document.getElementById("taskList");
    taskList.innerHTML = "";

    const filtered = tasks.filter(task => {
        const matchesFilter = activeFilter === 'all' || 
            (activeFilter === 'active' && !task.completed) || 
            (activeFilter === 'completed' && task.completed);
        const matchesSearch = task.text.toLowerCase().includes(searchQuery);
        const matchesSubject = !activeSubjectFilter || task.subject === activeSubjectFilter;
        return matchesFilter && matchesSearch && matchesSubject;
    });

    if (filtered.length === 0) {
        taskList.innerHTML = `<li style="justify-content:center; color: var(--text-muted);">No tasks found.</li>`;
    }

    filtered.forEach(task => {
        const li = document.createElement("li");
        li.className = task.completed ? "completed" : "";
        
        const isOverdue = task.due_date && !task.completed && new Date(task.due_date) < new Date().setHours(0,0,0,0);
        
        const attachmentsHtml = renderTaskAttachments(task);
        const subtasksHtml = renderSubtasks(task);
        
        li.innerHTML = `
            <div style="flex: 1;">
                <div>
                    <span class="task-text">${task.text}</span>
                    <span class="priority-badge ${task.priority}">${task.priority}</span>
                    <span class="subject-badge">${task.subject || 'General'}</span>
                    ${task.due_date ? `<span class="due-date-badge ${isOverdue ? 'overdue' : ''}">${isOverdue ? 'Overdue: ' : ''}${task.due_date}</span>` : ''}
                </div>
                ${attachmentsHtml ? `<div class="task-attachments">${attachmentsHtml}</div>` : ''}
                ${subtasksHtml}
            </div>
            <div class="task-actions">
                ${!task.completed ? `<button class="action-btn focus" onclick="startFocusMode(${task.id})" title="Start Focus Mode">
                    <i class="fa-solid fa-clock"></i>
                </button>` : ''}
                <button class="action-btn check" onclick="toggleTask(${task.id})">
                    <i class="fa-solid ${task.completed ? 'fa-rotate-left' : 'fa-check'}"></i>
                </button>
                <button class="action-btn delete" onclick="deleteTask(${task.id})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        taskList.appendChild(li);
    });

    updateStatistics();
    updateAnalytics();
    renderSubjectFilters();
    
    document.querySelectorAll('.subtask-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleSubtaskToggle);
    });
    
    document.querySelectorAll('.add-subtask-btn').forEach(btn => {
        btn.addEventListener('click', handleAddSubtask);
    });
}

function renderSubjectFilters() {
    const subjects = [...new Set(tasks.map(task => task.subject))];
    const subjectFilters = document.getElementById("subjectFilters");
    subjectFilters.innerHTML = "";
    subjects.forEach(subject => {
        const button = document.createElement("button");
        button.classList.add("subject-filter");
        button.dataset.subject = subject;
        button.textContent = subject;
        if (subject === activeSubjectFilter) {
            button.classList.add("active");
        }
        subjectFilters.appendChild(button);
    });
}

function saveCustomSubject(subject) {
    if (!customSubjects.includes(subject) && subject !== "General") {
        customSubjects.push(subject);
        localStorage.setItem('customSubjects', JSON.stringify(customSubjects));
        
        const subjectSelect = document.getElementById("subjectSelect");
        const option = document.createElement("option");
        option.value = subject;
        option.textContent = subject;
        subjectSelect.insertBefore(option, subjectSelect.lastElementChild);
    }
}

function loadCustomSubjects() {
    const subjectSelect = document.getElementById("subjectSelect");
    customSubjects.forEach(subject => {
        const exists = Array.from(subjectSelect.options).some(option => option.value === subject);
        if (!exists && subject !== "custom") {
            const option = document.createElement("option");
            option.value = subject;
            option.textContent = subject;
            subjectSelect.insertBefore(option, subjectSelect.lastElementChild);
        }
    });
}

// Initialize everything
document.addEventListener("DOMContentLoaded", () => {
    loadTheme();
    loadCustomSubjects();
    displayUserInfo();
    fetchTasks();
    updateAnalytics();
    
    // Set footer year
    document.getElementById("currentYear").textContent = new Date().getFullYear();
    
    // Add event listeners
    document.getElementById("addBtn").addEventListener("click", addTask);
    document.getElementById("taskInput").addEventListener("keypress", (e) => { 
        if (e.key === "Enter") addTask(); 
    });
    
    document.getElementById("searchInput").addEventListener("input", (e) => {
        searchQuery = e.target.value.toLowerCase();
        render();
    });
    
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeFilter = btn.dataset.filter;
            render();
        });
    });
    
    document.getElementById("subjectSelect").addEventListener("change", (e) => {
        if (e.target.value === "custom") {
            document.getElementById("customSubjectInput").style.display = "block";
            document.getElementById("customSubjectInput").focus();
        } else {
            document.getElementById("customSubjectInput").style.display = "none";
            document.getElementById("customSubjectInput").value = "";
        }
    });
    
    document.getElementById("subjectFilters").addEventListener("click", (e) => {
        if (e.target.classList.contains("subject-filter")) {
            const subject = e.target.dataset.subject;
            activeSubjectFilter = subject;
            render();
        }
    });
    
    document.getElementById("logoutBtn").addEventListener('click', handleLogout);
    document.getElementById("addAttachmentBtn").addEventListener("click", addAttachment);
    
    // Timer event listeners
    document.getElementById("startTimer").addEventListener("click", startTimer);
    document.getElementById("pauseTimer").addEventListener("click", pauseTimer);
    document.getElementById("resetTimer").addEventListener("click", resetTimer);
    document.getElementById("closeModal").addEventListener("click", closePomodoroModal);
    
    // Timer preset buttons
    document.querySelectorAll(".timer-preset").forEach(btn => {
        btn.addEventListener("click", () => {
            const minutes = parseInt(btn.dataset.minutes);
            document.querySelectorAll(".timer-preset").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            setTimerDuration(minutes);
        });
    });
    
    // Custom timer minutes input
    document.getElementById("timerCustomMinutes").addEventListener("input", (e) => {
        const minutes = parseInt(e.target.value) || 25;
        e.target.value = Math.min(Math.max(minutes, 1), 180);
        document.querySelectorAll(".timer-preset").forEach(b => b.classList.remove("active"));
        setTimerDuration(e.target.value);
    });
    
    // Custom alarm upload
    document.getElementById("customAlarmSound").addEventListener("change", handleCustomAlarmUpload);
    document.getElementById("testSoundBtn").addEventListener("click", testAlarmSound);
    
    // Smart estimator event listeners
    document.getElementById("smartEstimatorBtn").addEventListener("click", openEstimatorModal);
    document.getElementById("closeEstimatorModal").addEventListener("click", closeEstimatorModal);
    document.getElementById("estimateBtn").addEventListener("click", handleEstimateClick);
    document.getElementById("splitTaskBtn").addEventListener("click", splitTaskIntoSessions);
    
    // Close modals when clicking outside
    document.getElementById("pomodoroModal").addEventListener("click", (e) => {
        if (e.target.id === "pomodoroModal") closePomodoroModal();
    });
    document.getElementById("smartEstimatorModal").addEventListener("click", (e) => {
        if (e.target.id === "smartEstimatorModal") closeEstimatorModal();
    });
    
    // Request notification permission
    if (Notification.permission === "default") {
        Notification.requestPermission();
    }
});
