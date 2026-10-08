import type { NextFunction, Request, Response } from 'express';
import { brandService } from './brand.service';
import { sendPaginated, sendSuccess, parsePagination } from '../../lib/apiResponse';
import { AppError } from '../../lib/AppError';
import type { CreateBrandInput, ListBrandsQuery, UpdateBrandInput } from './brand.dto';

export const brandController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as ListBrandsQuery;
      const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
      const { items, meta } = await brandService.list(query, page, pageSize);
      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await brandService.getById(req.params.id));
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await brandService.create(req.body as CreateBrandInput), 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await brandService.update(req.params.id, req.body as UpdateBrandInput));
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await brandService.remove(req.params.id);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async uploadLogo(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw AppError.validation('קובץ תמונה חסר (שדה "file")');
      const updated = await brandService.uploadManualLogo(req.params.id, req.file.buffer, req.file.mimetype);
      return sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
};
