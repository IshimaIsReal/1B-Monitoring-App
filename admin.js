const sessionKey = 'monitor-current-user';

const loadCurrentUser = () => {
    try {
        return JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
    } catch {
        return null;
    }
};

const currentUser = loadCurrentUser() || {};

{
    const pendingList = document.querySelector('#pending-list');
    const emptyPending = document.querySelector('#empty-pending');
    const ongoingList = document.querySelector('#ongoing-list');
    const emptyOngoing = document.querySelector('#empty-ongoing');
    const historyList = document.querySelector('#history-list');
    const emptyHistory = document.querySelector('#empty-history');
    const adminFeedback = document.querySelector('#admin-feedback');
    const adminTabs = [...document.querySelectorAll('[role="tab"]')];

    const activateAdminTab = activeTab => {
        adminTabs.forEach(tab => {
            const isActive = tab === activeTab;
            tab.setAttribute('aria-selected', String(isActive));
            tab.tabIndex = isActive ? 0 : -1;
            document.querySelector(`#${tab.getAttribute('aria-controls')}`).hidden = !isActive;
        });
    };

    adminTabs.forEach((tab, index) => {
        tab.addEventListener('click', () => activateAdminTab(tab));
        tab.addEventListener('keydown', event => {
            let nextIndex = index;
            if (event.key === 'ArrowRight') {
                nextIndex = (index + 1) % adminTabs.length;
            } else if (event.key === 'ArrowLeft') {
                nextIndex = (index - 1 + adminTabs.length) % adminTabs.length;
            } else if (event.key === 'Home') {
                nextIndex = 0;
            } else if (event.key === 'End') {
                nextIndex = adminTabs.length - 1;
            } else {
                return;
            }

            event.preventDefault();
            adminTabs[nextIndex].focus();
            activateAdminTab(adminTabs[nextIndex]);
        });
    });

    const fromDatabaseReport = report => ({
        id: report.id,
        type: report.type,
        area: report.area,
        description: report.description,
        photoDataUrl: report.photo_data_url,
        createdAt: report.created_at,
        status: report.status,
        confirmedAt: report.confirmed_at,
        scheduledAt: report.scheduled_at,
        resolvedAt: report.resolved_at,
        archivedAt: report.archived_at
    });

    let reports = [];
    let isRefreshingReports = false;
    const refreshReports = async () => {
        if (isRefreshingReports || !currentUser.id) {
            return;
        }
        isRefreshingReports = true;
        try {
            const { data, error } = await window.monitorSupabase
                .from('reports')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) {
                throw error;
            }
            reports = data.map(fromDatabaseReport);
            renderReports();
        } finally {
            isRefreshingReports = false;
        }
    };
    const isPending = report => report.status === 'Pending' || report.status === 'Open';
    const isOngoing = report => report.status === 'On-going' || report.status === 'Ongoing' || report.status === 'Confirmed';
    const isResolved = report => report.status === 'Resolved' || report.status === 'Solved';
    const isArchived = report => report.status === 'Archived';

    const saveReportChanges = async (reportId, changes, successMessage) => {
        const databaseChanges = {};
        if ('status' in changes) {
            databaseChanges.status = changes.status;
        }
        if ('confirmedAt' in changes) {
            databaseChanges.confirmed_at = changes.confirmedAt;
        }
        if ('scheduledAt' in changes) {
            databaseChanges.scheduled_at = changes.scheduledAt;
        }
        if ('resolvedAt' in changes) {
            databaseChanges.resolved_at = changes.resolvedAt;
        }
        if ('archivedAt' in changes) {
            databaseChanges.archived_at = changes.archivedAt;
        }

        try {
            const { data, error } = await window.monitorSupabase
                .from('reports')
                .update(databaseChanges)
                .eq('id', reportId)
                .select('*')
                .single();
            if (error) {
                throw error;
            }

            const reportIndex = reports.findIndex(report => report.id === reportId);
            if (reportIndex !== -1) {
                reports[reportIndex] = fromDatabaseReport(data);
            }
            adminFeedback.textContent = successMessage;
            renderReports();
        } catch (error) {
            adminFeedback.textContent = `Could not save this report update: ${error.message}`;
        }
    };

    const toLocalDateTimeValue = value => {
        if (!value) {
            return '';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    const createReportItem = (report, statusText, actionMode = '') => {
        const item = document.createElement('li');
        item.className = 'report-item';

        const details = document.createElement('div');
        details.className = 'report-details';

        const type = document.createElement('span');
        type.className = 'report-type-value';
        type.textContent = report.type || 'Issue report';
        const typeLabel = document.createElement('span');
        typeLabel.className = 'report-detail-label';
        typeLabel.textContent = 'Issue type';

        const area = document.createElement('span');
        area.className = 'report-area';
        area.textContent = report.area || 'Not provided';
        const areaLabel = document.createElement('span');
        areaLabel.className = 'report-detail-label report-area-label';
        areaLabel.textContent = 'Current area';

        const description = document.createElement('p');
        description.textContent = report.description || '';
        const descriptionLabel = document.createElement('span');
        descriptionLabel.className = 'report-detail-label';
        descriptionLabel.textContent = 'What happened?';

        if (typeof report.photoDataUrl === 'string' && report.photoDataUrl.startsWith('data:image/')) {
            const evidence = document.createElement('figure');
            evidence.className = 'report-photo-proof';

            const image = document.createElement('img');
            image.src = report.photoDataUrl;
            image.alt = `Photo evidence for ${report.type || 'issue report'}`;

            const caption = document.createElement('figcaption');
            caption.textContent = 'Uploaded photo proof';
            evidence.append(image, caption);
            details.append(typeLabel, type, areaLabel, area, descriptionLabel, description, evidence);
        } else {
            const noPhoto = document.createElement('p');
            noPhoto.className = 'report-proof-missing';
            noPhoto.textContent = 'No photo proof attached';
            details.append(typeLabel, type, areaLabel, area, descriptionLabel, description, noPhoto);
        }

        const meta = document.createElement('div');
        meta.className = 'report-meta';

        const timestamp = document.createElement('time');
        const reportDate = report.createdAt ? new Date(report.createdAt) : null;
        if (reportDate && !Number.isNaN(reportDate.getTime())) {
            timestamp.dateTime = reportDate.toISOString();
            timestamp.textContent = reportDate.toLocaleString();
        } else {
            timestamp.textContent = 'Date not recorded';
        }

        const status = document.createElement('span');
        status.className = 'report-status';
        if (isResolved(report)) {
            status.classList.add('is-resolved');
        } else if (isOngoing(report)) {
            status.classList.add('is-ongoing');
        } else if (isArchived(report)) {
            status.classList.add('is-archived');
        }
        status.textContent = statusText;
        meta.append(timestamp, status);

        if (report.confirmedAt) {
            const confirmedAt = document.createElement('time');
            confirmedAt.className = 'report-resolved-at';
            confirmedAt.dateTime = report.confirmedAt;
            confirmedAt.textContent = `Confirmed ${new Date(report.confirmedAt).toLocaleString()}`;
            meta.append(confirmedAt);
        }

        if (report.scheduledAt) {
            const scheduledAt = document.createElement('time');
            scheduledAt.className = 'report-resolved-at';
            scheduledAt.dateTime = report.scheduledAt;
            scheduledAt.textContent = `Repair scheduled ${new Date(report.scheduledAt).toLocaleString()}`;
            meta.append(scheduledAt);
        }

        if (report.resolvedAt) {
            const resolvedAt = document.createElement('time');
            resolvedAt.className = 'report-resolved-at';
            resolvedAt.dateTime = report.resolvedAt;
            resolvedAt.textContent = `Repaired ${new Date(report.resolvedAt).toLocaleString()}`;
            meta.append(resolvedAt);
        }

        if (report.archivedAt) {
            const archivedAt = document.createElement('time');
            archivedAt.className = 'report-resolved-at';
            archivedAt.dateTime = report.archivedAt;
            archivedAt.textContent = `Removed ${new Date(report.archivedAt).toLocaleString()}`;
            meta.append(archivedAt);
        }

        if (actionMode === 'pending') {
            const actions = document.createElement('div');
            actions.className = 'report-actions';

            const confirmButton = document.createElement('button');
            confirmButton.className = 'confirm-report';
            confirmButton.type = 'button';
            confirmButton.textContent = 'Confirm';
            confirmButton.addEventListener('click', () => saveReportChanges(report.id, {
                status: 'On-going',
                confirmedAt: new Date().toISOString()
            }, 'Report confirmed and moved to On-going.'));

            const removeButton = document.createElement('button');
            removeButton.className = 'remove-report';
            removeButton.type = 'button';
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => saveReportChanges(report.id, {
                status: 'Archived',
                archivedAt: new Date().toISOString()
            }, 'Report removed from the active queue and saved to History.'));

            actions.append(confirmButton, removeButton);
            meta.append(actions);
        } else if (actionMode === 'ongoing') {
            const confirmed = document.createElement('span');
            confirmed.className = 'action-confirmed';
            confirmed.textContent = 'Confirmed';
            meta.append(confirmed);

            const scheduleForm = document.createElement('form');
            scheduleForm.className = 'repair-schedule-form';

            const scheduleLabel = document.createElement('label');
            scheduleLabel.htmlFor = `schedule-${report.id}`;
            scheduleLabel.textContent = 'Schedule repair';

            const scheduleInput = document.createElement('input');
            scheduleInput.id = `schedule-${report.id}`;
            scheduleInput.type = 'datetime-local';
            scheduleInput.value = toLocalDateTimeValue(report.scheduledAt);
            scheduleInput.setAttribute('aria-label', `Repair schedule for ${report.type || 'issue report'}`);

            const scheduleButton = document.createElement('button');
            scheduleButton.className = 'save-schedule';
            scheduleButton.type = 'submit';
            scheduleButton.textContent = 'Save schedule';

            scheduleForm.append(scheduleLabel, scheduleInput, scheduleButton);
            scheduleForm.addEventListener('submit', event => {
                event.preventDefault();
                if (!scheduleInput.value) {
                    adminFeedback.textContent = 'Choose a date and time for the repair.';
                    return;
                }
                saveReportChanges(report.id, { scheduledAt: new Date(scheduleInput.value).toISOString() }, 'Repair schedule saved.');
            });
            meta.append(scheduleForm);

            const actions = document.createElement('div');
            actions.className = 'report-actions';

            const repairedButton = document.createElement('button');
            repairedButton.className = 'confirm-report';
            repairedButton.type = 'button';
            repairedButton.textContent = 'Mark repaired';
            repairedButton.addEventListener('click', () => saveReportChanges(report.id, {
                status: 'Resolved',
                resolvedAt: new Date().toISOString()
            }, 'Report marked repaired and moved to History.'));

            const removeButton = document.createElement('button');
            removeButton.className = 'remove-report';
            removeButton.type = 'button';
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => saveReportChanges(report.id, {
                status: 'Archived',
                archivedAt: new Date().toISOString()
            }, 'Report removed from the active queue and saved to History.'));

            actions.append(repairedButton, removeButton);
            meta.append(actions);
        }

        item.append(details, meta);
        return item;
    };

    const renderReports = () => {
        const pendingReports = reports.filter(isPending);
        const ongoingReports = reports.filter(isOngoing);
        const historyReports = reports.filter(report => isResolved(report) || isArchived(report));
        pendingList.replaceChildren();
        ongoingList.replaceChildren();
        historyList.replaceChildren();
        emptyPending.hidden = pendingReports.length > 0;
        emptyOngoing.hidden = ongoingReports.length > 0;
        emptyHistory.hidden = historyReports.length > 0;
        document.querySelector('#pending-count').textContent = `${pendingReports.length} pending`;
        document.querySelector('#ongoing-count').textContent = `${ongoingReports.length} on-going`;
        document.querySelector('#resolved-count').textContent = `${historyReports.length} items`;

        pendingReports.forEach(report => pendingList.append(createReportItem(report, 'Pending', 'pending')));
        ongoingReports.forEach(report => ongoingList.append(createReportItem(report, 'On-going', 'ongoing')));
        historyReports.forEach(report => historyList.append(createReportItem(report, isArchived(report) ? 'Removed' : 'Resolved')));
    };

    const renderAccounts = async () => {
        const accountList = document.querySelector('#account-list');
        const { data: accounts, error } = await window.monitorSupabase
            .from('profiles')
            .select('username, email, created_at')
            .order('created_at', { ascending: false });
        if (error) {
            throw error;
        }
        accountList.replaceChildren();

        accounts.forEach(account => {
            const item = document.createElement('li');
            item.className = 'account-item';

            const identity = document.createElement('div');
            identity.className = 'account-identity';

            const name = document.createElement('strong');
            name.textContent = account.username || 'Unnamed account';

            const email = document.createElement('span');
            email.textContent = account.email || 'Email not recorded';

            const created = document.createElement('time');
            created.className = 'account-created';
            const createdDate = account.created_at ? new Date(account.created_at) : null;
            if (createdDate && !Number.isNaN(createdDate.getTime())) {
                created.dateTime = createdDate.toISOString();
                created.textContent = createdDate.toLocaleString();
            } else {
                created.textContent = 'Creation date not recorded';
            }

            identity.append(name, email);
            item.append(identity, created);
            accountList.append(item);
        });

        document.querySelector('#account-count').textContent = `${accounts.length} ${accounts.length === 1 ? 'account' : 'accounts'}`;
    };

    document.querySelector('#logout-button').addEventListener('click', async () => {
        try {
            const { error } = await window.monitorSupabase.auth.signOut();
            if (error) {
                throw error;
            }
            sessionStorage.removeItem(sessionKey);
            window.location.assign('index.html');
        } catch (error) {
            adminFeedback.textContent = `Could not log out: ${error.message}`;
        }
    });

    const initializeAdmin = async () => {
        if (!window.monitorSupabase) {
            throw new Error(window.monitorSupabaseError || 'Could not connect to shared storage.');
        }
        const { data: { user }, error: authError } = await window.monitorSupabase.auth.getUser();
        if (authError) {
            throw authError;
        }
        if (!user) {
            sessionStorage.removeItem(sessionKey);
            window.location.replace('index.html');
            return;
        }

        const { data: profile, error: profileError } = await window.monitorSupabase
            .from('profiles')
            .select('username, role')
            .eq('id', user.id)
            .single();
        if (profileError) {
            throw profileError;
        }
        if (profile.role !== 'admin') {
            window.location.replace('app.html');
            return;
        }

        currentUser.id = user.id;
        document.querySelector('#admin-name').textContent = profile.username || 'Admin';
        await Promise.all([refreshReports(), renderAccounts()]);
    };

    renderReports();
    initializeAdmin().catch(error => {
        adminFeedback.textContent = `Could not load shared admin data: ${error.message}`;
    });
    window.addEventListener('focus', () => refreshReports().catch(error => {
        adminFeedback.textContent = `Could not refresh reports: ${error.message}`;
    }));
    window.setInterval(() => {
        if (!document.hidden) {
            refreshReports().catch(error => {
                adminFeedback.textContent = `Could not refresh reports: ${error.message}`;
            });
        }
    }, 20000);
}