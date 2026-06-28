// Глобальное состояние
let state = {
    transactions: [],
    categories: {
        expense: ['Продукты', 'Транспорт', 'Жилье', 'Развлечения'],
        income: ['Зарплата', 'Фриланс', 'Инвестиции']
    }
};

let config = { ghToken: '', ghRepo: '', aiKey: '' };

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initForms();
    await loadData();
    renderAll();
});

// Загрузка с использованием прокси corsproxy.io для обхода CORS
async function loadData() {
    const savedConfig = localStorage.getItem('finance_config');
    if (savedConfig) {
        config = JSON.parse(savedConfig);
        updateAuthStatus();
    }
    const savedState = localStorage.getItem('finance_state');
    if (savedState) state = JSON.parse(savedState);

    if (config.ghRepo && config.ghToken) {
        try {
            const url = `https://corsproxy.io/?https://api.github.com/repos/${config.ghRepo}/contents/data.json`;
            const response = await fetch(url, {
                headers: { 'Authorization': `token ${config.ghToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                // Декодируем base64 (стандартный формат GitHub API)
                const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
                state = content;
                saveLocalData();
                return true;
            }
        } catch (err) { console.error("Ошибка загрузки:", err); }
    }
    return false;
}

function saveLocalData() {
    localStorage.setItem('finance_state', JSON.stringify(state));
}

// Синхронизация с GitHub
async function syncWithGitHub() {
    if (!config.ghRepo || !config.ghToken) return alert('Заполните настройки!');
    
    try {
        const url = `https://corsproxy.io/?https://api.github.com/repos/${config.ghRepo}/contents/data.json`;
        
        // 1. Получаем SHA
        const resGet = await fetch(url, { headers: { 'Authorization': `token ${config.ghToken}` } });
        const fileInfo = await resGet.json();
        const sha = fileInfo.sha;

        // 2. Отправляем (PUT)
        const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(state, null, 2))));
        const resPut = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${config.ghToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Update', content: contentBase64, sha: sha })
        });

        if (resPut.ok) alert('Успешно сохранено на GitHub!');
        else throw new Error('Ошибка записи');
    } catch (err) { alert('Ошибка: ' + err.message); }
}

// Отрисовка интерфейса
function renderAll() {
    updateCategorySelects();
    // Здесь вы можете вызвать свои функции renderDashboard() и renderHistory(), если они есть
}

function updateCategorySelects() {
    const typeEl = document.querySelector('input[name="type"]:checked');
    const select = document.getElementById('tx-category');
    
    // Если элементы не найдены, выходим
    if (!select) {
        console.error("Элемент #tx-category не найден в HTML!");
        return;
    }
    
    // Если ни одна радиокнопка не выбрана, берем 'expense' по умолчанию
    const type = typeEl ? typeEl.value : 'expense';
    
    select.innerHTML = ''; // Очистка текущего списка
    
    if (state.categories && state.categories[type]) {
        state.categories[type].forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            select.appendChild(opt);
        });
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
            date: document.getElementById('tx-date').value
        };
        state.transactions.unshift(t);
        saveLocalData();
        renderAll();
    });

    document.querySelectorAll('input[name="type"]').forEach(el => {
        el.addEventListener('change', updateCategorySelects);
    });
}

function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            // Убираем активный класс у всех кнопок и контентов
            tabs.forEach(b => b.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            // Добавляем активный класс текущей кнопке
            btn.classList.add('active');
            
            // Находим нужный блок контента по data-tab
            const tabId = btn.getAttribute('data-tab');
            const target = document.getElementById(tabId);
            if (target) {
                target.classList.add('active');
            }
        });
    });
}
function updateAuthStatus() { /* ваша логика статуса */ }
