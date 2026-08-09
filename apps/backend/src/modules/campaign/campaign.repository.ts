import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { ListCampaignsQuery } from './campaign.dto';

export const campaignRepository = {
  async findMany(query: ListCampaignsQuery, skip: number, take: number) {
    const now = new Date();
    const where: Prisma.CampaignWhereInput = {
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.activeNow && { startDate: { lte: now }, endDate: { gte: now } }),
    };
    const [items, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        skip,
        take,
        include: { benefits: { include: { benefit: true }, orderBy: { sortOrder: 'asc' } } },
      }),
      prisma.campaign.count({ where }),
    ]);
    return { items, total };
  },

  async findById(id: string) {
    return prisma.campaign.findFirst({
      where: { id, deletedAt: null },
      include: { benefits: { include: { benefit: true }, orderBy: { sortOrder: 'asc' } } },
    });
  },

  async create(data: Prisma.CampaignCreateInput) {
    return prisma.campaign.create({ data });
  },

  async update(id: string, data: Prisma.CampaignUpdateInput) {
    return prisma.campaign.update({ where: { id }, data });
  },

  async softDelete(id: string) {
    return prisma.campaign.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  },

  // מחליף את כל שורות הקישור בטרנזקציה אחת — אותה תבנית כמו
  // replaceScopes ב-benefit.repository, לעקביות.
  async replaceBenefitLinks(campaignId: string, benefitIds: string[]) {
    return prisma.$transaction([
      prisma.campaignBenefit.deleteMany({ where: { campaignId } }),
      prisma.campaignBenefit.createMany({
        data: benefitIds.map((benefitId, index) => ({ campaignId, benefitId, sortOrder: index })),
      }),
    ]);
  },
};
