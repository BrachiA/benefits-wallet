import { Router } from 'express';
import { programController } from './program.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { createProgramSchema, listProgramsQuerySchema, updateProgramSchema } from './program.dto';

export const programRouter = Router();

programRouter.get('/', validateRequest(listProgramsQuerySchema, 'query'), programController.list);
programRouter.get('/:id', programController.getById);
programRouter.post('/', validateRequest(createProgramSchema), programController.create);
programRouter.patch('/:id', validateRequest(updateProgramSchema), programController.update);
programRouter.delete('/:id', programController.remove);
