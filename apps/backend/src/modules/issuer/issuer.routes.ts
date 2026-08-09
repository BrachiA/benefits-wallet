import { Router } from 'express';
import { issuerController } from './issuer.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { createIssuerSchema, listIssuersQuerySchema, updateIssuerSchema } from './issuer.dto';

export const issuerRouter = Router();

issuerRouter.get('/', validateRequest(listIssuersQuerySchema, 'query'), issuerController.list);
issuerRouter.get('/:id', issuerController.getById);
issuerRouter.post('/', validateRequest(createIssuerSchema), issuerController.create);
issuerRouter.patch('/:id', validateRequest(updateIssuerSchema), issuerController.update);
issuerRouter.delete('/:id', issuerController.remove);
