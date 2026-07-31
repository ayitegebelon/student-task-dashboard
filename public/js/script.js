const API_URL = '/api/tasks';

let tasks = [];
let activeFilter = 'all';
let searchQuery = '';
let activeSubjectFilter = null;
let customSubjects = JSON.parse(localStorage.getItem('customSubjects')) || [];
let customAlarmSound = localStorage.getItem('customAlarmSound') || null;
let currentEstimation = null;

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

// DOM Elements
const taskInput = document.getElementById("taskInput");
const prioritySelect = document.getElementById("prioritySelect");
const subjectSelect = document.getElementById("subjectSelect");
const customSubjectInput = document.getElementById("customSubjectInput");
const dueDateInput = document.getElementById("dueDateInput");
const addBtn = document.getElementById("addBtn");
const taskList = document.getElementById("taskList");
const searchInput = document.getElementById("searchInput");
const filterBtns = document.querySelectorAll(".filter-btn");
const subjectFilters = document.getElementById("subjectFilters");

const totalEl = document.getElementById("total");
const completedEl = document.getElementById("completed");
const remainingEl = document.getElementById("remaining");
const currentYearEl = document.getElementById("currentYear");

const customAlarmSoundInput = document.getElementById("customAlarmSound");
const testSoundBtn = document.getElementById("testSoundBtn");

const smartEstimatorBtn = document.getElementById("smartEstimatorBtn");
const smartEstimatorModal = document.getElementById("smartEstimatorModal");
const closeEstimatorModalBtn = document.getElementById("closeEstimatorModal");
const estimatorTaskInput = document.getElementById("estimatorTaskInput");
const estimatorHoursInput = document.getElementById("estimatorHoursInput");
const estimatorResult = document.getElementById("estimatorResult");
const estimateBtn = document.getElementById("estimateBtn");
const splitTaskBtn = document.getElementById("splitTaskBtn");

// Set Footer Year
if (currentYearEl) {
    currentYearEl.textContent = new Date().getFullYear();
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
        due_date: dueDateInput.value || null
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
        
        li.innerHTML = `
            <div>
                <span class="task-text">${task.text}</span>
                <span class="priority-badge ${task.priority}">${task.priority}</span>
                <span class="subject-badge">${task.subject || 'General'}</span>
                ${task.due_date ? `<span class="due-date-badge ${isOverdue ? 'overdue' : ''}">${isOverdue ? 'Overdue: ' : ''}${task.due_date}</span>` : ''}
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
    renderSubjectFilters();
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
    fetchTasks();
});