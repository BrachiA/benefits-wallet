import { Router } from 'express';
import { brandController } from './brand.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { createBrandSchema, listBrandsQuerySchema, updateBrandSchema } from './brand.dto';

export const brandRouter = Router();

brandRouter.get('/', validateRequest(listBrandsQuerySchema, 'query'), brandController.list);
brandRouter.get('/:id', brandController.getById);
brandRouter.post('/', validateRequest(createBrandSchema), brandController.create);
brandRouter.patch('/:id', validateRequest(updateBrandSchema), brandController.update);
brandRouter.delete('/:id', brandController.remove);
