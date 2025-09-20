// main.js — полная версия с исправлением кнопки Отмена (делегирование события)

// Глобальные зависимости (инициализируются в window.bukolpak)
const data = window.bukolpak?.data || null;
const ui = window.bukolpak?.ui || null;

const state = {
    tasks: [],
    users: {},
    currentUser: null,
    showAllTasks: false
};

const selectors = {
    newTaskButton: null,
    saveButton: null,
    cancelButton: null,
    modal: null,
    formErrors: null,
    form: null,
    formElement: null, // Добавлено для формы
    projectField: null,
    responsibleField: null,
    hoursField: null,
    subjectField: null,
    descField: null,
    directionField: null,
    assigneeDirectory: null,
    groupField: null,
    dueDateField: null,
    dueTimeField: null,
    showAllTasksButton: null
};

const formErrors = {
    project: 'm-project-error',
    responsible: 'm-responsible-error',
    hours: 'm-hours-error',
    subject: 'm-subject-error',
    desc: 'm-desc-error'
};

let fileData = null;
let fileName = null;

if (!data || !ui) {
    console.error('Модуль данных недоступен, интерфейс не сможет работать корректно.');
}

document.addEventListener('DOMContentLoaded', () => {
    cacheSelectors();
    if (!selectors.form || !data || !ui) {
        renderFatalError();
        return;
    }

    initShell();
    bindModalEvents();
    bindViewControls();
    populateUserDirectory();
    attachFormListeners();
    restoreState();
    renderAll();
    watchStorageChanges();
});

function cacheSelectors() {
    selectors.newTaskButton = document.getElementById('new-task-btn');
    selectors.saveButton = document.getElementById('m-save');
    selectors.cancelButton = document.getElementById('m-cancel');
    selectors.modal = document.getElementById('modal');
    selectors.formErrors = document.getElementById('form-errors');
    selectors.form = document.querySelector('#modal .form');
    selectors.formElement = document.querySelector('#modal form') || selectors.form; // Исправлено
    selectors.projectField = document.getElementById('m-project');
    selectors.responsibleField = document.getElementById('m-responsible');
    selectors.hoursField = document.getElementById('m-hours');
    selectors.subjectField = document.getElementById('m-subject');
    selectors.descField = document.getElementById('m-desc');
    selectors.directionField = document.getElementById('m-direction');
    selectors.assigneeDirectory = document.getElementById('m-assignee-dir');
    selectors.groupField = document.getElementById('m-group');
    selectors.dueDateField = document.getElementById('m-due-date');
    selectors.dueTimeField = document.getElementById('m-due-time');
    selectors.showAllTasksButton = document.getElementById('toggle-all-tasks');
}

function initShell() {
    ui.initThemeToggle?.(document.getElementById('theme-toggle'));
    ui.initNotificationBell?.(
        document.getElementById('notifications-btn'),
        document.getElementById('notifications-dropdown')
    );
    ui.initUserMenu?.(
        document.getElementById('user-menu-button'),
        document.getElementById('user-menu-panel')
    );
    ui.initLogoutButton?.(document.getElementById('logout-btn'));
    ui.syncLogos?.();
    document.documentElement.addEventListener('bukolpak:theme-change', (event) => {
        ui.syncLogos?.(event.detail?.theme);
    });
}

function bindModalEvents() {
    // Открытие модалки
    selectors.newTaskButton?.addEventListener('click', () => openModal('Новая задача'));

    // Делегирование на документ — работает даже если #m-cancel появляется динамически
    document.addEventListener('click', (e) => {
        const cancelBtn = e.target.closest('#m-cancel');
        if (cancelBtn) {
            e.preventDefault();
            e.stopPropagation();
            onCancelClick();
        }
    });

    // Закрытие по клику на подложку
    selectors.modal?.addEventListener('click', (event) => {
        if (event.target === selectors.modal) {
            onCancelClick();
        }
    });

    // Сохранение
    selectors.saveButton?.addEventListener('click', handleTaskSave);

    // Приоритеты
    const priorityButtons = document.querySelectorAll('#pri-seg .opt');
    priorityButtons.forEach((button) => {
        button.addEventListener('click', () => {
            priorityButtons.forEach((candidate) => candidate.classList.remove('sel'));
            button.classList.add('sel');
            syncDueWithPriority(true);
        });
    });

    // Файл
    document.getElementById('m-file')?.addEventListener('change', handleFileChange);

    // На случай замены узлов модалки — MutationObserver обновит ссылки
    const observer = new MutationObserver(() => {
        cacheSelectors();
    });
    if (selectors.modal?.parentElement) {
        observer.observe(selectors.modal.parentElement, { childList: true, subtree: true });
    }

}

function bindViewControls() {
    if (!selectors.showAllTasksButton) {
        return;
    }
    selectors.showAllTasksButton.addEventListener('click', () => {
        state.showAllTasks = !state.showAllTasks;
        renderAll();
    });
    updateTaskScopeToggle();
}

function onCancelClick() {
    clearModal();
    closeModal();
}

function handleFileChange(event) {
    const [file] = event.target.files || [];
    if (!file) {
        fileData = null;
        fileName = null;
        return;
    }
    fileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
        fileData = reader.result;
    };
    reader.readAsDataURL(file);
}

function populateUserDirectory() {
    if (!data?.getUsers || !selectors.assigneeDirectory) {
        return;
    }
    const placeholder = selectors.assigneeDirectory.querySelector('option[value=""]');
    selectors.assigneeDirectory.innerHTML = '';
    if (placeholder) {
        selectors.assigneeDirectory.appendChild(placeholder);
    } else {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '— Выберем позже —';
        selectors.assigneeDirectory.appendChild(option);
    }

    state.users = data.getUsers();
    Object.values(state.users)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru'))
        .forEach((user) => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.fullName;
            selectors.assigneeDirectory.appendChild(option);
        });
}

function attachFormListeners() {
    selectors.formElement?.addEventListener('input', (event) => {
        const fieldId = event.target.id;
        const errorId = formErrorsMap()[fieldId];
        if (errorId) {
            document.getElementById(errorId)?.classList.remove('visible');
            event.target.classList.remove('error');
        }
    });
}

function restoreState() {
    state.currentUser = data.getCurrentUser();
    state.users = data.getUsers();
    state.tasks = data.getTasks();
    state.showAllTasks = false;
    syncWelcomeBlock();
    syncDueWithPriority();
}

function renderAll() {
    renderBoard();
    renderUrgentTasks();
    renderOverdueTasks();
    renderRecentActivity();
    updateDashboardStats();
    updateNavbarOverdue();
    updateTaskScopeToggle();
}

function watchStorageChanges() {
    window.addEventListener('storage', (event) => {
        if (event.key === data.BOARD_STORAGE_KEY) {
            state.tasks = data.getTasks();
            renderAll();
        }
        if (event.key === data.CURRENT_USER_KEY) {
            state.currentUser = data.getCurrentUser();
            state.showAllTasks = false;
            syncWelcomeBlock();
            renderAll();
        }
        if (event.key === data.NOTIFICATION_STORAGE_KEY) {
            ui.refreshNotificationBell?.();
        }
    });
}

function renderBoard() {
    const columns = [
        { id: 'new', element: document.getElementById('col-new') },
        { id: 'progress', element: document.getElementById('col-progress') },
        { id: 'done', element: document.getElementById('col-done') }
    ];

    const visibleTasks = getVisibleTasks();

    columns.forEach((column) => {
        if (!column.element) {
            return;
        }
        column.element.innerHTML = '';
        const tasks = sortByDueDate(
            visibleTasks.filter((task) => {
                if (column.id === 'progress') {
                    return task.status === 'progress' || task.status === 'review';
                }
                return task.status === column.id;
            })
        );
        if (tasks.length === 0) {
            column.element.appendChild(createEmptyState('Задач пока нет', 'small'));
        } else {
            tasks.forEach((task) => {
                column.element.appendChild(createTaskCard(task));
            });
        }
        const counter = column.element.parentElement?.querySelector('.column-count');
        if (counter) {
            counter.textContent = String(tasks.length);
        }
    });
}

function renderUrgentTasks() {
    const container = document.getElementById('urgent-tasks');
    if (!container) {
        return;
    }
    container.innerHTML = '';
    const urgent = sortByDueDate(
        getVisibleTasks().filter((task) => task.pri === 'high' && task.status !== 'done')
    );
    if (urgent.length === 0) {
        container.appendChild(createEmptyState('Нет срочных задач — отличная работа!'));
        return;
    }
    urgent.forEach((task) => container.appendChild(createTaskCard(task)));
}

function renderOverdueTasks() {
    const container = document.getElementById('overdue-tasks');
    if (!container) {
        return;
    }
    container.innerHTML = '';
    const overdue = sortByDueDate(getVisibleTasks().filter(isTaskOverdue));
    if (overdue.length === 0) {
        container.appendChild(createEmptyState('Просроченных задач нет — вы молодец!'));
        return;
    }
    overdue.forEach((task) => {
        const card = createTaskCard(task);
        card.classList.add('task-item--overdue');
        card.querySelector('.task-checkbox')?.remove();
        container.appendChild(card);
    });
}

function renderRecentActivity() {
    const container = document.getElementById('recent-activity');
    if (!container) {
        return;
    }
    container.innerHTML = '';
    const recent = [...getVisibleTasks()]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .slice(0, 3);

    if (recent.length === 0) {
        container.appendChild(createEmptyState('Пока нет активности', 'small'));
        return;
    }

    recent.forEach((task) => {
        const entry = document.createElement('div');
        entry.className = 'task-item';
        entry.innerHTML = `
            <div class="task-content">
                <div class="task-title">${escapeHtml(task.subject || 'Задача')}</div>
                <span class="text-muted">Изменено ${formatRelative(task.updatedAt || task.createdAt)}</span>
            </div>
        `;
        entry.addEventListener('click', () => {
            window.location.href = `task.html?id=${task.id}`;
        });
        container.appendChild(entry);
    });
}

function updateDashboardStats() {
    const tasks = getVisibleTasks();
    setText('stat-total', tasks.length);
    setText(
        'stat-progress',
        tasks.filter((task) => task.status === 'progress' || task.status === 'review').length
    );
    setText('stat-done', tasks.filter((task) => task.status === 'done').length);
    setText('stat-overdue', tasks.filter(isTaskOverdue).length);

    const active = tasks.filter((task) => task.status !== 'done').length;
    const message = document.getElementById('active-task-message');
    if (message) {
        const noun = pluralize(active, 'активная задача', 'активные задачи', 'активных задач');
        message.textContent = `У вас ${active} ${noun} на сегодня`;
    }
}

function updateNavbarOverdue() {
    const container = document.getElementById('navbar-overdue');
    if (!container || !state.currentUser) {
        return;
    }
    const overdue = data.getOverdueTasks(state.currentUser.id);
    if (!overdue.length) {
        container.hidden = true;
        return;
    }
    const text = container.querySelector('.navbar-overdue__text');
    if (text) {
        const noun = pluralize(overdue.length, 'просроченная задача', 'просроченные задачи', 'просроченных задач');
        text.textContent = `У вас ${overdue.length} ${noun}`;
    }
    const link = container.querySelector('.navbar-overdue__link');
    if (link) {
        link.href = `task.html?id=${overdue[0].id}`;
    }
    container.hidden = false;
}

function createTaskCard(task) {
    const element = document.createElement('div');
    element.className = 'task-item';
    element.dataset.id = task.id;

    const description = task.desc ? `<div class="task-desc">${escapeHtml(task.desc)}</div>` : '';
    const dueClass = getDueClass(task.due, task.dueTime);
    const dueLabel = task.due ? `до ${formatDate(task.due)}${task.dueTime ? ` ${task.dueTime}` : ''}` : 'Срок не указан';
    const statusBadge =
        task.status === 'review'
            ? '<span class="task-status task-status--review">На проверке</span>'
            : '';

    element.innerHTML = `
        <input type="checkbox" class="task-checkbox" aria-label="Отметить задачу ${escapeHtml(task.subject || '')}">
        <div class="task-content">
            <div class="task-title">${escapeHtml(task.subject || 'Без названия')}</div>
            ${description}
            <div class="task-meta">
                ${statusBadge}
                <span class="task-priority ${getPriorityClass(task.pri)}">${getPriorityLabel(task.pri)}</span>
                <span class="text-muted${dueClass ? ` ${dueClass}` : ''}">${dueLabel}</span>
            </div>
        </div>
    `;

    element.addEventListener('click', (event) => {
        if (event.target.matches('.task-checkbox')) {
            return;
        }
        window.location.href = `task.html?id=${task.id}`;
    });

    element.querySelector('.task-checkbox')?.addEventListener('change', (event) => {
        element.style.opacity = event.target.checked ? '0.6' : '1';
    });

    return element;
}

function handleTaskSave() {
    if (!selectors.form) {
        return;
    }
    const payload = collectFormData();
    const errors = validateForm(payload);
    if (errors.length > 0) {
        showFormErrors(errors);
        return;
    }

    const task = buildTaskPayload(payload);
    const tasks = data.getTasks();
    tasks.unshift(task);
    data.setTasks(tasks);
    state.tasks = data.getTasks();
    renderAll();
    closeModal();
    clearModal();
    ui.showToast?.({
        title: 'Задача создана',
        message: 'Новая задача добавлена в список «К выполнению».',
        type: 'success'
    });
    notifyTaskParticipants(task, {
        title: 'Новая задача',
        message: `${state.currentUser.fullName} создал(а) задачу «${task.subject}»`,
        link: `task.html?id=${task.id}`,
        type: 'task'
    });
    ui.refreshNotificationBell?.();
}

function collectFormData() {
    const groupInput = selectors.groupField?.value || '';
    const groupMembers = Array.from(new Set(parseGroupInput(groupInput)));
    const hoursRaw = selectors.hoursField?.value;
    return {
        type: document.getElementById('m-type')?.value || 'work',
        project: selectors.projectField?.value || '',
        privacy: document.getElementById('m-privacy')?.value || 'public',
        direction: selectors.directionField?.value || '',
        responsibleInput: selectors.responsibleField?.value.trim() || '',
        selectedAssignee: selectors.assigneeDirectory?.value || '',
        groupInput,
        groupMembers,
        priority: getSelectedPriority(),
        hours: typeof hoursRaw === 'string' ? hoursRaw.trim() : '',
        subject: selectors.subjectField?.value.trim() || '',
        desc: selectors.descField?.value.trim() || '',
        dueDate: selectors.dueDateField?.value || '',
        dueTime: selectors.dueTimeField?.value || '',
        file: fileData ? { name: fileName, dataUrl: fileData } : null
    };
}

function validateForm(dataPayload) {
    clearErrors();
    const errors = [];
    if (!dataPayload.project) {
        errors.push({ field: selectors.projectField, messageId: formErrors.project });
    }
    if (!dataPayload.responsibleInput && !dataPayload.selectedAssignee) {
        errors.push({ field: selectors.responsibleField, messageId: formErrors.responsible });
    }
    const hoursValue = Number.parseFloat(dataPayload.hours);
    if (dataPayload.hours === '' || Number.isNaN(hoursValue) || hoursValue < 0) {
        errors.push({ field: selectors.hoursField, messageId: formErrors.hours });
    }
    if (!dataPayload.subject) {
        errors.push({ field: selectors.subjectField, messageId: formErrors.subject });
    }
    if (!dataPayload.desc) {
        errors.push({ field: selectors.descField, messageId: formErrors.desc });
    }
    if (!dataPayload.dueDate) {
        selectors.dueDateField?.classList.add('error');
    }
    return errors;
}

function showFormErrors(errors) {
    if (!selectors.formErrors) {
        return;
    }
    selectors.formErrors.innerHTML = '';
    let firstInvalidField = null;
    errors.forEach(({ field, messageId }) => {
        field?.classList.add('error');
        const message = document.getElementById(messageId);
        if (message) {
            message.style.display = 'block';
        }
        if (!firstInvalidField && field && typeof field.focus === 'function') {
            firstInvalidField = field;
        }
    });
    const alert = document.createElement('div');
    alert.className = 'alert err';
    alert.innerHTML = `
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <span>Заполните обязательные поля, отмеченные красным</span>
        <button class="alert-close" type="button" aria-label="Закрыть" data-dismiss-alert>
            <i class="fas fa-times" aria-hidden="true"></i>
        </button>
    `;
    alert.querySelector('[data-dismiss-alert]')?.addEventListener('click', () => alert.remove());
    selectors.formErrors.appendChild(alert);
    // Для удобства пользователя сразу переводим фокус на первое проблемное поле
    if (firstInvalidField) {
        window.requestAnimationFrame(() => firstInvalidField.focus());
    }
}

function buildTaskPayload(formData) {
    const id = data.nextTaskId();
    const createdAt = data.nowIso();
    const responsibleUser = resolveUser(formData.selectedAssignee || formData.responsibleInput);
    const workGroupMembers = Array.from(
        new Set([...(formData.groupMembers || []), responsibleUser?.id].filter(Boolean))
    );
    const participants = buildParticipants(responsibleUser, workGroupMembers);
    const dueDate = formData.dueDate || addDaysFromPriority(formData.priority);
    const dueTime = formData.dueTime || '18:00';
    const reviewState = {
        status: 'idle',
        requestedBy: null,
        requestedAt: null,
        reviewerId: responsibleUser?.id || state.currentUser?.id || null,
        approvedBy: null,
        approvedAt: null
    };

    return {
        id,
        authorId: state.currentUser?.id,
        author: state.currentUser?.fullName,
        type: formData.type,
        project: formData.project,
        subject: formData.subject,
        desc: formData.desc,
        status: 'new',
        pri: formData.priority,
        due: dueDate,
        dueTime,
        hours: Number.parseFloat(formData.hours) || 0,
        assigneeId: responsibleUser?.id || state.currentUser?.id,
        assignee: responsibleUser?.fullName || state.currentUser?.fullName,
        responsibleId: responsibleUser?.id || state.currentUser?.id,
        responsible: responsibleUser?.fullName || state.currentUser?.fullName,
        group: workGroupMembers,
        participants,
        workGroup: workGroupMembers,
        workGroupAcceptance: {},
        review: reviewState,
        privacy: formData.privacy,
        direction: formData.direction,
        createdAt,
        updatedAt: createdAt,
        comments: [],
        timeline: [
            {
                id: data.uid(),
                type: 'creation',
                text: 'Задача создана',
                actorId: state.currentUser?.id,
                createdAt
            }
        ],
        file: formData.file
    };
}

function resolveUser(input) {
    if (!input) {
        return null;
    }
    const normalized = normalizeToken(input);
    return (
        state.users[input] ||
        Object.values(state.users).find((user) => normalizeToken(user.fullName) === normalized) ||
        Object.values(state.users).find((user) => normalizeToken(user.email?.split('@')[0]) === normalized) ||
        Object.values(state.users).find((user) => normalizeToken(user.id) === normalized)
    ) || null;
}

function buildParticipants(responsibleUser, groupMembers) {
    const participants = new Set();
    if (responsibleUser) {
        participants.add(responsibleUser.id);
    }
    if (state.currentUser?.id) {
        participants.add(state.currentUser.id);
    }
    (groupMembers || []).forEach((id) => participants.add(id));
    return Array.from(participants);
}

function parseGroupInput(input) {
    if (!input) {
        return [];
    }
    return input
        .split(',')
        .map((value) => value.trim())
        .map((value) => value.replace(/^@/, ''))
        .map((value) => resolveUser(value)?.id)
        .filter(Boolean);
}

function openModal(title) {
    const header = document.getElementById('m-title-h');
    if (header) header.textContent = title;
    if (!selectors.modal) return;
    selectors.modal.style.display = 'flex';
    selectors.modal.setAttribute('aria-hidden', 'false');
    selectors.modal.scrollTop = 0;
    syncDueWithPriority();
    selectors.subjectField?.focus();
}

function closeModal() {
    if (!selectors.modal) return;
    selectors.modal.style.display = 'none';
    selectors.modal.setAttribute('aria-hidden', 'true');
    clearErrors();
}

function clearModal() {
    // Исправлено: безопасный сброс формы
    if (selectors.formElement && typeof selectors.formElement.reset === 'function') {
        selectors.formElement.reset();
    } else if (selectors.form) {
        // Альтернативный сброс для элементов с классом .form
        const inputs = selectors.form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.type !== 'button' && input.type !== 'submit') {
                input.value = '';
            }
            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = false;
            }
        });
    }
    
    document.querySelectorAll('#pri-seg .opt').forEach((button) => button.classList.remove('sel'));
    document.querySelector('#pri-seg [data-pri="medium"]')?.classList.add('sel');
    syncDueWithPriority();
    fileData = null;
    fileName = null;
    const fileInput = document.getElementById('m-file');
    if (fileInput) {
        fileInput.value = '';
    }
}

function clearErrors() {
    Object.values(formErrors).forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'none';
        }
    });
    if (selectors.formErrors) {
        selectors.formErrors.innerHTML = '';
    }
    const formContainer = selectors.formElement || selectors.form;
    formContainer?.querySelectorAll('.error').forEach((field) => field.classList.remove('error'));
}

function formErrorsMap() {
    return {
        'm-project': formErrors.project,
        'm-responsible': formErrors.responsible,
        'm-hours': formErrors.hours,
        'm-subject': formErrors.subject,
        'm-desc': formErrors.desc
    };
}

function syncDueWithPriority(force = false) {
    const dueField = selectors.dueDateField;
    if (dueField && (force || !dueField.value)) {
        dueField.value = addDaysFromPriority(getSelectedPriority());
    }
    if (selectors.dueTimeField && (force || !selectors.dueTimeField.value)) {
        selectors.dueTimeField.value = '18:00';
    }
}

function getSelectedPriority() {
    const selected = document.querySelector('#pri-seg .opt.sel');
    return selected?.dataset.pri || 'medium';
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function createEmptyState(text, size = 'default') {
    const element = document.createElement('div');
    element.className = size === 'small' ? 'empty-state small' : 'empty-state';
    element.textContent = text;
    return element;
}

function sortByDueDate(tasks) {
    return [...tasks].sort((a, b) => {
        const dateA = toDate(a.due, a.dueTime);
        const dateB = toDate(b.due, b.dueTime);
        if (!dateA && !dateB) {
            return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
        }
        if (!dateA) {
            return 1;
        }
        if (!dateB) {
            return -1;
        }
        const diff = dateA - dateB;
        if (diff !== 0) {
            return diff;
        }
        return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    });
}

function toDate(dateStr, timeStr = '00:00') {
    if (!dateStr) {
        return null;
    }
    const [year, month, day] = dateStr.split('-').map(Number);
    if ([year, month, day].some(Number.isNaN)) {
        return null;
    }
    let hours = 0;
    let minutes = 0;
    if (timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        if (![h, m].some(Number.isNaN)) {
            hours = h;
            minutes = m;
        }
    }
    return new Date(year, month - 1, day, hours, minutes);
}

function isTaskOverdue(task) {
    if (!task.due || task.status === 'done') {
        return false;
    }
    const due = toDate(task.due, task.dueTime || '23:59');
    if (!due) return false;
    return due.getTime() < Date.now();
}

function getPriorityClass(priority) {
    if (priority === 'high') {
        return 'priority-high';
    }
    if (priority === 'medium') {
        return 'priority-medium';
    }
    return 'priority-low';
}

function getPriorityLabel(priority) {
    if (priority === 'high') {
        return 'Высокий';
    }
    if (priority === 'medium') {
        return 'Средний';
    }
    return 'Низкий';
}

function getDueClass(dateStr, timeStr) {
    if (!dateStr) return '';
    const now = new Date();
    const todayYMD = ymdLocal(now);
    const taskDate = dateStr;

    if (taskDate < todayYMD) {
        return 'due-overdue';
    }
    if (taskDate === todayYMD) {
        const dt = toDate(dateStr, timeStr || '23:59');
        if (dt && dt.getTime() < now.getTime()) {
            return 'due-overdue';
        }
        return 'due-today';
    }
    return '';
}

function formatDate(dateStr) {
    if (!dateStr) {
        return '—';
    }
    const date = toDate(dateStr, '12:00');
    if (!date || Number.isNaN(date.getTime())) {
        return '—';
    }
    return date.toLocaleDateString('ru-RU');
}

function formatRelative(value) {
    if (!value) {
        return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 0) {
        return formatDateTime(value);
    }
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) {
        return 'только что';
    }
    if (minutes < 60) {
        return `${minutes} ${pluralize(minutes, 'минуту', 'минуты', 'минут')} назад`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours} ${pluralize(hours, 'час', 'часа', 'часов')} назад`;
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
        return `${days} ${pluralize(days, 'день', 'дня', 'дней')} назад`;
    }
    return formatDateTime(value);
}

function formatDateTime(value) {
    if (!value) {
        return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }
    return date.toLocaleString('ru-RU');
}

function getVisibleTasks() {
    const accessible = getAccessibleTasks();
    if (state.showAllTasks) {
        return accessible;
    }
    const userId = state.currentUser?.id;
    if (!userId) {
        return [];
    }
    return accessible.filter((task) => isUserParticipant(task, userId));
}

function getAccessibleTasks() {
    const userId = state.currentUser?.id;
    if (!userId) {
        return [];
    }
    return state.tasks.filter((task) => canUserAccessTask(task, userId));
}

function canUserAccessTask(task, userId) {
    if (!task) {
        return false;
    }
    const privacy = task.privacy || 'public';
    if (privacy !== 'private') {
        return true;
    }
    return isUserParticipant(task, userId);
}

function isUserParticipant(task, userId) {
    if (!task || !userId) {
        return false;
    }
    if (task.authorId === userId || task.responsibleId === userId) {
        return true;
    }
    const participants = new Set([
        ...ensureArrayValue(task.participants),
        ...ensureArrayValue(task.workGroup)
    ]);
    return participants.has(userId);
}

function ensureArrayValue(value) {
    return Array.isArray(value) ? value : [];
}

function getTaskNotificationRecipients(task) {
    if (!task) {
        return [];
    }
    const recipients = new Set([
        task.authorId,
        task.responsibleId,
        ...ensureArrayValue(task.participants),
        ...ensureArrayValue(task.workGroup)
    ].filter(Boolean));
    return Array.from(recipients);
}

function notifyTaskParticipants(task, payload) {
    if (!data?.upsertNotification) {
        return;
    }
    const recipients = getTaskNotificationRecipients(task);
    if (recipients.length === 0) {
        return;
    }
    data.upsertNotification({
        ...payload,
        recipients
    });
}

function updateTaskScopeToggle() {
    if (!selectors.showAllTasksButton) {
        return;
    }
    const icon = state.showAllTasks ? 'fa-user-check' : 'fa-layer-group';
    const label = state.showAllTasks ? 'Показать мои задачи' : 'Показать все задачи';
    selectors.showAllTasksButton.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
    selectors.showAllTasksButton.setAttribute('aria-pressed', state.showAllTasks ? 'true' : 'false');
}

function escapeHtml(value) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return (value || '').replace(/[&<>"']/g, (char) => map[char] || char);
}

function pluralize(number, one, few, many) {
    const mod10 = number % 10;
    const mod100 = number % 100;
    if (mod10 === 1 && mod100 !== 11) {
        return one;
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
        return few;
    }
    return many;
}

// --------- ИСПРАВЛЕНО: локальное вычисление даты без UTC-сдвига ---------
function addDaysFromPriority(priority) {
    const map = { low: 15, medium: 7, high: 3 };
    const date = new Date();
    date.setDate(date.getDate() + (map[priority] || 7));
    return ymdLocal(date);
}

function ymdLocal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
// ------------------------------------------------------------------------

function normalizeToken(value) {
    return value ? value.toString().trim().toLowerCase().replace(/\s+/g, '') : '';
}

function syncWelcomeBlock() {
    const title = document.querySelector('.welcome-message h1');
    if (title && state.currentUser) {
        const name = state.currentUser.fullName?.split(' ')[0] || state.currentUser.fullName;
        title.textContent = `Добро пожаловать, ${name}!`;
    }
    const roleTarget = document.querySelector('.user-chip__role');
    if (roleTarget && state.currentUser) {
        roleTarget.textContent = state.currentUser.role || '';
    }
}

function renderFatalError() {
    const container = document.querySelector('.container');
    if (!container) {
        return;
    }
    container.innerHTML = `
        <section class="card" role="alert">
            <div class="inline-alert" data-variant="danger">
                <svg aria-hidden="true" focusable="false"><use href="assets/img/system-icons.svg#icon-flag"></use></svg>
                <div>Не удалось загрузить данные. Обновите страницу позже.</div>
            </div>
        </section>
    `;
}