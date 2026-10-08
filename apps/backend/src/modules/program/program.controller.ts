import type { NextFunction, Request, Response } from 'express';
import { programService } from './program.service';
import { sendPaginated, sendSuccess, parsePagination } from '../../lib/apiResponse';
import { AppError } from '../../lib/AppError';
import type { CreateProgramInput, ListProgramsQuery, UpdateProgramInput } from './program.dto';

export const programController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as ListProgramsQuery;
      const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
      const { items, meta } = await programService.list(query, page, pageSize);
      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await programService.getById(req.params.id));
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = req.body as CreateProgramInput;
      return sendSuccess(res, await programService.create(input), 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const input = req.body as UpdateProgramInput;
      return sendSuccess(res, await programService.update(req.params.id, input));
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await programService.remove(req.params.id);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async uploadLogo(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw AppError.validation('קובץ תמונה חסר (שדה "file")');
      const updated = await programService.uploadManualLogo(req.params.id, req.file.buffer, req.file.mimetype);
      return sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
};
