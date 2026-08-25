'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Heart, Plus, Wallet } from 'lucide-react';

type Subcategory = { id: number; name: string };
type Category = { id: number; name: string; icon?: string; type: 'INCOME' | 'EXPENSE'; subcategories: Subcategory[] };
type Tx = {
  id: number;
  member: 'HUSBAND' | 'WIFE';
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  note?: string;
  occurredAt: string;
  category: Category;
  subcategory?: Subcategory;
};

const money = (value: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(value);
const memberName = (m: 'HUSBAND' | 'WIFE') => (m === 'HUSBAND' ? 'Муж' : 'Жена');

export default function Home() {
  const now = new Date();
  const [year, setYear] = useState(Math.max(2026, now.getFullYear()));
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ member: 'HUSBAND', type: 'EXPENSE', amount: '', categoryId: '', subcategoryId: '', note: '' });

  const load = async () => {
    setLoading(true);
    const [cats, txs] = await Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch(`/api/transactions?year=${year}&month=${month}`).then(r => r.json()),
    ]);
    setCategories(cats);
    setTransactions(txs);
    setLoading(false);
  };

  useEffect(() => { load(); }, [year, month]);

  const typedCategories = useMemo(() => categories.filter(c => c.type === form.type), [categories, form.type]);
  const selectedCategory = categories.find(c => c.id === Number(form.categoryId));

  const summary = useMemo(() => {
    const calc = (member?: 'HUSBAND' | 'WIFE') => {
      const list = member ? transactions.filter(t => t.member === member) : transactions;
      const income = list.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
      const expense = list.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);
      return { income, expense, balance: income - expense };
    };
    return { family: calc(), husband: calc('HUSBAND'), wife: calc('WIFE') };
  }, [transactions]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    transactions.filter(t => t.type === 'EXPENSE').forEach(t => map.set(t.category.name, (map.get(t.category.name) || 0) + Number(t.amount)));
    const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value, percent: Math.round(value / total * 100) }));
  }, [transactions]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.categoryId) return;
    await fetch('/api/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: Number(form.amount), categoryId: Number(form.categoryId), subcategoryId: form.subcategoryId || null }),
    });
    setForm(f => ({ ...f, amount: '', note: '', categoryId: '', subcategoryId: '' }));
    await load();
  };

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brandMark"><Heart size={20}/></div><div><strong>Семейный бюджет</strong><span>Муж + Жена</span></div></div>
        <nav>
          <button className="navActive">Обзор</button>
          <button>Операции</button>
          <button>Категории</button>
          <button>Аналитика</button>
        </nav>
        <div className="sidebarNote"><span>Семейная цель</span><strong>Финансовая ясность</strong><p>Все деньги семьи в одном понятном месте.</p></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">Семейные финансы</p><h1>Добрый вечер 👋</h1><span>Посмотрим, как идут дела с бюджетом семьи.</span></div>
          <div className="period">
            <select value={month} onChange={e => setMonth(Number(e.target.value))}>{['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'].map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select>
            <select value={year} onChange={e => setYear(Number(e.target.value))}>{Array.from({length: 8},(_,i)=>2026+i).map(y=><option key={y}>{y}</option>)}</select>
          </div>
        </header>

        <div className="heroGrid">
          <article className="balanceCard">
            <div className="cardTop"><div><span>Общий баланс семьи</span><strong>{money(summary.family.balance)}</strong></div><div className="walletIcon"><Wallet/></div></div>
            <div className="flowGrid">
              <div><ArrowUpRight size={18}/><span>Доходы</span><b>{money(summary.family.income)}</b></div>
              <div><ArrowDownRight size={18}/><span>Расходы</span><b>{money(summary.family.expense)}</b></div>
            </div>
          </article>

          <article className="memberCard husband"><span>Муж</span><strong>{money(summary.husband.balance)}</strong><div><small>Доходы {money(summary.husband.income)}</small><small>Расходы {money(summary.husband.expense)}</small></div></article>
          <article className="memberCard wife"><span>Жена</span><strong>{money(summary.wife.balance)}</strong><div><small>Доходы {money(summary.wife.income)}</small><small>Расходы {money(summary.wife.expense)}</small></div></article>
        </div>

        <div className="mainGrid">
          <article className="panel addPanel">
            <div className="panelTitle"><div><span className="roundIcon"><Plus size={18}/></span><div><h2>Новая операция</h2><p>Добавьте доход или расход за несколько секунд</p></div></div></div>
            <form onSubmit={submit}>
              <div className="segmented"><button type="button" className={form.type==='EXPENSE'?'selected danger':''} onClick={()=>setForm({...form,type:'EXPENSE',categoryId:'',subcategoryId:''})}>Расход</button><button type="button" className={form.type==='INCOME'?'selected success':''} onClick={()=>setForm({...form,type:'INCOME',categoryId:'',subcategoryId:''})}>Доход</button></div>
              <label>Кто<div className="segmented compact"><button type="button" className={form.member==='HUSBAND'?'selected':''} onClick={()=>setForm({...form,member:'HUSBAND'})}>Муж</button><button type="button" className={form.member==='WIFE'?'selected':''} onClick={()=>setForm({...form,member:'WIFE'})}>Жена</button></div></label>
              <label>Сумма, ₸<input inputMode="decimal" placeholder="0" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label>
              <div className="twoCols"><label>Категория<select value={form.categoryId} onChange={e=>setForm({...form,categoryId:e.target.value,subcategoryId:''})}><option value="">Выберите</option>{typedCategories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></label><label>Подкатегория<select disabled={!selectedCategory} value={form.subcategoryId} onChange={e=>setForm({...form,subcategoryId:e.target.value})}><option value="">Не выбрана</option>{selectedCategory?.subcategories.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
              <label>Комментарий<input placeholder="Например: продукты на неделю" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label>
              <button className="primary" type="submit">Добавить операцию</button>
            </form>
          </article>

          <article className="panel analytics">
            <div className="panelTitle"><div><h2>Куда уходят деньги</h2><p>Структура расходов за месяц</p></div></div>
            <div className="categoryBars">{expenseByCategory.length ? expenseByCategory.map((x,i)=><div className="barRow" key={x.name}><div><span>{x.name}</span><b>{money(x.value)}</b></div><div className="bar"><i style={{width:`${x.percent}%`}}/></div><small>{x.percent}% расходов</small></div>) : <div className="empty">Пока нет расходов за этот месяц</div>}</div>
          </article>
        </div>

        <article className="panel recent">
          <div className="panelTitle"><div><h2>Последние операции</h2><p>Фактическая история за выбранный месяц</p></div><span className="count">{transactions.length}</span></div>
          <div className="txList">{loading ? <div className="empty">Загрузка...</div> : transactions.length ? transactions.slice(0,10).map(t=><div className="tx" key={t.id}><div className="txIcon">{t.category.icon || '•'}</div><div className="txText"><strong>{t.subcategory?.name || t.category.name}</strong><span>{memberName(t.member)} · {new Date(t.occurredAt).toLocaleString('ru-RU')}</span></div><div className={t.type==='INCOME'?'txAmount income':'txAmount expense'}>{t.type==='INCOME'?'+':'−'} {money(Number(t.amount))}</div></div>) : <div className="empty">Добавьте первую операцию — она появится здесь.</div>}</div>
        </article>
      </section>
    </main>
  );
}
