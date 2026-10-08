import { Router } from 'express';
import { programController } from './program.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';
import { uploadSingleImage } from '../../middleware/upload';
import { createProgramSchema, listProgramsQuerySchema, updateProgramSchema } from './program.dto';

export const programRouter = Router();

programRouter.get('/', validateRequest(listProgramsQuerySchema, 'query'), programController.list);
programRouter.get('/:id', programController.getById);

programRouter.use(requireAdminAuth);

programRouter.post('/', validateRequest(createProgramSchema), programController.create);
programRouter.patch('/:id', validateRequest(updateProgramSchema), programController.update);
programRouter.post('/:id/logo', uploadSingleImage('file'), programController.uploadLogo);
programRouter.delete('/:id', programController.remove);
