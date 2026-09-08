/**
 * User Controller
 *
 * Handles HTTP request/response logic for user-related operations:
 * - Viewing and updating the authenticated user's profile
 * - Admin listing of all users (with pagination and search)
 * - Admin user status updates and deletions
 */
import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service';
import { sendSuccess, sendError } from '../utils/response';

// ──────────────────────────────────────────────────────────────────────────────
// GET PROFILE
// ──────────────────────────────────────────────────────────────────────────────
export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const user = await userService.getUserById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    return sendSuccess(res, 200, 'Profile retrieved successfully', user);
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// UPDATE PROFILE
// ──────────────────────────────────────────────────────────────────────────────
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const user = await userService.updateUser(userId, req.body);
    return sendSuccess(res, 200, 'Profile updated successfully', user);
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET ALL USERS (Admin)
// ──────────────────────────────────────────────────────────────────────────────
export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '10');
    const search = req.query.search as string | undefined;

    const result = await userService.getAllUsers(page, limit, search);
    return sendSuccess(res, 200, 'Users retrieved successfully', result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// UPDATE USER STATUS (Admin)
// ──────────────────────────────────────────────────────────────────────────────
export const updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUserId = req.params.id as string;
    const { isActive } = req.body;
    const user = await userService.updateUserStatus(targetUserId, isActive);
    return sendSuccess(res, 200, 'User status updated successfully', user);
  } catch (error: any) {
    if (error.message === 'User not found') return sendError(res, 404, error.message);
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// DELETE USER (Admin)
// ──────────────────────────────────────────────────────────────────────────────
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUserId = req.params.id as string;
    await userService.deleteUser(targetUserId);
    return sendSuccess(res, 200, 'User deleted successfully');
  } catch (error: any) {
    if (error.message === 'User not found') return sendError(res, 404, error.message);
    next(error);
  }
};
