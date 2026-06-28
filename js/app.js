// --- Глобальное состояние ---
let state = {
    transactions: [],
    categories: {
        expense: ['Продукты', 'Транспорт', 'Жилье', 'Развлечения'],
        income: ['Зарплата', 'Фриланс', 'Инвестиции']
    }
};

let config = { ghToken: '', ghRepo: '' };

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', async () => {
    // Восстанавливаем данные из локального хранилища
    const savedConfig = localStorage.getItem('finance_config');
    if (savedConfig) config = JSON.parse(savedConfig);
    
    const savedState = localStorage.getItem('finance_state');
    if (savedState) state = JSON.parse(savedState);

    initTabs();
    initForms();
    updateAuthStatus();
    
    // Загружаем актуальные данные с GitHub
    await loadData();
    renderAll();
});

// --- Работа с API ---
async function loadData() {
    if (!config.ghRepo || !config.ghToken) return false;
    try {
        const url = `https://corsproxy.io/?https://api.github.com/repos/${config.ghRepo}/contents/data.json?t=${Date.now()}`;
        const response = await fetch(url, { headers: { 'Authorization': `token ${config.ghToken}` } });
        
        if (response.ok) {
            const data = await response.json();
            state = JSON.parse(decodeURIComponent(escape(atob(data.content))));
            saveLocalData();
            renderAll();
            return true;
        }
    } catch (err) { console.error("Ошибка загрузки:", err); }
    return false;
}

async function syncWithGitHub() {
    if (!config.ghRepo || !config.ghToken) return alert('Заполните настройки!');
    try {
        const url = `https://corsproxy.io/?https://api.github.com/repos/${config.ghRepo}/contents/data.json`;
        const resGet = await fetch(url, { headers: { 'Authorization': `token ${config.ghToken}` } });
        const fileInfo = await resGet.json();
        
        const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(state, null, 2))));
        const resPut = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${config.ghToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Update finance data', content: contentBase64, sha: fileInfo.sha })
        });
        if (resPut.ok) alert('Успешно сохранено на GitHub!');
        else throw new Error('Ошибка записи');
    } catch (err) { alert('Ошибка: ' + err.message); }
}

// --- Отрисовка ---
function renderAll() {
    updateCategorySelects();
    updateAuthStatus();
    // Вызов ваших функций отрисовки (если их нет, они не вызовут ошибку)
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderHistory === 'function') renderHistory();
}

function updateCategorySelects() {
    const typeEl = document.querySelector('input[name="type"]:checked');
    const select = document.getElementById('tx-category');
    if (!select) return;
    
    const type = typeEl ? typeEl.value : 'expense';
    select.innerHTML = '';
    if (state.categories[type]) {
        state.categories[type].forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat; opt.textContent = cat;
            select.appendChild(opt);
        });
    }
}

// --- Обработка событий ---
function initForms() {
    document.getElementById('transaction-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const t = {
            id: Date.now().toString(),
            type: document.querySelector('input[name="type"]:checked').value,
            category: document.getElementById('tx-category').value,
            amount: parseFloat(document.getElementById('tx-amount').value),
            date: document.getElementById('tx-date').value
        };
        state.transactions.unshift(t);
        saveLocalData();
        renderAll();
    });

    document.querySelectorAll('input[name="type"]').forEach(el => {
        el.addEventListener('change', updateCategorySelects);
    });

    document.getElementById('settings-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        config.ghToken = document.getElementById('gh-token').value.trim();
        config.ghRepo = document.getElementById('gh-repo').value.trim();
        localStorage.setItem('finance_config', JSON.stringify(config));
        updateAuthStatus();
        loadData();
    });

    document.getElementById('main-save-btn')?.addEventListener('click', syncWithGitHub);
}

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(btn.getAttribute('data-tab'));
            if (target) target.classList.add('active');
        });
    });
}

function updateAuthStatus() {
    const badge = document.getElementById('auth-status');
    if (badge) {
        const isAuth = config.ghToken && config.ghRepo;
        badge.textContent = isAuth ? "GitHub подключен" : "Не авторизован";
        badge.className = isAuth ? "status-badge success" : "status-badge error";
    }
}

function saveLocalData() { localStorage.setItem('finance_state', JSON.stringify(state)); }
