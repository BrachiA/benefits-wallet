import { Router } from 'express';
import { searchController } from './search.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { searchQuerySchema } from './search.dto';

export const searchRouter = Router();

searchRouter.get('/', validateRequest(searchQuerySchema, 'query'), searchController.searchAll);
