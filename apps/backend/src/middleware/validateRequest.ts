import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

// עטיפה גנרית סביב כל Zod schema מ-@benefits-wallet/shared. משמש
// גם לגוף הבקשה וגם ל-query params — אותו middleware, target שונה.
export function validateRequest(schema: ZodSchema, target: 'body' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      // נזרק כ-throw ולא res.json ישיר — כך ה-errorHandler המרכזי
      // הוא נקודת האמת היחידה לפורמט השגיאה, גם עבור ולידציה.
      return next(result.error);
    }
    req[target] = result.data;
    next();
  };
}
