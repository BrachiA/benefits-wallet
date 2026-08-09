import type { NextFunction, Request, Response } from 'express';
import { searchService } from './search.service';
import { sendSuccess } from '../../lib/apiResponse';
import type { SearchQuery } from './search.dto';

export const searchController = {
  async searchAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as SearchQuery;
      return sendSuccess(res, await searchService.searchAll(query));
    } catch (err) {
      next(err);
    }
  },
};
