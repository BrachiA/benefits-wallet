import type { NextFunction, Request, Response } from 'express';
import { storeService } from './store.service';
import { sendPaginated, sendSuccess, parsePagination } from '../../lib/apiResponse';
import type { CreateStoreInput, ListStoresQuery, UpdateStoreInput } from './store.dto';

export const storeController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as ListStoresQuery;
      const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
      const { items, meta } = await storeService.list(query, page, pageSize);
      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await storeService.getById(req.params.id));
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await storeService.create(req.body as CreateStoreInput), 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await storeService.update(req.params.id, req.body as UpdateStoreInput));
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await storeService.remove(req.params.id);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
