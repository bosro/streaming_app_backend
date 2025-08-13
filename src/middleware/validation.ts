import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ApiResponse } from '../types/common';

export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      next();
      return;
    }

    const extractedErrors = errors.array().map(err => ({
      field: 'param' in err ? err.param : undefined, 
      message: err.msg,
      value: 'value' in err ? err.value : undefined,
    }));

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: extractedErrors,
    } as ApiResponse);
  };
};

// Common validation middleware
export const validatePagination = (req: Request, res: Response, next: NextFunction): void => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  if (page < 1) {
    res.status(400).json({
      success: false,
      message: 'Page must be greater than 0',
    } as ApiResponse);
    return;
  }

  if (limit < 1 || limit > 100) {
    res.status(400).json({
      success: false,
      message: 'Limit must be between 1 and 100',
    } as ApiResponse);
    return;
  }

  req.query.page = page.toString();
  req.query.limit = limit.toString();
  next();
};