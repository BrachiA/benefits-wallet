import type { Request, Response } from 'express';

export function notFound(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
}
