import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/AppError';
import { campaignRepository } from './campaign.repository';
import type { CreateCampaignInput, ListCampaignsQuery, UpdateCampaignInput } from './campaign.dto';

export const campaignService = {
  async list(query: ListCampaignsQuery, page: number, pageSize: number) {
    const { items, total } = await campaignRepository.findMany(query, (page - 1) * pageSize, pageSize);
    return { items, meta: { page, pageSize, total } };
  },

  async getById(id: string) {
    const campaign = await campaignRepository.findById(id);
    if (!campaign) throw AppError.notFound('Campaign', id);
    return campaign;
  },

  async create(input: CreateCampaignInput) {
    const { benefitIds, ...rest } = input;
    if (benefitIds.length) await this.validateBenefitIds(benefitIds);

    const campaign = await campaignRepository.create(rest);
    if (benefitIds.length) await campaignRepository.replaceBenefitLinks(campaign.id, benefitIds);
    return this.getById(campaign.id);
  },

  async update(id: string, input: UpdateCampaignInput) {
    await this.getById(id);
    const { benefitIds, ...rest } = input;

    if (Object.keys(rest).length) await campaignRepository.update(id, rest);
    if (benefitIds) {
      await this.validateBenefitIds(benefitIds);
      await campaignRepository.replaceBenefitLinks(id, benefitIds);
    }
    return this.getById(id);
  },

  async remove(id: string) {
    await this.getById(id);
    return campaignRepository.softDelete(id);
  },

  async validateBenefitIds(benefitIds: string[]) {
    const count = await prisma.benefit.count({ where: { id: { in: benefitIds }, deletedAt: null } });
    if (count !== new Set(benefitIds).size) throw AppError.validation('One or more benefitId not found');
  },
};
