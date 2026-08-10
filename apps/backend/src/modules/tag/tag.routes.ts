import { Router } from 'express';
import { tagController } from './tag.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';
import { createTagSchema, listTagsQuerySchema, updateTagSchema } from './tag.dto';

export const tagRouter = Router();

tagRouter.get('/', validateRequest(listTagsQuerySchema, 'query'), tagController.list);
tagRouter.get('/:id', tagController.getById);

tagRouter.use(requireAdminAuth);

tagRouter.post('/', validateRequest(createTagSchema), tagController.create);
tagRouter.patch('/:id', validateRequest(updateTagSchema), tagController.update);
tagRouter.delete('/:id', tagController.remove);
