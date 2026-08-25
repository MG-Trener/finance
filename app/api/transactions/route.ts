import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year') || new Date().getFullYear());
  const month = Number(searchParams.get('month') || new Date().getMonth() + 1);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const transactions = await prisma.transaction.findMany({
    where: { occurredAt: { gte: start, lt: end } },
    include: { category: true, subcategory: true },
    orderBy: { occurredAt: 'desc' },
  });
  return NextResponse.json(transactions);
}

export async function POST(request: Request) {
  const body = await request.json();
  const transaction = await prisma.transaction.create({
    data: {
      member: body.member,
      type: body.type,
      amount: body.amount,
      categoryId: Number(body.categoryId),
      subcategoryId: body.subcategoryId ? Number(body.subcategoryId) : null,
      note: body.note?.trim() || null,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
    },
    include: { category: true, subcategory: true },
  });
  return NextResponse.json(transaction, { status: 201 });
}
