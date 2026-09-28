import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError';
import { requireUUID } from '../utils/validation';
import { currentUser } from './auth';
import { getAssetById } from '../repositories/assets.repository';
import { hasResponsibility } from '../repositories/responsibilities.repository';

// Asset access policy (single place to change it):
//   ADMIN and GOVERNMENT_OFFICER can access every asset.
//   A FIELD_USER (Field Officer) can access an asset ONLY if government has assigned them
//   responsibility for it (asset_responsibilities: CONSTRUCTION or MAINTENANCE).
//   Department membership and activity assignment do NOT grant access.
/** Mounted on /api/assets/:id - enforces asset access for every nested route too. */
export const requireAssetAccess: RequestHandler = async (req, _res, next) => {
  const user = currentUser(req);
  const assetId = requireUUID(req.params.id, 'id');
  const asset = await getAssetById(assetId);
  if (!asset) throw AppError.notFound('Asset');

  if (user.role === 'FIELD_USER' && !(await hasResponsibility(user.id, assetId))) {
    throw AppError.forbidden('You do not have access to this asset');
  }
  next();
};
