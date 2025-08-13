export interface ProductFilters {
  category?: string;
  inStock?: boolean;
  isDigital?: boolean;
  search?: string;
  priceMin?: number;
  priceMax?: number;
}

export interface CustomizationOption {
  id: string;
  name: string;
  type: 'text' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
  maxLength?: number;
  description?: string;
}

export interface ProductDimensions {
  length: number;
  width: number;
  height: number;
  unit?: 'cm' | 'in';
}

export interface CreateProductRequest {
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  images: string[];
  stockQuantity: number;
  isDigital: boolean;
  weight?: number;
  dimensions?: ProductDimensions;
  customizationOptions?: CustomizationOption[];
  digitalFileUrl?: string;
  isActive?: boolean;
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {
  id: string;
}

export interface ProductSearchQuery {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  isDigital?: boolean;
  sortBy?: 'name' | 'price' | 'createdAt' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stockQuantity: number;
  attributes: Record<string, string>;
}

export interface ProductReview {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  title?: string;
  comment?: string;
  isVerifiedPurchase: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductInventory {
  productId: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  allowBackorders: boolean;
}

export interface ProductMetrics {
  views: number;
  sales: number;
  revenue: number;
  averageRating: number;
  reviewCount: number;
  conversionRate: number;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
}

export interface ProductTag {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

export interface ProductBundle {
  id: string;
  name: string;
  description: string;
  price: number;
  discount: number;
  products: Array<{
    productId: string;
    quantity: number;
  }>;
  isActive: boolean;
}

export interface DigitalProduct {
  downloadUrl: string;
  fileSize: number;
  fileType: string;
  downloadLimit?: number;
  expirationDays?: number;
  licenseType: 'single' | 'multi' | 'unlimited';
}

export interface PhysicalProduct {
  weight: number;
  dimensions: ProductDimensions;
  shippingClass: string;
  requiresShipping: boolean;
  isTaxable: boolean;
}

export interface ProductValidationRules {
  minPrice: number;
  maxPrice: number;
  requiredFields: string[];
  allowedCategories: string[];
  maxImages: number;
  maxTags: number;
  maxVariants: number;
}

export interface ProductImportData {
  name: string;
  description: string;
  price: number;
  category: string;
  sku?: string;
  stockQuantity?: number;
  weight?: number;
  images?: string[];
  tags?: string[];
}

export interface ProductExportData extends ProductImportData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  sales: number;
  revenue: number;
}

export interface BulkProductOperation {
  operation: 'update' | 'delete' | 'activate' | 'deactivate';
  productIds: string[];
  data?: Partial<UpdateProductRequest>;
}

export interface ProductAnalytics {
  period: 'day' | 'week' | 'month' | 'year';
  metrics: {
    views: number;
    sales: number;
    revenue: number;
    conversionRate: number;
    returnsRate: number;
  };
  topProducts: Array<{
    productId: string;
    name: string;
    sales: number;
    revenue: number;
  }>;
  categoryPerformance: Array<{
    category: string;
    sales: number;
    revenue: number;
  }>;
}