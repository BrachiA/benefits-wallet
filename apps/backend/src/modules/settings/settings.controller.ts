import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../lib/apiResponse';
import { settingsService } from './settings.service';
import type { UpdateAlertSettingsInput } from './settings.dto';

export const settingsController = {
  async getAlertSettings(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await settingsService.getAlertSettings());
    } catch (err) {
      next(err);
    }
  },

  async updateAlertSettings(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await settingsService.updateAlertSettings(req.body as UpdateAlertSettingsInput));
    } catch (err) {
      next(err);
    }
  },
};
