const dataLayer = window.bukolpak?.data || null;

document.addEventListener('DOMContentLoaded', () => {
    // Элементы DOM
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    const authForm = document.getElementById('authForm');
    const loginButton = document.getElementById('loginButton');
    const forgotLink = document.getElementById('forgotLink');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalClose = document.getElementById('modalClose');
    const passwordModal = document.getElementById('passwordModal');
    const recoveryButton = document.getElementById('recoveryButton');
    const recoveryEmail = document.getElementById('recoveryEmail');
    const togglePasswordButtons = document.querySelectorAll('.toggle-password');
    const notificationContainer = document.getElementById('notificationContainer');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const usernameMessage = document.getElementById('usernameMessage');
    const passwordMessage = document.getElementById('passwordMessage');
    const recoveryMessage = document.getElementById('recoveryMessage');

    // Индекс пользователей для быстрого поиска
    const knownUsers = buildUserIndex();

    // Создание частиц фона
    function createParticles() {
        const particlesContainer = document.getElementById('particles');
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion || !particlesContainer) {
            return;
        }

        for (let i = 0; i < 15; i += 1) {
            const particle = document.createElement('div');
            particle.className = 'particle';

            const size = Math.random() * 3 + 1;
            const duration = Math.random() * 10 + 10;
            const delay = Math.random() * 5;

            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDuration = `${duration}s`;
            particle.style.animationDelay = `${delay}s`;

            particlesContainer.appendChild(particle);
        }
    }

    // Инициализация темы
    function initTheme() {
        const storedProfileTheme = dataLayer?.getCurrentUser?.()?.theme;
        const savedTheme = localStorage.getItem('theme') || storedProfileTheme;
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme) {
            body.setAttribute('data-theme', savedTheme);
        } else if (systemPrefersDark) {
            body.setAttribute('data-theme', 'dark');
        }

        updateThemeToggleState();
    }

    // Обновление визуального состояния переключателя темы
    function updateThemeToggleState() {
        const isDark = body.getAttribute('data-theme') === 'dark';
        themeToggle.setAttribute('aria-pressed', String(isDark));
        themeToggle.setAttribute('aria-label', isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему');

        const lightLogo = document.querySelector('.light-logo');
        const darkLogo = document.querySelector('.dark-logo');

        if (lightLogo) {
            lightLogo.setAttribute('aria-hidden', String(isDark));
        }

        if (darkLogo) {
            darkLogo.setAttribute('aria-hidden', String(!isDark));
        }
    }

    // Универсальная установка состояния поля
    function setFieldState(input, messageElement, state, message = '') {
        if (!input || !messageElement) {
            return;
        }

        const container = input.closest('.input-container');
        if (!container) {
            return;
        }

        container.classList.remove('error', 'success');
        messageElement.classList.remove('error', 'success');

        if (state) {
            container.classList.add(state);
            messageElement.classList.add(state);
        }

        messageElement.textContent = message;
    }

    // Сброс состояния поля
    function clearFieldState(input, messageElement) {
        setFieldState(input, messageElement, null, '');
    }

    // Переключение темы нажатием кнопки
    themeToggle.addEventListener('click', () => {
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        if (dataLayer) {
            dataLayer.setTheme(newTheme);
        }
        updateThemeToggleState();

        themeToggle.style.transform = 'scale(0.9)';
        setTimeout(() => {
            themeToggle.style.transform = '';
        }, 150);
    });

    // Быстрая валидация имени пользователя
    usernameInput.addEventListener('input', () => {
        if (usernameInput.value.trim().length >= 3) {
            setFieldState(usernameInput, usernameMessage, 'success', '');
        } else {
            clearFieldState(usernameInput, usernameMessage);
        }
    });

    // Быстрая валидация пароля
    passwordInput.addEventListener('input', () => {
        if (passwordInput.value.trim().length >= 6) {
            setFieldState(passwordInput, passwordMessage, 'success', '');
        } else {
            clearFieldState(passwordInput, passwordMessage);
        }
    });

    // Валидация email для восстановления
    recoveryEmail.addEventListener('input', () => {
        const value = recoveryEmail.value.trim();
        if (value === '') {
            clearFieldState(recoveryEmail, recoveryMessage);
        } else if (validateEmail(value)) {
            setFieldState(recoveryEmail, recoveryMessage, 'success', '');
        } else {
            setFieldState(recoveryEmail, recoveryMessage, 'error', 'Введите корректный email');
        }
    });

    // Переключение отображения пароля
    togglePasswordButtons.forEach((button) => {
        button.addEventListener('click', function () {
            const input = this.closest('.input-wrapper').querySelector('input');
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            const isVisible = type === 'text';
            this.setAttribute('aria-pressed', String(isVisible));
            this.setAttribute('aria-label', isVisible ? 'Скрыть пароль' : 'Показать пароль');

            this.style.transform = 'translateY(-50%) scale(0.8)';
            setTimeout(() => {
                this.style.transform = 'translateY(-50%)';
            }, 150);
        });
    });

    // Лёгкая анимация полей при фокусе
    document.querySelectorAll('input').forEach((input) => {
        input.addEventListener('focus', function () {
            this.parentElement.style.transform = 'translateY(-2px)';
        });

        input.addEventListener('blur', function () {
            this.parentElement.style.transform = '';
        });
    });

    // Открытие модального окна восстановления
    forgotLink.addEventListener('click', (event) => {
        event.preventDefault();
        modalOverlay.classList.add('visible');
        modalOverlay.setAttribute('aria-hidden', 'false');

        setTimeout(() => {
            recoveryEmail.focus();
        }, 300);
    });

    // Закрытие модального окна восстановления
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modalOverlay.classList.contains('visible')) {
            closeModal();
        }
    });

    function closeModal() {
        modalOverlay.classList.remove('visible');
        recoveryEmail.value = '';
        clearFieldState(recoveryEmail, recoveryMessage);
        modalOverlay.setAttribute('aria-hidden', 'true');
    }

    // Обработка формы авторизации
    authForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        let hasError = false;
        if (username.length < 3) {
            setFieldState(usernameInput, usernameMessage, 'error', 'Введите не менее 3 символов');
            hasError = true;
        } else {
            setFieldState(usernameInput, usernameMessage, 'success', '');
        }

        if (password.length < 6) {
            setFieldState(passwordInput, passwordMessage, 'error', 'Пароль должен содержать минимум 6 символов');
            hasError = true;
        } else {
            setFieldState(passwordInput, passwordMessage, 'success', '');
        }

        if (hasError) {
            shakeElement(authForm);
            showNotification('Исправьте ошибки в форме', 'error');
            return;
        }

        simulateLogin();
    });

    // Обработка восстановления пароля
    recoveryButton.addEventListener('click', () => {
        const email = recoveryEmail.value.trim();

        if (!email) {
            setFieldState(recoveryEmail, recoveryMessage, 'error', 'Введите email');
            shakeElement(passwordModal);
            showNotification('Введите email для восстановления', 'error');
            return;
        }

        if (!validateEmail(email)) {
            setFieldState(recoveryEmail, recoveryMessage, 'error', 'Введите корректный email');
            shakeElement(passwordModal);
            showNotification('Введите корректный email', 'error');
            return;
        }

        setFieldState(recoveryEmail, recoveryMessage, 'success', '');
        simulateRecovery();
    });

    // Проверка email на корректность
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Визуальный эффект ошибки
    function shakeElement(element) {
        element.style.animation = 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both';
        setTimeout(() => {
            element.style.animation = '';
        }, 500);
    }

    // Имитация успешного входа
    function simulateLogin() {
        loginButton.classList.add('loading');

        setTimeout(() => {
            loginButton.classList.remove('loading');
            loginButton.style.background = 'var(--success)';
            loginButton.querySelector('.button-text').textContent = 'Успешно!';

            const username = usernameInput.value.trim();
            const resolvedUser = resolveUserByLogin(username) || dataLayer?.getCurrentUser?.() || null;
            if (resolvedUser && dataLayer) {
                dataLayer.setCurrentUserById(resolvedUser.id);
                const theme = resolvedUser.theme || 'light';
                localStorage.setItem('theme', theme);
                body.setAttribute('data-theme', theme);
                updateThemeToggleState();
            }

            const userData = {
                id: resolvedUser?.id || null,
                username,
                loggedAt: new Date().toISOString()
            };
            localStorage.setItem('bukolpak_current_user', JSON.stringify(userData));
            if (resolvedUser?.id) {
                localStorage.setItem('bukolpak_last_login', resolvedUser.id);
            }

            showNotification('Вход выполнен успешно!', 'success');

            setTimeout(() => {
                loginButton.style.background = '';
                loginButton.querySelector('.button-text').textContent = 'Войти';
                authForm.reset();
                clearFieldState(usernameInput, usernameMessage);
                clearFieldState(passwordInput, passwordMessage);
                window.location.href = 'main.html';
            }, 1000);
        }, 2000);
    }

    // Имитация отправки инструкций по восстановлению
    function simulateRecovery() {
        recoveryButton.classList.add('loading');

        setTimeout(() => {
            recoveryButton.classList.remove('loading');
            recoveryButton.style.background = 'var(--success)';
            recoveryButton.querySelector('.button-text').textContent = 'Отправлено!';

            setTimeout(() => {
                closeModal();
                recoveryButton.style.background = '';
                recoveryButton.querySelector('.button-text').textContent = 'Отправить инструкции';
                showNotification('Инструкции отправлены на ваш email', 'success');
            }, 1000);
        }, 2000);
    }

    // Показ всплывающих уведомлений
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.setAttribute('role', 'alert');
        notification.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="${type === 'success' ? 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3' : 'M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'}"
                      stroke="${type === 'success' ? '#34C759' : '#FF3B30'}"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"/>
            </svg>
            <span>${message}</span>
        `;

        notificationContainer.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('visible');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('visible');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 4000);
    }

    // Стартовые вызовы
    initTheme();
    createParticles();

    // --- Работа с пользователями ---
    function buildUserIndex() {
        if (!dataLayer?.getUsers) {
            return new Map();
        }
        const map = new Map();
        const users = Object.values(dataLayer.getUsers());
        users.forEach((user) => {
            computeUserAliases(user).forEach((alias) => {
                if (!map.has(alias)) {
                    map.set(alias, user);
                }
            });
        });
        return map;
    }

    function computeUserAliases(user) {
        const aliases = new Set();
        const push = (value) => {
            const prepared = normalizeLogin(value);
            if (prepared) {
                aliases.add(prepared);
            }
        };
        push(user.id);
        push(user.id?.replace(/^user-/, ''));
        if (user.fullName) {
            push(user.fullName);
            push(user.fullName.replace(/\s+/g, ''));
            const parts = user.fullName.split(/\s+/);
            if (parts.length >= 2) {
                push(`${parts[0]} ${parts[1]}`);
            }
            parts.forEach((part) => push(part));
            push(parts.map((part) => part.charAt(0)).join(''));
        }
        if (user.email) {
            push(user.email);
            push(user.email.split('@')[0]);
        }
        return aliases;
    }

    function normalizeLogin(value) {
        return value ? value.trim().toLowerCase().replace(/^@/, '') : '';
    }

    function resolveUserByLogin(login) {
        const normalized = normalizeLogin(login);
        if (!normalized) {
            return null;
        }
        return knownUsers.get(normalized) || null;
    }
});
