import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Guards write endpoints (deploy/delete) with a shared bearer token.
 *
 * When DEPLOY_TOKEN is unset, requests pass through — this keeps local dev
 * frictionless. Any publicly reachable instance (e.g. Heroku) must set it.
 */
export function requireDeployToken(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.DEPLOY_TOKEN;
  if (!expected) {
    next();
    return;
  }

  const header = req.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'Missing or invalid deploy token.' });
    return;
  }
  next();
}
