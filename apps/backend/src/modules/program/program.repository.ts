import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { ListProgramsQuery } from './program.dto';

export const programRepository = {
  async findMany(query: ListProgramsQuery, skip: number, take: number) {
    const where: Prisma.ProgramWhereInput = {
      deletedAt: null,
      ...(query.issuerId && { issuerId: query.issuerId }),
      ...(query.type && { type: query.type }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };
    const [items, total] = await Promise.all([
      prisma.program.findMany({ where, orderBy: { sortOrder: 'asc' }, skip, take, include: { issuer: true } }),
      prisma.program.count({ where }),
    ]);
    return { items, total };
  },

  async findById(id: string) {
    return prisma.program.findFirst({
      where: { id, deletedAt: null },
      include: { issuer: true, parentProgram: true, childPrograms: true },
    });
  },

  async findByIdRaw(id: string) {
    // ללא include — משמש פנימית לבניית path, לא לתגובת API
    return prisma.program.findUnique({ where: { id } });
  },

  async create(data: Prisma.ProgramCreateInput) {
    return prisma.program.create({ data });
  },

  async update(id: string, data: Prisma.ProgramUpdateInput) {
    return prisma.program.update({ where: { id }, data });
  },

  async softDelete(id: string) {
    return prisma.program.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  },
};
