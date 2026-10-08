import { Router } from 'express';
import { brandController } from './brand.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';
import { uploadSingleImage } from '../../middleware/upload';
import { createBrandSchema, listBrandsQuerySchema, updateBrandSchema } from './brand.dto';

export const brandRouter = Router();

brandRouter.get('/', validateRequest(listBrandsQuerySchema, 'query'), brandController.list);
brandRouter.get('/:id', brandController.getById);

brandRouter.use(requireAdminAuth);

brandRouter.post('/', validateRequest(createBrandSchema), brandController.create);
brandRouter.patch('/:id', validateRequest(updateBrandSchema), brandController.update);
brandRouter.post('/:id/logo', uploadSingleImage('file'), brandController.uploadLogo);
brandRouter.delete('/:id', brandController.remove);
