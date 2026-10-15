const adminEmail = 'admin123@gmail.com';
const sessionKey = 'monitor-current-user';

const loadCurrentUser = () => {
    try {
        return JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
    } catch {
        return null;
    }
};

const currentUser = loadCurrentUser();

if (!currentUser?.email) {
    window.location.replace('index.html');
} else if (currentUser.email.trim().toLowerCase() !== adminEmail) {
    window.location.replace('app.html');
} else {
    const accountStorageKey = 'monitor-accounts';
    const reportStorageKey = 'monitor-issue-reports';
    const pendingList = document.querySelector('#pending-list');
    const emptyPending = document.querySelector('#empty-pending');
    const ongoingList = document.querySelector('#ongoing-list');
    const emptyOngoing = document.querySelector('#empty-ongoing');
    const historyList = document.querySelector('#history-list');
    const emptyHistory = document.querySelector('#empty-history');
    const adminFeedback = document.querySelector('#admin-feedback');
    const adminTabs = [...document.querySelectorAll('[role="tab"]')];

    document.querySelector('#admin-name').textContent = currentUser.username || 'Admin';

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

    const loadStoredItems = key => {
        try {
            const items = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(items) ? items : [];
        } catch {
            return [];
        }
    };

    const loadReports = () => {
        const reports = loadStoredItems(reportStorageKey);
        let needsSave = false;
        reports.forEach((report, index) => {
            if (!report.id) {
                report.id = `legacy-${report.createdAt || 'unknown'}-${index}`;
                needsSave = true;
            }
        });
        if (needsSave) {
            try {
                localStorage.setItem(reportStorageKey, JSON.stringify(reports));
            } catch {
                return reports;
            }
        }
        return reports;
    };

    let reports = loadReports();
    const isPending = report => report.status === 'Pending' || report.status === 'Open';
    const isOngoing = report => report.status === 'On-going' || report.status === 'Ongoing' || report.status === 'Confirmed';
    const isResolved = report => report.status === 'Resolved' || report.status === 'Solved';
    const isArchived = report => report.status === 'Archived';

    const saveReportChanges = (reportId, changes, successMessage) => {
        const report = reports.find(savedReport => savedReport.id === reportId);
        if (!report) {
            return;
        }

        const previousReport = { ...report };
        Object.assign(report, changes);
        try {
            localStorage.setItem(reportStorageKey, JSON.stringify(reports));
            adminFeedback.textContent = successMessage;
            renderReports();
        } catch {
            reports[reports.indexOf(report)] = previousReport;
            adminFeedback.textContent = 'Could not save this update in the browser.';
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

    const renderAccounts = () => {
        const accountList = document.querySelector('#account-list');
        const accounts = loadStoredItems(accountStorageKey);
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
            const createdDate = account.createdAt ? new Date(account.createdAt) : null;
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

    document.querySelector('#logout-button').addEventListener('click', () => {
        sessionStorage.removeItem(sessionKey);
        window.location.assign('index.html');
    });

    window.addEventListener('storage', event => {
        if (event.key === reportStorageKey) {
            reports = loadReports();
            renderReports();
        }
    });

    renderReports();
    renderAccounts();
}