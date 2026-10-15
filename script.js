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
const resetPassword = document.querySelector('#reset-password');
const confirmPassword = document.querySelector('#confirm-password');
const resetRequestFields = document.querySelector('#reset-request-fields');
const resetPasswordFields = document.querySelector('#reset-password-fields');
const resetFeedback = document.querySelector('#reset-feedback');
const resetLoginLink = document.querySelector('#reset-login-link');
const resetSubmitButton = resetForm.querySelector('[type="submit"]');

const setAuthFeedback = (element, message, state = 'error') => {
    element.textContent = message;
    element.dataset.state = state;
};

const ensureSupabase = () => {
    if (!window.monitorSupabase) {
        throw new Error(window.monitorSupabaseError || 'Could not connect to shared storage.');
    }
    return window.monitorSupabase;
};

const showPasswordResetForm = () => {
    resetRequestFields.hidden = true;
    resetPasswordFields.hidden = false;
    resetEmail.required = false;
    resetPassword.required = true;
    confirmPassword.required = true;
    resetSubmitButton.textContent = 'Update password';
    wrapper.classList.remove('active');
    wrapper.classList.add('reset-mode', 'active-popup');
};

registerLink.addEventListener('click', () => {
    loginFeedback.textContent = '';
    registerFeedback.textContent = '';
    wrapper.classList.add('active');
});

loginLink.addEventListener('click', () => {
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
    resetRequestFields.hidden = false;
    resetPasswordFields.hidden = true;
    resetEmail.required = true;
    resetPassword.required = false;
    confirmPassword.required = false;
    resetSubmitButton.textContent = 'Send reset link';
    wrapper.classList.remove('active');
    wrapper.classList.add('reset-mode');
});

resetLoginLink.addEventListener('click', event => {
    event.preventDefault();
    resetFeedback.textContent = '';
    wrapper.classList.remove('reset-mode', 'active');
});

iconClose.addEventListener('click', () => {
    wrapper.classList.remove('active-popup');
});

loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginFeedback.textContent = '';

    try {
        const supabase = ensureSupabase();
        const email = loginEmail.value.trim().toLowerCase();
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: loginPassword.value
        });
        if (error) {
            throw error;
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('username, role')
            .eq('id', data.user.id)
            .single();
        if (profileError) {
            throw profileError;
        }

        sessionStorage.setItem('monitor-current-user', JSON.stringify({
            username: profile.username,
            email: data.user.email,
            role: profile.role
        }));
        window.location.assign(profile.role === 'admin' ? 'admin.html' : 'app.html');
    } catch (error) {
        setAuthFeedback(loginFeedback, error.message || 'Could not log in.');
    }
});

registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    registerFeedback.textContent = '';

    const formData = new FormData(registerForm);
    const username = formData.get('username').trim();
    const email = formData.get('email').trim().toLowerCase();
    const password = formData.get('password');

    try {
        const supabase = ensureSupabase();
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { username } }
        });
        if (error) {
            throw error;
        }

        registerForm.reset();
        wrapper.classList.remove('active');
        loginEmail.value = email;
        if (data.session) {
            setAuthFeedback(loginFeedback, 'Account created. You can log in now.', 'success');
        } else {
            setAuthFeedback(loginFeedback, 'Account created. Check your email to confirm it, then log in.', 'success');
        }
    } catch (error) {
        setAuthFeedback(registerFeedback, error.message || 'Could not create your account.');
    }
});

resetForm.addEventListener('submit', async event => {
    event.preventDefault();
    resetFeedback.textContent = '';

    try {
        const supabase = ensureSupabase();
        if (resetPasswordFields.hidden) {
            const { error } = await supabase.auth.resetPasswordForEmail(
                resetEmail.value.trim().toLowerCase(),
                { redirectTo: `${window.location.origin}${window.location.pathname}` }
            );
            if (error) {
                throw error;
            }
            setAuthFeedback(resetFeedback, 'If an account exists, a password reset link has been sent.', 'success');
            return;
        }

        if (resetPassword.value !== confirmPassword.value) {
            throw new Error('The passwords do not match.');
        }

        const { error } = await supabase.auth.updateUser({ password: resetPassword.value });
        if (error) {
            throw error;
        }

        resetForm.reset();
        resetRequestFields.hidden = false;
        resetPasswordFields.hidden = true;
        resetEmail.required = true;
        resetPassword.required = false;
        confirmPassword.required = false;
        resetSubmitButton.textContent = 'Send reset link';
        wrapper.classList.remove('reset-mode', 'active');
        setAuthFeedback(loginFeedback, 'Password updated. Log in with your new password.', 'success');
    } catch (error) {
        setAuthFeedback(resetFeedback, error.message || 'Could not reset your password.');
    }
});

btnPopup.addEventListener('click', () => {
    wrapper.classList.add('active-popup');
});

window.monitorSupabase?.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') {
        showPasswordResetForm();
    }
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
    toggle.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            togglePassword();
        }
    });
});
