const wrapper = document.querySelector('.wrapper');
const loginLink = document.querySelector('.login-link');
const registerLink = document.querySelector('.register-link');
const btnPopup = document.querySelector('.btnLogin-popup');
const iconClose = document.querySelector('.icon-close');
const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
const loginEmail = document.querySelector('#login-email');
const loginPassword = document.querySelector('#login-password');
const loginFeedback = document.querySelector('#login-feedback');
const registerFeedback = document.querySelector('#register-feedback');
const forgotPasswordLink = document.querySelector('#forgot-password-link');
const resetForm = document.querySelector('#reset-form');
const resetEmail = document.querySelector('#reset-email');
const resetFeedback = document.querySelector('#reset-feedback');
const resetLoginLink = document.querySelector('#reset-login-link');
const accountStorageKey = 'monitor-accounts';
const adminEmail = 'admin123@gmail.com';
const adminDefaultPassword = 'Admin123!';

const loadAccounts = () => {
    try {
        const savedAccounts = JSON.parse(localStorage.getItem(accountStorageKey) || '[]');
        return Array.isArray(savedAccounts) ? savedAccounts : [];
    } catch {
        return [];
    }
};

const hashPassword = async password => {
    if (!window.crypto?.subtle) {
        throw new Error('Secure password storage is unavailable in this browser. Open this page through localhost or HTTPS.');
    }

    const passwordBytes = new TextEncoder().encode(password);
    const digest = await window.crypto.subtle.digest('SHA-256', passwordBytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

const setAuthFeedback = (element, message, state = 'error') => {
    element.textContent = message;
    element.dataset.state = state;
};

registerLink.addEventListener('click', ()=> {
    loginFeedback.textContent = '';
    registerFeedback.textContent = '';
    wrapper.classList.add('active');
});

loginLink.addEventListener('click', ()=> {
    loginFeedback.textContent = '';
    registerFeedback.textContent = '';
    wrapper.classList.remove('active');
});

forgotPasswordLink.addEventListener('click', event => {
    event.preventDefault();
    loginFeedback.textContent = '';
    resetFeedback.textContent = '';
    resetForm.reset();
    resetEmail.value = loginEmail.value.trim();
    wrapper.classList.remove('active');
    wrapper.classList.add('reset-mode');
});

resetLoginLink.addEventListener('click', event => {
    event.preventDefault();
    resetFeedback.textContent = '';
    wrapper.classList.remove('reset-mode', 'active');
});

iconClose.addEventListener('click', ()=> {
    wrapper.classList.remove('active-popup');
});

loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginFeedback.textContent = '';

    const email = loginEmail.value.trim().toLowerCase();
    const password = loginPassword.value;

    try {
        const passwordHash = await hashPassword(password);
        let accounts = loadAccounts();
        let account = accounts.find(savedAccount => savedAccount.email === email);

        if (!account && email === adminEmail) {
            if (password !== adminDefaultPassword) {
                setAuthFeedback(loginFeedback, `Use the built-in admin password: ${adminDefaultPassword}`);
                return;
            }

            account = {
                username: 'Admin',
                email,
                passwordHash,
                createdAt: new Date().toISOString()
            };
            accounts.push(account);
            localStorage.setItem(accountStorageKey, JSON.stringify(accounts));
        }

        if (!account) {
            setAuthFeedback(loginFeedback, 'No account found for this email. Register first.');
            return;
        }

        if (passwordHash !== account.passwordHash) {
            setAuthFeedback(loginFeedback, 'Incorrect password. Please try again.');
            return;
        }

        sessionStorage.setItem('monitor-current-user', JSON.stringify({
            username: account.username,
            email
        }));
        window.location.assign(email === adminEmail ? 'admin.html' : 'app.html');
    } catch (error) {
        setAuthFeedback(loginFeedback, error.message || 'Could not verify your login.');
    }
});

registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    registerFeedback.textContent = '';

    const formData = new FormData(registerForm);
    const username = formData.get('username').trim();
    const email = formData.get('email').trim().toLowerCase();
    const password = formData.get('password');
    const accounts = loadAccounts();

    if (accounts.some(account => account.email === email)) {
        setAuthFeedback(registerFeedback, 'An account with this email already exists. Log in instead.');
        return;
    }

    try {
        const passwordHash = await hashPassword(password);
        accounts.push({ username, email, passwordHash, createdAt: new Date().toISOString() });
        localStorage.setItem(accountStorageKey, JSON.stringify(accounts));
        registerForm.reset();
        wrapper.classList.remove('active');
        loginEmail.value = email;
        setAuthFeedback(loginFeedback, 'Account created. You can log in now.', 'success');
    } catch (error) {
        setAuthFeedback(registerFeedback, error.message || 'Could not save your account in this browser.');
    }
});

resetForm.addEventListener('submit', async event => {
    event.preventDefault();
    resetFeedback.textContent = '';

    const formData = new FormData(resetForm);
    const email = formData.get('email').trim().toLowerCase();
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    const accounts = loadAccounts();
    const accountIndex = accounts.findIndex(account => account.email === email);

    if (accountIndex === -1) {
        setAuthFeedback(resetFeedback, 'No account found for this email.');
        return;
    }

    if (password !== confirmPassword) {
        setAuthFeedback(resetFeedback, 'The passwords do not match.');
        return;
    }

    try {
        accounts[accountIndex].passwordHash = await hashPassword(password);
        localStorage.setItem(accountStorageKey, JSON.stringify(accounts));
        resetForm.reset();
        loginEmail.value = email;
        loginPassword.value = '';
        wrapper.classList.remove('reset-mode', 'active');
        setAuthFeedback(loginFeedback, 'Password updated. Log in with your new password.', 'success');
    } catch (error) {
        setAuthFeedback(resetFeedback, error.message || 'Could not update your password.');
    }
});

btnPopup.addEventListener('click', () => {
    wrapper.classList.add('active-popup');
});

document.querySelectorAll('.toggle-password').forEach(toggle => {
    const togglePassword = () => {
        const input = toggle.parentElement.querySelector('input');
        const icon = toggle.querySelector('ion-icon');
        const show = input.type === 'password';

        input.type = show ? 'text' : 'password';
        icon.setAttribute('name', show ? 'eye-outline' : 'eye-off-outline');
        toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    };

    toggle.addEventListener('click', togglePassword);
    toggle.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePassword();
        }
    });
});