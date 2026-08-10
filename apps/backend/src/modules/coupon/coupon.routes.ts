import { Router } from 'express';
import { couponController } from './coupon.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';
import { createCouponSchema, listCouponsQuerySchema, updateCouponSchema } from './coupon.dto';

export const couponRouter = Router();

couponRouter.get('/', validateRequest(listCouponsQuerySchema, 'query'), couponController.list);
couponRouter.get('/:id', couponController.getById);
// redeem הוא פעולת משתמשת-קצה באפליקציה (מימוש קופון), לא פעולת
// ניהול — נשאר ציבורי כמו שאר הנתיבים שהאפליקציה קוראת.
couponRouter.post('/:id/redeem', couponController.redeem);

couponRouter.use(requireAdminAuth);

couponRouter.post('/', validateRequest(createCouponSchema), couponController.create);
couponRouter.patch('/:id', validateRequest(updateCouponSchema), couponController.update);
couponRouter.delete('/:id', couponController.remove);
