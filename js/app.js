/* ============================================================
   BLOOM TO-DO — Main Application Logic (app.js)
   ============================================================ */

'use strict';

/* ── STORAGE ─────────────────────────────────────────────────── */
const Storage = {
  KEY: 'bloom_tasks',

  load() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch {
      return [];
    }
  },

  save(tasks) {
    localStorage.setItem(this.KEY, JSON.stringify(tasks));
  }
};

/* ── STATE ───────────────────────────────────────────────────── */
const state = {
  tasks: [],
  filter: 'all',         // priority filter: all | High | Medium | Low
  view: 'today',         // nav view: today | weekly | all | completed
  categoryFilter: null,  // category string or null
  searchQuery: '',
  deleteTargetId: null,
};

/* ── HELPERS ─────────────────────────────────────────────────── */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(iso) {
  if (!iso) return false;
  return iso < today();
}

function isToday(iso) {
  return iso === today();
}

function isThisWeek(iso) {
  if (!iso) return false;
  const t = new Date(today());
  const d = new Date(iso + 'T00:00:00');
  const diff = (d - t) / 86400000;
  return diff >= 0 && diff <= 6;
}

function categoryColor(cat) {
  if (!cat) return '#c8b4e0';
  const colors = ['#f4a7b9','#c8b4e0','#a8d8b0','#f4c4a0','#a8c8e8','#e8c4d8','#b8d4a8','#f8d8b8'];
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function showToast(msg, duration = 2400) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

/* ── FILTER & DERIVE ─────────────────────────────────────────── */
function getVisibleTasks() {
  let tasks = [...state.tasks];

  // View filter
  if (state.view === 'today') {
    tasks = tasks.filter(t =>
      !t.done && (isToday(t.dueDate) || !t.dueDate || isOverdue(t.dueDate))
    );
  } else if (state.view === 'weekly') {
    tasks = tasks.filter(t => !t.done && isThisWeek(t.dueDate));
  } else if (state.view === 'completed') {
    tasks = tasks.filter(t => t.done);
  }
  // 'all' → no view filter

  // Priority filter
  if (state.filter !== 'all') {
    tasks = tasks.filter(t => t.priority === state.filter);
  }

  // Category filter
  if (state.categoryFilter) {
    tasks = tasks.filter(t => t.category === state.categoryFilter);
  }

  // Search
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    tasks = tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q)
    );
  }

  // Sort: overdue first, then by due date asc, then by priority weight
  const pw = { High: 0, Medium: 1, Low: 2 };
  tasks.sort((a, b) => {
    const aOver = isOverdue(a.dueDate) ? -1 : 0;
    const bOver = isOverdue(b.dueDate) ? -1 : 0;
    if (aOver !== bOver) return aOver - bOver;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return (pw[a.priority] || 1) - (pw[b.priority] || 1);
  });

  return tasks;
}

function getStats() {
  const all = state.tasks;
  const total   = all.length;
  const done    = all.filter(t => t.done).length;
  const pending = total - done;
  const overdue = all.filter(t => !t.done && isOverdue(t.dueDate)).length;
  return { total, done, pending, overdue };
}

function getCategories() {
  const cats = [...new Set(state.tasks.map(t => t.category).filter(Boolean))];
  return cats.sort();
}

/* ── RENDER ──────────────────────────────────────────────────── */
function renderAll() {
  renderStats();
  renderCategoryChips();
  renderTasks();
  renderViewTitle();
  updateCategorySuggestions();
}

function renderStats() {
  const s = getStats();
  document.getElementById('statTotal').textContent   = s.total;
  document.getElementById('statPending').textContent = s.pending;
  document.getElementById('statDone').textContent    = s.done;
  document.getElementById('statOverdue').textContent = s.overdue;
}

function renderViewTitle() {
  const titleEl = document.getElementById('viewTitle');
  const dateEl  = document.getElementById('viewDate');
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 12 ? 'Good morning 🌸' : hour < 17 ? 'Good afternoon 🌺' : 'Good evening 🌙';
  const dateStr = now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });

  const titles = {
    today:     greet,
    weekly:    'This Week 📅',
    all:       'All Tasks 🌿',
    completed: 'Completed ✨',
  };
  titleEl.textContent = titles[state.view] || greet;
  dateEl.textContent  = dateStr;
}

function renderCategoryChips() {
  const container = document.getElementById('categoryChips');
  const cats = getCategories();
  container.innerHTML = '';

  if (cats.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text-light);padding:4px 8px;">No categories yet</p>';
    return;
  }

  // "All" chip
  const allBtn = document.createElement('button');
  allBtn.className = 'cat-chip' + (state.categoryFilter === null ? ' active' : '');
  allBtn.innerHTML = `<span class="cat-dot" style="background:#c8b4e0"></span> All`;
  allBtn.addEventListener('click', () => {
    state.categoryFilter = null;
    renderAll();
  });
  container.appendChild(allBtn);

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-chip' + (state.categoryFilter === cat ? ' active' : '');
    const color = categoryColor(cat);
    btn.innerHTML = `<span class="cat-dot" style="background:${color}"></span> ${escHtml(cat)}`;
    btn.addEventListener('click', () => {
      state.categoryFilter = state.categoryFilter === cat ? null : cat;
      renderAll();
    });
    container.appendChild(btn);
  });
}

function renderTasks() {
  const list    = document.getElementById('taskList');
  const empty   = document.getElementById('emptyState');
  const visible = getVisibleTasks();

  // Clear old cards (keep empty state element)
  [...list.querySelectorAll('.task-card')].forEach(el => el.remove());

  if (visible.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  visible.forEach((task, idx) => {
    const card = buildTaskCard(task, idx);
    list.appendChild(card);
  });
}

function buildTaskCard(task, idx) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.done ? ' done' : '');
  card.dataset.priority = task.priority;
  card.style.animationDelay = `${idx * 40}ms`;

  const overdue = !task.done && isOverdue(task.dueDate);
  const todayDue = !task.done && isToday(task.dueDate);

  // Priority emoji
  const priEmoji = { High: '🔴', Medium: '🟡', Low: '🟢' }[task.priority] || '🟡';

  // Due badge
  let dueBadge = '';
  if (task.dueDate) {
    const cls = overdue ? 'badge--due overdue' : todayDue ? 'badge--today' : 'badge--due';
    const label = overdue ? `⚠️ ${formatDate(task.dueDate)}` : todayDue ? '📅 Today' : `📅 ${formatDate(task.dueDate)}`;
    dueBadge = `<span class="task-badge ${cls}">${label}</span>`;
  }

  // Category badge
  const catBadge = task.category
    ? `<span class="task-badge badge--cat" style="border-color:${categoryColor(task.category)}20;color:${categoryColor(task.category)};">🏷 ${escHtml(task.category)}</span>`
    : '';

  card.innerHTML = `
    <div class="task-check ${task.done ? 'checked' : ''}" role="checkbox" aria-checked="${task.done}" tabindex="0" data-id="${task.id}" title="${task.done ? 'Mark incomplete' : 'Mark complete'}"></div>
    <div class="task-body">
      <div class="task-title">${escHtml(task.title)}</div>
      ${task.description ? `<div class="task-desc">${escHtml(task.description)}</div>` : ''}
      <div class="task-meta">
        <span class="task-badge badge--priority-${task.priority}">${priEmoji} ${task.priority}</span>
        ${dueBadge}
        ${catBadge}
      </div>
    </div>
    <div class="task-actions">
      <button class="icon-btn edit-btn" data-id="${task.id}" title="Edit task" aria-label="Edit">✏️</button>
      <button class="icon-btn del" data-id="${task.id}" title="Delete task" aria-label="Delete">🗑</button>
    </div>
  `;

  // Checkbox toggle
  const chk = card.querySelector('.task-check');
  chk.addEventListener('click', () => toggleDone(task.id));
  chk.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') toggleDone(task.id); });

  // Edit
  card.querySelector('.edit-btn').addEventListener('click', () => openEditModal(task.id));

  // Delete
  card.querySelector('.del').addEventListener('click', () => openDeleteConfirm(task.id));

  return card;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── TASK CRUD ───────────────────────────────────────────────── */
function addTask(data) {
  const task = {
    id:          genId(),
    title:       data.title.trim(),
    description: data.description.trim(),
    priority:    data.priority,
    status:      'Pending',
    done:        false,
    category:    data.category.trim(),
    dueDate:     data.dueDate || null,
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  };
  state.tasks.unshift(task);
  Storage.save(state.tasks);
  renderAll();
  showToast('🌸 Task added!');
}

function updateTask(id, data) {
  const idx = state.tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  state.tasks[idx] = {
    ...state.tasks[idx],
    title:       data.title.trim(),
    description: data.description.trim(),
    priority:    data.priority,
    category:    data.category.trim(),
    dueDate:     data.dueDate || null,
    updatedAt:   new Date().toISOString(),
  };
  Storage.save(state.tasks);
  renderAll();
  showToast('✏️ Task updated!');
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  Storage.save(state.tasks);
  renderAll();
  showToast('🗑 Task removed.');
}

function toggleDone(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.done      = !task.done;
  task.status    = task.done ? 'Completed' : 'Pending';
  task.updatedAt = new Date().toISOString();
  Storage.save(state.tasks);
  renderAll();
  showToast(task.done ? '✨ Well done!' : '🌱 Back to pending!');
}

/* ── MODAL ───────────────────────────────────────────────────── */
function openAddModal() {
  clearForm();
  document.getElementById('modalTitle').textContent = 'New Task 🌸';
  document.getElementById('editId').value = '';
  document.getElementById('saveBtn').textContent = 'Save Task 🌸';
  document.getElementById('taskDue').value = today(); // default to today
  openModal('modalOverlay');
}

function openEditModal(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  clearForm();
  document.getElementById('modalTitle').textContent = 'Edit Task ✏️';
  document.getElementById('editId').value       = task.id;
  document.getElementById('taskTitle').value    = task.title;
  document.getElementById('taskDesc').value     = task.description || '';
  document.getElementById('taskPriority').value = task.priority;
  document.getElementById('taskDue').value      = task.dueDate || '';
  document.getElementById('taskCategory').value = task.category || '';
  document.getElementById('saveBtn').textContent = 'Update Task 🌸';
  openModal('modalOverlay');
}

function openDeleteConfirm(id) {
  state.deleteTargetId = id;
  openModal('deleteOverlay');
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

function clearForm() {
  document.getElementById('taskForm').reset();
  document.querySelectorAll('.form-error').forEach(el => el.remove());
}

function updateCategorySuggestions() {
  const dl = document.getElementById('categorySuggestions');
  dl.innerHTML = getCategories().map(c => `<option value="${escHtml(c)}"></option>`).join('');
}

/* ── FORM SUBMIT ─────────────────────────────────────────────── */
function handleFormSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) {
    showFieldError('taskTitle', 'Please enter a task title.');
    return;
  }
  const data = {
    title,
    description: document.getElementById('taskDesc').value,
    priority:    document.getElementById('taskPriority').value,
    dueDate:     document.getElementById('taskDue').value,
    category:    document.getElementById('taskCategory').value,
  };
  const editId = document.getElementById('editId').value;
  if (editId) {
    updateTask(editId, data);
  } else {
    addTask(data);
  }
  closeModal('modalOverlay');
}

function showFieldError(fieldId, msg) {
  const field = document.getElementById(fieldId);
  field.focus();
  // Remove existing
  const old = field.parentElement.querySelector('.form-error');
  if (old) old.remove();
  const err = document.createElement('p');
  err.className = 'form-error';
  err.textContent = msg;
  field.parentElement.appendChild(err);
  field.addEventListener('input', () => err.remove(), { once: true });
}

/* ── EVENT WIRING ────────────────────────────────────────────── */
function initEvents() {
  // Add task button
  document.getElementById('addBtn').addEventListener('click', openAddModal);

  // Form submit
  document.getElementById('taskForm').addEventListener('submit', handleFormSubmit);

  // Modal close
  document.getElementById('modalClose').addEventListener('click', () => closeModal('modalOverlay'));
  document.getElementById('cancelBtn').addEventListener('click', () => closeModal('modalOverlay'));

  // Overlay click to close
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('modalOverlay');
  });

  // Delete modal
  document.getElementById('deleteCancelBtn').addEventListener('click', () => closeModal('deleteOverlay'));
  document.getElementById('deleteConfirmBtn').addEventListener('click', () => {
    if (state.deleteTargetId) {
      deleteTask(state.deleteTargetId);
      state.deleteTargetId = null;
    }
    closeModal('deleteOverlay');
  });
  document.getElementById('deleteOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('deleteOverlay');
  });

  // Keyboard ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('modalOverlay');
      closeModal('deleteOverlay');
    }
  });

  // Nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      state.view = item.dataset.view;
      state.categoryFilter = null;
      renderAll();
      // Close sidebar on mobile
      if (window.innerWidth <= 680) {
        document.getElementById('sidebar').classList.remove('open');
      }
    });
  });

  // Filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.filter = chip.dataset.filter;
      renderAll();
    });
  });

  // Search button
  const searchBtn  = document.getElementById('searchBtn');
  const searchWrap = document.getElementById('searchBarWrap');
  const searchInput= document.getElementById('searchInput');

  searchBtn.addEventListener('click', () => {
    searchWrap.classList.toggle('open');
    if (searchWrap.classList.contains('open')) {
      searchInput.focus();
    } else {
      state.searchQuery = '';
      searchInput.value = '';
      renderAll();
    }
  });

  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value;
    renderAll();
  });

  // Mobile menu toggle
  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Close sidebar when clicking main content on mobile
  document.getElementById('mainContent').addEventListener('click', () => {
    if (window.innerWidth <= 680) {
      document.getElementById('sidebar').classList.remove('open');
    }
  });
}

/* ── SEED DATA (first-time users) ────────────────────────────── */
function seedIfEmpty() {
  if (state.tasks.length > 0) return;
  const seeds = [
    {
      id: genId(), title: 'Design weekly mood board', description: 'Gather inspiration for the new colour palette.',
      priority: 'High', status: 'Pending', done: false, category: 'Creative',
      dueDate: today(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    },
    {
      id: genId(), title: 'Morning journaling session', description: '10 minutes of free writing before breakfast.',
      priority: 'Medium', status: 'Pending', done: false, category: 'Wellness',
      dueDate: today(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    },
    {
      id: genId(), title: 'Review project requirements', description: 'Go through the PRD and highlight open questions.',
      priority: 'High', status: 'Pending', done: false, category: 'Work',
      dueDate: today(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    },
    {
      id: genId(), title: 'Read 20 pages of current book', description: '',
      priority: 'Low', status: 'Pending', done: false, category: 'Personal',
      dueDate: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    },
    {
      id: genId(), title: 'Water all the plants 🪴', description: 'Don\'t forget the balcony succulents.',
      priority: 'Low', status: 'Completed', done: true, category: 'Home',
      dueDate: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    },
  ];
  state.tasks = seeds;
  Storage.save(state.tasks);
}

/* ── INIT ────────────────────────────────────────────────────── */
function init() {
  state.tasks = Storage.load();
  seedIfEmpty();
  initEvents();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
