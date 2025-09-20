(function () {
    const data = window.bukolpak?.data;
    const ui = {};
    const notificationRegistry = new WeakMap();

    function ensureToastStack() {
        let stack = document.querySelector('.toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'toast-stack';
            stack.setAttribute('role', 'region');
            stack.setAttribute('aria-live', 'polite');
            stack.setAttribute('aria-label', 'Системные уведомления');
            document.body.appendChild(stack);
        }
        return stack;
    }

    function iconMarkup(name) {
        return `<svg aria-hidden="true" focusable="false"><use href="assets/img/system-icons.svg#${name}"></use></svg>`;
    }

    function showToast({ title, message, type = 'info', duration = 4000 }) {
        const stack = ensureToastStack();
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.dataset.type = type;
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.innerHTML = `
            <div class="toast__icon">${iconMarkup(type === 'error' ? 'icon-flag' : type === 'success' ? 'icon-check' : 'icon-chat')}</div>
            <div>
                <div class="toast__title">${title}</div>
                <div class="toast__message">${message}</div>
            </div>
            <button class="toast__close" type="button" aria-label="Закрыть уведомление">${iconMarkup('icon-close')}</button>
        `;
        let timerId = null;
        const remove = () => {
            if (!toast.classList.contains('toast-leave')) {
                if (timerId) {
                    clearTimeout(timerId);
                    timerId = null;
                }
                toast.classList.add('toast-leave');
                setTimeout(() => toast.remove(), 220);
            }
        };
        toast.querySelector('.toast__close').addEventListener('click', remove);
        stack.appendChild(toast);
        while (stack.children.length > 4) {
            stack.firstElementChild?.remove();
        }
        const startTimer = () => {
            if (duration > 0) {
                timerId = window.setTimeout(remove, duration);
            }
        };
        toast.addEventListener('mouseenter', () => {
            if (timerId) {
                clearTimeout(timerId);
                timerId = null;
            }
        });
        toast.addEventListener('mouseleave', () => {
            if (!timerId) {
                startTimer();
            }
        });
        startTimer();
        return toast;
    }

    function formatRelativeTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const diff = Date.now() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'только что';
        if (minutes < 60) return `${minutes} мин назад`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} ч назад`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days} дн назад`;
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
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

    function initThemeToggle(button) {
        if (!button) return;
        const current = ensureTheme();
        renderThemeIcon(button, current);
        button.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const next = currentTheme === 'light' ? 'dark' : 'light';
            applyTheme(next);
            syncLogos(next);
            renderThemeIcon(button, next);
            showToast({
                title: next === 'light' ? 'Светлая тема' : 'Тёмная тема',
                message: 'Настройка сохранена для вашего профиля.',
                type: 'info',
                duration: 2800
            });
        });
    }

    function renderThemeIcon(button, theme) {
        const icon = theme === 'light' ? 'fa-moon' : 'fa-sun';
        button.innerHTML = `<i class="fas ${icon}" aria-hidden="true"></i>`;
        const label = theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему';
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
    }

    function ensureTheme() {
        const stored = data?.getCurrentUser()?.theme;
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = stored || (prefersDark ? 'dark' : 'light');
        applyTheme(theme);
        syncLogos(theme);
        return theme;
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (data) {
            data.setTheme(theme);
        }
        syncLogos(theme);
        document.documentElement.dispatchEvent(
            new CustomEvent('bukolpak:theme-change', { detail: { theme } })
        );
    }

    function initNotificationBell(button, panel) {
        if (!button || !panel || !data) return;
        const badge = button.querySelector('.notification-badge');
        const list = panel.querySelector('.notifications-list');
        const markAll = panel.querySelector('.mark-all-read');
        const resolveIcon = (type) => {
            const map = {
                system: 'fa-gear',
                reminder: 'fa-clock',
                comment: 'fa-message',
                task: 'fa-flag'
            };
            return map[type] || 'fa-bell';
        };
        const updateBadge = (unread) => {
            if (!badge) return;
            if (unread > 0) {
                badge.textContent = unread > 99 ? '99+' : unread;
                badge.hidden = false;
                badge.style.display = '';
            } else {
                badge.hidden = true;
                badge.textContent = '';
                badge.style.display = 'none';
            }
        };
        const pullNotifications = (force = false) => {
            if (force) {
                data.refreshNotifications?.();
            }
            return data
                .getNotifications()
                .slice()
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        };
        const selectDropdownNotifications = (notifications) => {
            const unreadItems = notifications.filter((item) => !item.read);
            if (unreadItems.length > 0) {
                return { items: unreadItems, mode: 'unread' };
            }
            const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
            const recentItems = notifications.filter((item) => {
                if (!item.createdAt) return false;
                const created = new Date(item.createdAt);
                return !Number.isNaN(created.getTime()) && created.getTime() >= dayAgo;
            });
            if (recentItems.length > 0) {
                return { items: recentItems, mode: 'recent' };
            }
            return {
                items: [],
                mode: notifications.length > 0 ? 'recent-empty' : 'empty'
            };
        };

        const render = (force = false) => {
            const notifications = pullNotifications(force);
            const unread = notifications.filter((item) => !item.read).length;
            updateBadge(unread);
            if (markAll) {
                markAll.classList.toggle('is-disabled', unread === 0);
            }
            if (!list) return;
            list.innerHTML = '';
            const { items: dropdownItems, mode } = selectDropdownNotifications(notifications);
            if (dropdownItems.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'notifications-empty';
                empty.textContent =
                    mode === 'recent-empty'
                        ? 'За последние 24 часа уведомлений нет'
                        : 'Новых уведомлений нет';
                list.appendChild(empty);
                return;
            }
            const contextNote = document.createElement('div');
            contextNote.className = 'notifications-note';
            contextNote.textContent =
                mode === 'unread'
                    ? 'Непрочитанные уведомления'
                    : 'Уведомления за последние 24 часа';
            list.appendChild(contextNote);
            dropdownItems.forEach((item) => {
                const entry = document.createElement('button');
                entry.type = 'button';
                entry.className = 'notification-item';
                if (!item.read) {
                    entry.classList.add('unread');
                }
                entry.innerHTML = `
                    <span class="notification-icon"><i class="fas ${resolveIcon(item.type)}" aria-hidden="true"></i></span>
                    <span class="notification-content">
                        <span class="notification-text">${escapeHtml(item.title || 'Уведомление')}</span>
                        ${item.message ? `<span class="notification-time">${escapeHtml(item.message)}</span>` : ''}
                        <span class="notification-time">${formatRelativeTime(item.createdAt)}</span>
                    </span>
                `;
                entry.addEventListener('click', () => {
                    panel.classList.remove('is-open', 'active');
                    button.setAttribute('aria-expanded', 'false');
                    if (!item.read) {
                        data.markNotificationRead(item.id);
                    }
                    if (item.link) {
                        window.location.href = item.link;
                    } else {
                        render();
                    }
                });
                list.appendChild(entry);
            });
        };

        setupNotificationsModal({
            button,
            panel,
            pullNotifications,
            renderDropdown: render
        });

        button.addEventListener('click', () => {
            const isOpen = panel.classList.toggle('is-open');
            if (!isOpen) {
                panel.classList.remove('active');
            } else {
                panel.classList.add('active');
            }
            button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            if (isOpen) {
                render();
            }
        });

        markAll?.addEventListener('click', (event) => {
            event.preventDefault();
            if (markAll.classList.contains('is-disabled')) return;
            const notifications = data.getNotifications().map((item) => ({ ...item, read: true }));
            data.setNotifications(notifications);
            render();
        });

        document.addEventListener('click', (event) => {
            if (!panel.contains(event.target) && !button.contains(event.target)) {
                panel.classList.remove('is-open', 'active');
                button.setAttribute('aria-expanded', 'false');
            }
        });

        notificationRegistry.set(button, render);
        render();

        const handleStorage = (event) => {
            if (event.key === data.NOTIFICATION_STORAGE_KEY) {
                render();
            }
        };

        window.addEventListener('storage', handleStorage);
    }

    function setupNotificationsModal({ button, panel, pullNotifications, renderDropdown }) {
        const modal = document.getElementById('notifications-modal');
        if (!modal) {
            return;
        }
        if (modal.dataset.bound === 'true') {
            return;
        }
        const list = modal.querySelector('[data-notifications-modal-list]');
        const closeButtons = modal.querySelectorAll('[data-notifications-modal-close]');
        const backdrop = modal.querySelector('.notifications-modal__backdrop');
        const headerMarkAll = modal.querySelector('[data-notifications-modal-mark-all]');
        const body = document.body;
        let escapeHandler = null;

        const closeModal = () => {
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
            body.classList.remove('notifications-modal-open');
            if (escapeHandler) {
                document.removeEventListener('keydown', escapeHandler);
                escapeHandler = null;
            }
            if (button) {
                button.focus();
            }
        };

        const renderModalContent = () => {
            if (!list) return;
            list.innerHTML = '';
            const notifications = pullNotifications();
            if (notifications.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'notifications-modal__empty';
                empty.textContent = 'Новых уведомлений нет';
                list.appendChild(empty);
                return;
            }
            notifications.forEach((item) => {
                const entry = document.createElement('article');
                entry.className = 'notifications-modal__item';
                entry.dataset.type = item.type || 'info';
                if (!item.read) {
                    entry.classList.add('notifications-modal__item--unread');
                }
                entry.innerHTML = `
                    <div class="notifications-modal__icon"><i class="fas ${resolveModalIcon(item.type)}" aria-hidden="true"></i></div>
                    <div class="notifications-modal__content">
                        <h3 class="notifications-modal__title">${escapeHtml(item.title || 'Уведомление')}</h3>
                        ${item.message ? `<p class="notifications-modal__message">${escapeHtml(item.message)}</p>` : ''}
                        <time class="notifications-modal__time" datetime="${item.createdAt || ''}">${formatRelativeTime(item.createdAt)}</time>
                    </div>
                    ${item.link ? `<a class="notifications-modal__link" href="${item.link}"><span>Открыть</span></a>` : ''}
                `;
                if (item.link) {
                    entry.querySelector('.notifications-modal__link')?.addEventListener('click', () => {
                        data.markNotificationRead(item.id);
                        renderDropdown();
                        closeModal();
                    });
                }
                entry.addEventListener('click', () => {
                    if (!item.read) {
                        data.markNotificationRead(item.id);
                        renderDropdown();
                        renderModalContent();
                    }
                });
                list.appendChild(entry);
            });
        };

        const openModal = () => {
            panel?.classList.remove('is-open', 'active');
            button?.setAttribute('aria-expanded', 'false');
            renderDropdown(true);
            renderModalContent();
            modal.classList.add('is-open');
            modal.setAttribute('aria-hidden', 'false');
            body.classList.add('notifications-modal-open');
            escapeHandler = (event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeModal();
                }
            };
            document.addEventListener('keydown', escapeHandler);
        };

        modal.dataset.bound = 'true';

        document.querySelectorAll('.view-all-link').forEach((link) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                openModal();
            });
        });

        closeButtons.forEach((control) => {
            control.addEventListener('click', (event) => {
                event.preventDefault();
                closeModal();
            });
        });

        if (backdrop) {
            backdrop.addEventListener('click', closeModal);
        }

        if (headerMarkAll) {
            headerMarkAll.addEventListener('click', (event) => {
                event.preventDefault();
                const notifications = data.getNotifications().map((item) => ({ ...item, read: true }));
                data.setNotifications(notifications);
                renderDropdown();
                renderModalContent();
            });
        }
    }

    function resolveModalIcon(type) {
        const map = {
            system: 'fa-gear',
            reminder: 'fa-clock',
            comment: 'fa-message',
            task: 'fa-flag'
        };
        return map[type] || 'fa-bell';
    }

    function initUserMenu(button, panel) {
        if (!button || !panel || !data) return;
        const nameEl = button.querySelector('.user-chip__name');
        const roleEl = button.querySelector('.user-chip__role');
        const avatarEl = button.querySelector('.user-chip__avatar');
        const panelName = panel.querySelector('[data-profile-name]');
        const panelRole = panel.querySelector('[data-profile-role]');
        const panelMail = panel.querySelector('[data-profile-mail]');
        const panelAvatar = panel.querySelector('[data-profile-avatar]');
        const render = () => {
            const user = data.getCurrentUser();
            if (nameEl) nameEl.textContent = user.fullName;
            if (roleEl) roleEl.textContent = user.role;
            if (avatarEl) {
                if (user.avatar) {
                    avatarEl.innerHTML = `<img src="${user.avatar}" alt="${user.fullName}">`;
                } else {
                    avatarEl.textContent = user.fullName.slice(0, 1);
                }
            }
            if (panelName) panelName.textContent = user.fullName;
            if (panelRole) panelRole.textContent = user.role || 'Роль не указана';
            if (panelMail) panelMail.textContent = user.email || 'Почта не указана';
            if (panelAvatar) {
                if (user.avatar) {
                    panelAvatar.innerHTML = `<img src="${user.avatar}" alt="${user.fullName}">`;
                } else {
                    panelAvatar.textContent = user.fullName.slice(0, 1);
                }
            }
        };
        render();

        button.addEventListener('click', () => {
            panel.classList.toggle('is-open');
            button.setAttribute('aria-expanded', panel.classList.contains('is-open'));
        });
        document.addEventListener('click', (event) => {
            if (!panel.contains(event.target) && !button.contains(event.target)) {
                panel.classList.remove('is-open');
                button.setAttribute('aria-expanded', 'false');
            }
        });
    }

    function initReducedMotionToggle() {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => {
            document.body.classList.toggle('no-motion', mq.matches);
        };
        if (mq.addEventListener) {
            mq.addEventListener('change', update);
        }
        update();
    }

    function initLogoutButton(button) {
        if (!button) return;
        button.addEventListener('click', () => {
            const key = data?.CURRENT_USER_KEY;
            if (key) {
                localStorage.removeItem(key);
            }
            localStorage.removeItem('bukolpak_current_user');
            window.location.href = 'auth.html';
        });
    }

    function syncLogos(theme = document.documentElement.getAttribute('data-theme') || 'light') {
        document.querySelectorAll('img[data-logo-light][data-logo-dark]').forEach((img) => {
            const target = theme === 'dark' ? img.dataset.logoDark : img.dataset.logoLight;
            if (target && img.getAttribute('src') !== target) {
                img.setAttribute('src', target);
            }
        });
    }

    function refreshNotificationBell(button = document.getElementById('notifications-btn')) {
        const render = notificationRegistry.get(button);
        if (render) {
            render(true);
        }
    }

    ui.showToast = showToast;
    ui.initThemeToggle = initThemeToggle;
    ui.initNotificationBell = initNotificationBell;
    ui.initUserMenu = initUserMenu;
    ui.ensureTheme = ensureTheme;
    ui.applyTheme = applyTheme;
    ui.initReducedMotionToggle = initReducedMotionToggle;
    ui.initLogoutButton = initLogoutButton;
    ui.syncLogos = syncLogos;
    ui.refreshNotificationBell = refreshNotificationBell;

    window.bukolpak = window.bukolpak || {};
    window.bukolpak.ui = ui;

    ensureTheme();
    syncLogos();
    initReducedMotionToggle();
})();
