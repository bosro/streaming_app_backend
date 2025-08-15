import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { ApiResponse } from "../types/common";

const prisma = new PrismaClient();

const getProductsSchema = z.object({
  category: z.string().optional(),
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1))
    .optional()
    .default("1"),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(50))
    .optional()
    .default("20"),
  search: z.string().optional(),
  inStock: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  isDigital: z
    .string()
    .transform((val) => val === "true")
    .optional(),
});

export class ProductController {
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
  public async getProducts(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { category, page, limit, search, inStock, isDigital } =
        getProductsSchema.parse(req.query);
      const offset = (page - 1) * limit;

      // Build where clause
      const where: any = {
        isActive: true,
      };

      if (category) where.category = category;
      if (inStock !== undefined) where.inStock = inStock;
      if (isDigital !== undefined) where.isDigital = isDigital;

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            currency: true,
            category: true,
            images: true,
            inStock: true,
            stockQuantity: true,
            isDigital: true,
            createdAt: true,
          },
        }),
        prisma.product.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        message: "Products retrieved successfully",
        data: {
          products,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1,
          },
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

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
  public async getProductById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      const product = await prisma.product.findUnique({
        where: { id, isActive: true },
      });

      if (!product) {
        res.status(404).json({
          success: false,
          message: "Product not found",
        } as ApiResponse);
        return;
      }

      res.status(200).json({
        success: true,
        message: "Product details retrieved successfully",
        data: { product },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

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
  public async getCategories(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const categories = await prisma.product.groupBy({
        by: ["category"],
        where: { isActive: true },
        _count: { category: true },
        orderBy: { category: "asc" },
      });

      const formattedCategories = categories.map((cat) => ({
        name: cat.category,
        count: cat._count.category,
      }));

      res.status(200).json({
        success: true,
        message: "Categories retrieved successfully",
        data: { categories: formattedCategories },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export const productController = new ProductController();
