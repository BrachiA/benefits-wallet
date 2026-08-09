import type { NextFunction, Request, Response } from 'express';
import { tagService } from './tag.service';
import { sendPaginated, sendSuccess, parsePagination } from '../../lib/apiResponse';
import type { CreateTagInput, ListTagsQuery, UpdateTagInput } from './tag.dto';

export const tagController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as ListTagsQuery;
      const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
      const { items, meta } = await tagService.list(query, page, pageSize);
      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await tagService.getById(req.params.id));
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await tagService.create(req.body as CreateTagInput), 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await tagService.update(req.params.id, req.body as UpdateTagInput));
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await tagService.remove(req.params.id);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
