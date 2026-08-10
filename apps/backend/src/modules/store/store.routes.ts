import { Router } from 'express';
import { storeController } from './store.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';
import { createStoreSchema, listStoresQuerySchema, updateStoreSchema } from './store.dto';

export const storeRouter = Router();

storeRouter.get('/', validateRequest(listStoresQuerySchema, 'query'), storeController.list);
storeRouter.get('/:id', storeController.getById);

storeRouter.use(requireAdminAuth);

storeRouter.post('/', validateRequest(createStoreSchema), storeController.create);
storeRouter.patch('/:id', validateRequest(updateStoreSchema), storeController.update);
storeRouter.delete('/:id', storeController.remove);
