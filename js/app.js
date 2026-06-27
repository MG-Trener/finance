// Глобальное состояние приложения
let state = {
    transactions: [],
    categories: {
        expense: ['Продукты', 'Транспорт', 'Жилье', 'Развлечения'],
        income: ['Зарплата', 'Фриланс', 'Инвестиции']
    }
};

let config = {
    ghToken: '',
    ghRepo: '',
    aiKey: ''
};

let expenseChart = null;
let incomeChart = null;

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initForms();
    await loadData();
    renderAll();
});

// ИСПРАВЛЕННАЯ ФУНКЦИЯ ЗАГРУЗКИ (Без проблемных заголовков)
async function loadData() {
    const savedConfig = localStorage.getItem('finance_config');
    if (savedConfig) {
        try { 
            config = JSON.parse(savedConfig);
            if (document.getElementById('gh-token')) document.getElementById('gh-token').value = config.ghToken || '';
            if (document.getElementById('gh-repo')) document.getElementById('gh-repo').value = config.ghRepo || '';
            if (document.getElementById('ai-key')) document.getElementById('ai-key').value = config.aiKey || '';
            updateAuthStatus();
        } catch(e) {}
    }

    const savedState = localStorage.getItem('finance_state');
    if (savedState) {
        try { state = JSON.parse(savedState); } catch(e) {}
    }

    if (config.ghRepo && config.ghToken) {
        try {
            const response = await fetch(`https://api.github.com/repos/${config.ghRepo}/contents/data.json`, {
                headers: {
                    'Authorization': `token ${config.ghToken}`,
                    'Accept': 'application/vnd.github.v3.raw'
                }
            });
            if (response.ok) {
                const remoteData = await response.json();
                state = remoteData;
                saveLocalData();
                return true;
            }
        } catch (err) {
            console.error("Ошибка загрузки:", err);
        }
    }
    return false;
}

function saveLocalData() {
    localStorage.setItem('finance_state', JSON.stringify(state));
}

// ИСПРАВЛЕННАЯ ФУНКЦИЯ СИНХРОНИЗАЦИИ
async function syncWithGitHub() {
    if (!config.ghRepo || !config.ghToken) {
        alert('Заполните настройки!');
        return;
    }

    try {
        let sha = '';
        // 1. Получаем SHA (GET запрос)
        const resGet = await fetch(`https://api.github.com/repos/${config.ghRepo}/contents/data.json`, {
            headers: { 'Authorization': `token ${config.ghToken}` }
        });
        
        if (resGet.ok) {
            const fileInfo = await resGet.json();
            sha = fileInfo.sha;
        }

        // 2. Отправляем данные (PUT запрос)
        const jsonString = JSON.stringify(state, null, 2);
        const base64Content = btoa(unescape(encodeURIComponent(jsonString)));

        const resPut = await fetch(`https://api.github.com/repos/${config.ghRepo}/contents/data.json`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${config.ghToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Update data.json',
                content: base64Content,
                sha: sha || undefined
            })
        });

        if (resPut.ok) {
            alert('Успешно сохранено на GitHub!');
        } else {
            throw new Error('Ошибка при отправке данных');
        }
    } catch (err) {
        console.error(err);
        alert('Ошибка: ' + err.message);
    }
}

// Вспомогательные функции (Tabs, Forms, Render - без изменений)
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
        });
    });
}

function updateAuthStatus() {
    const badge = document.getElementById('auth-status');
    if (badge) {
        badge.textContent = (config.ghToken && config.ghRepo) ? "GitHub подключен" : "Не авторизован";
        badge.className = (config.ghToken && config.ghRepo) ? "status-badge success" : "status-badge error";
    }
}

function initForms() {
    document.getElementById('transaction-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const t = {
            id: Date.now().toString(),
            type: document.querySelector('input[name="type"]:checked').value,
            category: document.getElementById('tx-category').value,
            amount: parseFloat(document.getElementById('tx-amount').value),
            date: document.getElementById('tx-date').value,
            comment: document.getElementById('tx-comment').value
        };
        state.transactions.unshift(t);
        saveLocalData();
        renderAll();
        e.target.reset();
        document.getElementById('tx-date').valueAsDate = new Date();
    });

    document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        config.ghToken = document.getElementById('gh-token').value.trim();
        config.ghRepo = document.getElementById('gh-repo').value.trim();
        localStorage.setItem('finance_config', JSON.stringify(config));
        updateAuthStatus();
        await loadData();
        renderAll();
        alert('Конфигурация сохранена');
    });

    document.getElementById('main-save-btn')?.addEventListener('click', syncWithGitHub);
}

function renderAll() {
    // Тут ваша логика отрисовки (renderDashboard, renderCategories, renderHistory)
    // Она остается прежней
}
