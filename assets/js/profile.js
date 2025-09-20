const data = window.bukolpak?.data ?? null;
const ui = window.bukolpak?.ui ?? null;

const HISTORY_LIMIT = 6;

const state = {
    original: null,
    draft: null,
    pendingFiles: {
        avatar: null,
        cover: null
    },
    activity: []
};

const selectors = {
    form: null,
    status: null,
    save: null,
    overdueBanner: null,
    overdueText: null,
    overdueAction: null,
    history: null,
    lastActivity: null
};

const isReady = Boolean(data && ui);

document.addEventListener('DOMContentLoaded', () => {
    cacheSelectors();
    if (!isReady) {
        renderFatalError('Системный модуль недоступен. Попробуйте обновить страницу позднее.');
        return;
    }

    initShell();

    try {
        const user = data.getCurrentUser();
        if (!user) {
            throw new Error('No user payload');
        }
        state.original = { ...user };
        state.draft = { ...user };
        populateForm(user);
        bindEvents();
        renderOverdueBanner();
    } catch (error) {
        renderFatalError('Не удалось загрузить профиль пользователя.');
    }
});

function cacheSelectors() {
    selectors.form = document.getElementById('profile-form');
    selectors.status = document.getElementById('profile-status');
    selectors.save = document.getElementById('save-button');
    selectors.overdueBanner = document.getElementById('overdue-banner');
    selectors.overdueText = document.getElementById('overdue-banner-text');
    selectors.overdueAction = document.getElementById('overdue-banner-action');
    selectors.history = document.getElementById('profile-history');
    selectors.lastActivity = document.getElementById('profile-last-activity');
}

function resolveControl(name) {
    if (!selectors.form) return null;
    const form = selectors.form;
    if (form.elements?.namedItem) {
        const named = form.elements.namedItem(name);
        if (named) {
            return named;
        }
    }
    const escaped = name.replace(/([\.\[\]#:\s])/g, '\\$1');
    return form.querySelector(`[name="${escaped}"]`);
}

function setControlValue(name, value) {
    const control = resolveControl(name);
    if (!control) return;
    if (control.type === 'checkbox') {
        control.checked = Boolean(value);
        return;
    }
    control.value = value ?? '';
}

function readControlValue(name) {
    const control = resolveControl(name);
    if (!control) return '';
    if (control.type === 'checkbox') {
        return control.checked;
    }
    const value = control.value ?? '';
    return typeof value === 'string' ? value.trim() : value;
}

function readString(name, fallback = '') {
    const value = readControlValue(name);
    return typeof value === 'string' ? value : fallback;
}

function readBoolean(name) {
    const value = readControlValue(name);
    return typeof value === 'boolean' ? value : Boolean(value);
}

function initShell() {
    ui.initThemeToggle(document.getElementById('theme-toggle'));
    ui.initNotificationBell(
        document.getElementById('notifications-btn'),
        document.getElementById('notifications-dropdown')
    );
    ui.initUserMenu(
        document.getElementById('user-menu-button'),
        document.getElementById('user-menu-panel')
    );
    ui.initLogoutButton(document.getElementById('logout-btn'));
    ui.syncLogos?.();
    document.documentElement.addEventListener('bukolpak:theme-change', (event) => {
        ui.syncLogos?.(event.detail?.theme);
    });
}

function populateForm(user) {
    if (!selectors.form) return;
    setControlValue('fullName', user.fullName || '');
    setControlValue('role', user.role || '');
    setControlValue('email', user.email || '');
    setControlValue('phone', user.phone || '');
    setControlValue('location', user.location || '');
    setControlValue('pronouns', user.pronouns || '');
    setControlValue('bio', user.bio || '');
    setControlValue('theme', user.theme || 'light');
    setControlValue('language', user.language || 'ru-RU');
    setControlValue('timezone', user.timezone || 'Europe/Moscow');
    setControlValue('availability.hours', user.availability?.hours || '');
    setControlValue('availability.status', user.availability?.status || 'available');
    setControlValue('availability.note', user.availability?.note || '');
    setControlValue('notifications.system', Boolean(user.notifications?.system));
    setControlValue('notifications.reminders', Boolean(user.notifications?.reminders));
    setControlValue('notifications.weekly', Boolean(user.notifications?.weekly));

    renderSummary(user);
    renderAvatar(user.avatar, user.fullName);
    renderCover(user.cover);
    setStatus('');
    state.draft = { ...user };
    refreshActivity();
}

function bindEvents() {
    if (!selectors.form) return;

    selectors.form.addEventListener('input', () => {
        state.draft = collectFormData();
        renderSummary(state.draft);
    });

    selectors.form.addEventListener('submit', handleSubmit);
    selectors.save?.addEventListener('click', handleSubmit);

    setupFileDrop('avatar-input', 'avatar');
    setupFileDrop('cover-input', 'cover');

    window.addEventListener('storage', handleStorageEvent);
}

function renderSummary(user) {
    document.getElementById('profile-name').textContent = user.fullName || '—';
    document.getElementById('profile-role').textContent = user.role || '—';
    document.getElementById('profile-bio').textContent = user.bio || 'Расскажите о себе';
    document.title = user.fullName ? `${user.fullName} · Буколпак` : 'Профиль · Буколпак';
}

function renderAvatar(source, name) {
    const container = document.getElementById('avatar-preview');
    if (!container) return;
    container.innerHTML = '';
    if (source) {
        const img = document.createElement('img');
        img.src = source;
        img.alt = name ? `Аватар пользователя ${name}` : 'Аватар';
        container.appendChild(img);
    } else {
        const span = document.createElement('span');
        span.className = 'profile-avatar__initial';
        span.textContent = (name || '—').trim().slice(0, 1).toUpperCase();
        container.appendChild(span);
    }
}

function renderCover(source) {
    const cover = document.getElementById('cover-preview');
    if (!cover) return;
    if (source) {
        cover.style.backgroundImage = `url(${source})`;
        cover.setAttribute('aria-label', 'Обложка профиля — пользовательское изображение');
    } else {
        cover.style.backgroundImage =
            'linear-gradient(135deg, rgba(255,138,76,0.6), rgba(140,123,255,0.6))';
        cover.setAttribute('aria-label', 'Обложка профиля — изображение по умолчанию');
    }
}

function setupFileDrop(inputId, type) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const dropZone = input.closest('.file-drop');
    if (!dropZone) return;

    input.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (file) {
            await handleFile(file, type);
            input.value = '';
        }
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
        dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropZone.classList.add('is-dragging');
        });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
        dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropZone.classList.remove('is-dragging');
        });
    });

    dropZone.addEventListener('drop', async (event) => {
        const file = event.dataTransfer?.files?.[0];
        if (file) {
            await handleFile(file, type);
        }
    });
}

async function handleFile(file, type) {
    const maxSize = 4 * 1024 * 1024;
    if (!file.type.startsWith('image/')) {
        ui.showToast({
            title: 'Неверный формат',
            message: 'Допустимы только изображения (JPG, PNG, WebP).',
            type: 'error'
        });
        return;
    }
    if (file.size > maxSize) {
        ui.showToast({
            title: 'Файл слишком большой',
            message: 'Выберите изображение до 4 МБ.',
            type: 'error'
        });
        return;
    }
    const dataUrl = await readAsDataURL(file);
    state.pendingFiles[type] = dataUrl;
    if (type === 'avatar') {
        renderAvatar(dataUrl, state.draft?.fullName ?? state.original?.fullName);
    } else {
        renderCover(dataUrl);
    }
    ui.showToast({
        title: 'Файл загружен',
        message: 'Изображение предварительно обновлено. Не забудьте сохранить изменения.',
        type: 'success'
    });
}

function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function collectFormData() {
    if (!selectors.form) return { ...state.original };
    return {
        ...state.original,
        fullName: readString('fullName'),
        role: readString('role'),
        email: readString('email'),
        phone: readString('phone'),
        bio: readString('bio'),
        theme: readString('theme', state.original?.theme || 'light'),
        language: readString('language', state.original?.language || 'ru-RU'),
        timezone: readString('timezone', state.original?.timezone || 'Europe/Moscow'),
        location: readString('location'),
        pronouns: readString('pronouns'),
        notifications: {
            system: readBoolean('notifications.system'),
            reminders: readBoolean('notifications.reminders'),
            weekly: readBoolean('notifications.weekly')
        },
        availability: {
            hours: readString('availability.hours'),
            status: readString('availability.status', 'available'),
            note: readString('availability.note')
        },
        avatar: state.pendingFiles.avatar ?? state.original.avatar,
        cover: state.pendingFiles.cover ?? state.original.cover
    };
}

function validate(formData) {
    const errors = {};
    if (!formData.fullName) {
        errors.fullName = 'Введите ваше имя';
    }
    if (!formData.role) {
        errors.role = 'Укажите должность';
    }
    if (!formData.email) {
        errors.email = 'Укажите email';
    }
    return errors;
}

function showErrors(errors) {
    if (!selectors.form) return;
    ['fullName', 'role', 'email', 'phone', 'bio'].forEach((field) => {
        const fieldEl = resolveControl(field);
        if (!fieldEl) return;
        const wrapper = fieldEl.closest('.profile-field');
        const errorEl = wrapper?.querySelector('.profile-field__error');
        const message = errors[field];
        if (message) {
            if (errorEl) errorEl.textContent = message;
            fieldEl.setAttribute('aria-invalid', 'true');
        } else {
            if (errorEl) errorEl.textContent = '';
            fieldEl.removeAttribute('aria-invalid');
        }
    });
}

async function handleSubmit(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const formData = collectFormData();
    const errors = validate(formData);
    showErrors(errors);
    if (Object.keys(errors).length > 0) {
        ui.showToast({
            title: 'Проверьте форму',
            message: 'Заполните обязательные поля.',
            type: 'error'
        });
        return;
    }

    await saveProfile(formData);
}

async function saveProfile(formData) {
    const previous = { ...state.original };
    toggleForm(false);
    setStatus('Сохраняем изменения…');

    if (state.pendingFiles.avatar) {
        formData.avatar = state.pendingFiles.avatar;
    }
    if (state.pendingFiles.cover) {
        formData.cover = state.pendingFiles.cover;
    }

    try {
        const payload = await simulateNetwork(formData);
        state.original = data.updateCurrentUser(payload);
        state.draft = { ...state.original };
        state.pendingFiles = { avatar: null, cover: null };
        renderAvatar(state.original.avatar, state.original.fullName);
        renderCover(state.original.cover);
        renderSummary(state.original);
        syncShellUser();
        ui.applyTheme(state.original.theme);
        setStatus('Профиль обновлён');
        ui.showToast({
            title: 'Профиль сохранён',
            message: 'Все изменения применены.',
            type: 'success'
        });
        renderOverdueBanner();
        refreshActivity();
    } catch (error) {
        state.original = previous;
        populateForm(previous);
        setStatus('Ошибка сохранения. Изменения не применены.');
        ui.showToast({
            title: 'Не удалось сохранить',
            message: error.message || 'Попробуйте ещё раз позже.',
            type: 'error'
        });
    } finally {
        toggleForm(true);
    }
}

function toggleForm(enabled) {
    if (selectors.save) selectors.save.disabled = !enabled;
    if (selectors.form) {
        selectors.form.querySelectorAll('input, textarea, select').forEach((control) => {
            control.disabled = !enabled;
        });
    }
}

function syncShellUser() {
    const nameTarget = document.querySelector('.user-chip__name');
    if (nameTarget) nameTarget.textContent = state.original.fullName;
    const roleTarget = document.querySelector('.user-chip__role');
    if (roleTarget) roleTarget.textContent = state.original.role;
    const avatarTarget = document.querySelector('.user-chip__avatar');
    if (avatarTarget) {
        if (state.original.avatar) {
            avatarTarget.innerHTML = `<img src="${state.original.avatar}" alt="${state.original.fullName}">`;
        } else {
            avatarTarget.textContent = state.original.fullName.slice(0, 1);
        }
    }
}

function simulateNetwork(payload) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (payload.fullName.toLowerCase().includes('ошибка')) {
                reject(new Error('Сервер отклонил изменение данных.'));
            } else {
                resolve(payload);
            }
        }, 700);
    });
}

function setStatus(message) {
    if (selectors.status) {
        selectors.status.textContent = message;
    }
}

function renderOverdueBanner() {
    if (!selectors.overdueBanner || !data) return;
    const userId = state.original?.id || data.getCurrentUser()?.id;
    const overdue = data.getOverdueTasks(userId);
    if (!overdue || overdue.length === 0) {
        selectors.overdueBanner.hidden = true;
        selectors.overdueBanner.setAttribute('aria-hidden', 'true');
        return;
    }
    const count = overdue.length;
    const noun = formatTaskCount(count);
    if (selectors.overdueText) {
        selectors.overdueText.textContent = `У вас ${count} ${noun}.`;
    }
    if (selectors.overdueAction) {
        selectors.overdueAction.href = `task.html?id=${overdue[0].id}`;
    }
    selectors.overdueBanner.hidden = false;
    selectors.overdueBanner.setAttribute('aria-hidden', 'false');
}

function formatTaskCount(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'просроченная задача';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'просроченные задачи';
    return 'просроченных задач';
}

function renderFatalError(message) {
    const container = document.querySelector('.profile-page');
    if (!container) return;
    if (selectors.overdueBanner) {
        selectors.overdueBanner.hidden = true;
        selectors.overdueBanner.setAttribute('aria-hidden', 'true');
    }
    container.innerHTML = `
        <section class="profile-error" role="alert">
            <div class="profile-error__icon">${icon('icon-flag')}</div>
            <h1 class="profile-error__title">Ошибка загрузки</h1>
            <p class="profile-error__message">${escapeHtml(message)}</p>
            <a class="btn btn-primary" href="main.html">Вернуться на главную</a>
        </section>
    `;
}

function handleStorageEvent(event) {
    if (!event || !data) return;
    if (event.key === data.BOARD_STORAGE_KEY) {
        refreshActivity();
        renderOverdueBanner();
    }
    if (event.key === data.NOTIFICATION_STORAGE_KEY) {
        ui.refreshNotificationBell?.();
    }
}

function refreshActivity() {
    if (!data?.getTasks) return;
    const userId = state.original?.id;
    if (!userId) return;
    const entries = collectUserActivity(userId);
    renderActivity(entries);
}

function renderActivity(entries) {
    const list = Array.isArray(entries) ? entries : [];
    state.activity = list;
    renderHistoryList(list);
    renderLastActivity(list[0] || null);
}

function renderHistoryList(entries) {
    if (!selectors.history) return;
    selectors.history.innerHTML = '';
    if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'profile-history__empty';
        empty.textContent = 'Активность пока не зафиксирована.';
        selectors.history.appendChild(empty);
        return;
    }
    entries.slice(0, HISTORY_LIMIT).forEach((entry) => {
        const item = document.createElement('article');
        item.className = 'profile-history__item';
        const meta = document.createElement('div');
        meta.className = 'profile-history__meta';
        meta.textContent = buildActivityMeta(entry);
        const text = document.createElement('div');
        text.className = 'profile-history__text';
        text.textContent = buildActivityDescription(entry);
        item.append(meta, text);
        selectors.history.appendChild(item);
    });
}

function renderLastActivity(entry) {
    if (!selectors.lastActivity) return;
    if (!entry) {
        selectors.lastActivity.textContent = 'Последняя активность: данных пока нет.';
        selectors.lastActivity.removeAttribute('title');
        return;
    }
    const summary = buildActivitySummary(entry);
    const relative = formatRelativeTime(entry.createdAt);
    const pieces = [summary, relative].filter(Boolean);
    selectors.lastActivity.textContent = `Последняя активность: ${pieces.join(' · ')}`;
    selectors.lastActivity.setAttribute('title', summary);
}

function buildActivityMeta(entry) {
    const pieces = [];
    const relative = formatRelativeTime(entry.createdAt);
    if (relative) {
        pieces.push(relative);
    }
    if (entry.taskSubject) {
        pieces.push(`Задача «${entry.taskSubject}»`);
    }
    return pieces.join(' · ') || 'Активность';
}

function buildActivityDescription(entry) {
    if (!entry) return '';
    if (entry.description) {
        return `${entry.title}: ${entry.description}`;
    }
    return entry.title;
}

function buildActivitySummary(entry) {
    if (!entry) return '';
    const subject = entry.taskSubject ? ` в задаче «${entry.taskSubject}»` : '';
    if (entry.description) {
        return `${entry.title}${subject}: ${entry.description}`;
    }
    return `${entry.title}${subject}`;
}

function collectUserActivity(userId) {
    const tasks = data.getTasks?.() || [];
    if (!Array.isArray(tasks)) return [];
    const entries = [];
    tasks.forEach((task) => {
        const subject = task.subject || 'Без названия';
        const timeline = Array.isArray(task.timeline) ? task.timeline : [];
        timeline.forEach((item) => {
            if (item.actorId === userId) {
                entries.push({
                    id: `${task.id}-timeline-${item.id || Math.random().toString(36).slice(2)}`,
                    createdAt: item.createdAt || task.updatedAt || task.createdAt || data.nowIso?.(),
                    title: item.text || 'Обновление задачи',
                    description: '',
                    taskSubject: subject
                });
            }
        });
        const comments = Array.isArray(task.comments) ? task.comments : [];
        comments.forEach((comment) => {
            if (comment.authorId === userId) {
                entries.push({
                    id: `${task.id}-comment-${comment.id || Math.random().toString(36).slice(2)}`,
                    createdAt: comment.createdAt || task.updatedAt || task.createdAt || data.nowIso?.(),
                    title: 'Комментарий к задаче',
                    description: truncateText(extractTextFromHtml(comment.html)),
                    taskSubject: subject
                });
            }
        });
    });
    return entries
        .filter((entry) => entry.createdAt)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function extractTextFromHtml(html) {
    if (!html) return '';
    const container = document.createElement('div');
    container.innerHTML = html;
    return container.textContent?.trim() || '';
}

function truncateText(text, limit = 160) {
    if (!text) return '';
    if (text.length <= limit) return text;
    return `${text.slice(0, limit - 1)}…`;
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const diff = Date.now() - date.getTime();
    const minute = 60 * 1000;
    if (diff < minute) return 'только что';
    const minutes = Math.floor(diff / minute);
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} дн назад`;
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function icon(name) {
    return `<svg aria-hidden="true" focusable="false"><use href="assets/img/system-icons.svg#${name}"></use></svg>`;
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
