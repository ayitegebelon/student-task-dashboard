const API_URL = '/api/tasks';

let tasks = [];
let activeFilter = 'all';
let searchQuery = '';

// DOM Elements
const taskInput = document.getElementById("taskInput");
const prioritySelect = document.getElementById("prioritySelect");
const addBtn = document.getElementById("addBtn");
const taskList = document.getElementById("taskList");
const searchInput = document.getElementById("searchInput");
const filterBtns = document.querySelectorAll(".filter-btn");

const totalEl = document.getElementById("total");
const completedEl = document.getElementById("completed");
const remainingEl = document.getElementById("remaining");
const currentYearEl = document.getElementById("currentYear");

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

    const newTask = {
        text: text,
        priority: prioritySelect.value
    };

    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTask)
        });
        taskInput.value = "";
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
        return matchesFilter && matchesSearch;
    });

    if (filtered.length === 0) {
        taskList.innerHTML = `<li style="justify-content:center; color: var(--text-muted);">No tasks found.</li>`;
    }

    filtered.forEach(task => {
        const li = document.createElement("li");
        li.className = task.completed ? "completed" : "";
        li.innerHTML = `
            <div>
                <span class="task-text">${task.text}</span>
                <span class="priority-badge ${task.priority}">${task.priority}</span>
            </div>
            <div class="task-actions">
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
}

// Initial Load from API
document.addEventListener("DOMContentLoaded", fetchTasks);