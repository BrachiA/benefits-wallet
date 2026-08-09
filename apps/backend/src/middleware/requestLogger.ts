import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { createRequestLogger } from '../lib/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID();
  (req as Request & { requestId: string; log: ReturnType<typeof createRequestLogger> }).requestId = requestId;
  (req as Request & { log: ReturnType<typeof createRequestLogger> }).log = createRequestLogger(requestId);

  res.setHeader('X-Request-Id', requestId);

  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    (req as Request & { log: ReturnType<typeof createRequestLogger> }).log.info(
      { method: req.method, path: req.path, statusCode: res.statusCode, durationMs },
      'request completed'
    );
  });

  next();
}
