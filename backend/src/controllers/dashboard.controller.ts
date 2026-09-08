/**
 * Dashboard Controller
 *
 * Returns role-specific dashboard aggregate data for the authenticated user.
 * ADMIN, STAFF, and USER each receive a different data payload from the service layer.
 */
import { Request, Response, NextFunction } from 'express';
import * as dashboardService from '../services/dashboard.service';
import { sendSuccess, sendError } from '../utils/response';

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    // Dispatch to the role-specific dashboard data loader
    let data;
    if (role === 'ADMIN') {
      data = await dashboardService.getAdminDashboardData();
    } else if (role === 'STAFF') {
      data = await dashboardService.getStaffDashboardData(userId);
    } else {
      // Default: authenticated USER role
      data = await dashboardService.getUserDashboardData(userId);
    }

    return sendSuccess(res, 200, `${role} dashboard data retrieved successfully`, data);
  } catch (error: any) {
    // Staff dashboard requires a linked StaffProfile
    if (error.message === 'Staff profile not found') {
      return sendError(res, 404, error.message);
    }
    next(error);
  }
};
