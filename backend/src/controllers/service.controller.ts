/**
 * Service Controller
 *
 * Handles HTTP request/response logic for salon service catalog operations:
 * - Listing and retrieving services
 * - Creating, updating, and deleting services (admin)
 */
import { Request, Response, NextFunction } from 'express';
import * as serviceService from '../services/service.service';
import { sendSuccess, sendError } from '../utils/response';
import { PaginationQuery, SearchQuery } from '../types';

// ──────────────────────────────────────────────────────────────────────────────
// GET ALL SERVICES
// ──────────────────────────────────────────────────────────────────────────────
export const getAllServices = async (req: Request<{}, {}, {}, PaginationQuery & SearchQuery>, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '10');
    const search = req.query.search;

    const result = await serviceService.getAllServices(page, limit, search);
    return sendSuccess(res, 200, 'Services retrieved successfully', result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET SERVICE BY ID
// ──────────────────────────────────────────────────────────────────────────────
export const getServiceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serviceId = req.params.id as string;
    const service = await serviceService.getServiceById(serviceId);
    return sendSuccess(res, 200, 'Service retrieved successfully', service);
  } catch (error: any) {
    if (error.message === 'Service not found') {
      return sendError(res, 404, error.message);
    }
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// CREATE SERVICE
// ──────────────────────────────────────────────────────────────────────────────
export const createService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = await serviceService.createService(req.body);
    return sendSuccess(res, 201, 'Service created successfully', service);
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// UPDATE SERVICE
// ──────────────────────────────────────────────────────────────────────────────
export const updateService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serviceId = req.params.id as string;
    const service = await serviceService.updateService(serviceId, req.body);
    return sendSuccess(res, 200, 'Service updated successfully', service);
  } catch (error: any) {
    if (error.message === 'Service not found') {
      return sendError(res, 404, error.message);
    }
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// DELETE SERVICE
// ──────────────────────────────────────────────────────────────────────────────
export const deleteService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serviceId = req.params.id as string;
    await serviceService.deleteService(serviceId);
    return sendSuccess(res, 200, 'Service deleted successfully');
  } catch (error: any) {
    if (error.message === 'Service not found') {
      return sendError(res, 404, error.message);
    }
    next(error);
  }
};
