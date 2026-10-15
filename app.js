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
    const dashboardName = document.querySelector('#dashboard-name');
    const reportForm = document.querySelector('#report-form');
    const issueArea = document.querySelector('#issue-area');
    const locationStatus = document.querySelector('#location-status');
    const reportFeedback = document.querySelector('#report-feedback');
    const reportList = document.querySelector('#report-list');
    const emptyReports = document.querySelector('#empty-reports');
    const historyList = document.querySelector('#history-list');
    const emptyHistory = document.querySelector('#empty-history');
    const photoInput = document.querySelector('#issue-photo');
    const photoPreview = document.querySelector('#photo-preview');
    const photoPreviewImage = document.querySelector('#photo-preview-image');
    const photoStatus = document.querySelector('#photo-status');
    const userTabs = [...document.querySelectorAll('[role="tab"]')];
    const maxPhotoSize = 5 * 1024 * 1024;
    const maxStoredPhotoSize = 512 * 1024;

    dashboardName.textContent = currentUser.username || currentUser.email?.split('@')[0] || 'there';

    const activateUserTab = activeTab => {
        userTabs.forEach(tab => {
            const isActive = tab === activeTab;
            tab.setAttribute('aria-selected', String(isActive));
            tab.tabIndex = isActive ? 0 : -1;
            document.querySelector(`#${tab.getAttribute('aria-controls')}`).hidden = !isActive;
        });
    };

    userTabs.forEach((tab, index) => {
        tab.addEventListener('click', () => activateUserTab(tab));
        tab.addEventListener('keydown', event => {
            let nextIndex = index;
            if (event.key === 'ArrowRight') {
                nextIndex = (index + 1) % userTabs.length;
            } else if (event.key === 'ArrowLeft') {
                nextIndex = (index - 1 + userTabs.length) % userTabs.length;
            } else if (event.key === 'Home') {
                nextIndex = 0;
            } else if (event.key === 'End') {
                nextIndex = userTabs.length - 1;
            } else {
                return;
            }

            event.preventDefault();
            userTabs[nextIndex].focus();
            activateUserTab(userTabs[nextIndex]);
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
    const isPendingReport = report => report.status === 'Pending' || report.status === 'Open';
    const isOngoingReport = report => report.status === 'On-going' || report.status === 'Ongoing' || report.status === 'Confirmed';
    const isHistoryReport = report => ['Resolved', 'Solved', 'Archived'].includes(report.status);

    const blobToDataUrl = blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => resolve(reader.result));
        reader.addEventListener('error', () => reject(new Error('Could not read this image.')));
        reader.readAsDataURL(blob);
    });

    const preparePhotoAsDataUrl = async file => {
        const bitmap = await createImageBitmap(file);
        try {
            for (const maxDimension of [1600, 1280, 960]) {
                const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(bitmap.width * scale));
                canvas.height = Math.max(1, Math.round(bitmap.height * scale));
                const context = canvas.getContext('2d');
                if (!context) {
                    throw new Error('Could not process this image.');
                }
                context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

                for (const quality of [.82, .72, .62, .52]) {
                    const compressedBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
                    if (compressedBlob && compressedBlob.size <= maxStoredPhotoSize) {
                        return blobToDataUrl(compressedBlob);
                    }
                }
            }
        } finally {
            bitmap.close();
        }

        throw new Error('Could not reduce this photo enough for shared storage. Choose a smaller image.');
    };

    const validatePhoto = file => {
        if (!file) {
            return '';
        }
        if (!file.type.startsWith('image/')) {
            return 'Choose an image file.';
        }
        if (file.size > maxPhotoSize) {
            return 'Choose an image smaller than 5 MB.';
        }
        return '';
    };

    const createReportItem = (report, statusText) => {
        const item = document.createElement('li');
        item.className = 'report-item';

        const details = document.createElement('div');
        details.className = 'report-details';

        const title = document.createElement('span');
        title.className = 'report-type-value';
        title.textContent = report.type;
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
        description.textContent = report.description;
        const descriptionLabel = document.createElement('span');
        descriptionLabel.className = 'report-detail-label';
        descriptionLabel.textContent = 'What happened?';

        if (typeof report.photoDataUrl === 'string' && report.photoDataUrl.startsWith('data:image/')) {
            const evidence = document.createElement('figure');
            evidence.className = 'report-photo-proof';

            const image = document.createElement('img');
            image.src = report.photoDataUrl;
            image.alt = `Photo evidence for ${report.type}`;

            const caption = document.createElement('figcaption');
            caption.textContent = 'Uploaded photo proof';
            evidence.append(image, caption);
            details.append(typeLabel, title, areaLabel, area, descriptionLabel, description, evidence);
        } else {
            const noPhoto = document.createElement('p');
            noPhoto.className = 'report-proof-missing';
            noPhoto.textContent = 'No photo proof attached';
            details.append(typeLabel, title, areaLabel, area, descriptionLabel, description, noPhoto);
        }

        const meta = document.createElement('div');
        meta.className = 'report-meta';

        const timestamp = document.createElement('time');
        timestamp.dateTime = report.createdAt;
        timestamp.textContent = new Date(report.createdAt).toLocaleString();

        const status = document.createElement('span');
        status.className = 'report-status';
        if (statusText === 'Resolved') {
            status.classList.add('is-resolved');
        } else if (statusText === 'On-going') {
            status.classList.add('is-ongoing');
        } else if (statusText === 'Removed') {
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

        item.append(details, meta);
        return item;
    };

    const renderReports = () => {
        const pendingReports = reports.filter(isPendingReport);
        const activeReports = reports.filter(report => isPendingReport(report) || isOngoingReport(report));
        const historyReports = reports.filter(isHistoryReport);
        reportList.replaceChildren();
        historyList.replaceChildren();
        emptyReports.hidden = activeReports.length > 0;
        emptyHistory.hidden = historyReports.length > 0;

        activeReports.forEach(report => {
            const status = isOngoingReport(report) ? 'On-going' : 'Pending';
            reportList.append(createReportItem(report, status));
        });
        historyReports.forEach(report => {
            historyList.append(createReportItem(report, report.status === 'Archived' ? 'Removed' : 'Resolved'));
        });

        document.querySelector('#total-reports').textContent = reports.length;
        document.querySelector('#open-reports').textContent = pendingReports.length;
        document.querySelector('#report-count').textContent = `${activeReports.length} active`;
        document.querySelector('#history-count').textContent = `${historyReports.length} items`;
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
            reportFeedback.textContent = `Could not log out: ${error.message}`;
        }
    });

    const locateButton = document.querySelector('#locate-button');
    const submitReportButton = reportForm.querySelector('[type="submit"]');
    let isDashboardReady = false;
    let isSubmittingReport = false;
    submitReportButton.disabled = true;
    let selectedPhotoDataUrl = '';

    photoInput.addEventListener('change', async () => {
        selectedPhotoDataUrl = '';
        photoPreview.hidden = true;
        photoStatus.textContent = '';
        const file = photoInput.files[0];
        const validationMessage = validatePhoto(file);
        if (validationMessage) {
            photoInput.value = '';
            photoStatus.textContent = validationMessage;
            return;
        }
        if (!file) {
            return;
        }

        photoStatus.textContent = 'Preparing photo...';
        submitReportButton.disabled = true;
        try {
            selectedPhotoDataUrl = await preparePhotoAsDataUrl(file);
            photoPreviewImage.src = selectedPhotoDataUrl;
            photoPreview.hidden = false;
            photoStatus.textContent = 'Photo ready to attach. A smaller copy will be saved with the report.';
        } catch (error) {
            photoInput.value = '';
            selectedPhotoDataUrl = '';
            photoStatus.textContent = error.message;
        } finally {
            submitReportButton.disabled = !isDashboardReady || isSubmittingReport;
        }
    });

    locateButton.addEventListener('click', () => {
        if (!navigator.geolocation) {
            locationStatus.textContent = 'Device location is unavailable. Enter the area manually.';
            return;
        }

        locateButton.disabled = true;
        locationStatus.textContent = 'Finding your location and looking up its address...';
        navigator.geolocation.getCurrentPosition(async position => {
            const query = new URLSearchParams({
                format: 'jsonv2',
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                zoom: '18',
                addressdetails: '1'
            });
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query}`, {
                    signal: controller.signal
                });
                if (!response.ok) {
                    throw new Error('Address lookup failed');
                }

                const place = await response.json();
                const address = place.address || {};
                const street = [
                    address.house_number,
                    address.road || address.pedestrian || address.residential || address.footway || address.path
                ].filter(Boolean).join(' ');
                const neighborhood = address.neighbourhood || address.suburb || address.quarter || address.city_district || address.village || address.hamlet;
                const city = address.city || address.town || address.municipality || address.county;
                const shortAddress = [street, neighborhood, city]
                    .filter((part, index, parts) => part && parts.findIndex(candidate => candidate?.toLowerCase() === part.toLowerCase()) === index)
                    .join(', ');
                const fallbackAddress = place.name || place.display_name?.split(',').slice(0, 2).join(',').trim();
                if (!shortAddress && !fallbackAddress) {
                    throw new Error('No address found');
                }

                issueArea.value = shortAddress || fallbackAddress;
                locationStatus.textContent = 'Address found. Check it for accuracy.';
            } catch {
                locationStatus.textContent = 'Could not look up an address. Enter the current area manually.';
            } finally {
                clearTimeout(timeoutId);
                locateButton.disabled = false;
            }
        }, error => {
            locationStatus.textContent = error.code === error.PERMISSION_DENIED
                ? 'Location permission was denied. Enter the area manually.'
                : 'Could not get your location. Enter the area manually.';
            locateButton.disabled = false;
        }, { enableHighAccuracy: true, timeout: 10000 });
    });

    reportForm.addEventListener('submit', async event => {
        event.preventDefault();
        reportFeedback.textContent = '';
        if (!isDashboardReady) {
            reportFeedback.textContent = 'Wait for shared storage to finish connecting before submitting.';
            return;
        }
        const photoFile = photoInput.files[0];
        const validationMessage = validatePhoto(photoFile);
        if (validationMessage) {
            photoStatus.textContent = validationMessage;
            return;
        }

        if (photoFile && !selectedPhotoDataUrl) {
            photoStatus.textContent = 'Wait for the photo to finish preparing, then submit again.';
            return;
        }

        const formData = new FormData(reportForm);
        isSubmittingReport = true;
        submitReportButton.disabled = true;
        photoInput.disabled = true;
        try {
            const { data, error } = await window.monitorSupabase
                .from('reports')
                .insert({
                    user_id: currentUser.id,
                    type: formData.get('type'),
                    area: formData.get('area').trim(),
                    description: formData.get('description').trim(),
                    photo_data_url: selectedPhotoDataUrl
                })
                .select('*')
                .single();
            if (error) {
                throw error;
            }

            reports.unshift(fromDatabaseReport(data));
            renderReports();
            reportForm.reset();
            selectedPhotoDataUrl = '';
            photoPreview.hidden = true;
            photoPreviewImage.removeAttribute('src');
            photoStatus.textContent = '';
            locationStatus.textContent = '';
            reportFeedback.textContent = 'Your report has been saved and shared.';
        } catch (error) {
            reportFeedback.textContent = `Could not save your report: ${error.message}`;
        } finally {
            isSubmittingReport = false;
            photoInput.disabled = false;
            submitReportButton.disabled = !isDashboardReady;
        }
    });

    const initializeDashboard = async () => {
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
        if (profile.role === 'admin') {
            window.location.replace('admin.html');
            return;
        }

        currentUser.id = user.id;
        currentUser.email = user.email;
        dashboardName.textContent = profile.username || user.email.split('@')[0];
        await refreshReports();
        isDashboardReady = true;
        submitReportButton.disabled = false;
    };

    initializeDashboard().catch(error => {
        reportFeedback.textContent = `Could not load shared reports: ${error.message}`;
    });
    window.addEventListener('focus', () => refreshReports().catch(error => {
        reportFeedback.textContent = `Could not refresh reports: ${error.message}`;
    }));
    window.setInterval(() => {
        if (!document.hidden) {
            refreshReports().catch(error => {
                reportFeedback.textContent = `Could not refresh reports: ${error.message}`;
            });
        }
    }, 20000);
}