import type { NextFunction, Request, Response } from 'express';
import { categoryService } from './category.service';
import { sendPaginated, sendSuccess, parsePagination } from '../../lib/apiResponse';
import type { CreateCategoryInput, ListCategoriesQuery, UpdateCategoryInput } from './category.dto';

export const categoryController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as ListCategoriesQuery;
      const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
      const { items, meta } = await categoryService.list(query, page, pageSize);
      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await categoryService.getById(req.params.id));
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await categoryService.create(req.body as CreateCategoryInput), 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await categoryService.update(req.params.id, req.body as UpdateCategoryInput));
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await categoryService.remove(req.params.id);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
