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
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initForms();
    await loadLocalData();
    renderAll();
});

// ЗАГРУЗКА ДАННЫХ (Оригинальные прямые запросы к GitHub)
async function loadLocalData() {
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
            // Возвращено: Прямой запрос к официальному API GitHub
            const response = await fetch(`https://api.github.com/repos/${config.ghRepo}/contents/data.json`, {
                headers: {
                    'Authorization': `token ${config.ghToken}`,
                    'Accept': 'application/vnd.github.v3.raw',
                    'Cache-Control': 'no-cache'
                }
            });
            if (response.ok) {
                const remoteData = await response.json();
                if (remoteData && (remoteData.transactions || remoteData.categories)) {
                    state = remoteData;
                    saveLocalData();
                    const errDiv = document.getElementById('gh-debug-error');
                    if (errDiv) errDiv.style.display = 'none';
                }
            } else {
                showGitHubError(`GitHub вернул статус ${response.status}. Возможно, неверный токен или data.json отсутствует.`);
            }
        } catch (err) {
            showGitHubError(`Ошибка сети при запросе к GitHub: ${err.message}`);
        }
    } else {
        showGitHubError(`В настройках не заполнен Repo или Token. Зайдите во вкладку Настройки Гитхаба.`);
    }
}

function showGitHubError(msg) {
    let errDiv = document.getElementById('gh-debug-error');
    if (!errDiv) {
        errDiv = document.createElement('div');
        errDiv.id = 'gh-debug-error';
        errDiv.style.background = '#fff3cd';
        errDiv.style.color = '#856404';
        errDiv.style.padding = '10px 15px';
        errDiv.style.marginBottom = '15px';
        errDiv.style.borderRadius = '6px';
        errDiv.style.border = '1px solid #ffeeba';
        errDiv.style.fontSize = '13px';
        const container = document.querySelector('.container');
        if (container) container.insertBefore(errDiv, container.firstChild);
    }
    errDiv.innerHTML = `<strong>Диагностика GitHub:</strong> ${msg}`;
    errDiv.style.display = 'block';
}

function saveLocalData() {
    localStorage.setItem('finance_state', JSON.stringify(state));
}

// БЕЗОПАСНАЯ СИНХРОНИЗАЦИЯ: Защита от затирания данных
async function syncWithGitHub() {
    if (!config.ghRepo || !config.ghToken) {
        alert('Пожалуйста, заполните параметры GitHub в Настройках!');
        return;
    }

    const btn = document.getElementById('sync-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Синхронизация...';
    }

    try {
        let sha = '';
        let remoteTransactionsCount = 0;

        // 1. Сначала проверяем, что лежит на GitHub прямо сейчас
        const resGet = await fetch(`https://api.github.com/repos/${config.ghRepo}/contents/data.json`, {
            headers: { 'Authorization': `token ${config.ghToken}` }
        });
        
        if (resGet.ok) {
            const fileInfo = await resGet.json();
            sha = fileInfo.sha;
            
            // Пробуем декодировать и прочитать старый файл с сервера
            try {
                const contentText = decodeURIComponent(escape(atob(fileInfo.content)));
                const remoteData = JSON.parse(contentText);
                if (remoteData && remoteData.transactions) {
                    remoteTransactionsCount = remoteData.transactions.length;
                }
            } catch(e) {
                console.log("Не удалось прочесть старый файл для проверки, пропускаем.");
            }
        }

        // 2. ЗАЩИТНЫЙ БЛОК: Если на сервере были транзакции, а у нас в локальном коде пусто — БЛОКИРУЕМ
        if (remoteTransactionsCount > 0 && (!state.transactions || state.transactions.length === 0)) {
            alert(`⚠️ СИНХРОНИЗАЦИЯ ОТМЕНЕНА!\n\nНа GitHub обнаружено ${remoteTransactionsCount} транзакций, а на вашем экране сейчас 0 (пусто).\n\nЧтобы не затереть данные, отправка заблокирована. Сначала обновите страницу (или включите VPN), чтобы данные скачались в браузер.`);
            return; // Прерываем выполнение, файл на гитхабе не затрется!
        }

        // 3. Если всё безопасно — отправляем данные
        const jsonString = JSON.stringify(state, null, 2);
        const base64Content = btoa(encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g, function(match, p1) {
            return String.fromCharCode('0x' + p1);
        }));

        const resPut = await fetch(`https://api.github.com/repos/${config.ghRepo}/contents/data.json`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${config.ghToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Финансовые данные обновлены через веб-интерфейс',
                content: base64Content,
                sha: sha || undefined
            })
        });

        if (resPut.ok) {
            alert('Данные успешно отправлены в data.json на GitHub!');
            const errDiv = document.getElementById('gh-debug-error');
            if (errDiv) errDiv.style.display = 'none';
        } else {
            throw new Error(`Статус ответа сервера: ${resPut.status}`);
        }
    } catch (err) {
        alert(`Ошибка синхронизации: ${err.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Синхронизировать сейчас';
        }
    }
}

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(tabId);
            if (targetContent) targetContent.classList.add('active');
        });
    });
}

function updateAuthStatus() {
    const badge = document.getElementById('auth-status');
    if (!badge) return;
    if (config.ghToken && config.ghRepo) {
        badge.textContent = "GitHub подключен";
        badge.className = "status-badge success";
    } else {
        badge.textContent = "Не авторизован";
        badge.className = "status-badge error";
    }
}

function initForms() {
    // Форма добавления транзакции
    const txForm = document.getElementById('transaction-form');
    if (txForm) {
        txForm.addEventListener('submit', (e) => {
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
    }

    // Форма добавления категории
    const catForm = document.getElementById('category-form');
    if (catForm) {
        catForm.addEventListener('submit', (e) => {
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
    }

    // Сохранение конфигурации
    const setForm = document.getElementById('settings-form');
    if (setForm) {
        setForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            config.ghToken = document.getElementById('gh-token').value.trim();
            config.ghRepo = document.getElementById('gh-repo').value.trim();
            config.aiKey = document.getElementById('ai-key').value.trim();
            localStorage.setItem('finance_config', JSON.stringify(config));
            updateAuthStatus();
            
            // Фикс: Принудительно скачиваем свежий data.json сразу после нажатия кнопки "Сохранить"
            await loadLocalData();
            renderAll();
            alert('Конфигурация сохранена! Данные с GitHub успешно синхронизированы.');
        });
    }

    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', syncWithGitHub);
    }

    const filterSelect = document.getElementById('month-filter');
    if (filterSelect) {
        filterSelect.addEventListener('change', renderDashboard);
    }

    const aiBtn = document.getElementById('ai-analyze-btn');
    if (aiBtn) {
        aiBtn.addEventListener('click', generateAIRecommendations);
    }

    const dateInput = document.getElementById('tx-date');
    if (dateInput) dateInput.valueAsDate = new Date();
}

document.querySelectorAll('input[name="type"]').forEach(radio => {
    radio.addEventListener('change', updateCategorySelects);
});

function updateCategorySelects() {
    const typeEl = document.querySelector('input[name="type"]:checked');
    if (!typeEl) return;
    const type = typeEl.value;
    const select = document.getElementById('tx-category');
    if (!select) return;
    select.innerHTML = '';
    if(state.categories && state.categories[type]) {
        state.categories[type].forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            select.appendChild(opt);
        });
    }
}

function renderAll() {
    updateCategorySelects();
    renderDashboard();
    renderCategories();
    renderHistory();
}

function renderDashboard() {
    let balance = 0, currentMonthInc = 0, currentMonthExp = 0;
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const filterSelect = document.getElementById('month-filter');
    if (!filterSelect) return;
    const selectedMonth = filterSelect.value || 'all';
    const monthsSet = new Set();
    
    if (state.transactions && state.transactions.length > 0) {
        state.transactions.forEach(t => {
            if (t.date) monthsSet.add(t.date.substring(0, 7));
        });
    }
    
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

    if (state.transactions && state.transactions.length > 0) {
        state.transactions.forEach(t => {
            const amt = parseFloat(t.amount) || 0;
            if (t.type === 'income') {
                balance += amt;
                if (t.date && t.date.startsWith(currentYearMonth)) currentMonthInc += amt;
            } else {
                balance -= amt;
                if (t.date && t.date.startsWith(currentYearMonth)) currentMonthExp += amt;
            }
        });
    }
    
    document.getElementById('total-balance').textContent = `${balance.toLocaleString()} ₸`;
    document.getElementById('month-income').textContent = `+${currentMonthInc.toLocaleString()} ₸`;
    document.getElementById('month-expense').textContent = `-${currentMonthExp.toLocaleString()} ₸`;

    const incomeDataMap = {};
    const expenseDataMap = {};

    if (state.transactions && state.transactions.length > 0) {
        state.transactions.forEach(t => {
            if (selectedMonth !== 'all' && (!t.date || !t.date.startsWith(selectedMonth))) return;
            const amt = parseFloat(t.amount) || 0;
            if (t.type === 'income') {
                incomeDataMap[t.category] = (incomeDataMap[t.category] || 0) + amt;
            } else {
                expenseDataMap[t.category] = (expenseDataMap[t.category] || 0) + amt;
            }
        });
    }

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

function renderCategories() {
    const renderList = (elementId, type) => {
        const ul = document.getElementById(elementId);
        if (!ul) return;
        ul.innerHTML = '';
        if (state.categories && state.categories[type]) {
            state.categories[type].forEach(cat => {
                const li = document.createElement('li');
                li.innerHTML = `${cat} <button class="delete-btn" onclick="deleteCategory('${type}', '${cat}')">&times;</button>`;
                ul.appendChild(li);
            });
        }
    };
    renderList('expense-categories-list', 'expense');
    renderList('income-categories-list', 'income');
}

function deleteCategory(type, name) {
    state.categories[type] = state.categories[type].filter(c => c !== name);
    saveLocalData();
    renderAll();
}

function renderHistory() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (state.transactions && state.transactions.length > 0) {
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
}

function deleteTransaction(id) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveLocalData();
    renderAll();
}

// ИИ-АНАЛИТИК (Оригинальный прямой запрос к серверам Google)
async function generateAIRecommendations() {
    const container = document.getElementById('ai-response-container');
    const textBlock = document.getElementById('ai-response-text');
    const btn = document.getElementById('ai-analyze-btn');

    if (!config.aiKey) {
        alert('Пожалуйста, укажите Gemini API Key во вкладке "Настройки Гитхаба".');
        return;
    }

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

    const summaryData = filteredTxs.map(t => `${t.date} | ${t.type === 'income' ? 'Доход' : 'Расход'} | ${t.category} | ${t.amount} ₸ | ${t.comment || ''}`).join('\n');
    const filterText = selectedMonth === 'all' ? 'за всё время' : `за период ${selectedMonth}`;

    try {
        // Возвращено: Прямой запрос к официальному серверу Google Gemini API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.aiKey}`, {
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
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiText) {
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
                    3. Стабильность интернет-соединения (при необходимости включите VPN).
                </span>
            </div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Сгенерировать рекомендации';
    }
}
