let tasks = JSON.parse(localStorage.getItem('student_dashboard_tasks')) || [];
let activeFilter = 'all';
let searchQuery = '';

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

if (currentYearEl) {
    currentYearEl.textContent = new Date().getFullYear();
}

addBtn.addEventListener("click", addTask);
taskInput.addEventListener("keypress", (e) => { if (e.key === "Enter") addTask(); });

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

function saveTasks() {
    localStorage.setItem('student_dashboard_tasks', JSON.stringify(tasks));
}

function addTask() {
    const text = taskInput.value.trim();
    if (!text) return;

    const newTask = {
        id: Date.now(),
        text: text,
        priority: prioritySelect.value,
        completed: false
    };

    tasks.push(newTask);
    saveTasks();
    taskInput.value = "";
    render();
}

function toggleTask(id) {
    tasks = tasks.map(task => 
        task.id === id ? { ...task, completed: !task.completed } : task
    );
    saveTasks();
    render();
}

function deleteTask(id) {
    tasks = tasks.filter(task => task.id !== id);
    saveTasks();
    render();
}

function updateStatistics() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const remaining = total - completed;

    totalEl.textContent = total;
    completedEl.textContent = completed;
    remainingEl.textContent = remaining;
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

render();