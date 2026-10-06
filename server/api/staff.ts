import type { VercelRequest, VercelResponse } from '@vercel/node';
import staffIndexHandler from '../handlers/admin/staff/index';
import createStaffHandler from '../handlers/admin/staff/create';
import updateRoleHandler from '../handlers/admin/staff/update-role';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname.endsWith('/create')) {
    return createStaffHandler(req, res);
  }

  if (pathname.endsWith('/update-role')) {
    return updateRoleHandler(req, res);
  }

  return staffIndexHandler(req, res);
}
