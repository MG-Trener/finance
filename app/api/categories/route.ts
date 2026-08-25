import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: { subcategories: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const body = await request.json();
  const category = await prisma.category.create({
    data: {
      name: String(body.name).trim(),
      type: body.type,
      icon: body.icon || '📌',
      subcategories: body.subcategories?.length
        ? { create: body.subcategories.map((name: string) => ({ name: name.trim() })) }
        : undefined,
    },
    include: { subcategories: true },
  });
  return NextResponse.json(category, { status: 201 });
}
