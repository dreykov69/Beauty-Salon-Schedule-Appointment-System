/**
 * Post Controller
 *
 * Handles HTTP request/response logic for salon blog/news posts:
 * - Listing and retrieving posts (public sees published only; staff/admin see all)
 * - Creating, updating, and deleting posts (staff/admin)
 */
import { Request, Response, NextFunction } from 'express';
import * as postService from '../services/post.service';
import { sendSuccess, sendError } from '../utils/response';

export const getAllPosts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '50');
    
    // Regular users only see published posts; admin/staff see drafts too
    let publishedOnly = true;
    if (req.user && (req.user.role === 'ADMIN' || req.user.role === 'STAFF')) {
      publishedOnly = false;
    }

    const result = await postService.getAllPosts(page, limit, publishedOnly);
    return sendSuccess(res, 200, 'Posts retrieved successfully', result.data, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const getPostById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let publishedOnly = true;
    if (req.user && (req.user.role === 'ADMIN' || req.user.role === 'STAFF')) {
      publishedOnly = false;
    }

    const post = await postService.getPostById((req.params.id as string), publishedOnly);
    return sendSuccess(res, 200, 'Post retrieved successfully', post);
  } catch (error: any) {
    if (error.message === 'Post not found') return sendError(res, 404, error.message);
    next(error);
  }
};

export const createPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = req.user!.id;
    const post = await postService.createPost(authorId, req.body);
    return sendSuccess(res, 201, 'Post created successfully', post);
  } catch (error) {
    next(error);
  }
};

export const updatePost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = req.user!.id;
    const role = req.user!.role;
    const post = await postService.updatePost((req.params.id as string), authorId, role, req.body);
    return sendSuccess(res, 200, 'Post updated successfully', post);
  } catch (error: any) {
    if (error.message === 'Post not found') return sendError(res, 404, error.message);
    if (error.message === 'Unauthorized') return sendError(res, 403, error.message);
    next(error);
  }
};

export const deletePost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = req.user!.id;
    const role = req.user!.role;
    await postService.deletePost((req.params.id as string), authorId, role);
    return sendSuccess(res, 200, 'Post deleted successfully');
  } catch (error: any) {
    if (error.message === 'Post not found') return sendError(res, 404, error.message);
    if (error.message === 'Unauthorized') return sendError(res, 403, error.message);
    next(error);
  }
};
