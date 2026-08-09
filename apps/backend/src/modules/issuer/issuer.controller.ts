import type { NextFunction, Request, Response } from 'express';
import { issuerService } from './issuer.service';
import { sendPaginated, sendSuccess, parsePagination } from '../../lib/apiResponse';
import type { CreateIssuerInput, ListIssuersQuery, UpdateIssuerInput } from './issuer.dto';

export const issuerController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as ListIssuersQuery;
      const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
      const { items, meta } = await issuerService.list(query, page, pageSize);
      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await issuerService.getById(req.params.id));
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = req.body as CreateIssuerInput;
      return sendSuccess(res, await issuerService.create(input), 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const input = req.body as UpdateIssuerInput;
      return sendSuccess(res, await issuerService.update(req.params.id, input));
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await issuerService.remove(req.params.id);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
