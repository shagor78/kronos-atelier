export type UserRole = 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  shippingAddress?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  parent_id: string | null;
  display_order: number;
  product_count?: number;
}

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  title: string;
  comment: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  is_verified_purchase: number;
  created_at: string;
  product_name?: string;
  product_sku?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  specifications: Record<string, string>;
  price: number;
  discount_percent: number;
  final_price: number;
  category_id: string;
  category_name?: string;
  category_slug?: string;
  brand: string;
  image_url: string;
  gallery_urls: string[];
  stock_quantity: number;
  is_available: boolean;
  is_featured: boolean;
  rating_avg: number;
  rating_count: number;
  reviews?: ProductReview[];
  created_at: string;
}

export interface CartItem {
  cart_item_id: string;
  product_id: string;
  sku: string;
  name: string;
  slug: string;
  price: number;
  discount_percent: number;
  unit_discounted_price: number;
  quantity: number;
  line_subtotal: number;
  line_total: number;
  image_url: string;
  stock_quantity: number;
  is_available: number;
  brand: string;
  category_name: string;
}

export interface CartSummary {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  productDiscount: number;
  promoCode: string;
  promoDescription: string;
  promoDiscount: number;
  discountTotal: number;
  shippingCost: number;
  taxTotal: number;
  totalAmount: number;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderItemRecord {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  product_image: string;
  unit_price: number;
  discount_percent: number;
  quantity: number;
  line_total: number;
}

export interface OrderRecord {
  id: string;
  order_number: string;
  user_id: string;
  customer_email?: string;
  customer_account_name?: string;
  status: OrderStatus;
  payment_status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  payment_method: 'CARD' | 'WIRE_TRANSFER' | 'COD';
  payment_reference: string;
  subtotal: number;
  discount_total: number;
  shipping_cost: number;
  tax_total: number;
  total_amount: number;
  promo_code: string;
  recipient_name: string;
  recipient_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
  tracking_number: string;
  notes: string;
  created_at: string;
  items: OrderItemRecord[];
}

export interface HealthReport {
  success: boolean;
  status: 'HEALTHY' | 'UNHEALTHY';
  timestamp: string;
  environment: string;
  uptimeSeconds: number;
  checks: {
    application: string;
    database: string;
    catalogSeeded: string;
    memory: string;
    cpu: string;
    tlsConfig: string;
  };
  metrics: {
    rssMb: number;
    heapUsedMb: number;
    systemMemoryUsedPercent: number;
    cpuLoadAvg1m: number;
  };
}
