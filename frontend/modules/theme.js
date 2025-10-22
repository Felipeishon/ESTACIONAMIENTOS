const applyTheme = (theme) => {
    document.body.classList.toggle('dark-theme', theme === 'dark');
};

const toggleTheme = () => {
    const newTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
};

export function initTheme() {
    const themeToggleButton = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    }
    themeToggleButton.addEventListener('click', toggleTheme);
}
