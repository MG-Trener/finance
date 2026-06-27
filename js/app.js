// Аварийный вывод ошибок прямо на экран для мобильных устройств
window.onerror = function (message, source, lineno, colno, error) {
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '0';
    errorDiv.style.left = '0';
    errorDiv.style.width = '100%';
    errorDiv.style.background = '#e74c3c';
    errorDiv.style.color = '#fff';
    errorDiv.style.padding = '15px';
    errorDiv.style.zIndex = '99999';
    errorDiv.style.fontSize = '12px';
    errorDiv.style.fontFamily = 'monospace';
    errorDiv.style.whiteSpace = 'pre-wrap';
    errorDiv.innerHTML = `<strong>JS КРИТИЧЕСКАЯ ОШИБКА:</strong><br>${message}<br>Файл: ${source}<br>Строка: ${lineno}:${colno}`;
    document.body.appendChild(errorDiv);
    return false;
};

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

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    loadLocalData();
    initTabs();
    initForms();
    renderAll();
});

// Загрузка сохраненных данных из LocalStorage
function loadLocalData() {
    const savedState = localStorage.getItem('finance_state');
    if (savedState) {
        try { state = JSON.parse(savedState); } catch(e) {}
    }
    const savedConfig = localStorage.getItem('finance_config');
    if (savedConfig) {
        try { 
            config = JSON.parse(savedConfig);
            document.getElementById('gh-token').value = config.ghToken || '';
            document.getElementById('gh-repo').value = config.ghRepo || '';
            document.getElementById('ai-key').value = config.aiKey || '';
            updateAuthStatus();
        } catch(e) {}
    }
}

// Сохранение данных в LocalStorage
function saveLocalData() {
    localStorage.setItem('finance_state', JSON.stringify(state));
}

// Переключение вкладок (Табы)
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Статус авторизации GitHub
function updateAuthStatus() {
    const badge = document.getElementById('auth-status');
    if (config.ghToken && config.ghRepo) {
        badge.textContent = "GitHub подключен";
        badge.className = "status-badge success";
    } else {
        badge.textContent = "Не авторизован";
        badge.className = "status-badge error";
    }
}

// Инициализация обработчиков событий для всех форм и фильтров
function initForms() {
    // Добавление операции
    document.getElementById('transaction-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const transaction = {
            id: Date.now().toString(),
            type: document.querySelector('input[name="type"]:checked').value,
            category: document.getElementById('tx-category').value,
            amount: parseFloat(document.getElementById('tx-amount').value),
            date: document.getElementById('tx-date').value,
            comment: document.getElementById('tx-comment').value
        };
        state.transactions.unshift(transaction);
        saveLocalData();
        renderAll();
        e.target.reset();
        document.getElementById('tx-date').valueAsDate = new Date();
        updateCategorySelects();
    });

    // Добавление новой категории
    document.getElementById('category-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('cat-type').value;
        const name = document.getElementById('cat-name').value.trim();
        if (name && !state.categories[type].includes(name)) {
            state.categories[type].push(name);
            saveLocalData();
            renderAll();
            e.target.reset();
        }
    });

    // Сохранение конфигурации GitHub и ИИ
    document.getElementById('settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        config.ghToken = document.getElementById('gh-token').value.trim();
        config.ghRepo = document.getElementById('gh-repo').value.trim();
        config.aiKey = document.getElementById('ai-key').value.trim();
        localStorage.setItem('finance_config', JSON.stringify(config));
        updateAuthStatus();
        alert('Конфигурация успешно сохранена!');
    });

    // Фильтр аналитики по месяцам
    document.getElementById('month-filter').addEventListener('change', () => {
        renderDashboard();
    });

    // Кнопка запуска ИИ-Аналитика
    document.getElementById('ai-analyze-btn').addEventListener('click', generateAIRecommendations);

    // Установка текущей даты по умолчанию в форму операции
    document.getElementById('tx-date').valueAsDate = new Date();
}

// Обновление селектов категорий при изменении типа (доход/расход)
document.querySelectorAll('input[name="type"]').forEach(radio => {
    radio.addEventListener('change', updateCategorySelects);
});

function updateCategorySelects() {
    const type = document.querySelector('input[name="type"]:checked').value;
    const select = document.getElementById('tx-category');
    if (!select) return;
    select.innerHTML = '';
    state.categories[type].forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });
}

// Главный рендеринг всего приложения
function renderAll() {
    updateCategorySelects();
    renderDashboard();
    renderCategories();
    renderHistory();
}

// Рендеринг главной панели, графиков Chart.js и селектора месяцев
function renderDashboard() {
    let balance = 0, currentMonthInc = 0, currentMonthExp = 0;
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const filterSelect = document.getElementById('month-filter');
    if (!filterSelect) return;

    const selectedMonth = filterSelect.value || 'all';
    const monthsSet = new Set();
    
    state.transactions.forEach(t => {
        if (t.date) monthsSet.add(t.date.substring(0, 7));
    });
    
    const currentOptionsCount = filterSelect.options.length - 1;
    if (monthsSet.size !== currentOptionsCount) {
        filterSelect.innerHTML = '<option value="all">За всё время</option>';
        Array.from(monthsSet).sort().reverse().forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            filterSelect.appendChild(opt);
        });
        filterSelect.value = selectedMonth;
    }

    state.transactions.forEach(t => {
        const amt = parseFloat(t.amount);
        if (t.type === 'income') {
            balance += amt;
            if (t.date.startsWith(currentYearMonth)) currentMonthInc += amt;
        } else {
            balance -= amt;
            if (t.date.startsWith(currentYearMonth)) currentMonthExp += amt;
        }
    });
    
    document.getElementById('total-balance').textContent = `${balance.toLocaleString()} ₸`;
    document.getElementById('month-income').textContent = `+${currentMonthInc.toLocaleString()} ₸`;
    document.getElementById('month-expense').textContent = `-${currentMonthExp.toLocaleString()} ₸`;

    const incomeDataMap = {};
    const expenseDataMap = {};

    state.transactions.forEach(t => {
        if (selectedMonth !== 'all' && !t.date.startsWith(selectedMonth)) return;
        
        const amt = parseFloat(t.amount);
        if (t.type === 'income') {
            incomeDataMap[t.category] = (incomeDataMap[t.category] || 0) + amt;
        } else {
            expenseDataMap[t.category] = (expenseDataMap[t.category] || 0) + amt;
        }
    });

    const buildChart = (canvasId, isIncome, labels, data, labelName, color) => {
        const canvasElement = document.getElementById(canvasId);
        if (!canvasElement) return null;
        const ctx = canvasElement.getContext('2d');
        
        if (isIncome && incomeChart) { incomeChart.destroy(); }
        if (!isIncome && expenseChart) { expenseChart.destroy(); }

        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: labelName,
                    data: data,
                    backgroundColor: color,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: '#e1e4e8' } },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
    };

    const expenseLabels = Object.keys(expenseDataMap);
    const expenseValues = Object.values(expenseDataMap);
    expenseChart = buildChart('expenseChart', false, expenseLabels, expenseValues, 'Расходы (₸)', '#e74c3c');

    const incomeLabels = Object.keys(incomeDataMap);
    const incomeValues = Object.values(incomeDataMap);
    incomeChart = buildChart('incomeChart', true, incomeLabels, incomeValues, 'Доходы (₸)', '#2ecc71');
}

// Рендеринг списков категорий настроек
function renderCategories() {
    const renderList = (elementId, type) => {
        const ul = document.getElementById(elementId);
        if (!ul) return;
        ul.innerHTML = '';
        state.categories[type].forEach(cat => {
            const li = document.createElement('li');
            li.innerHTML = `${cat} <button class="delete-btn" onclick="deleteCategory('${type}', '${cat}')">&times;</button>`;
            ul.appendChild(li);
        });
    };
    renderList('expense-categories-list', 'expense');
    renderList('income-categories-list', 'income');
}

function deleteCategory(type, name) {
    state.categories[type] = state.categories[type].filter(c => c !== name);
    saveLocalData();
    renderAll();
}

// Рендеринг таблицы истории операций
function renderHistory() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    state.transactions.forEach(t => {
        const tr = document.createElement('tr');
        const sign = t.type === 'income' ? '+' : '-';
        const cls = t.type === 'income' ? 'tx-inc' : 'tx-exp';
        
        tr.innerHTML = `
            <td>${t.date || ''}</td>
            <td><span class="${cls}">${t.type === 'income' ? 'Доход' : 'Расход'}</span></td>
            <td>${t.category}</td>
            <td class="${cls}">${sign}${parseFloat(t.amount).toLocaleString()} ₸</td>
            <td>${t.comment || ''}</td>
            <td><button class="delete-btn" onclick="deleteTransaction('${t.id}')">&times;</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteTransaction(id) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveLocalData();
    renderAll();
}

// ИИ-АНАЛИТИК: Запрос рекомендаций через безопасное прокси-зеркало с поддержкой CORS
async function generateAIRecommendations() {
    const container = document.getElementById('ai-response-container');
    const textBlock = document.getElementById('ai-response-text');
    const btn = document.getElementById('ai-analyze-btn');

    if (!config.aiKey) {
        alert('Пожалуйста, укажите Gemini API Key во вкладке "Настройки Гитхаба".');
        return;
    }

    // Собираем данные за выбранный на панели аналитики период
    const selectedMonth = document.getElementById('month-filter').value;
    const filteredTxs = state.transactions.filter(t => selectedMonth === 'all' || t.date.startsWith(selectedMonth));

    if (filteredTxs.length === 0) {
        alert('Нет операций за выбранный период для анализа ИИ.');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'ИИ анализирует данные...';
    container.style.display = 'block';
    textBlock.innerHTML = '<em>Генерирую персональный финансовый разбор... Подождите несколько секунд.</em>';

    // Форматируем сжатый финансовый лог для отправки в промпт
    const summaryData = filteredTxs.map(t => `${t.date} | ${t.type === 'income' ? 'Доход' : 'Расход'} | ${t.category} | ${t.amount} ₸ | ${t.comment || ''}`).join('\n');
    const filterText = selectedMonth === 'all' ? 'за всё время' : `за период ${selectedMonth}`;

    try {
        // Используем выделенный прокси-эндпоинт с поддержкой CORS для GitHub Pages
        const response = await fetch(`https://api.gemini.ai-proxy.org/v1beta/models/gemini-1.5-flash:generateContent?key=${config.aiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Ты опытный персональный финансовый консультант. Изучи этот список транзакций пользователя ${filterText} и составь лаконичный структурированный аудит в формате HTML (используй только небольшие абзацы, жирный текст <b> и списки <ul>/<li> для читаемости).
                        Укажи: 
                        1. Главные статьи расходов и потенциальные аномалии/переплаты.
                        2. Точки роста (как оптимизировать траты или распределить доходы).
                        3. Финансовый совет на следующий месяц.
                        Отвечай строго на русском языке. Будь краток и пиши по делу.

                        Данные транзакций:
                        ${summaryData}`
                    }]
                }]
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const apiErrorMessage = errData.error?.message || `Статус сервера: ${response.status}`;
            throw new Error(apiErrorMessage);
        }

        const data = await response.json();
        
        // Извлекаем текст ответа согласно правильной структуре JSON Gemini
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (aiText) {
            // Форматируем markdown-звездочки, если модель прислала их вместо HTML
            let formattedText = aiText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
            formattedText = formattedText.replace(/^\*\s(.*)/gm, '<li>$1</li>');
            textBlock.innerHTML = formattedText;
        } else {
            throw new Error('От сервера пришел пустой ответ или структура данных изменилась.');
        }

    } catch (err) {
        console.error(err);
        textBlock.innerHTML = `
            <div style="color: #721c24; background: #f8d7da; padding: 12px; border-radius: 6px; border: 1px solid #f5c6cb;">
                <strong>⚠️ Не удалось получить анализ от ИИ</strong><br>
                <span style="font-size: 13px; margin-top: 5px; display: inline-block;">
                    <b>Причина ошибки:</b> ${err.message}<br><br>
                    <i>Что проверить:</i><br>
                    1. Правильность API-ключа в Настройках (должен быть без пробелов и начинаться на AIzaSy).<br>
                    2. Активирован ли Gemini API в вашей Google AI Studio.<br>
                    3. Стабильность интернет-соединения.
                </span>
            </div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Сгенерировать рекомендации';
    }
}
