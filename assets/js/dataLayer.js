(function () {
    const BOARD_STORAGE_KEY = 'bukolpak_app_state_v1';
    const NOTIFICATION_STORAGE_KEY = 'bukolpak_notifications_v2';
    const NOTIFICATION_STATE_VERSION = 2;
    const CURRENT_USER_KEY = 'bukolpak_current_user_v2';

    const defaultUsers = {
        'user-me': {
            id: 'user-me',
            fullName: 'Алексей Смирнов',
            role: 'Product Designer',
            email: 'alexei.smirnov@bukolpak.ru',
            phone: '+7 (921) 555-88-20',
            language: 'ru-RU',
            timezone: 'Europe/Moscow',
            theme: 'light',
            notifications: {
                system: true,
                reminders: true,
                weekly: false
            },
            bio: 'Дизайнер цифровых продуктов. Люблю создавать понятные интерфейсы и помогаю командам быть эффективнее.',
            avatar: '',
            cover: '',
            location: 'Санкт-Петербург',
            pronouns: 'он/его'
        },
        'user-maria': {
            id: 'user-maria',
            fullName: 'Мария Плотникова',
            role: 'Project Manager',
            email: 'm.plotnikova@bukolpak.ru',
            phone: '+7 (911) 200-44-22',
            language: 'ru-RU',
            timezone: 'Europe/Moscow',
            theme: 'light',
            notifications: {
                system: true,
                reminders: true,
                weekly: true
            },
            bio: 'Управляю продуктом и помогаю команде двигаться к результату.',
            avatar: '',
            cover: '',
            location: 'Москва',
            pronouns: 'она/ее'
        },
        'user-alex': {
            id: 'user-alex',
            fullName: 'Александр Романов',
            role: 'Frontend Engineer',
            email: 'a.romanov@bukolpak.ru',
            phone: '+7 (981) 400-33-11',
            language: 'ru-RU',
            timezone: 'Europe/Moscow',
            theme: 'dark',
            notifications: {
                system: true,
                reminders: true,
                weekly: true
            },
            bio: 'Разрабатываю интерфейсы и люблю оптимизацию.',
            avatar: '',
            cover: '',
            location: 'Великий Новгород',
            pronouns: 'он/его'
        },
        'user-nikita': {
            id: 'user-nikita',
            fullName: 'Никита Бабаев',
            role: 'Head of Design',
            email: 'n.babaev@bukolpak.ru',
            phone: '+7 (921) 710-55-11',
            language: 'ru-RU',
            timezone: 'Europe/Moscow',
            theme: 'light',
            notifications: {
                system: true,
                reminders: false,
                weekly: true
            },
            bio: 'Куратор дизайн-направления Буколпака.',
            avatar: '',
            cover: '',
            location: 'Москва',
            pronouns: 'он/его'
        },
        'user-pavel': {
            id: 'user-pavel',
            fullName: 'Павел Костров',
            role: 'Motion Designer',
            email: 'p.kostrov@bukolpak.ru',
            phone: '+7 (901) 220-71-82',
            language: 'ru-RU',
            timezone: 'Europe/Moscow',
            theme: 'dark',
            notifications: {
                system: true,
                reminders: true,
                weekly: false
            },
            bio: 'Создаю анимацию и motion-ресурсы.',
            avatar: '',
            cover: '',
            location: 'Торжок',
            pronouns: 'он/его'
        }
    };

    const defaultNotifications = (userId) => {
        // Примерные уведомления для демонстрации отображаются только текущему пользователю
        if (userId !== 'user-me') {
            return [];
        }
        return [
            {
                id: uid(),
                title: 'Обновление системы',
                message: 'Платформа Буколпак обновлена до версии 2.5.1',
                createdAt: subtractMinutes(90).toISOString(),
                read: false,
                type: 'system'
            },
            {
                id: uid(),
                title: 'Комментарий',
                message: 'Мария упомянула вас в задаче «Релиз дашборда»',
                createdAt: subtractMinutes(15).toISOString(),
                read: false,
                type: 'comment',
                link: 'task.html?id=1'
            },
            {
                id: uid(),
                title: 'Напоминание',
                message: 'Срок задачи «Подготовить отчёт для руководства» завтра',
                createdAt: subtractMinutes(240).toISOString(),
                read: true,
                type: 'reminder',
                link: 'task.html?id=2'
            }
        ];
    };

    function subtractMinutes(minutes) {
        const date = new Date();
        date.setMinutes(date.getMinutes() - minutes);
        return date;
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function uid() {
        return `id-${Math.random().toString(36).slice(2, 10)}`;
    }

    function ensureState() {
        let state;
        try {
            state = JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY));
        } catch (error) {
            state = null;
        }

        if (!state || !Array.isArray(state.tasks)) {
            state = seedState();
            persistState(state);
        }

        if (typeof state.taskSequence !== 'number') {
            state.taskSequence = deriveSequence(state.tasks);
            persistState(state);
        }

        if (upgradeWorkgroupData(state)) {
            persistState(state);
        }

        return state;
    }

    function seedState() {
        const users = JSON.parse(JSON.stringify(defaultUsers));
        const tasks = createDefaultTasks(users);
        return { users, tasks, taskSequence: deriveSequence(tasks) };
    }

    function persistState(state) {
        localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(state));
    }

    function deriveSequence(tasks) {
        if (!Array.isArray(tasks) || tasks.length === 0) return 0;
        return tasks.reduce((max, task) => {
            const numericId = Number.parseInt(task.id, 10);
            return Number.isFinite(numericId) && numericId > max ? numericId : max;
        }, 0);
    }

    function getNotificationsInternal(userId = null) {
        const store = ensureNotificationState();
        const targetUser = userId || getCurrentUser()?.id;
        if (!targetUser) {
            return [];
        }
        if (!Array.isArray(store.byUser[targetUser])) {
            store.byUser[targetUser] = defaultNotifications(targetUser);
            persistNotificationState(store);
        }
        return store.byUser[targetUser].map((item) => ({ ...item }));
    }

    function setNotifications(notifications, userId = null) {
        const store = ensureNotificationState();
        const targetUser = userId || getCurrentUser()?.id;
        if (!targetUser) {
            return;
        }
        store.byUser[targetUser] = Array.isArray(notifications)
            ? notifications.map((item) => ({ ...item }))
            : [];
        persistNotificationState(store);
    }

    function getCurrentUser() {
        try {
            const stored = JSON.parse(localStorage.getItem(CURRENT_USER_KEY));
            if (stored && stored.id && defaultUsers[stored.id]) {
                return { ...defaultUsers[stored.id], ...stored };
            }
        } catch (error) {
            /* noop */
        }
        const state = ensureState();
        const fallback = state.users['user-me'];
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(fallback));
        return { ...fallback };
    }

    function updateCurrentUser(patch) {
        const state = ensureState();
        const current = getCurrentUser();
        const updated = { ...current, ...patch };
        state.users[updated.id] = { ...state.users[updated.id], ...updated };
        persistState(state);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
        return updated;
    }

    function setCurrentUserById(userId) {
        const state = ensureState();
        const user = state.users[userId];
        if (!user) {
            return null;
        }
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        return { ...user };
    }

    function setTheme(theme) {
        const current = getCurrentUser();
        if (!current) return;
        updateCurrentUser({ theme });
    }

    function getTasksSnapshot() {
        const state = ensureState();
        return JSON.parse(JSON.stringify(state.tasks));
    }

    function overwriteTasks(tasks) {
        const state = ensureState();
        state.tasks = JSON.parse(JSON.stringify(tasks));
        state.taskSequence = deriveSequence(state.tasks);
        persistState(state);
    }

    function nextTaskId() {
        const state = ensureState();
        state.taskSequence = (Number.isFinite(state.taskSequence) ? state.taskSequence : deriveSequence(state.tasks)) + 1;
        const id = String(state.taskSequence);
        persistState(state);
        return id;
    }

    function getTaskById(taskId) {
        const state = ensureState();
        return state.tasks.find((task) => task.id === taskId) || null;
    }

    function updateTask(taskId, updater) {
        const state = ensureState();
        const index = state.tasks.findIndex((task) => task.id === taskId);
        if (index === -1) return null;
        const current = state.tasks[index];
        const patched = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
        const merged = { ...current, ...patched, updatedAt: nowIso() };
        state.tasks[index] = merged;
        persistState(state);
        return { ...merged };
    }

    function pushComment(taskId, payload) {
        return updateTask(taskId, (task) => {
            const comments = Array.isArray(task.comments) ? [...task.comments] : [];
            comments.push({
                id: payload.id || uid(),
                authorId: payload.authorId,
                html: payload.html,
                createdAt: payload.createdAt || nowIso(),
                status: payload.status || 'posted'
            });
            return { ...task, comments };
        });
    }

    function replaceComment(taskId, commentId, patch) {
        return updateTask(taskId, (task) => {
            const comments = (task.comments || []).map((comment) =>
                comment.id === commentId ? { ...comment, ...patch } : comment
            );
            return { ...task, comments };
        });
    }

    function addActivity(taskId, entry) {
        return updateTask(taskId, (task) => {
            const timeline = Array.isArray(task.timeline) ? [...task.timeline] : [];
            timeline.unshift({
                id: uid(),
                createdAt: nowIso(),
                ...entry
            });
            return { ...task, timeline };
        });
    }

    function markNotificationRead(notificationId, userId = null) {
        const store = ensureNotificationState();
        const targetUser = userId || getCurrentUser()?.id;
        if (!targetUser) {
            return [];
        }
        const bucket = Array.isArray(store.byUser[targetUser]) ? store.byUser[targetUser] : [];
        store.byUser[targetUser] = bucket.map((item) =>
            item.id === notificationId ? { ...item, read: true } : item
        );
        persistNotificationState(store);
        return store.byUser[targetUser].map((item) => ({ ...item }));
    }

    function upsertNotification(notification) {
        const store = ensureNotificationState();
        const recipients = normalizeRecipients(notification.recipients);
        const defaultRecipient = recipients.length === 0 ? getCurrentUser()?.id : null;
        const targetUsers = recipients.length > 0
            ? recipients
            : defaultRecipient
                ? [defaultRecipient]
                : [];
        if (targetUsers.length === 0) {
            return getNotificationsInternal();
        }
        const { recipients: _ignored, ...payload } = notification || {};
        const preparedId = payload.id || uid();
        const preparedCreatedAt = payload.createdAt || nowIso();
        targetUsers.forEach((userId) => {
            if (!Array.isArray(store.byUser[userId])) {
                store.byUser[userId] = [];
            }
            const bucket = store.byUser[userId];
            const index = bucket.findIndex((item) => item.id === preparedId);
            const base = {
                id: preparedId,
                title: payload.title || 'Уведомление',
                message: payload.message || '',
                createdAt: preparedCreatedAt,
                type: payload.type || 'info',
                link: payload.link || null,
                data: payload.data || null
            };
            const readFlag =
                typeof payload.read === 'boolean'
                    ? payload.read
                    : index >= 0
                        ? bucket[index].read
                        : false;
            if (index >= 0) {
                bucket[index] = { ...bucket[index], ...base, read: readFlag };
            } else {
                bucket.unshift({ ...base, read: readFlag });
            }
        });
        persistNotificationState(store);
        const current = getCurrentUser()?.id;
        return current ? store.byUser[current].map((item) => ({ ...item })) : [];
    }

    function getUserById(userId) {
        const state = ensureState();
        return state.users[userId] || null;
    }

    function listUsers(userIds) {
        const state = ensureState();
        return (userIds || []).map((id) => state.users[id]).filter(Boolean);
    }

    function ensureArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function upgradeWorkgroupData(state) {
        if (!state || !Array.isArray(state.tasks)) return false;
        let changed = false;
        state.tasks = state.tasks.map((task) => {
            const { workGroupAssignments, ...rest } = task;
            const workGroup = Array.isArray(task.workGroup)
                ? task.workGroup.filter(Boolean)
                : [];
            const acceptance =
                task.workGroupAcceptance && typeof task.workGroupAcceptance === 'object'
                    ? task.workGroupAcceptance
                    : {};
            const normalizedReview = normalizeReview(
                task.review,
                task.responsibleId,
                task.authorId
            );
            const workGroupChanged = !arraysEqual(rest.workGroup || [], workGroup);
            const acceptanceChanged = acceptance !== task.workGroupAcceptance;
            const reviewChanged = !isSameReview(task.review, normalizedReview);
            if (workGroupAssignments) {
                changed = true;
            }
            if (workGroupChanged || acceptanceChanged || reviewChanged || workGroupAssignments) {
                changed = true;
                return {
                    ...rest,
                    workGroup,
                    workGroupAcceptance: acceptance,
                    review: normalizedReview
                };
            }
            if (!('review' in rest)) {
                changed = true;
                return {
                    ...rest,
                    workGroup,
                    workGroupAcceptance: acceptance,
                    review: normalizedReview
                };
            }
            return {
                ...rest,
                workGroup,
                workGroupAcceptance: acceptance,
                review: rest.review
            };
        });
        return changed;
    }

    function arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        return a.every((value, index) => value === b[index]);
    }

    function normalizeReview(review, responsibleId, authorId) {
        const fallbackReviewer = authorId || responsibleId || null;
        if (!review || typeof review !== 'object') {
            return {
                status: 'idle',
                requestedBy: null,
                requestedAt: null,
                reviewerId: fallbackReviewer,
                approvedBy: null,
                approvedAt: null
            };
        }
        const allowed = new Set(['idle', 'pending', 'approved']);
        const status = allowed.has(review.status) ? review.status : 'idle';
        const reviewerId = status === 'approved'
            ? review.approvedBy || review.reviewerId || fallbackReviewer
            : fallbackReviewer;
        return {
            status,
            requestedBy: review.requestedBy || null,
            requestedAt: review.requestedAt || null,
            reviewerId,
            approvedBy: review.approvedBy || null,
            approvedAt: review.approvedAt || null
        };
    }

    function isSameReview(current, next) {
        if (!current || typeof current !== 'object') {
            return next.status === 'idle' && !next.requestedBy && !next.requestedAt && !next.approvedBy && !next.approvedAt;
        }
        return (
            current.status === next.status &&
            (current.requestedBy || null) === next.requestedBy &&
            (current.requestedAt || null) === next.requestedAt &&
            (current.reviewerId || null) === next.reviewerId &&
            (current.approvedBy || null) === next.approvedBy &&
            (current.approvedAt || null) === next.approvedAt
        );
    }

    function createDefaultTasks(users) {
        const now = nowIso();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        return [
            {
                id: '1',
                authorId: 'user-nikita',
                author: users['user-nikita'].fullName,
                type: 'work',
                project: 'ЦРМК Буколпак',
                subject: 'Релиз обновлённого дашборда по проектам',
                desc: 'Собрать финальный релиз, проверить метрики, подготовить презентацию для руководства.',
                status: 'progress',
                privacy: 'public',
                pri: 'high',
                due: formatDateISO(tomorrow),
                dueTime: '18:00',
                hours: 10,
                assigneeId: 'user-alex',
                assignee: users['user-alex'].fullName,
                responsibleId: 'user-alex',
                responsible: users['user-alex'].fullName,
                group: ['user-me', 'user-maria'],
                participants: ['user-nikita', 'user-maria', 'user-me', 'user-alex'],
                workGroup: ['user-me', 'user-maria'],
                workGroupAcceptance: {
                    'user-me': { acceptedAt: subtractMinutes(220).toISOString() }
                },
                review: normalizeReview(null, 'user-alex', 'user-nikita'),
                createdAt: now,
                updatedAt: now,
                comments: [
                    {
                        id: uid(),
                        authorId: 'user-maria',
                        html: '<p>Вынесла блок метрик выше, проверьте, пожалуйста.</p>',
                        createdAt: subtractMinutes(180).toISOString(),
                        status: 'posted'
                    }
                ],
                timeline: [
                    {
                        id: uid(),
                        createdAt: subtractMinutes(220).toISOString(),
                        type: 'status-change',
                        text: 'Статус обновлён на «В работе»',
                        actorId: 'user-maria'
                    },
                    {
                        id: uid(),
                        createdAt: subtractMinutes(300).toISOString(),
                        type: 'assignment',
                        text: `${users['user-alex'].fullName} назначен ответственным`,
                        actorId: 'user-nikita'
                    }
                ]
            },
            {
                id: '2',
                authorId: 'user-me',
                author: users['user-me'].fullName,
                type: 'work',
                project: 'Киноклуб «Кадр»',
                subject: 'Подготовить отчёт для руководства',
                desc: 'Собрать данные за последний квартал, обновить диаграммы и подготовить выводы.',
                status: 'new',
                privacy: 'public',
                pri: 'medium',
                due: formatDateISO(tomorrow),
                dueTime: '12:00',
                hours: 6,
                assigneeId: 'user-me',
                assignee: users['user-me'].fullName,
                responsibleId: 'user-me',
                responsible: users['user-me'].fullName,
                group: ['user-maria'],
                participants: ['user-me', 'user-maria'],
                workGroup: ['user-me', 'user-maria'],
                workGroupAcceptance: {
                    'user-me': { acceptedAt: subtractMinutes(30).toISOString() }
                },
                review: normalizeReview(null, 'user-me', 'user-me'),
                createdAt: now,
                updatedAt: now,
                comments: [],
                timeline: [
                    {
                        id: uid(),
                        createdAt: now,
                        type: 'creation',
                        text: 'Задача создана',
                        actorId: 'user-me'
                    }
                ]
            },
            {
                id: '3',
                authorId: 'user-nikita',
                author: users['user-nikita'].fullName,
                type: 'work',
                project: 'Турпроект «Цифровой Торжокъ»',
                subject: 'Обновить бренд-пакет и подготовить 3D-рендеры',
                desc: 'Нужны 3D-рендеры новых тур-точек и обновлённые гайды по тону коммуникации.',
                status: 'progress',
                privacy: 'public',
                pri: 'high',
                due: formatDateISO(yesterday),
                dueTime: '10:00',
                hours: 14,
                assigneeId: 'user-pavel',
                assignee: users['user-pavel'].fullName,
                responsibleId: 'user-pavel',
                responsible: users['user-pavel'].fullName,
                group: ['user-me', 'user-maria'],
                participants: ['user-nikita', 'user-me', 'user-pavel'],
                workGroup: ['user-me', 'user-pavel'],
                workGroupAcceptance: {
                    'user-pavel': { acceptedAt: subtractMinutes(420).toISOString() }
                },
                review: normalizeReview(null, 'user-pavel', 'user-nikita'),
                createdAt: subtractMinutes(1440).toISOString(),
                updatedAt: subtractMinutes(45).toISOString(),
                comments: [
                    {
                        id: uid(),
                        authorId: 'user-pavel',
                        html: '<p>Обновил шапку гайдов, посмотрите на страницу 4.</p>',
                        createdAt: subtractMinutes(60).toISOString(),
                        status: 'posted'
                    }
                ],
                timeline: [
                    {
                        id: uid(),
                        createdAt: subtractMinutes(420).toISOString(),
                        type: 'status-change',
                        text: 'Статус обновлён на «В работе»',
                        actorId: 'user-pavel'
                    },
                    {
                        id: uid(),
                        createdAt: subtractMinutes(1380).toISOString(),
                        type: 'assignment',
                        text: `${users['user-pavel'].fullName} назначен ответственным`,
                        actorId: 'user-nikita'
                    }
                ]
            },
            {
                id: '4',
                authorId: 'user-maria',
                author: users['user-maria'].fullName,
                type: 'work',
                project: 'Проект «Колпачки»',
                subject: 'Подготовить закрытую презентацию для партнёров',
                desc: 'Собрать результаты пилота, оформить выводы и подготовить предложения по развитию.',
                status: 'progress',
                privacy: 'private',
                pri: 'medium',
                due: formatDateISO(tomorrow),
                dueTime: '16:00',
                hours: 8,
                assigneeId: 'user-alex',
                assignee: users['user-alex'].fullName,
                responsibleId: 'user-alex',
                responsible: users['user-alex'].fullName,
                group: ['user-maria', 'user-alex'],
                participants: ['user-maria', 'user-alex'],
                workGroup: ['user-maria', 'user-alex'],
                workGroupAcceptance: {
                    'user-alex': { acceptedAt: subtractMinutes(120).toISOString() }
                },
                review: normalizeReview(null, 'user-alex', 'user-maria'),
                createdAt: subtractMinutes(360).toISOString(),
                updatedAt: subtractMinutes(60).toISOString(),
                comments: [
                    {
                        id: uid(),
                        authorId: 'user-maria',
                        html: '<p>Собрала статистику по воронке, проверь, пожалуйста.</p>',
                        createdAt: subtractMinutes(90).toISOString(),
                        status: 'posted'
                    }
                ],
                timeline: [
                    {
                        id: uid(),
                        createdAt: subtractMinutes(300).toISOString(),
                        type: 'status-change',
                        text: 'Статус обновлён на «В работе»',
                        actorId: 'user-alex'
                    },
                    {
                        id: uid(),
                        createdAt: subtractMinutes(340).toISOString(),
                        type: 'assignment',
                        text: `${users['user-alex'].fullName} назначен ответственным`,
                        actorId: 'user-maria'
                    }
                ]
            }
        ];
    }

    function formatDateISO(date) {
        return date.toISOString().slice(0, 10);
    }

    function getOverdueTasks(userId) {
        const tasks = getTasksSnapshot();
        const today = new Date();
        return tasks.filter((task) => {
            if (task.status === 'done' || !task.due) return false;
            const dueDate = new Date(`${task.due}T${task.dueTime || '23:59'}`);
            const isOverdue = dueDate.getTime() < today.getTime();
            if (!userId) return isOverdue;
            const workGroup = new Set(ensureArray(task.workGroup));
            return isOverdue && (workGroup.has(userId) || task.responsibleId === userId);
        });
    }

    function buildPublicApi() {
        return {
            BOARD_STORAGE_KEY,
            NOTIFICATION_STORAGE_KEY,
            CURRENT_USER_KEY,
            getCurrentUser,
            updateCurrentUser,
            setTheme,
            getUsers: () => {
                const state = ensureState();
                return { ...state.users };
            },
            getUserById,
            listUsers,
            getTasks: getTasksSnapshot,
            setTasks: overwriteTasks,
            getTaskById,
            updateTask,
            pushComment,
            replaceComment,
            addActivity,
            nextTaskId,
            getNotifications: getNotificationsInternal,
            setNotifications,
            markNotificationRead,
            upsertNotification,
            getOverdueTasks,
            setCurrentUserById,
            uid,
            nowIso
        };
    }

    function ensureNotificationState() {
        const boardState = ensureState();
        const users = boardState?.users || {};
        let stored;
        try {
            stored = JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY));
        } catch (error) {
            stored = null;
        }
        if (Array.isArray(stored)) {
            const upgraded = upgradeLegacyNotifications(stored, users);
            persistNotificationState(upgraded);
            return upgraded;
        }
        if (!stored || typeof stored !== 'object') {
            const seeded = seedNotificationStore(users);
            persistNotificationState(seeded);
            return seeded;
        }
        const normalized = normalizeNotificationStore(stored, users);
        if (normalized !== stored) {
            persistNotificationState(normalized);
            return normalized;
        }
        return normalized;
    }

    function seedNotificationStore(users) {
        const byUser = {};
        Object.keys(users || {}).forEach((userId) => {
            byUser[userId] = defaultNotifications(userId).map((item) => ({ ...item }));
        });
        return { version: NOTIFICATION_STATE_VERSION, byUser };
    }

    function upgradeLegacyNotifications(legacy, users) {
        const store = seedNotificationStore(users);
        const current = getCurrentUser();
        const targetUser = current?.id && users?.[current.id] ? current.id : 'user-me';
        store.byUser[targetUser] = legacy.map((item) => ({ ...item, read: Boolean(item.read) }));
        return store;
    }

    function normalizeNotificationStore(store, users) {
        const next = {
            version: store.version === NOTIFICATION_STATE_VERSION
                ? store.version
                : NOTIFICATION_STATE_VERSION,
            byUser: { ...store.byUser }
        };
        Object.keys(users || {}).forEach((userId) => {
            if (!Array.isArray(next.byUser[userId])) {
                next.byUser[userId] = defaultNotifications(userId).map((item) => ({ ...item }));
            }
        });
        Object.keys(next.byUser).forEach((userId) => {
            if (!users[userId]) {
                delete next.byUser[userId];
            }
        });
        next.version = NOTIFICATION_STATE_VERSION;
        return next;
    }

    function persistNotificationState(store) {
        localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(store));
    }

    function normalizeRecipients(recipients) {
        if (!recipients) {
            return [];
        }
        const list = Array.isArray(recipients) ? recipients : [recipients];
        return Array.from(
            new Set(
                list
                    .map((value) => (typeof value === 'string' ? value.trim() : ''))
                    .filter(Boolean)
            )
        );
    }

    window.bukolpak = window.bukolpak || {};
    window.bukolpak.data = buildPublicApi();
})();
