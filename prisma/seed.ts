import { PrismaClient, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

const catalog = [
  { type: TransactionType.INCOME, name: 'Зарплата', icon: '💼', subs: ['Основная работа', 'Премия', 'Подработка'] },
  { type: TransactionType.INCOME, name: 'Бизнес', icon: '📈', subs: ['Продажи', 'Услуги', 'Дивиденды'] },
  { type: TransactionType.INCOME, name: 'Прочие доходы', icon: '✨', subs: ['Подарки', 'Возвраты', 'Продажа вещей', 'Другое'] },
  { type: TransactionType.EXPENSE, name: 'Продукты', icon: '🛒', subs: ['Супермаркет', 'Рынок', 'Доставка продуктов'] },
  { type: TransactionType.EXPENSE, name: 'Дом', icon: '🏠', subs: ['Коммунальные услуги', 'Ремонт', 'Мебель', 'Бытовая химия'] },
  { type: TransactionType.EXPENSE, name: 'Транспорт', icon: '🚗', subs: ['Топливо', 'Такси', 'Обслуживание авто', 'Общественный транспорт'] },
  { type: TransactionType.EXPENSE, name: 'Дети и семья', icon: '👨‍👩‍👧', subs: ['Школа', 'Кружки', 'Одежда', 'Подарки'] },
  { type: TransactionType.EXPENSE, name: 'Здоровье', icon: '❤️', subs: ['Аптека', 'Врачи', 'Анализы', 'Спорт'] },
  { type: TransactionType.EXPENSE, name: 'Красота', icon: '✨', subs: ['Парикмахер', 'Косметика', 'Уход'] },
  { type: TransactionType.EXPENSE, name: 'Развлечения', icon: '🎬', subs: ['Кафе и рестораны', 'Кино', 'Хобби', 'Отдых'] },
  { type: TransactionType.EXPENSE, name: 'Покупки', icon: '🛍️', subs: ['Одежда', 'Техника', 'Маркетплейсы', 'Другое'] },
  { type: TransactionType.EXPENSE, name: 'Обязательства', icon: '🏦', subs: ['Кредит', 'Ипотека', 'Рассрочка', 'Налоги'] },
];

async function main() {
  for (const item of catalog) {
    const category = await prisma.category.upsert({
      where: { name_type: { name: item.name, type: item.type } },
      update: { icon: item.icon },
      create: { name: item.name, icon: item.icon, type: item.type },
    });

    for (const name of item.subs) {
      await prisma.subcategory.upsert({
        where: { name_categoryId: { name, categoryId: category.id } },
        update: {},
        create: { name, categoryId: category.id },
      });
    }
  }
}

main().finally(async () => prisma.$disconnect());
