const API_URL = '/api/tasks';

let tasks = [];
let activeFilter = 'all';
let searchQuery = '';
let activeSubjectFilter = null;
let customSubjects = JSON.parse(localStorage.getItem('customSubjects')) || [];
let customAlarmSound = localStorage.getItem('customAlarmSound') || null;
let currentEstimation = null;
let pendingAttachments = [];

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
    
    // Update theme toggle icon
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
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark ? 'dark' : 'light', savedAccent);
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    const currentAccent = accentPreset.value;
    
    localStorage.setItem('theme', newTheme);
    localStorage.setItem('accent', currentAccent);
    applyTheme(newTheme, currentAccent);
}

function changeAccent(e) {
    const newAccent = e.target.value;
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
    
    // Add today if not already present and there are completed tasks today
    const todayCompleted = tasks.filter(t => t.completed).length > 0;
    if (todayCompleted && !completedDates.includes(today)) {
        completedDates.push(today);
        localStorage.setItem('completedDates', JSON.stringify(completedDates));
    }
    
    // Calculate streak
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
    progressRingValueEl.textContent = percentage + '%';
}

function updateWeeklyChart() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const weekData = {};
    
    // Initialize week data
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - today.getDay() + i);
        weekData[date.toDateString()] = 0;
    }
    
    // Count completed tasks per day
    const completedDates = JSON.parse(localStorage.getItem('completedDates')) || [];
    completedDates.forEach(date => {
        if (weekData.hasOwnProperty(date)) {
            weekData[date]++;
        }
    });
    
    // Update chart bars
    const bars = weeklyChartEl.querySelectorAll('.chart-bar');
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
    
    totalCompletedEl.textContent = completedCount;
    studyStreakEl.textContent = streak + ' day' + (streak !== 1 ? 's' : '');
    completionRateEl.textContent = rate + '%';
    
    updateProgressRing(rate);
    updateWeeklyChart();
}

// Attachment Functions
function addAttachment() {
    const url = attachmentUrlInput.value.trim();
    const name = attachmentNameInput.value.trim();
    
    if (!url || !name) return;
    
    // Validate URL format
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        alert('Please enter a valid URL starting with http:// or https://');
        return;
    }
    
    const attachment = { url, name, id: Date.now() };
    pendingAttachments.push(attachment);
    
    renderAttachmentsList();
    attachmentUrlInput.value = '';
    attachmentNameInput.value = '';
}

function renderAttachmentsList() {
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

// Attachment event listeners
addAttachmentBtn.addEventListener("click", addAttachment);

// DOM Elements - will be initialized after DOM loads
let taskInput, prioritySelect, subjectSelect, customSubjectInput, dueDateInput, addBtn, taskList, searchInput, filterBtns, subjectFilters;
let totalEl, completedEl, remainingEl, currentYearEl;
let userDisplay, logoutBtn;
let totalCompletedEl, studyStreakEl, completionRateEl, progressRingValueEl, weeklyChartEl;
let attachmentUrlInput, attachmentNameInput, addAttachmentBtn, attachmentsListEl;
let customAlarmSoundInput, testSoundBtn;
let smartEstimatorBtn, smartEstimatorModal, closeEstimatorModalBtn, estimatorTaskInput, estimatorHoursInput, estimatorResult, estimateBtn, splitTaskBtn;
let closeModalBtn, startTimerBtn, pauseTimerBtn, resetTimerBtn, timerPresetBtns, timerCustomMinutes, pomodoroModal;

// Initialize DOM elements
function initializeDOMElements() {
    taskInput = document.getElementById("taskInput");
    prioritySelect = document.getElementById("prioritySelect");
    subjectSelect = document.getElementById("subjectSelect");
    customSubjectInput = document.getElementById("customSubjectInput");
    dueDateInput = document.getElementById("dueDateInput");
    addBtn = document.getElementById("addBtn");
    taskList = document.getElementById("taskList");
    searchInput = document.getElementById("searchInput");
    filterBtns = document.querySelectorAll(".filter-btn");
    subjectFilters = document.getElementById("subjectFilters");

    totalEl = document.getElementById("total");
    completedEl = document.getElementById("completed");
    remainingEl = document.getElementById("remaining");
    currentYearEl = document.getElementById("currentYear");

    userDisplay = document.getElementById("userDisplay");
    logoutBtn = document.getElementById("logoutBtn");

    totalCompletedEl = document.getElementById("totalCompleted");
    studyStreakEl = document.getElementById("studyStreak");
    completionRateEl = document.getElementById("completionRate");
    progressRingValueEl = document.getElementById("progressRingValue");
    weeklyChartEl = document.getElementById("weeklyChart");

    attachmentUrlInput = document.getElementById("attachmentUrl");
    attachmentNameInput = document.getElementById("attachmentName");
    addAttachmentBtn = document.getElementById("addAttachmentBtn");
    attachmentsListEl = document.getElementById("attachmentsList");

    customAlarmSoundInput = document.getElementById("customAlarmSound");
    testSoundBtn = document.getElementById("testSoundBtn");

    smartEstimatorBtn = document.getElementById("smartEstimatorBtn");
    smartEstimatorModal = document.getElementById("smartEstimatorModal");
    closeEstimatorModalBtn = document.getElementById("closeEstimatorModal");
    estimatorTaskInput = document.getElementById("estimatorTaskInput");
    estimatorHoursInput = document.getElementById("estimatorHoursInput");
    estimatorResult = document.getElementById("estimatorResult");
    estimateBtn = document.getElementById("estimateBtn");
    splitTaskBtn = document.getElementById("splitTaskBtn");

    // Pomodoro timer elements
    closeModalBtn = document.getElementById("closeModal");
    startTimerBtn = document.getElementById("startTimer");
    pauseTimerBtn = document.getElementById("pauseTimer");
    resetTimerBtn = document.getElementById("resetTimer");
    timerPresetBtns = document.querySelectorAll(".timer-preset");
    timerCustomMinutes = document.getElementById("timerCustomMinutes");
    pomodoroModal = document.getElementById("pomodoroModal");
}

// Initialize event listeners
function initializeEventListeners() {
    if (!addBtn || !taskInput || !subjectSelect) {
        console.error("Required DOM elements not found");
        return;
    }

    addBtn.addEventListener("click", addTask);
    taskInput.addEventListener("keypress", (e) => { 
        if (e.key === "Enter") addTask(); 
    });

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchQuery = e.target.value.toLowerCase();
            render();
        });
    }

    if (filterBtns) {
        filterBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                filterBtns.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                activeFilter = btn.dataset.filter;
                render();
            });
        });
    }

    if (subjectSelect) {
        subjectSelect.addEventListener("change", (e) => {
            if (e.target.value === "custom") {
                customSubjectInput.style.display = "block";
                customSubjectInput.focus();
            } else {
                customSubjectInput.style.display = "none";
                customSubjectInput.value = "";
            }
        });
    }

    if (subjectFilters) {
        subjectFilters.addEventListener("click", (e) => {
            if (e.target.classList.contains("subject-filter")) {
                const subject = e.target.dataset.subject;
                activeSubjectFilter = subject;
                render();
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Pomodoro timer event listeners
    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", closePomodoroModal);
    }
    
    if (startTimerBtn) {
        startTimerBtn.addEventListener("click", startTimer);
    }
    
    if (pauseTimerBtn) {
        pauseTimerBtn.addEventListener("click", pauseTimer);
    }
    
    if (resetTimerBtn) {
        resetTimerBtn.addEventListener("click", resetTimer);
    }
    
    if (timerPresetBtns) {
        timerPresetBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const minutes = parseInt(btn.dataset.minutes);
                setTimerDuration(minutes);
            });
        });
    }
    
    if (timerCustomMinutes) {
        timerCustomMinutes.addEventListener("input", (e) => {
            const minutes = parseInt(e.target.value) || 25;
            e.target.value = minutes;
            timerPresetBtns.forEach(b => b.classList.remove("active"));
            setTimerDuration(minutes);
        });
    }
    
    if (pomodoroModal) {
        pomodoroModal.addEventListener("click", (e) => {
            if (e.target === pomodoroModal) {
                closePomodoroModal();
            }
        });
    }

    // Smart estimator event listeners
    if (smartEstimatorBtn) {
        smartEstimatorBtn.addEventListener("click", () => {
            smartEstimatorModal.style.display = "flex";
        });
    }
    
    if (closeEstimatorModalBtn) {
        closeEstimatorModalBtn.addEventListener("click", () => {
            smartEstimatorModal.style.display = "none";
        });
    }
    
    if (estimateBtn) {
        estimateBtn.addEventListener("click", () => {
            const taskName = estimatorTaskInput.value.trim();
            const hours = estimatorHoursInput.value.trim();
            const result = calculateWorkload(taskName, hours);
            estimatorResult.innerHTML = result.html;
            splitTaskBtn.style.display = result.sessions > 1 ? "inline-block" : "none";
            currentEstimation = result;
        });
    }
    
    if (splitTaskBtn) {
        splitTaskBtn.addEventListener("click", () => {
            if (currentEstimation && currentEstimation.sessions > 1) {
                const baseTask = estimatorTaskInput.value.trim();
                for (let i = 1; i <= currentEstimation.sessions; i++) {
                    taskInput.value = `${baseTask} - Part ${i}`;
                    addTask();
                }
                smartEstimatorModal.style.display = "none";
                estimatorTaskInput.value = "";
                estimatorHoursInput.value = "";
                estimatorResult.innerHTML = "";
                splitTaskBtn.style.display = "none";
            }
        });
    }

    // Custom sound event listeners
    if (customAlarmSoundInput) {
        customAlarmSoundInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                customAlarmSound = event.target.result;
                localStorage.setItem('customAlarmSound', customAlarmSound);
                alert("Custom alarm sound saved!");
            };
            reader.readAsDataURL(file);
        });
    }

    if (testSoundBtn) {
        testSoundBtn.addEventListener("click", () => {
            playCustomAudio();
        });
    }
}

// Set Footer Year
if (currentYearEl) {
    currentYearEl.textContent = new Date().getFullYear();
}

// Display user info and handle logout
function displayUserInfo() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && userDisplay) {
        userDisplay.textContent = `Hello, ${user.username}`;
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

if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
}

// Event Listeners
addBtn.addEventListener("click", addTask);
taskInput.addEventListener("keypress", (e) => { 
    if (e.key === "Enter") addTask(); 
});

searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase();
    render();
});

filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = btn.dataset.filter;
        render();
    });
});

subjectSelect.addEventListener("change", (e) => {
    if (e.target.value === "custom") {
        customSubjectInput.style.display = "block";
        customSubjectInput.focus();
    } else {
        customSubjectInput.style.display = "none";
        customSubjectInput.value = "";
    }
});

subjectFilters.addEventListener("click", (e) => {
    if (e.target.classList.contains("subject-filter")) {
        const subject = e.target.dataset.subject;
        activeSubjectFilter = subject;
        render();
    }
});

// --- API FUNCTIONS ---

// 1. Fetch all tasks from SQLite Database
async function fetchTasks() {
    try {
        const response = await fetch(API_URL);
        tasks = await response.json();
        render();
    } catch (error) {
        console.error("Error fetching tasks from SQLite server:", error);
    }
}

// 2. Add task to SQLite Database
async function addTask() {
    const text = taskInput.value.trim();
    if (!text) return;

    let subjectValue = subjectSelect.value;
    if (subjectValue === "custom") {
        subjectValue = customSubjectInput.value.trim() || "General";
        saveCustomSubject(subjectValue);
    }

    const newTask = {
        text: text,
        priority: prioritySelect.value,
        subject: subjectValue,
        due_date: dueDateInput.value || null,
        attachments: pendingAttachments.length > 0 ? pendingAttachments : [],
        subtasks: []
    };

    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTask)
        });
        taskInput.value = "";
        dueDateInput.value = "";
        customSubjectInput.value = "";
        customSubjectInput.style.display = "none";
        subjectSelect.value = "General";
        pendingAttachments = [];
        renderAttachmentsList();
        fetchTasks();
    } catch (error) {
        console.error("Error adding task:", error);
    }
}

// 3. Toggle completion state in SQLite Database
async function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    try {
        await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: !task.completed })
        });
        
        // Update completed dates for analytics
        const completedDates = JSON.parse(localStorage.getItem('completedDates')) || [];
        const today = new Date().toDateString();
        
        if (!task.completed) {
            // Task is being completed
            if (!completedDates.includes(today)) {
                completedDates.push(today);
            }
        } else {
            // Task is being uncompleted - remove today if no other completed tasks
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

// 4. Delete task from SQLite Database
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

    if (totalEl) totalEl.textContent = total;
    if (completedEl) completedEl.textContent = completed;
    if (remainingEl) remainingEl.textContent = remaining;
}

function render() {
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
        
        // Check if task is overdue
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
    
    // Add event listeners for subtask checkboxes and add buttons
    document.querySelectorAll('.subtask-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleSubtaskToggle);
    });
    
    document.querySelectorAll('.add-subtask-btn').forEach(btn => {
        btn.addEventListener('click', handleAddSubtask);
    });
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

function renderSubjectFilters() {
    const subjects = [...new Set(tasks.map(task => task.subject))];
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

// --- AUDIO ENGINE FUNCTIONS ---

// Web Audio API Chime
function playWebAudioChime() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create oscillator for the chime
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Multi-frequency chime pattern
        const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        let noteIndex = 0;
        
        function playNote() {
            if (noteIndex >= frequencies.length) {
                oscillator.stop();
                audioContext.close();
                return;
            }
            
            oscillator.frequency.setValueAtTime(frequencies[noteIndex], audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            noteIndex++;
            setTimeout(playNote, 300);
        }
        
        oscillator.start();
        playNote();
    } catch (error) {
        console.error("Error playing Web Audio chime:", error);
    }
}

// Play custom audio from localStorage
function playCustomAudio() {
    if (!customAlarmSound) {
        playWebAudioChime();
        return;
    }
    
    try {
        const audio = new Audio(customAlarmSound);
        audio.play().catch(() => {
            console.log("Custom audio failed, falling back to chime");
            playWebAudioChime();
        });
    } catch (error) {
        console.error("Error playing custom audio:", error);
        playWebAudioChime();
    }
}

// Handle custom audio file upload
customAlarmSoundInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        customAlarmSound = event.target.result;
        localStorage.setItem('customAlarmSound', customAlarmSound);
        alert("Custom alarm sound saved!");
    };
    reader.readAsDataURL(file);
});

// Test sound button
testSoundBtn.addEventListener("click", () => {
    playCustomAudio();
});

// --- PERSISTENT CUSTOM SUBJECTS ---

function loadCustomSubjects() {
    customSubjects.forEach(subject => {
        // Check if subject already exists to prevent duplication
        const exists = Array.from(subjectSelect.options).some(option => option.value === subject);
        if (!exists && subject !== "custom") {
            const option = document.createElement("option");
            option.value = subject;
            option.textContent = subject;
            subjectSelect.insertBefore(option, subjectSelect.lastElementChild);
        }
    });
}

function saveCustomSubject(subject) {
    if (!customSubjects.includes(subject) && subject !== "General") {
        customSubjects.push(subject);
        localStorage.setItem('customSubjects', JSON.stringify(customSubjects));
        
        // Add to dropdown
        const option = document.createElement("option");
        option.value = subject;
        option.textContent = subject;
        subjectSelect.insertBefore(option, subjectSelect.lastElementChild);
    }
}

// --- SMART WORKLOAD ESTIMATOR ---

function calculateWorkload(taskName, estimatedHours) {
    let sessions = 1;
    let energyLevel = "Low Energy / Quick Win";
    let energyIcon = "⚡";
    
    if (estimatedHours) {
        // Use provided hours
        const hours = parseFloat(estimatedHours);
        sessions = Math.ceil(hours / 0.5); // 1 session = 25 mins ~ 0.5 hours
    } else {
        // Estimate based on task name length and complexity
        const wordCount = taskName.split(/\s+/).length;
        const hasComplexWords = /\b(study|research|project|thesis|dissertation|analysis|development|implementation)\b/i.test(taskName);
        
        if (wordCount <= 3 && !hasComplexWords) {
            sessions = 1;
        } else if (wordCount <= 6 || hasComplexWords) {
            sessions = 2;
        } else {
            sessions = Math.ceil(wordCount / 3);
        }
    }
    
    // Determine energy level
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
    
    estimatorResult.innerHTML = `
        <div class="estimation-card">
            <div class="energy-tag ${result.sessions === 1 ? 'low' : result.sessions <= 3 ? 'medium' : 'high'}">
                ${result.energyIcon} ${result.energyLevel}
            </div>
            <div class="sessions-info">
                <strong>Estimated Pomodoro Sessions:</strong> ${result.sessions}
            </div>
            <div class="time-info">
                <strong>Total Focus Time:</strong> ${result.sessions * 25} minutes
            </div>
        </div>
    `;
    
    // Show split button if sessions > 1
    splitTaskBtn.style.display = result.sessions > 1 ? "inline-flex" : "none";
}

async function splitTaskIntoSessions() {
    if (!currentEstimation || currentEstimation.sessions <= 1) return;
    
    const { taskName, sessions } = currentEstimation;
    const basePriority = prioritySelect.value;
    const baseSubject = subjectSelect.value === "custom" ? customSubjectInput.value.trim() || "General" : subjectSelect.value;
    const baseDueDate = dueDateInput.value || null;
    
    for (let i = 1; i <= sessions; i++) {
        const sessionTask = {
            text: `${taskName} - Session ${i}`,
            priority: basePriority,
            subject: baseSubject,
            due_date: baseDueDate
        };
        
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionTask)
        });
    }
    
    // Close modal and refresh
    smartEstimatorModal.classList.remove("active");
    fetchTasks();
    alert(`Successfully split into ${sessions} sessions!`);
}

// Smart Estimator event listeners
smartEstimatorBtn.addEventListener("click", () => {
    smartEstimatorModal.classList.add("active");
    estimatorTaskInput.value = taskInput.value;
});

closeEstimatorModalBtn.addEventListener("click", () => {
    smartEstimatorModal.classList.remove("active");
    estimatorResult.innerHTML = "";
    splitTaskBtn.style.display = "none";
});

estimateBtn.addEventListener("click", () => {
    const taskName = estimatorTaskInput.value.trim();
    const estimatedHours = estimatorHoursInput.value;
    
    if (!taskName) {
        alert("Please enter a task name");
        return;
    }
    
    showEstimationResult(taskName, estimatedHours);
});

splitTaskBtn.addEventListener("click", splitTaskIntoSessions);

// Close estimator modal when clicking outside
smartEstimatorModal.addEventListener("click", (e) => {
    if (e.target === smartEstimatorModal) {
        smartEstimatorModal.classList.remove("active");
        estimatorResult.innerHTML = "";
        splitTaskBtn.style.display = "none";
    }
});

// --- AUDIO ENGINE FUNCTIONS ---

// Web Audio API Chime
function playWebAudioChime() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        const frequencies = [523.25, 659.25, 783.99, 1046.50];
        let noteIndex = 0;
        
        function playNote() {
            if (noteIndex >= frequencies.length) {
                oscillator.stop();
                audioContext.close();
                return;
            }
            
            oscillator.frequency.setValueAtTime(frequencies[noteIndex], audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            noteIndex++;
            setTimeout(playNote, 300);
        }
        
        oscillator.start();
        playNote();
    } catch (error) {
        console.error("Error playing Web Audio chime:", error);
    }
}

// Play custom audio from localStorage
function playCustomAudio() {
    if (!customAlarmSound) {
        playWebAudioChime();
        return;
    }
    
    try {
        const audio = new Audio(customAlarmSound);
        audio.play().catch(() => {
            playWebAudioChime();
        });
    } catch (error) {
        console.error("Error playing custom audio:", error);
        playWebAudioChime();
    }
}

// Handle custom audio file upload
customAlarmSoundInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        customAlarmSound = event.target.result;
        localStorage.setItem('customAlarmSound', customAlarmSound);
        alert("Custom alarm sound saved!");
    };
    reader.readAsDataURL(file);
});

// Test sound button
testSoundBtn.addEventListener("click", () => {
    playCustomAudio();
});

// --- PERSISTENT CUSTOM SUBJECTS ---

function loadCustomSubjects() {
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

function saveCustomSubject(subject) {
    if (!customSubjects.includes(subject) && subject !== "General") {
        customSubjects.push(subject);
        localStorage.setItem('customSubjects', JSON.stringify(customSubjects));
        
        const option = document.createElement("option");
        option.value = subject;
        option.textContent = subject;
        subjectSelect.insertBefore(option, subjectSelect.lastElementChild);
    }
}

// --- SMART WORKLOAD ESTIMATOR ---

function calculateWorkload(taskName, estimatedHours) {
    let sessions = 1;
    let energyLevel = "Low Energy / Quick Win";
    let energyIcon = "⚡";
    
    if (estimatedHours) {
        const hours = parseFloat(estimatedHours);
        sessions = Math.ceil(hours / 0.5);
    } else {
        const wordCount = taskName.split(/\s+/).length;
        const hasComplexWords = /\b(study|research|project|thesis|dissertation|analysis|development|implementation)\b/i.test(taskName);
        
        if (wordCount <= 3 && !hasComplexWords) {
            sessions = 1;
        } else if (wordCount <= 6 || hasComplexWords) {
            sessions = 2;
        } else {
            sessions = Math.ceil(wordCount / 3);
        }
    }
    
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
    
    estimatorResult.innerHTML = `
        <div class="estimation-card">
            <div class="energy-tag ${result.sessions === 1 ? 'low' : result.sessions <= 3 ? 'medium' : 'high'}">
                ${result.energyIcon} ${result.energyLevel}
            </div>
            <div class="sessions-info">
                <strong>Estimated Pomodoro Sessions:</strong> ${result.sessions}
            </div>
            <div class="time-info">
                <strong>Total Focus Time:</strong> ${result.sessions * 25} minutes
            </div>
        </div>
    `;
    
    splitTaskBtn.style.display = result.sessions > 1 ? "inline-flex" : "none";
}

async function splitTaskIntoSessions() {
    if (!currentEstimation || currentEstimation.sessions <= 1) return;
    
    const { taskName, sessions } = currentEstimation;
    const basePriority = prioritySelect.value;
    const baseSubject = subjectSelect.value === "custom" ? customSubjectInput.value.trim() || "General" : subjectSelect.value;
    const baseDueDate = dueDateInput.value || null;
    
    for (let i = 1; i <= sessions; i++) {
        const sessionTask = {
            text: `${taskName} - Session ${i}`,
            priority: basePriority,
            subject: baseSubject,
            due_date: baseDueDate
        };
        
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionTask)
        });
    }
    
    smartEstimatorModal.classList.remove("active");
    fetchTasks();
    alert(`Successfully split into ${sessions} sessions!`);
}

// Smart Estimator event listeners
smartEstimatorBtn.addEventListener("click", () => {
    smartEstimatorModal.classList.add("active");
    estimatorTaskInput.value = taskInput.value;
});

closeEstimatorModalBtn.addEventListener("click", () => {
    smartEstimatorModal.classList.remove("active");
    estimatorResult.innerHTML = "";
    splitTaskBtn.style.display = "none";
});

estimateBtn.addEventListener("click", () => {
    const taskName = estimatorTaskInput.value.trim();
    const estimatedHours = estimatorHoursInput.value;
    
    if (!taskName) {
        alert("Please enter a task name");
        return;
    }
    
    showEstimationResult(taskName, estimatedHours);
});

splitTaskBtn.addEventListener("click", splitTaskIntoSessions);

smartEstimatorModal.addEventListener("click", (e) => {
    if (e.target === smartEstimatorModal) {
        smartEstimatorModal.classList.remove("active");
        estimatorResult.innerHTML = "";
        splitTaskBtn.style.display = "none";
    }
});

// --- POMODORO TIMER FUNCTIONS ---

let timerInterval = null;
let timerSeconds = 25 * 60;
let currentTaskForFocus = null;

const pomodoroModal = document.getElementById("pomodoroModal");
const pomodoroTaskName = document.getElementById("pomodoroTaskName");
const pomodoroTimer = document.getElementById("pomodoroTimer");
const timerCustomMinutes = document.getElementById("timerCustomMinutes");
const timerPresetBtns = document.querySelectorAll(".timer-preset");
const startTimerBtn = document.getElementById("startTimer");
const pauseTimerBtn = document.getElementById("pauseTimer");
const resetTimerBtn = document.getElementById("resetTimer");
const closeModalBtn = document.getElementById("closeModal");

function startFocusMode(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    currentTaskForFocus = task;
    pomodoroTaskName.textContent = task.text;
    // Get current timer duration from custom input
    const customMinutes = parseInt(timerCustomMinutes.value) || 25;
    timerSeconds = customMinutes * 60;
    updateTimerDisplay();
    pomodoroModal.classList.add("active");
}

function setTimerDuration(minutes) {
    pauseTimer();
    timerSeconds = minutes * 60;
    timerCustomMinutes.value = minutes;
    updateTimerDisplay();
    pomodoroTimer.style.color = "";
}

function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    pomodoroTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function startTimer() {
    if (timerInterval) return;
    
    timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerDisplay();
        
        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            pomodoroTimer.textContent = "Time's up!";
            pomodoroTimer.style.color = "var(--success)";
            
            playCustomAudio();
            
            if (Notification.permission === "granted") {
                new Notification("Focus Session Complete!", {
                    body: `Great job! You completed your focus session for: ${currentTaskForFocus.text}`,
                    icon: "https://img.icons8.com/color/48/000000/task--v1.png"
                });
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission();
            }
        }
    }, 1000);
}

function pauseTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function resetTimer() {
    pauseTimer();
    // Reset to current custom input value
    const customMinutes = parseInt(timerCustomMinutes.value) || 25;
    timerSeconds = customMinutes * 60;
    updateTimerDisplay();
    pomodoroTimer.style.color = "";
}

function closePomodoroModal() {
    pauseTimer();
    resetTimer();
    pomodoroModal.classList.remove("active");
    currentTaskForFocus = null;
}

// Pomodoro event listeners
startTimerBtn.addEventListener("click", startTimer);
pauseTimerBtn.addEventListener("click", pauseTimer);
resetTimerBtn.addEventListener("click", resetTimer);
closeModalBtn.addEventListener("click", closePomodoroModal);

// Timer preset buttons
timerPresetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const minutes = parseInt(btn.dataset.minutes);
        timerPresetBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        setTimerDuration(minutes);
    });
});

// Custom timer input
timerCustomMinutes.addEventListener("change", (e) => {
    let minutes = parseInt(e.target.value);
    if (minutes < 1) minutes = 1;
    if (minutes > 180) minutes = 180;
    e.target.value = minutes;
    
    // Remove active class from presets when using custom
    timerPresetBtns.forEach(b => b.classList.remove("active"));
    setTimerDuration(minutes);
});

// Close modal when clicking outside
pomodoroModal.addEventListener("click", (e) => {
    if (e.target === pomodoroModal) {
        closePomodoroModal();
    }
});

// Request notification permission on page load
if (Notification.permission === "default") {
    Notification.requestPermission();
}

// Load custom subjects and theme on page load
document.addEventListener("DOMContentLoaded", () => {
    loadTheme();
    loadCustomSubjects();
    displayUserInfo();
    fetchTasks();
    updateAnalytics();
});