let financeChart = null;

let state = {
    categories: {
        income: ["Зарплата", "Фриланс", "Кэшбэк"],
        expense: ["Продукты", "Транспорт", "Коммуналка", "Развлечения"]
    },
    transactions: [],
    sha: null
};

let config = {
    token: localStorage.getItem('gh_token') || '',
    repo: localStorage.getItem('gh_repo') || '',
    filename: 'data.json'
};

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initForms();
    loadConfigInputs();
    
    if (config.token && config.repo) {
        fetchDataFromGitHub();
    } else {
        updateStatus('Не настроен доступ к GitHub', 'error');
        renderApp();
    }
});

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });
}

function loadConfigInputs() {
    document.getElementById('gh-token').value = config.token;
    document.getElementById('gh-repo').value = config.repo;
    document.getElementById('tx-date').valueAsDate = new Date();
}

function updateStatus(text, type) {
    const badge = document.getElementById('auth-status');
    badge.textContent = text;
    badge.className = `status-badge ${type}`;
}

async function fetchDataFromGitHub() {
    if (!config.token || !config.repo) return;
    updateStatus('Загрузка данных...', 'loading');
    
    try {
        const response = await fetch(`https://api.github.com/repos/${config.repo}/contents/${config.filename}`, {
            headers: { 'Authorization': `token ${config.token}` }
        });
        
        if (response.status === 404) {
            updateStatus('Новый репозиторий (Файл не найден)', 'success');
            renderApp();
            return;
        }
        
        if (!response.ok) throw new Error('Ошибка сети');
        
        const data = await response.json();
        state.sha = data.sha;
        
        // Безопасное декодирование Base64 обратно в кириллицу UTF-8
        const binString = atob(data.content.replace(/\s/g, ""));
        const bytes = Uint8Array.from(binString, (m) => m.charCodeAt(0));
        const decodedContent = JSON.parse(new TextDecoder().decode(bytes));
        
        if (decodedContent.categories) state.categories = decodedContent.categories;
        if (decodedContent.transactions) state.transactions = decodedContent.transactions;
        
        updateStatus('Синхронизировано', 'success');
        renderApp();
    } catch (err) {
        updateStatus('Ошибка синхронизации', 'error');
        console.error(err);
        renderApp();
    }
}

async function saveDataToGitHub() {
    if (!config.token || !config.repo) {
        alert('Пожалуйста, укажите настройки во вкладке "Настройки Гитхаба".');
        return;
    }
    updateStatus('Сохранение...', 'loading');
    
    // Безопасное кодирование UTF-8 (кириллицы) в Base64
    const jsonString = JSON.stringify(state, null, 2);
    const bytes = new TextEncoder().encode(jsonString);
    const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    const contentPayload = btoa(binString);
    
    const body = {
        message: 'wallet update via github pages',
        content: contentPayload
    };
    if (state.sha) body.sha = state.sha;
    
    try {
        const response = await fetch(`https://api.github.com/repos/${config.repo}/contents/${config.filename}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${config.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) throw new Error('Не удалось обновить файл');
        
        const resData = await response.json();
        state.sha = resData.content.sha;
        updateStatus('Синхронизировано', 'success');
    } catch (err) {
        updateStatus('Ошибка сохранения!', 'error');
        console.error(err);
    }
}

function renderApp() {
    renderSelectOptions();
    renderDashboard();
    renderCategories();
    renderHistory();
}

function renderSelectOptions() {
    const select = document.getElementById('tx-category');
    const type = document.querySelector('input[name="type"]:checked').value;
    select.innerHTML = '';
    state.categories[type].forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat; opt.textContent = cat;
        select.appendChild(opt);
    });
}

function renderDashboard() {
    let balance = 0, currentMonthInc = 0, currentMonthExp = 0;
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // 1. Собираем все уникальные месяцы из транзакций для фильтра
    const filterSelect = document.getElementById('month-filter');
    const selectedMonth = filterSelect.value || 'all';
    const monthsSet = new Set();
    
    state.transactions.forEach(t => {
        if (t.date) monthsSet.add(t.date.substring(0, 7)); // Получаем YYYY-MM
    });
    
    // Перерисовываем селект месяцев, только если количество изменилось
    const currentOptionsCount = filterSelect.options.length - 1;
    if (monthsSet.size !== currentOptionsCount) {
        filterSelect.innerHTML = '<option value="all">За всё время</option>';
        [...monthsSet].sort().reverse().forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            filterSelect.appendChild(opt);
        });
        filterSelect.value = selectedMonth; // сохраняем выбор
    }

    // 2. Считаем основные карточки баланса (всегда за текущий месяц и общий)
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

    // 3. Подготовка данных для гистограммы с учетом фильтра времени
    const chartData = {};
    
    state.transactions.forEach(t => {
        // Если выбран конкретный месяц и транзакция не из него — пропускаем
        if (selectedMonth !== 'all' && !t.date.startsWith(selectedMonth)) return;
        
        if (!chartData[t.category]) {
            chartData[t.category] = { income: 0, expense: 0 };
        }
        chartData[t.category][t.type] += parseFloat(t.amount);
    });

    const labels = Object.keys(chartData);
    const incomeData = labels.map(cat => chartData[cat].income);
    const expenseData = labels.map(cat => chartData[cat].expense);

    // 4. Отрисовка или обновление графика Chart.js
    const ctx = document.getElementById('analyticsChart').getContext('2d');
    
    if (financeChart) {
        financeChart.destroy(); // Уничтожаем старый график перед перерисовкой
    }

    financeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Доходы (₸)',
                    data: incomeData,
                    backgroundColor: '#2ecc71',
                    borderRadius: 4
                },
                {
                    label: 'Расходы (₸)',
                    data: expenseData,
                    backgroundColor: '#e74c3c',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#e1e4e8' }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

function renderCategories() {
    const renderList = (elementId, list, type) => {
        const container = document.getElementById(elementId);
        container.innerHTML = '';
        list.forEach(cat => {
            const li = document.createElement('li');
            li.textContent = cat;
            const delBtn = document.createElement('button');
            delBtn.innerHTML = '&times;';
            delBtn.className = 'delete-btn';
            delBtn.onclick = () => {
                state.categories[type] = state.categories[type].filter(c => c !== cat);
                renderApp();
                saveDataToGitHub();
            };
            li.appendChild(delBtn);
            container.appendChild(li);
        });
    };
    renderList('expense-categories-list', state.categories.expense, 'expense');
    renderList('income-categories-list', state.categories.income, 'income');
}

function renderHistory() {
    const tbody = document.getElementById('history-table-body');
    tbody.innerHTML = '';
    const sorted = [...state.transactions].sort((a,b) => new Date(b.date) - new Date(a.date));
    
    sorted.forEach(t => {
        const tr = document.createElement('tr');
        const isInc = t.type === 'income';
        tr.innerHTML = `
            <td>${t.date}</td>
            <td>${isInc ? 'Доход' : 'Расход'}</td>
            <td>${t.category}</td>
            <td class="${isInc ? 'tx-inc' : 'tx-exp'}">${isInc ? '+' : '-'}${parseFloat(t.amount).toLocaleString()} ₸</td>
            <td>${t.comment || ''}</td>
            <td><button class="delete-btn">&times;</button></td>
        `;
        tr.querySelector('.delete-btn').onclick = () => {
            state.transactions = state.transactions.filter(item => item.id !== t.id);
            renderApp();
            saveDataToGitHub();
        };
        tbody.appendChild(tr);
    });
}

function initForms() {
    document.querySelectorAll('input[name="type"]').forEach(r => r.addEventListener('change', renderSelectOptions));
    
    document.getElementById('transaction-form').addEventListener('submit', (e) => {
        e.preventDefault();
        state.transactions.push({
            id: Date.now(),
            date: document.getElementById('tx-date').value,
            type: document.querySelector('input[name="type"]:checked').value,
            category: document.getElementById('tx-category').value,
            amount: parseFloat(document.getElementById('tx-amount').value),
            comment: document.getElementById('tx-comment').value
        });
        renderApp(); saveDataToGitHub();
        document.getElementById('tx-amount').value = '';
        document.getElementById('tx-comment').value = '';
    });
    
    document.getElementById('category-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('cat-type').value;
        const name = document.getElementById('cat-name').value.trim();
        if (name && !state.categories[type].includes(name)) {
            state.categories[type].push(name);
            renderApp(); saveDataToGitHub();
            document.getElementById('cat-name').value = '';
        }
    });
    
    document.getElementById('settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        config.token = document.getElementById('gh-token').value.trim();
        config.repo = document.getElementById('gh-repo').value.trim();
        localStorage.setItem('gh_token', config.token);
        localStorage.setItem('gh_repo', config.repo);
        fetchDataFromGitHub();
    });
    document.getElementById('sync-btn').addEventListener('click', fetchDataFromGitHub);
    // Слушатель изменения месяца в фильтре
    document.getElementById('month-filter').addEventListener('change', renderApp);
}
