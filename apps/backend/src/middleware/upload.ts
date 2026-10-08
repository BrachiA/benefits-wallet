import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/AppError';

// memoryStorage בכוונה, לא diskStorage: הקובץ הולך ישר ל-R2
// (lib/r2Storage.uploadImageBuffer) ולא צריך להישאר על דיסק השרת
// אפילו רגע — אין endpoint אחר שמגיש קבצים מקומיים.
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // עקבי עם lib/r2Storage.MAX_IMAGE_BYTES

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new AppError('VALIDATION_ERROR', 'הקובץ שהועלה חייב להיות תמונה', 422));
      return;
    }
    cb(null, true);
  },
});

// עוטף multer.single: בלי זה, MulterError (LIMIT_FILE_SIZE וכו') היה
// מגיע ל-errorHandler כ"Unhandled error" גנרי (500) במקום הודעה
// ברורה למנהלת — ראו lib/AppError / middleware/errorHandler.
export function uploadSingleImage(fieldName: string) {
  const middleware = multerUpload.single(fieldName);
  return (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof AppError) return next(err);
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('VALIDATION_ERROR', 'התמונה גדולה מדי (מקסימום 8MB)', 422));
      }
      next(err);
    });
  };
}
