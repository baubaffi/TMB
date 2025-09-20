const data = window.bukolpak?.data ?? null;
const ui = window.bukolpak?.ui ?? null;

const params = new URLSearchParams(window.location.search);
const taskId = params.get('id');
const isReady = Boolean(data && ui);

const selectors = {
    title: document.getElementById('task-title'),
    identifier: document.getElementById('task-identifier'),
    project: document.getElementById('task-project'),
    status: document.getElementById('task-status'),
    priority: document.getElementById('task-priority'),
    due: document.getElementById('task-due'),
    chips: document.querySelector('.task-card__chips'),
    author: document.getElementById('task-author'),
    responsible: document.getElementById('task-responsible'),
    participants: document.getElementById('task-participants'),
    workgroup: document.getElementById('task-workgroup'),
    workAcceptance: document.getElementById('task-work-acceptance'),
    workAcceptanceRow: document.getElementById('task-work-acceptance-row'),
    created: document.getElementById('task-created'),
    updated: document.getElementById('task-updated'),
    summary: document.getElementById('task-summary'),
    description: document.getElementById('task-description'),
    timeline: document.getElementById('timeline-list'),
    commentsList: document.getElementById('comments-list'),
    commentForm: document.getElementById('comment-form'),
    commentEditor: document.getElementById('comment-editor'),
    commentPermission: document.getElementById('comment-permission'),
    takeButton: document.getElementById('take-button'),
    completeButton: document.getElementById('complete-button'),
    reviewButton: document.getElementById('review-button'),
    approveButton: document.getElementById('approve-button'),
    editButton: document.getElementById('edit-button'),
    reassignButton: document.getElementById('reassign-button'),
    snoozeButton: document.getElementById('snooze-button'),
    overdueBanner: document.getElementById('overdue-banner'),
    overdueText: document.getElementById('overdue-banner-text'),
    overdueAction: document.getElementById('overdue-banner-action'),
    editDialog: document.getElementById('edit-dialog'),
    editForm: document.getElementById('edit-form'),
    editFormErrors: document.getElementById('edit-form-errors'),
    editType: document.getElementById('edit-type'),
    editProject: document.getElementById('edit-project'),
    editPrivacy: document.getElementById('edit-privacy'),
    editDirection: document.getElementById('edit-direction'),
    editAssigneeDirectory: document.getElementById('edit-assignee-dir'),
    editResponsible: document.getElementById('edit-responsible'),
    editGroup: document.getElementById('edit-group'),
    editPrioritySegment: document.getElementById('edit-pri-seg'),
    editHours: document.getElementById('edit-hours'),
    editDueDate: document.getElementById('edit-due-date'),
    editDueTime: document.getElementById('edit-due-time'),
    editSubject: document.getElementById('edit-subject'),
    editDesc: document.getElementById('edit-desc'),
    editFile: document.getElementById('edit-file')
};

const editFormErrorMap = {
    'edit-project': 'edit-project-error',
    'edit-responsible': 'edit-responsible-error',
    'edit-hours': 'edit-hours-error',
    'edit-subject': 'edit-subject-error',
    'edit-desc': 'edit-desc-error'
};

const state = {
    task: null,
    currentUser: data?.getCurrentUser ? data.getCurrentUser() : null,
    initialTaskSnapshot: null,
    initialOverdue: false,
    restricted: false
};

let editPriorityButtons = [];
let editFileData = null;
let editFileName = null;

// Управляем блокировкой прокрутки страницы при открытии окна редактирования
function setEditDialogScrollLock(isLocked) {
    if (isLocked) {
        document.body.classList.add('is-edit-dialog-open');
    } else {
        document.body.classList.remove('is-edit-dialog-open');
    }
}

function ensureDialogControls(dialog) {
    if (!dialog) return null;
    if (!dialog.dataset.controlsBound) {
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            dialog.close('cancel');
        });
        dialog.querySelectorAll('[data-dialog-cancel]').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                dialog.close('cancel');
            });
        });
        dialog.addEventListener('close', () => {
            const form = dialog.querySelector('form');
            if (form && typeof form.reset === 'function') {
                form.reset();
            }
            if (dialog === selectors.editDialog) {
                setEditDialogScrollLock(false);
                clearEditErrors();
                setEditPriority('medium', { suggestDue: false });
                editFileData = null;
                editFileName = null;
                if (selectors.editFile) selectors.editFile.value = '';
            }
        });
        dialog.dataset.controlsBound = 'true';
    }
    return dialog;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!isReady) {
        showError('Системный модуль недоступен. Попробуйте обновить страницу позднее.');
        return;
    }

    initShell();

    if (!taskId) {
        showError('Не удалось определить идентификатор задачи.');
        renderOverdueBanner();
        return;
    }

    loadTask();
    bindActions();
});

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

function loadTask() {
    state.currentUser = data.getCurrentUser();
    const task = data.getTaskById(taskId);
    if (!task) {
        showError('Задача не найдена или была удалена.');
        renderOverdueBanner();
        return;
    }
    
    // Проверяем доступ пользователя к задаче
    const hasAccess = canUserAccessTask(task, state.currentUser?.id);
    state.restricted = !hasAccess;
    
    if (!hasAccess) {
        state.initialTaskSnapshot = null;
        state.initialOverdue = false;
        renderRestrictedTask(task);
        renderOverdueBanner();
        return;
    }
    
    // Если есть доступ, рендерим полную задачу
    state.task = task;
    if (state.initialTaskSnapshot?.id !== task.id) {
        state.initialTaskSnapshot = null;
        state.initialOverdue = false;
    }
    renderTask(task);
    renderOverdueBanner();
}

function renderTask(task) {
    // Убираем карточку ограниченного доступа если она есть
    document.getElementById('task-restricted-card')?.remove();
    
    // Показываем все элементы интерфейса
    const actions = document.querySelector('.task-card__actions');
    actions?.removeAttribute('hidden');
    actions?.setAttribute('aria-hidden', 'false');
    
    if (selectors.chips) {
        selectors.chips.removeAttribute('hidden');
        selectors.chips.setAttribute('aria-hidden', 'false');
    }
    
    const layout = document.querySelector('.task-layout');
    layout?.removeAttribute('hidden');
    layout?.setAttribute('aria-hidden', 'false');
    
    const commentsSection = document.querySelector('.task-comments');
    commentsSection?.removeAttribute('hidden');
    commentsSection?.setAttribute('aria-hidden', 'false');
    
    if (selectors.commentForm) {
        selectors.commentForm.removeAttribute('hidden');
        selectors.commentForm.setAttribute('aria-hidden', 'false');
    }
    
    if (selectors.commentEditor) {
        selectors.commentEditor.removeAttribute('disabled');
    }

    const identifier = formatTaskNumber(task.id);
    if (selectors.identifier) {
        selectors.identifier.textContent = identifier;
        selectors.identifier.hidden = !identifier;
    }
    
    selectors.title.textContent = task.subject;
    selectors.project.textContent = task.project || '';
    selectors.status.textContent = mapStatus(task.status);
    selectors.status.dataset.status = task.status;
    
    const priorityText = mapPriority(task.pri);
    const formattedPriority = priorityText
        ? `${priorityText.slice(0, 1).toUpperCase()}${priorityText.slice(1)}`
        : '—';
    selectors.priority.textContent = `Приоритет: ${formattedPriority}`;
    selectors.priority.dataset.priority = task.pri || '';
    
    const dueInfo = formatDue(task);
    if (!state.initialTaskSnapshot || state.initialTaskSnapshot.id !== task.id) {
        state.initialTaskSnapshot = {
            id: task.id,
            due: task.due,
            dueTime: task.dueTime,
            status: task.status
        };
        state.initialOverdue = dueInfo.overdue;
    }
    
    const hasStateChange = state.initialTaskSnapshot
        ? task.due !== state.initialTaskSnapshot.due ||
          task.dueTime !== state.initialTaskSnapshot.dueTime ||
          task.status !== state.initialTaskSnapshot.status
        : false;
    
    const shouldPersistOverdue = state.initialOverdue && !hasStateChange;
    const displayOverdue = dueInfo.overdue || shouldPersistOverdue;
    selectors.due.textContent = displayOverdue
        ? `${dueInfo.label}${dueInfo.label ? ' · просрочено' : 'Просрочено'}`
        : dueInfo.label || 'Без срока';
    selectors.due.classList.toggle('is-overdue', displayOverdue);
    selectors.due.dataset.overdue = displayOverdue;
    
    if (hasStateChange) {
        state.initialTaskSnapshot = {
            id: task.id,
            due: task.due,
            dueTime: task.dueTime,
            status: task.status
        };
        state.initialOverdue = dueInfo.overdue;
    }

    selectors.author.textContent = resolveUser(task.authorId);
    const responsibleName = resolveUser(task.responsibleId);
    selectors.responsible.textContent = responsibleName;
    selectors.responsible.classList.toggle('is-empty', !task.responsibleId);
    renderMemberList(selectors.participants, task, task.participants, { scope: 'participants' });
    renderMemberList(selectors.workgroup, task, task.workGroup, { scope: 'workgroup' });
    renderWorkAcceptance(task);
    selectors.created.textContent = formatDateTime(task.createdAt);
    selectors.updated.textContent = formatRelativeOrDate(task.updatedAt);
    
    if (selectors.summary) {
        const reviewInfo = getReviewInfo(task);
        const base = `Обновлено: ${formatRelativeOrDate(task.updatedAt)}`;
        if (reviewInfo.status === 'pending') {
            const reviewerName = resolveUserName(reviewInfo.reviewerId, 'автора задачи');
            selectors.summary.textContent = `На проверке у ${reviewerName} · ${base}`;
        } else {
            selectors.summary.textContent = base;
        }
    }

    selectors.description.innerHTML = task.desc
        ? `<p>${escapeHtml(task.desc).replace(/\n/g, '<br>')}</p>`
        : '<p class="text-muted">Описание отсутствует</p>';

    renderTimeline(task);
    renderComments(task);
    updateCommentPermission(task);
    updateActionStates(task);
    document.title = `${identifier} · ${task.subject}`;
}

function renderRestrictedTask(task) {
    // Полностью заменяем содержимое основной карточки задачи
    const taskCard = document.getElementById('task-header');
    if (taskCard) {
        const identifier = formatTaskNumber(task.id);
        const priorityText = mapPriority(task.pri);
        const formattedPriority = priorityText
            ? `${priorityText.slice(0, 1).toUpperCase()}${priorityText.slice(1)}`
            : '—';
        
        const authorName = resolveUser(task.authorId) || task.author || '—';
        
        taskCard.innerHTML = `
            <a class="task-card__back" href="main.html">
                <svg aria-hidden="true" focusable="false"><use href="assets/img/system-icons.svg#icon-arrow-right"></use></svg>
                <span>К списку задач</span>
            </a>
            <span class="task-card__identifier">${identifier}</span>
            <h1 class="task-card__title">Доступ к задаче ограничен</h1>
            
            <div class="task-restricted">
                <div class="task-restricted__icon" aria-hidden="true">
                    <i class="fas fa-lock"></i>
                </div>
                <div class="task-restricted__chips" role="list">
                    <span class="task-restricted__chip" role="listitem">Приватная задача</span>
                </div>
                <p class="task-restricted__message">
                    У вас недостаточно прав для просмотра этой задачи. Обратитесь к автору задачи,
                    чтобы вас добавили в рабочую группу.
                </p>
                <dl class="task-restricted__meta">
                    <div>
                        <dt>Автор</dt>
                        <dd>${escapeHtml(authorName)}</dd>
                    </div>
                    <div>
                        <dt>Создана</dt>
                        <dd>${escapeHtml(formatDateTime(task.createdAt))}</dd>
                    </div>
                    <div>
                        <dt>Приоритет</dt>
                        <dd>${escapeHtml(formattedPriority)}</dd>
                    </div>
                </dl>
            </div>
        `;
    }

    // Скрываем все остальные элементы
    const elementsToHide = [
        '.task-card__actions',
        '.task-card__chips',
        '.task-layout',
        '.task-comments',
        '#overdue-banner'
    ];
    
    elementsToHide.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.setAttribute('hidden', 'true');
            element.setAttribute('aria-hidden', 'true');
        }
    });

    document.title = 'Доступ ограничен · Буколпак';
}

function renderTimeline(task) {
    selectors.timeline.innerHTML = '';
    const events = Array.isArray(task.timeline) ? task.timeline : [];
    if (events.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'inline-alert';
        empty.dataset.variant = 'info';
        empty.innerHTML = `${icon('icon-info')} <span>Пока нет активности.</span>`;
        selectors.timeline.appendChild(empty);
        return;
    }
    events.forEach((entry) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="timeline__dot"></span>
            <div class="timeline__content">
                <div class="timeline__meta">${formatRelativeOrDate(entry.createdAt)} · ${resolveUser(entry.actorId)}</div>
                <div>${escapeHtml(entry.text)}</div>
            </div>
        `;
        selectors.timeline.appendChild(li);
    });
}

function renderComments(task) {
    selectors.commentsList.innerHTML = '';
    const comments = Array.isArray(task.comments) ? task.comments : [];
    if (comments.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'inline-alert';
        empty.dataset.variant = 'info';
        empty.innerHTML = `${icon('icon-chat')} <span>Комментариев пока нет.</span>`;
        selectors.commentsList.appendChild(empty);
        return;
    }

    comments
        .slice()
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .forEach((comment) => {
            const user = data.getUserById(comment.authorId) || { fullName: 'Участник' };
            const wrapper = document.createElement('article');
            wrapper.className = 'comment';
            wrapper.dataset.status = comment.status || 'posted';
            const safeHtml = sanitizeCommentHtml(comment.html);
            wrapper.innerHTML = `
                <div class="comment__avatar">${(user.fullName || '—').slice(0, 1)}</div>
                <div class="comment__body">
                    <div class="comment__meta">
                        <strong>${escapeHtml(user.fullName)}</strong>
                        <span>${formatRelativeOrDate(comment.createdAt)}</span>
                        ${comment.status === 'pending' ? '<span>Отправляется…</span>' : ''}
                        ${comment.status === 'failed' ? '<span>Ошибка отправки</span>' : ''}
                    </div>
                    <div class="comment__content">${safeHtml}</div>
                </div>
            `;
            if (comment.status === 'failed') {
                const retry = document.createElement('button');
                retry.type = 'button';
                retry.className = 'comment__retry';
                retry.textContent = 'Повторить отправку';
                retry.addEventListener('click', () => retryComment(comment.id));
                wrapper.querySelector('.comment__body').appendChild(retry);
            }
            selectors.commentsList.appendChild(wrapper);
        });
}

function renderMemberList(container, task, memberIds, options = {}) {
    if (!container) return;
    const scope = options.scope || 'participants';
    const ids = Array.isArray(memberIds) ? Array.from(new Set(memberIds.filter(Boolean))) : [];
    if (ids.length === 0) {
        container.textContent = '—';
        container.classList.add('is-empty');
        return;
    }
    container.textContent = '';
    container.classList.remove('is-empty');
    const list = document.createElement('ul');
    list.className = 'task-member-list';
    ids
        .map((id) => data.getUserById(id) || { id, fullName: 'Участник' })
        .sort((a, b) => (a.fullName || '—').localeCompare(b.fullName || '—', 'ru'))
        .forEach((member) => {
            const item = document.createElement('li');
            item.className = 'task-member';
            const avatar = document.createElement('span');
            avatar.className = 'task-member__avatar';
            avatar.textContent = (member.fullName || '—').slice(0, 1).toUpperCase();
            const name = document.createElement('span');
            name.className = 'task-member__name';
            name.textContent = member.fullName || '—';
            item.appendChild(avatar);
            item.appendChild(name);
            const mode = determineMemberRemovalMode(task, member.id, scope);
            if (mode) {
                const action = document.createElement('button');
                action.type = 'button';
                action.className = 'task-member__action';
                if (mode === 'remove') {
                    action.dataset.variant = 'danger';
                    action.textContent = 'Исключить';
                    action.title = 'Удалить участника из задачи';
                } else {
                    action.textContent = 'Выйти из задачи';
                    action.title = 'Вы покидаете рабочую группу';
                }
                action.addEventListener('click', () => handleMemberRemoval(member.id, scope, mode));
                item.appendChild(action);
            }
            list.appendChild(item);
        });
    container.appendChild(list);
}

function determineMemberRemovalMode(task, memberId, scope = 'participants') {
    if (!state.currentUser || !task || !memberId) return null;
    if (memberId === task.authorId) return null;
    const actorId = state.currentUser.id;
    const isActorAuthor = actorId === task.authorId;
    const isActorResponsible = actorId === task.responsibleId;
    const isSelf = actorId === memberId;
    const isWorkgroupScope = scope === 'workgroup';

    if (isActorAuthor) {
        if (isSelf) return null;
        return 'remove';
    }

    if (isActorResponsible) {
        if (isSelf && isWorkgroupScope) {
            return 'self';
        }
        if (!isSelf) {
            return 'remove';
        }
        return null;
    }

    if (isWorkgroupScope && isSelf) {
        return 'self';
    }

    return null;
}

function handleMemberRemoval(memberId, scope, mode) {
    if (!state.task || !state.currentUser) return;
    const task = state.task;
    const allowedMode = determineMemberRemovalMode(task, memberId, scope);
    if (!allowedMode || allowedMode !== mode) {
        ui.showToast({
            title: 'Недостаточно прав',
            message: 'Вы не можете изменить состав задачи.',
            type: 'error'
        });
        return;
    }

    const actor = state.currentUser;
    const user = data.getUserById(memberId) || { id: memberId, fullName: 'Участник' };
    const fallbackReviewer = task.authorId || (task.responsibleId === memberId ? null : task.responsibleId) || null;
    let reassignedToAuthor = false;
    let reassignedUser = null;
    const updated = data.updateTask(task.id, (current) => {
        const unique = (list) => Array.from(new Set((Array.isArray(list) ? list : []).filter((id) => id !== memberId)));
        const participants = unique(current.participants);
        const workGroup = unique(current.workGroup);
        const group = unique(current.group);
        const acceptance = { ...(current.workGroupAcceptance || {}) };
        if (acceptance[memberId]) delete acceptance[memberId];

        const nextReview = { ...getReviewInfo(current) };
        if (current.responsibleId === memberId) {
            nextReview.status = 'idle';
            nextReview.requestedBy = null;
            nextReview.requestedAt = null;
            nextReview.reviewerId = fallbackReviewer || current.authorId || null;
            nextReview.approvedBy = null;
            nextReview.approvedAt = null;
        }

        const next = {
            ...current,
            participants,
            workGroup,
            group,
            workGroupAcceptance: acceptance,
            review: nextReview
        };

        if (current.responsibleId === memberId) {
            next.responsibleId = null;
            next.responsible = '';
            if (current.assigneeId === memberId) {
                next.assigneeId = null;
                next.assignee = '';
            }
            if (current.status === 'review') {
                next.status = 'progress';
            }
            if (actor.id === current.authorId && current.authorId) {
                const author = data.getUserById(current.authorId) || {
                    id: current.authorId,
                    fullName: resolveUser(current.authorId)
                };
                next.responsibleId = current.authorId;
                next.responsible = author.fullName || author.id;
                next.assigneeId = current.authorId;
                next.assignee = author.fullName || author.id;
                if (!workGroup.includes(current.authorId)) workGroup.push(current.authorId);
                if (!group.includes(current.authorId)) group.push(current.authorId);
                if (!participants.includes(current.authorId)) participants.push(current.authorId);
                next.workGroupAcceptance = {};
                next.review = {
                    status: 'idle',
                    requestedBy: null,
                    requestedAt: null,
                    reviewerId: current.authorId,
                    approvedBy: null,
                    approvedAt: null
                };
                reassignedToAuthor = true;
                reassignedUser = author;
            }
        } else if (current.assigneeId === memberId) {
            next.assigneeId = null;
            next.assignee = '';
        }

        return next;
    });

    if (!updated) {
        ui.showToast({
            title: 'Ошибка обновления',
            message: 'Не удалось изменить состав задачи.',
            type: 'error'
        });
        return;
    }

    const text = mode === 'self'
        ? `${actor.fullName} вышел(а) из задачи`
        : `${actor.fullName} исключил(а) ${user.fullName} из задачи`;
    data.addActivity(task.id, {
        type: 'membership-update',
        text,
        actorId: actor.id
    });

    if (reassignedToAuthor && reassignedUser) {
        data.addActivity(task.id, {
            type: 'assignment',
            text: `${reassignedUser.fullName} автоматически назначен(а) ответственным за задачу`,
            actorId: actor.id
        });
        notifyTaskParticipants(updated, {
            title: 'Ответственный обновлён',
            message: `${reassignedUser.fullName} теперь отвечает за задачу «${task.subject}».`,
            link: `task.html?id=${task.id}`,
            type: 'task'
        });
    }

    ui.showToast({
        title: mode === 'self' ? 'Вы покинули задачу' : 'Участник удалён',
        message: (mode === 'self'
            ? 'Вы больше не состоите в рабочей группе.'
            : `${user.fullName} исключён(а) из задачи.`) + (reassignedToAuthor ? ' Ответственный автоматически переназначен на автора.' : ''),
        type: 'info'
    });
    ui.refreshNotificationBell?.();
    loadTask();
}

function getWorkGroupMembers(task) {
    if (!task) return [];
    const members = Array.isArray(task.workGroup) ? task.workGroup.filter(Boolean) : [];
    return Array.from(new Set(members));
}

function canCurrentUserSeeAcceptance(task) {
    if (!state.currentUser || !task) return false;
    const id = state.currentUser.id;
    return task.authorId === id || task.responsibleId === id;
}

function renderWorkAcceptance(task) {
    if (!selectors.workAcceptance || !selectors.workAcceptanceRow) return;
    const canSee = canCurrentUserSeeAcceptance(task);
    selectors.workAcceptanceRow.hidden = !canSee;
    selectors.workAcceptanceRow.setAttribute('aria-hidden', (!canSee).toString());
    if (!canSee) {
        selectors.workAcceptance.textContent = '—';
        selectors.workAcceptance.classList.add('is-empty');
        return;
    }
    const members = getWorkGroupMembers(task).filter((id) => id !== task.authorId);
    if (members.length === 0) {
        selectors.workAcceptance.textContent = '—';
        selectors.workAcceptance.classList.add('is-empty');
        return;
    }
    const acceptance = task.workGroupAcceptance || {};
    const entries = members
        .map((id) => {
            const user = data.getUserById(id) || { fullName: 'Участник' };
            return {
                id,
                name: user.fullName || 'Участник',
                accepted: acceptance[id] || null
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    selectors.workAcceptance.innerHTML = '';
    const list = document.createElement('ul');
    list.className = 'task-work-list';
    entries.forEach((entry) => {
        const item = document.createElement('li');
        item.className = 'task-work-list__item';
        const name = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = entry.name;
        name.appendChild(strong);
        item.appendChild(name);
        const status = document.createElement('div');
        status.className = 'task-work-list__status';
        const acceptanceInfo = describeAcceptanceEntry(entry.accepted);
        status.dataset.state = acceptanceInfo.state;
        status.textContent = acceptanceInfo.text;
        if (acceptanceInfo.title) {
            status.title = acceptanceInfo.title;
        } else {
            status.removeAttribute('title');
        }
        item.appendChild(status);
        list.appendChild(item);
    });
    selectors.workAcceptance.appendChild(list);
    selectors.workAcceptance.classList.remove('is-empty');
}

function describeAcceptanceEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return {
            state: 'pending',
            text: 'Ожидает подтверждения',
            title: ''
        };
    }
    if (isAcceptanceSnoozed(entry)) {
        const { date, time } = resolveSnoozeParts(entry);
        const formatted = formatDateHuman(date, time);
        const text = formatted ? `Отложено до ${formatted}` : 'Отложено';
        const title = entry.snoozedReason ? `Причина: ${entry.snoozedReason}` : '';
        return {
            state: 'snoozed',
            text,
            title
        };
    }
    if (isAcceptanceAccepted(entry)) {
        return {
            state: 'accepted',
            text: `Принято ${formatRelativeOrDate(entry.acceptedAt)}`,
            title: ''
        };
    }
    return {
        state: 'pending',
        text: 'Ожидает подтверждения',
        title: ''
    };
}

function isAcceptanceAccepted(entry) {
    return Boolean(entry && entry.acceptedAt);
}

function isAcceptanceSnoozed(entry) {
    return Boolean(entry && entry.snoozedUntil);
}

function resolveSnoozeParts(entry) {
    if (!entry || typeof entry !== 'object') {
        return { date: '', time: '' };
    }
    if (entry.snoozedUntilDate) {
        return { date: entry.snoozedUntilDate, time: entry.snoozedUntilTime || '' };
    }
    if (entry.snoozedUntil) {
        const parsed = new Date(entry.snoozedUntil);
        if (!Number.isNaN(parsed.getTime())) {
            const iso = parsed.toISOString();
            return {
                date: iso.slice(0, 10),
                time: iso.slice(11, 16)
            };
        }
    }
    return { date: '', time: '' };
}

function setActionVisibility(button, visible) {
    if (!button) return;
    button.hidden = !visible;
    button.setAttribute('aria-hidden', (!visible).toString());
    button.style.display = visible ? '' : 'none';
}

function areCommentsClosed(task) {
    return Boolean(task && task.status === 'done');
}

function updateCommentPermission(task) {
    const closed = areCommentsClosed(task);
    const canComment = !closed && canCurrentUserComment(task);
    if (selectors.commentPermission) {
        selectors.commentPermission.textContent = closed
            ? 'Комментарии закрыты после завершения задачи'
            : canComment
                ? 'Вы можете оставлять комментарии'
                : 'Комментирование доступно автору, ответственному и рабочей группе';
        selectors.commentPermission.classList.toggle('chip--muted', !canComment || closed);
    }
    if (selectors.commentForm) {
        selectors.commentForm.setAttribute('aria-hidden', (!canComment).toString());
        selectors.commentForm.style.display = canComment ? 'flex' : 'none';
    }
}

function updateActionStates(task) {
    const reviewInfo = getReviewInfo(task);
    const reviewPending = reviewInfo.status === 'pending';
    const reviewApproved = reviewInfo.status === 'approved';
    const isAuthor = isCurrentUserTaskAuthor(task);
    const isResponsible = state.currentUser?.id === task.responsibleId;
    const canTake = canCurrentUserTake(task);
    const isCompleted = task.status === 'done';
    if (selectors.takeButton) {
        const labelEl = selectors.takeButton.querySelector('.action-button__label');
        if (isCompleted) {
            const canReturn = isAuthor;
            setActionVisibility(selectors.takeButton, canReturn);
            selectors.takeButton.disabled = !canReturn;
            selectors.takeButton.classList.remove('is-active', 'is-busy');
            selectors.takeButton.removeAttribute('aria-pressed');
            selectors.takeButton.title = canReturn
                ? 'Верните задачу в работу, чтобы продолжить' : '';
            if (labelEl) labelEl.textContent = 'Вернуть в работу';
        } else if (isAuthor) {
            setActionVisibility(selectors.takeButton, false);
            selectors.takeButton.classList.remove('is-active', 'is-busy');
            selectors.takeButton.removeAttribute('aria-pressed');
            selectors.takeButton.title = '';
        } else {
            setActionVisibility(selectors.takeButton, true);
            const currentId = state.currentUser?.id;
            const acceptedByMe = Boolean(
                currentId && isAcceptanceAccepted(task.workGroupAcceptance?.[currentId])
            );
            const locked = !canTake || acceptedByMe || reviewPending;
            selectors.takeButton.disabled = locked;
            selectors.takeButton.classList.toggle('is-active', acceptedByMe && !reviewPending);
            selectors.takeButton.classList.remove('is-busy');
            selectors.takeButton.setAttribute('aria-pressed', acceptedByMe ? 'true' : 'false');
            if (reviewPending) {
                const reviewerName = resolveUserName(reviewInfo.reviewerId, 'автора задачи');
                selectors.takeButton.title = `Задача на проверке у ${reviewerName}`;
            } else if (!canTake) {
                selectors.takeButton.title = 'Действие доступно участникам рабочей группы';
            } else if (acceptedByMe) {
                selectors.takeButton.title = 'Вы уже подтвердили участие';
            } else {
                selectors.takeButton.title = '';
            }
            if (labelEl) {
                if (reviewPending) {
                    labelEl.textContent = 'На проверке';
                } else {
                    labelEl.textContent = acceptedByMe ? 'Вы приняли задачу' : 'Принять в работу';
                }
            }
        }
    }
    const canComplete = canAuthorCompleteDirectly(task);
    if (selectors.completeButton) {
        setActionVisibility(selectors.completeButton, canComplete);
        selectors.completeButton.disabled = !canComplete;
        selectors.completeButton.title = canComplete
            ? ''
            : 'Завершение доступно автору, если задача не отправлена на проверку';
    }

    if (selectors.reviewButton) {
        const labelEl = selectors.reviewButton.querySelector('.action-button__label');
        selectors.reviewButton.classList.remove('is-busy');
        const shouldHide = isAuthor || reviewApproved || isCompleted;
        if (shouldHide) {
            setActionVisibility(selectors.reviewButton, false);
        } else if (reviewPending) {
            const canObserve = isResponsible;
            setActionVisibility(selectors.reviewButton, canObserve);
            selectors.reviewButton.disabled = true;
            selectors.reviewButton.title = selectors.takeButton?.title || 'Задача ожидает проверки';
            if (labelEl) labelEl.textContent = 'На проверке';
        } else {
            const canReview = canCurrentUserRequestReview(task);
            setActionVisibility(selectors.reviewButton, canReview);
            selectors.reviewButton.disabled = !canReview;
            selectors.reviewButton.title = canReview
                ? ''
                : 'Отправить на проверку может только ответственный';
            if (labelEl) labelEl.textContent = 'Отправить на проверку';
        }
    }
    if (selectors.approveButton) {
        const canApprove = !isCompleted && !reviewApproved && canCurrentUserApprove(task);
        setActionVisibility(selectors.approveButton, canApprove);
        selectors.approveButton.disabled = !canApprove;
        selectors.approveButton.title = canApprove ? '' : 'Подтверждение доступно автору задачи';
    }
    if (selectors.editButton) {
        const canEdit = isAuthor && !reviewApproved && !isCompleted;
        setActionVisibility(selectors.editButton, canEdit);
        selectors.editButton.disabled = !canEdit;
    }
    if (selectors.reassignButton) {
        const canReassign = isAuthor && !reviewApproved && !isCompleted;
        setActionVisibility(selectors.reassignButton, canReassign);
        selectors.reassignButton.disabled = !canReassign;
    }
    const canSnooze = !reviewApproved && !isCompleted && canCurrentUserComment(task);
    if (selectors.snoozeButton) {
        setActionVisibility(selectors.snoozeButton, !reviewApproved && !isCompleted);
        selectors.snoozeButton.disabled = !canSnooze;
        selectors.snoozeButton.title = reviewApproved
            ? 'После подтверждения задача закрыта для изменений'
            : isCompleted
                ? 'После завершения задача закрыта для изменений'
                : canSnooze
                ? (isAuthor
                    ? 'Перенесите срок задачи для всех участников'
                    : 'Отложите выполнение задачи для себя')
                : 'Отложить может автор или участник рабочей группы';
    }
}

function canCurrentUserComment(task) {
    if (!state.currentUser || !task) return false;
    if (areCommentsClosed(task)) return false;
    const id = state.currentUser.id;
    const workGroup = new Set(task.workGroup || []);
    return task.authorId === id || task.responsibleId === id || workGroup.has(id);
}

function canCurrentUserTake(task) {
    if (!state.currentUser || !task) return false;
    if (task.status === 'done' || task.status === 'review') return false;
    const id = state.currentUser.id;
    if (task.authorId === id) return false;
    const workGroup = new Set(Array.isArray(task.workGroup) ? task.workGroup : []);
    if (!workGroup.has(id)) return false;
    const acceptanceEntry = task.workGroupAcceptance?.[id];
    return !isAcceptanceAccepted(acceptanceEntry);
}

function isCurrentUserTaskAuthor(task) {
    if (!state.currentUser || !task) return false;
    return task.authorId === state.currentUser.id;
}

function getReviewInfo(task) {
    if (!task || typeof task !== 'object') {
        return {
            status: 'idle',
            requestedBy: null,
            requestedAt: null,
            reviewerId: null,
            approvedBy: null,
            approvedAt: null
        };
    }
    const review = task.review && typeof task.review === 'object' ? task.review : {};
    const status = ['pending', 'approved', 'idle'].includes(review.status) ? review.status : 'idle';
    const fallbackReviewer = task.authorId || task.responsibleId || null;
    const reviewerId = review.status === 'approved'
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

function isReviewPending(task) {
    return getReviewInfo(task).status === 'pending';
}

function collectTaskParticipantIds(task) {
    const ids = new Set();
    if (!task) return ids;
    if (task.authorId) ids.add(task.authorId);
    if (task.responsibleId) ids.add(task.responsibleId);
    (Array.isArray(task.participants) ? task.participants : []).forEach((id) => id && ids.add(id));
    (Array.isArray(task.workGroup) ? task.workGroup : []).forEach((id) => id && ids.add(id));
    (Array.isArray(task.group) ? task.group : []).forEach((id) => id && ids.add(id));
    return ids;
}

function canCurrentUserRequestReview(task) {
    if (!state.currentUser || !task) return false;
    if (task.status === 'done') return false;
    if (isReviewPending(task)) return false;
    const userId = state.currentUser.id;
    if (task.authorId === userId) return false;
    return userId === task.responsibleId;
}

function canCurrentUserApprove(task) {
    if (!state.currentUser || !task) return false;
    const review = getReviewInfo(task);
    if (review.status !== 'pending') return false;
    return state.currentUser.id === review.reviewerId;
}

function canAuthorCompleteDirectly(task) {
    if (!state.currentUser || !task) return false;
    if (!isCurrentUserTaskAuthor(task)) return false;
    if (task.status === 'done') return false;
    return getReviewInfo(task).status !== 'pending';
}

function bindActions() {
    initEditFormControls();
    ensureDialogControls(selectors.editDialog);
    ensureDialogControls(document.getElementById('reassign-dialog'));
    ensureDialogControls(document.getElementById('snooze-dialog'));
    selectors.takeButton?.addEventListener('click', handleTakeInWork);
    selectors.completeButton?.addEventListener('click', handleCompleteByAuthor);
    selectors.reviewButton?.addEventListener('click', handleSendReview);
    selectors.approveButton?.addEventListener('click', handleApproveCompletion);
    selectors.editButton?.addEventListener('click', () => openEditDialog(state.task));
    selectors.reassignButton?.addEventListener('click', () => openReassignDialog(state.task));
    selectors.snoozeButton?.addEventListener('click', () => openSnoozeDialog(state.task));
    selectors.editForm?.addEventListener('submit', handleEditSubmit);

    if (selectors.commentForm) {
        selectors.commentForm.addEventListener('submit', handleCommentSubmit);
        selectors.commentForm
            .querySelectorAll('.comment-toolbar__button')
            .forEach((button) =>
                button.addEventListener('click', () => {
                    document.execCommand(button.dataset.command, false, null);
                    selectors.commentEditor?.focus();
                })
            );
        document.getElementById('comment-cancel')?.addEventListener('click', resetCommentEditor);
    }
}

function initEditFormControls() {
    if (!selectors.editForm) return;
    if (selectors.editForm.dataset.initialized === 'true') return;
    selectors.editForm.dataset.initialized = 'true';
    populateEditAssigneeDirectory();
    editPriorityButtons = Array.from(selectors.editPrioritySegment?.querySelectorAll('.opt') || []);
    editPriorityButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const priority = button.dataset.pri || 'medium';
            setEditPriority(priority, { suggestDue: !selectors.editDueDate?.value });
        });
    });
    selectors.editForm.addEventListener('input', handleEditFieldInput, true);
    selectors.editForm.addEventListener('change', handleEditFieldInput, true);
    selectors.editFile?.addEventListener('change', handleEditFileChange);
}

function populateEditAssigneeDirectory() {
    if (!selectors.editAssigneeDirectory || !data?.getUsers) return;
    const directory = selectors.editAssigneeDirectory;
    const previousValue = directory.value;
    const users = Object.values(getUsersDirectory())
        .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'ru'));
    directory.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Выберем позже —';
    directory.appendChild(placeholder);
    users.forEach((user) => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.fullName || user.id;
        directory.appendChild(option);
    });
    if (previousValue && directory.querySelector(`option[value="${previousValue}"]`)) {
        directory.value = previousValue;
    }
}

function handleEditFieldInput(event) {
    const errorId = editFormErrorMap[event.target.id];
    if (errorId) {
        const message = document.getElementById(errorId);
        if (message) {
            message.style.display = 'none';
            message.classList.remove('visible');
        }
        event.target.classList.remove('error');
    }
    if (event.target === selectors.editDueDate) {
        selectors.editDueDate.classList.remove('error');
    }
    if (event.target === selectors.editAssigneeDirectory && selectors.editAssigneeDirectory?.value) {
        selectors.editResponsible && (selectors.editResponsible.value = '');
    }
    if (event.target === selectors.editResponsible && selectors.editResponsible?.value) {
        selectors.editAssigneeDirectory && (selectors.editAssigneeDirectory.value = '');
    }
}

function clearEditErrors() {
    Object.values(editFormErrorMap).forEach((id) => {
        const message = document.getElementById(id);
        if (message) {
            message.style.display = 'none';
            message.classList.remove('visible');
        }
    });
    selectors.editFormErrors && (selectors.editFormErrors.innerHTML = '');
    selectors.editForm?.querySelectorAll('.error').forEach((field) => field.classList.remove('error'));
}

function showEditErrors(errors) {
    if (!selectors.editFormErrors) return;
    selectors.editFormErrors.innerHTML = '';
    errors.forEach(({ field, messageId }) => {
        field?.classList.add('error');
        const message = document.getElementById(messageId);
        if (message) {
            message.style.display = 'block';
            message.classList.add('visible');
        }
    });
    if (errors.length > 0) {
        const alert = document.createElement('div');
        alert.className = 'alert err';
        alert.innerHTML = `
            <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
            <span>Проверьте обязательные поля формы редактирования</span>
            <button class="alert-close" type="button" aria-label="Закрыть" data-dismiss-alert>
                <i class="fas fa-times" aria-hidden="true"></i>
            </button>
        `;
        alert.querySelector('[data-dismiss-alert]')?.addEventListener('click', () => alert.remove());
        selectors.editFormErrors.appendChild(alert);
    }
}

function setEditPriority(priority, options = {}) {
    if (!selectors.editPrioritySegment) return;
    const targetPriority = ['low', 'medium', 'high'].includes(priority) ? priority : 'medium';
    if (editPriorityButtons.length === 0) {
        editPriorityButtons = Array.from(selectors.editPrioritySegment.querySelectorAll('.opt'));
    }
    editPriorityButtons.forEach((button) => {
        const matches = button.dataset.pri === targetPriority;
        button.classList.toggle('sel', matches);
    });
    selectors.editPrioritySegment.dataset.value = targetPriority;
    if (options.suggestDue && selectors.editDueDate && !selectors.editDueDate.value) {
        selectors.editDueDate.value = addDaysFromPriority(targetPriority);
    }
}

function getSelectedEditPriority() {
    return selectors.editPrioritySegment?.dataset.value || 'medium';
}

function handleEditFileChange(event) {
    const [file] = event.target.files || [];
    if (!file) {
        editFileData = null;
        editFileName = null;
        return;
    }
    editFileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
        editFileData = reader.result;
    };
    reader.readAsDataURL(file);
}

function collectEditFormData() {
    const groupInput = selectors.editGroup?.value || '';
    const groupMembers = Array.from(new Set(parseEditGroupInput(groupInput)));
    return {
        type: selectors.editType?.value || state.task?.type || 'work',
        project: selectors.editProject?.value || '',
        privacy: selectors.editPrivacy?.value || 'public',
        direction: selectors.editDirection?.value || '',
        responsibleInput: selectors.editResponsible?.value.trim() || '',
        selectedAssignee: selectors.editAssigneeDirectory?.value || '',
        groupInput,
        groupMembers,
        priority: getSelectedEditPriority(),
        hours: selectors.editHours?.value || '',
        subject: selectors.editSubject?.value.trim() || '',
        desc: selectors.editDesc?.value.trim() || '',
        dueDate: selectors.editDueDate?.value || '',
        dueTime: selectors.editDueTime?.value || '',
        file: editFileData ? { name: editFileName, dataUrl: editFileData } : null
    };
}

function validateEditForm(payload) {
    clearEditErrors();
    const errors = [];
    if (!payload.project) {
        errors.push({ field: selectors.editProject, messageId: editFormErrorMap['edit-project'] });
    }
    if (!payload.responsibleInput && !payload.selectedAssignee && !state.task?.responsibleId) {
        errors.push({ field: selectors.editResponsible, messageId: editFormErrorMap['edit-responsible'] });
    }
    if (payload.hours === '') {
        errors.push({ field: selectors.editHours, messageId: editFormErrorMap['edit-hours'] });
    }
    if (!payload.subject) {
        errors.push({ field: selectors.editSubject, messageId: editFormErrorMap['edit-subject'] });
    }
    if (!payload.desc) {
        errors.push({ field: selectors.editDesc, messageId: editFormErrorMap['edit-desc'] });
    }
    if (!payload.dueDate) {
        selectors.editDueDate?.classList.add('error');
    }
    return errors;
}

function parseEditGroupInput(input) {
    if (!input) return [];
    return input
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.replace(/^@/, ''))
        .map((value) => resolveDirectoryUserToken(value)?.id)
        .filter(Boolean);
}

function resolveDirectoryUserToken(value) {
    if (!value) return null;
    const users = getUsersDirectory();
    const direct = users[value];
    if (direct) return direct;
    const normalized = normalizeToken(value);
    return (
        Object.values(users).find((user) => normalizeToken(user.fullName) === normalized) ||
        Object.values(users).find((user) => normalizeToken(user.email?.split('@')[0]) === normalized) ||
        Object.values(users).find((user) => normalizeToken(user.id) === normalized)
    ) || null;
}

function getUsersDirectory() {
    return data?.getUsers ? data.getUsers() : {};
}

function handleTakeInWork() {
    if (!state.task || !state.currentUser) return;
    const isAuthor = isCurrentUserTaskAuthor(state.task);
    const returnToWork = isAuthor && state.task.status === 'done';
    if (!returnToWork && !canCurrentUserTake(state.task)) return;
    const labelEl = selectors.takeButton?.querySelector('.action-button__label');
    if (selectors.takeButton) {
        selectors.takeButton.disabled = true;
        selectors.takeButton.classList.add('is-busy');
        if (labelEl) {
            labelEl.textContent = returnToWork ? 'Возвращаем…' : 'Обновляем…';
        }
    }
    const actor = state.currentUser;
    let updatedTask = null;
    if (returnToWork) {
        updatedTask = data.updateTask(state.task.id, (task) => {
            return {
                ...task,
                status: 'progress',
                completedAt: null,
                review: {
                    status: 'idle',
                    requestedBy: null,
                    requestedAt: null,
                    reviewerId: task.authorId || task.responsibleId || actor.id,
                    approvedBy: null,
                    approvedAt: null
                },
                workGroupAcceptance: {}
            };
        });
        data.addActivity(state.task.id, {
            type: 'status-change',
            text: `${actor.fullName} вернул(а) задачу в работу`,
            actorId: actor.id
        });
        notifyTaskParticipants(updatedTask || state.task, {
            title: 'Задача возвращена в работу',
            message: `${actor.fullName} возобновил(а) задачу «${state.task.subject}».`,
            link: `task.html?id=${state.task.id}`,
            type: 'task'
        });
        ui.showToast({
            title: 'Задача возвращена',
            message: 'Задача снова находится в работе.',
            type: 'info'
        });
    } else {
        updatedTask = data.updateTask(state.task.id, (task) => ({
            ...task,
            status: task.status === 'done' ? task.status : 'progress',
            workGroupAcceptance: {
                ...(task.workGroupAcceptance || {}),
                [actor.id]: { acceptedAt: data.nowIso() }
            }
        }));
        data.addActivity(state.task.id, {
            type: 'acceptance',
            text: `${actor.fullName} подтвердил(а) участие в задаче`,
            actorId: actor.id
        });
        notifyTaskParticipants(updatedTask || state.task, {
            title: 'Задача принята в работу',
            message: `${actor.fullName} подтвердил(а) участие в задаче «${state.task.subject}»`,
            link: `task.html?id=${state.task.id}`,
            type: 'task'
        });
        ui.showToast({
            title: 'Участие подтверждено',
            message: 'Ваш статус обновлён.',
            type: 'success'
        });
    }
    ui.refreshNotificationBell?.();
    loadTask();
}

function handleSendReview() {
    if (!state.task || !canCurrentUserRequestReview(state.task)) return;
    const button = selectors.reviewButton;
    const labelEl = button?.querySelector('.action-button__label');
    if (button) {
        button.disabled = true;
        button.classList.add('is-busy');
        if (labelEl) labelEl.textContent = 'Отправляем…';
    }
    const actor = state.currentUser;
    const reviewInfo = getReviewInfo(state.task);
    const reviewerId = reviewInfo.reviewerId || state.task.authorId || state.task.responsibleId || actor.id;
    const requestedAt = data.nowIso();
    const updatedTask = data.updateTask(state.task.id, (task) => ({
        ...task,
        status: task.status === 'done' ? task.status : 'review',
        review: {
            status: 'pending',
            requestedBy: actor.id,
            requestedAt,
            reviewerId,
            approvedBy: null,
            approvedAt: null
        }
    }));
    const reviewerName = resolveUserName(reviewerId, 'автору задачи');
    data.addActivity(state.task.id, {
        type: 'review-request',
        text: `${actor.fullName} отправил(а) задачу на проверку ${reviewerName}`,
        actorId: actor.id
    });
    notifyTaskParticipants(updatedTask || state.task, {
        title: 'Задача на проверке',
        message: `${actor.fullName} отправил(а) задачу «${state.task.subject}» на проверку ${reviewerName}.`,
        link: `task.html?id=${state.task.id}`,
        type: 'task'
    });
    ui.refreshNotificationBell?.();
    ui.showToast({
        title: 'Задача отправлена на проверку',
        message: 'Автор уведомлён и сможет подтвердить выполнение.',
        type: 'info'
    });
    loadTask();
}

function handleApproveCompletion() {
    if (!state.task || !canCurrentUserApprove(state.task)) return;
    const button = selectors.approveButton;
    const labelEl = button?.querySelector('.action-button__label');
    if (button) {
        button.disabled = true;
        button.classList.add('is-busy');
        if (labelEl) labelEl.textContent = 'Подтверждаем…';
    }
    const actor = state.currentUser;
    const currentReview = getReviewInfo(state.task);
    const approvedAt = data.nowIso();
    const updatedTask = data.updateTask(state.task.id, (task) => ({
        ...task,
        status: 'done',
        review: {
            ...currentReview,
            status: 'approved',
            approvedBy: actor.id,
            approvedAt
        },
        completedAt: approvedAt
    }));
    data.addActivity(state.task.id, {
        type: 'review-approved',
        text: `${actor.fullName} подтвердил(а) выполнение задачи`,
        actorId: actor.id
    });
    notifyTaskParticipants(updatedTask || state.task, {
        title: 'Задача выполнена',
        message: `${actor.fullName} подтвердил(а) выполнение задачи «${state.task.subject}».`,
        link: `task.html?id=${state.task.id}`,
        type: 'task'
    });
    ui.refreshNotificationBell?.();
    ui.showToast({
        title: 'Задача подтверждена',
        message: 'Статус задачи обновлён на «Выполнена».',
        type: 'success'
    });
    loadTask();
}

function handleCompleteByAuthor() {
    if (!state.task || !canAuthorCompleteDirectly(state.task)) return;
    const button = selectors.completeButton;
    const labelEl = button?.querySelector('.action-button__label');
    if (button) {
        button.disabled = true;
        button.classList.add('is-busy');
        if (labelEl) labelEl.textContent = 'Завершаем…';
    }
    const actor = state.currentUser;
    const completedAt = data.nowIso();
    const updatedTask = data.updateTask(state.task.id, (task) => ({
        ...task,
        status: 'done',
        review: {
            status: 'idle',
            requestedBy: null,
            requestedAt: null,
            reviewerId: task.authorId || task.responsibleId || actor.id,
            approvedBy: null,
            approvedAt: null
        },
        completedAt
    }));
    data.addActivity(state.task.id, {
        type: 'status-change',
        text: `${actor.fullName} завершил(а) задачу`,
        actorId: actor.id
    });
    notifyTaskParticipants(updatedTask || state.task, {
        title: 'Задача завершена',
        message: `${actor.fullName} завершил(а) задачу «${state.task.subject}».`,
        link: `task.html?id=${state.task.id}`,
        type: 'task'
    });
    ui.refreshNotificationBell?.();
    ui.showToast({
        title: 'Задача завершена',
        message: 'Статус задачи обновлён на «Выполнена».',
        type: 'success'
    });
    loadTask();
}

function openEditDialog(task) {
    if (!task) return;
    if (!isCurrentUserTaskAuthor(task)) {
        ui.showToast({
            title: 'Недостаточно прав',
            message: 'Редактирование доступно только автору задачи.',
            type: 'error'
        });
        return;
    }
    const dialog = ensureDialogControls(selectors.editDialog);
    if (!dialog) return;
    populateEditAssigneeDirectory();
    clearEditErrors();
    editFileData = null;
    editFileName = null;
    if (selectors.editType) selectors.editType.value = task.type || 'work';
    if (selectors.editProject) {
        if (task.project) {
            const hasOption = Array.from(selectors.editProject.options || []).some(
                (option) => option.value === task.project
            );
            if (!hasOption) {
                const option = document.createElement('option');
                option.value = task.project;
                option.textContent = task.project;
                selectors.editProject.appendChild(option);
            }
        }
        selectors.editProject.value = task.project || '';
    }
    if (selectors.editPrivacy) selectors.editPrivacy.value = task.privacy || 'public';
    if (selectors.editDirection) selectors.editDirection.value = task.direction || '';
    if (selectors.editAssigneeDirectory) {
        selectors.editAssigneeDirectory.value = task.responsibleId || '';
    }
    if (selectors.editResponsible) {
        const responsibleName = task.responsible || resolveUser(task.responsibleId) || '';
        selectors.editResponsible.value = responsibleName;
        if (selectors.editAssigneeDirectory?.value) {
            selectors.editResponsible.value = '';
        }
    }
    if (selectors.editGroup) {
        const members = Array.isArray(task.workGroup) ? task.workGroup.filter(Boolean) : [];
        const unique = Array.from(new Set(members.filter((id) => id !== task.responsibleId)));
        const label = unique
            .map((id) => data.getUserById(id)?.fullName || `@${id}`)
            .join(', ');
        selectors.editGroup.value = label;
    }
    if (selectors.editHours) selectors.editHours.value = Number.isFinite(task.hours) ? task.hours : '';
    if (selectors.editDueDate) selectors.editDueDate.value = task.due || '';
    if (selectors.editDueTime) selectors.editDueTime.value = task.dueTime || '';
    if (selectors.editSubject) selectors.editSubject.value = task.subject || '';
    if (selectors.editDesc) selectors.editDesc.value = task.desc || '';
    setEditPriority(task.pri || 'medium', { suggestDue: !task.due });
    if (selectors.editFile) selectors.editFile.value = '';
    dialog.showModal();
    setEditDialogScrollLock(true);
    selectors.editSubject?.focus();
}

function handleEditSubmit(event) {
    event.preventDefault();
    const action = event.submitter?.value || 'confirm';
    if (action !== 'confirm') {
        selectors.editDialog?.close('cancel');
        return;
    }
    if (!state.task || !isCurrentUserTaskAuthor(state.task)) {
        selectors.editDialog?.close('cancel');
        ui.showToast({
            title: 'Недостаточно прав',
            message: 'Редактирование доступно только автору задачи.',
            type: 'error'
        });
        return;
    }
    const payload = collectEditFormData();
    const errors = validateEditForm(payload);
    if (errors.length > 0) {
        showEditErrors(errors);
        errors[0]?.field?.focus();
        return;
    }
    const responsibleUser = resolveDirectoryUserToken(
        payload.selectedAssignee || payload.responsibleInput
    ) || (state.task.responsibleId ? data.getUserById(state.task.responsibleId) : null);
    if (!responsibleUser) {
        showEditErrors([
            { field: selectors.editResponsible || selectors.editAssigneeDirectory, messageId: editFormErrorMap['edit-responsible'] }
        ]);
        (selectors.editResponsible || selectors.editAssigneeDirectory)?.focus();
        return;
    }
    selectors.editDialog?.close('confirm');
    const hours = payload.hours === ''
        ? state.task.hours ?? 0
        : Number.parseFloat(payload.hours);
    const dueDate = payload.dueDate || addDaysFromPriority(payload.priority);
    const dueTime = payload.dueTime || state.task.dueTime || '18:00';
    const workGroupMembers = Array.from(new Set([
        ...payload.groupMembers,
        responsibleUser.id
    ].filter(Boolean)));
    const participants = new Set(
        (Array.isArray(state.task.participants) ? state.task.participants.filter(Boolean) : [])
            .concat(workGroupMembers)
    );
    participants.add(responsibleUser.id);
    if (state.task.authorId) {
        participants.add(state.task.authorId);
    }
    const preservedAcceptance = {};
    const currentAcceptance = state.task.workGroupAcceptance || {};
    workGroupMembers.forEach((id) => {
        if (currentAcceptance[id]) {
            preservedAcceptance[id] = currentAcceptance[id];
        }
    });
    const review = { ...(state.task.review || {}) };
    if (responsibleUser.id !== state.task.responsibleId) {
        review.status = 'idle';
        review.requestedBy = null;
        review.requestedAt = null;
        review.reviewerId = state.task.authorId || responsibleUser.id;
        review.approvedBy = null;
        review.approvedAt = null;
    }
    const filePayload = payload.file ? payload.file : state.task.file;
    const updatedTask = data.updateTask(state.task.id, (task) => ({
        ...task,
        type: payload.type,
        project: payload.project,
        privacy: payload.privacy,
        direction: payload.direction,
        subject: payload.subject,
        desc: payload.desc,
        pri: payload.priority,
        due: dueDate,
        dueTime,
        hours: Number.isFinite(hours) ? hours : task.hours,
        responsibleId: responsibleUser.id,
        responsible: responsibleUser.fullName || responsibleUser.id,
        assigneeId: responsibleUser.id,
        assignee: responsibleUser.fullName || responsibleUser.id,
        group: workGroupMembers,
        workGroup: workGroupMembers,
        participants: Array.from(participants),
        workGroupAcceptance: preservedAcceptance,
        review,
        file: filePayload
    }));
    data.addActivity(state.task.id, {
        type: 'update',
        text: `${state.currentUser.fullName} обновил(а) задачу через форму редактирования`,
        actorId: state.currentUser.id
    });
    notifyTaskParticipants(updatedTask || state.task, {
        title: 'Задача обновлена',
        message: `${state.currentUser.fullName} изменил(а) задачу «${payload.subject}».`,
        link: `task.html?id=${state.task.id}`,
        type: 'task'
    });
    ui.refreshNotificationBell?.();
    ui.showToast({
        title: 'Изменения сохранены',
        message: 'Детали задачи обновлены.',
        type: 'success'
    });
    editFileData = null;
    editFileName = null;
    loadTask();
}

function openReassignDialog(task) {
    if (!task) return;
    if (!isCurrentUserTaskAuthor(task)) {
        ui.showToast({
            title: 'Недостаточно прав',
            message: 'Переназначение доступно только автору задачи.',
            type: 'error'
        });
        return;
    }
    const dialog = ensureDialogControls(document.getElementById('reassign-dialog'));
    const list = document.getElementById('reassign-list');
    list.innerHTML = '';
    const ids = Array.from(new Set([...(task.workGroup || []), ...(task.participants || [])]));
    const options = ids.map((id) => data.getUserById(id)).filter(Boolean);
    if (options.length === 0) {
        ui.showToast({
            title: 'Недостаточно данных',
            message: 'В задаче нет участников, доступных для назначения.',
            type: 'error'
        });
        return;
    }
    options.forEach((user) => {
        const label = document.createElement('label');
        label.className = 'modal__option';
        label.innerHTML = `
            <input type="radio" name="responsible" value="${user.id}" ${
                user.id === task.responsibleId ? 'checked' : ''
            }>
            <span>
                <strong>${escapeHtml(user.fullName)}</strong><br>
                <span class="text-muted">${escapeHtml(user.role || '')}</span>
            </span>
        `;
        list.appendChild(label);
    });
    const form = dialog.querySelector('form');
    form.addEventListener('submit', handleReassignSubmit, { once: true });
    dialog.showModal();
}

function handleReassignSubmit(event) {
    event.preventDefault();
    const dialog = document.getElementById('reassign-dialog');
    const form = dialog.querySelector('form');
    const action = event.submitter?.value || 'confirm';
    if (!state.task || !isCurrentUserTaskAuthor(state.task)) {
        dialog.close('cancel');
        ui.showToast({
            title: 'Недостаточно прав',
            message: 'Переназначение доступно только автору задачи.',
            type: 'error'
        });
        return;
    }
    if (action !== 'confirm') {
        dialog.close('cancel');
        return;
    }
    const selected = dialog.querySelector('input[name="responsible"]:checked');
    if (!selected) {
        ui.showToast({
            title: 'Выберите участника',
            message: 'Необходимо выбрать ответственного.',
            type: 'error'
        });
        dialog.showModal();
        form?.addEventListener('submit', handleReassignSubmit, { once: true });
        return;
    }
    const reasonInput = document.getElementById('reassign-reason');
    const reason = reasonInput?.value.trim() || '';
    if (!reason) {
        ui.showToast({
            title: 'Укажите причину',
            message: 'Заполните поле причины переназначения.',
            type: 'error'
        });
        dialog.showModal();
        reasonInput?.focus();
        form?.addEventListener('submit', handleReassignSubmit, { once: true });
        return;
    }
    dialog.close('confirm');
    const user = data.getUserById(selected.value);
    const updatedTask = data.updateTask(state.task.id, (task) => ({
        ...task,
        responsibleId: user.id,
        responsible: user.fullName,
        assigneeId: user.id,
        assignee: user.fullName
    }));
    data.addActivity(state.task.id, {
        type: 'assignment',
        text: `${user.fullName} теперь ответственный за задачу. Причина: ${reason}`,
        actorId: state.currentUser.id
    });
    notifyTaskParticipants(updatedTask || state.task, {
        title: 'Переназначение задачи',
        message: `${state.currentUser.fullName} назначил(а) ${user.fullName} ответственным за «${state.task.subject}»`,
        link: `task.html?id=${state.task.id}`,
        type: 'task'
    });
    ui.refreshNotificationBell?.();
    ui.showToast({
        title: 'Ответственный обновлён',
        message: `${user.fullName} назначен(а) ответственным.`,
        type: 'success'
    });
    loadTask();
}

function openSnoozeDialog(task) {
    if (!task) return;
    const dialog = ensureDialogControls(document.getElementById('snooze-dialog'));
    const dateInput = document.getElementById('snooze-date');
    const timeInput = document.getElementById('snooze-time');
    const reasonInput = document.getElementById('snooze-reason');
    const isAuthor = isCurrentUserTaskAuthor(task);
    const currentId = state.currentUser?.id;
    const personalAcceptance = currentId ? task.workGroupAcceptance?.[currentId] : null;
    const personalSnooze = !isAuthor && personalAcceptance && isAcceptanceSnoozed(personalAcceptance)
        ? resolveSnoozeParts(personalAcceptance)
        : null;
    if (dateInput) {
        const value = personalSnooze?.date || task.due || '';
        dateInput.value = value;
    }
    if (timeInput) {
        const value = personalSnooze?.time || task.dueTime || '';
        timeInput.value = value;
    }
    if (reasonInput) reasonInput.value = '';
    const form = dialog.querySelector('form');
    form.addEventListener('submit', handleSnoozeSubmit, { once: true });
    dialog.showModal();
}

function handleSnoozeSubmit(event) {
    event.preventDefault();
    const dialog = document.getElementById('snooze-dialog');
    const form = dialog.querySelector('form');
    const action = event.submitter?.value || 'confirm';
    if (action !== 'confirm') {
        dialog.close('cancel');
        return;
    }
    const dateInput = document.getElementById('snooze-date');
    const timeInput = document.getElementById('snooze-time');
    const reasonInput = document.getElementById('snooze-reason');
    if (!dateInput?.value || !timeInput?.value) {
        ui.showToast({
            title: 'Укажите дату и время',
            message: 'Для переноса нужно заполнить оба поля.',
            type: 'error'
        });
        dialog.showModal();
        form?.addEventListener('submit', handleSnoozeSubmit, { once: true });
        return;
    }
    const reason = reasonInput?.value.trim() || '';
    if (!reason) {
        ui.showToast({
            title: 'Укажите причину',
            message: 'Поясните, почему задачу нужно отложить.',
            type: 'error'
        });
        dialog.showModal();
        reasonInput?.focus();
        form?.addEventListener('submit', handleSnoozeSubmit, { once: true });
        return;
    }
    const dueDate = new Date(`${dateInput.value}T${timeInput.value}`);
    if (dueDate < new Date()) {
        ui.showToast({
            title: 'Неверная дата',
            message: 'Дата не может быть в прошлом.',
            type: 'error'
        });
        dialog.showModal();
        form?.addEventListener('submit', handleSnoozeSubmit, { once: true });
        return;
    }
    dialog.close('confirm');
    const actor = state.currentUser;
    const isAuthor = isCurrentUserTaskAuthor(state.task);
    const formattedDate = formatDateHuman(dateInput.value, timeInput.value);
    if (isAuthor) {
        const updatedTask = data.updateTask(state.task.id, (task) => ({
            ...task,
            due: dateInput.value,
            dueTime: timeInput.value
        }));
        data.addActivity(state.task.id, {
            type: 'snooze',
            text: `Новый срок: ${formattedDate}. Причина: ${reason}`,
            actorId: actor.id
        });
        notifyTaskParticipants(updatedTask || state.task, {
            title: 'Задача отложена',
            message: `${actor.fullName} перенёс(ла) задачу «${state.task.subject}» на ${formattedDate}.`,
            link: `task.html?id=${state.task.id}`,
            type: 'task'
        });
        ui.refreshNotificationBell?.();
        ui.showToast({
            title: 'Срок обновлён',
            message: `Задача перенесена на ${formattedDate}.`,
            type: 'info'
        });
    } else {
        const updatedTask = data.updateTask(state.task.id, (task) => {
            const acceptance = { ...(task.workGroupAcceptance || {}) };
            const current = { ...(acceptance[actor.id] || {}) };
            delete current.acceptedAt;
            const snoozedUntil = dueDate.toISOString();
            const updatedEntry = {
                ...current,
                snoozedUntil,
                snoozedUntilDate: dateInput.value,
                snoozedUntilTime: timeInput.value,
                snoozedReason: reason,
                updatedAt: data.nowIso()
            };
            acceptance[actor.id] = updatedEntry;
            return {
                ...task,
                workGroupAcceptance: acceptance
            };
        });
        data.addActivity(state.task.id, {
            type: 'snooze',
            text: `${actor.fullName} отложил(а) выполнение задачи до ${formattedDate}. Причина: ${reason}`,
            actorId: actor.id
        });
        notifyTaskParticipants(updatedTask || state.task, {
            title: 'Перенос выполнения',
            message: `${actor.fullName} отложил(а) выполнение задачи «${state.task.subject}» до ${formattedDate}.`,
            link: `task.html?id=${state.task.id}`,
            type: 'task'
        });
        ui.refreshNotificationBell?.();
        ui.showToast({
            title: 'Выполнение отложено',
            message: `Вы отложили задачу до ${formattedDate}.`,
            type: 'info'
        });
    }
    loadTask();
}

function handleCommentSubmit(event) {
    event.preventDefault();
    if (!state.task || !canCurrentUserComment(state.task)) return;
    const html = (selectors.commentEditor?.innerHTML || '').trim();
    const sanitized = sanitizeCommentHtml(html);
    if (!sanitized) {
        ui.showToast({
            title: 'Пустой комментарий',
            message: 'Введите текст перед отправкой.',
            type: 'error'
        });
        return;
    }
    const id = data.uid();
    const optimistic = {
        id,
        authorId: state.currentUser.id,
        html: sanitized,
        createdAt: data.nowIso(),
        status: 'pending'
    };
    data.pushComment(state.task.id, optimistic);
    resetCommentEditor();
    loadTask();
    simulateCommentNetwork(sanitized)
        .then(() => {
            data.replaceComment(state.task.id, id, {
                status: 'posted',
                createdAt: data.nowIso()
            });
            ui.showToast({
                title: 'Комментарий опубликован',
                message: 'Сообщение доставлено участникам задачи.',
                type: 'success'
            });
            loadTask();
        })
        .catch(() => {
            data.replaceComment(state.task.id, id, { status: 'failed' });
            ui.showToast({
                title: 'Ошибка публикации',
                message: 'Не удалось отправить комментарий. Попробуйте ещё раз.',
                type: 'error'
            });
            loadTask();
        });
}

function resetCommentEditor() {
    if (selectors.commentEditor) {
        selectors.commentEditor.innerHTML = '';
    }
}

function retryComment(commentId) {
    const comment = (state.task.comments || []).find((item) => item.id === commentId);
    if (!comment) return;
    data.replaceComment(state.task.id, commentId, { status: 'pending' });
    loadTask();
    simulateCommentNetwork(comment.html)
        .then(() => {
            data.replaceComment(state.task.id, commentId, {
                status: 'posted',
                createdAt: data.nowIso()
            });
            ui.showToast({
                title: 'Комментарий отправлен',
                message: 'Сообщение успешно доставлено.',
                type: 'success'
            });
            loadTask();
        })
        .catch(() => {
            data.replaceComment(state.task.id, commentId, { status: 'failed' });
            ui.showToast({
                title: 'Ошибка публикации',
                message: 'Не удалось отправить комментарий. Попробуйте ещё раз.',
                type: 'error'
            });
            loadTask();
        });
}

function simulateCommentNetwork(html) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (html.toLowerCase().includes('ошибка')) {
                reject(new Error('Ошибка сервера'));
            } else {
                resolve();
            }
        }, 800);
    });
}

function renderOverdueBanner() {
    if (!selectors.overdueBanner || !data || !state.currentUser) return;
    const overdue = data.getOverdueTasks(state.currentUser.id);
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

function formatTaskNumber(id) {
    const numeric = Number.parseInt(id, 10);
    if (Number.isFinite(numeric)) {
        return `Задача №${String(numeric).padStart(3, '0')}`;
    }
    return id ? `Задача ${id}` : '';
}

function showError(message) {
    const container = document.querySelector('.task-page');
    if (!container) return;
    container.innerHTML = `
        <section class="card task-card">
            <div class="inline-alert" data-variant="danger">
                ${icon('icon-flag')}<div>${escapeHtml(message)}</div>
            </div>
            <a class="task-card__back" href="main.html">
                ${icon('icon-arrow-right')}<span>Вернуться к списку задач</span>
            </a>
        </section>
    `;
}

function icon(name) {
    return `<svg aria-hidden="true" focusable="false"><use href="assets/img/system-icons.svg#${name}"></use></svg>`;
}

function ensureArrayValue(value) {
    return Array.isArray(value) ? value : [];
}

function isUserInTask(task, userId) {
    if (!task || !userId) {
        return false;
    }
    if (task.authorId === userId || task.responsibleId === userId) {
        return true;
    }
    const members = new Set([
        ...ensureArrayValue(task.participants),
        ...ensureArrayValue(task.workGroup),
        ...ensureArrayValue(task.group)
    ]);
    return members.has(userId);
}

function canUserAccessTask(task, userId) {
    if (!task) {
        return false;
    }
    const privacy = task.privacy || 'public';
    if (privacy !== 'private') {
        return true;
    }
    return isUserInTask(task, userId);
}

function getTaskNotificationRecipients(task) {
    if (!task) {
        return [];
    }
    const recipients = new Set([
        task.authorId,
        task.responsibleId,
        ...ensureArrayValue(task.participants),
        ...ensureArrayValue(task.workGroup),
        ...ensureArrayValue(task.group)
    ].filter(Boolean));
    return Array.from(recipients);
}

function notifyTaskParticipants(taskOrId, payload) {
    if (!data?.upsertNotification) {
        return;
    }
    const task = typeof taskOrId === 'object' && taskOrId !== null
        ? taskOrId
        : data.getTaskById(taskOrId);
    if (!task) {
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

function mapStatus(status) {
    const map = {
        new: 'Новая',
        progress: 'В работе',
        review: 'На проверке',
        done: 'Завершена'
    };
    return map[status] || status;
}

function mapPriority(priority) {
    const map = {
        low: 'низкий',
        medium: 'средний',
        high: 'высокий'
    };
    return map[priority] || priority;
}

function formatDue(task) {
    if (!task.due) return { label: 'Без срока', overdue: false };
    const date = new Date(`${task.due}T${task.dueTime || '23:59'}`);
    const overdue = task.status !== 'done' && date < new Date();
    return {
        label: formatDateHuman(task.due, task.dueTime),
        overdue
    };
}

function formatDateHuman(dateStr, timeStr) {
    if (!dateStr) return '';
    const options = { day: 'numeric', month: 'long' };
    const date = new Date(dateStr);
    let formatted = date.toLocaleDateString('ru-RU', options);
    if (timeStr) {
        formatted += `, ${timeStr}`;
    }
    return formatted;
}

function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatRelativeOrDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    if (diff < 0) return formatDateTime(value);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} дн назад`;
    return formatDateTime(value);
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

function sanitizeCommentHtml(html) {
    if (!html) {
        return '';
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const wrapper = doc.body.firstElementChild;
    if (!wrapper) {
        return '';
    }
    wrapper.querySelectorAll('script, style').forEach((node) => node.remove());
    wrapper.querySelectorAll('*').forEach((node) => {
        [...node.attributes].forEach((attr) => {
            if (/^on/i.test(attr.name)) {
                node.removeAttribute(attr.name);
            }
        });
    });
    return wrapper.innerHTML.trim();
}

function resolveUser(id) {
    const user = data.getUserById(id);
    return user ? user.fullName : '—';
}

function resolveUserName(id, fallback = 'ответственный') {
    const name = resolveUser(id);
    return name && name !== '—' ? name : fallback;
}

function normalizeToken(value) {
    return value ? value.toString().trim().toLowerCase().replace(/\s+/g, '') : '';
}

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