import { Router } from 'express';
import { categoryController } from './category.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { createCategorySchema, listCategoriesQuerySchema, updateCategorySchema } from './category.dto';

export const categoryRouter = Router();

categoryRouter.get('/', validateRequest(listCategoriesQuerySchema, 'query'), categoryController.list);
categoryRouter.get('/:id', categoryController.getById);
categoryRouter.post('/', validateRequest(createCategorySchema), categoryController.create);
categoryRouter.patch('/:id', validateRequest(updateCategorySchema), categoryController.update);
categoryRouter.delete('/:id', categoryController.remove);
