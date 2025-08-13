import { Router } from 'express';
import { param } from 'express-validator';
import { productController } from '../controllers/productController';
import { validate, validatePagination } from '../middleware/validation';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: E-commerce product management
 */

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get products with filtering and pagination
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: inStock
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: isDigital
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 */
router.get('/', validatePagination, productController.getProducts);

/**
 * @swagger
 * /products/categories:
 *   get:
 *     summary: Get product categories
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get('/categories', productController.getCategories);

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get product details by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product details retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get('/:id', validate([
  param('id').isString().notEmpty().withMessage('Product ID is required'),
]), productController.getProductById);

export default router;