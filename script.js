const wrapper = document.querySelector('.wrapper');
const loginLink = document.querySelector('.login-link');
const registerLink = document.querySelector('.register-link');
const btnPopup = document.querySelector('.btnLogin-popup');
const iconClose = document.querySelector('.icon-close');

registerLink.addEventListener('click', ()=> {
    wrapper.classList.add('active');
});

loginLink.addEventListener('click', ()=> {
    wrapper.classList.remove('active');
});

btnPopup.addEventListener('click', ()=> {
    wrapper.classList.add('active-popup');
});

iconClose.addEventListener('click', ()=> {
    wrapper.classList.remove('active-popup');
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
