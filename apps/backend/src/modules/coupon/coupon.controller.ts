import type { NextFunction, Request, Response } from 'express';
import { couponService } from './coupon.service';
import { sendPaginated, sendSuccess, parsePagination } from '../../lib/apiResponse';
import type { CreateCouponInput, ListCouponsQuery, UpdateCouponInput } from './coupon.dto';

export const couponController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as ListCouponsQuery;
      const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
      const { items, meta } = await couponService.list(query, page, pageSize);
      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await couponService.getById(req.params.id));
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await couponService.create(req.body as CreateCouponInput), 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await couponService.update(req.params.id, req.body as UpdateCouponInput));
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await couponService.remove(req.params.id);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async redeem(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await couponService.redeem(req.params.id));
    } catch (err) {
      next(err);
    }
  },
};
