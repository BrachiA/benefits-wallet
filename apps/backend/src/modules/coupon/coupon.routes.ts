import { Router } from 'express';
import { couponController } from './coupon.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { createCouponSchema, listCouponsQuerySchema, updateCouponSchema } from './coupon.dto';

export const couponRouter = Router();

couponRouter.get('/', validateRequest(listCouponsQuerySchema, 'query'), couponController.list);
couponRouter.get('/:id', couponController.getById);
couponRouter.post('/', validateRequest(createCouponSchema), couponController.create);
couponRouter.post('/:id/redeem', couponController.redeem);
couponRouter.patch('/:id', validateRequest(updateCouponSchema), couponController.update);
couponRouter.delete('/:id', couponController.remove);
