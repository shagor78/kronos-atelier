import type {
  UserProfile,
  Category,
  Product,
  CartSummary,
  OrderRecord,
  HealthReport,
} from '../types/ecommerce.ts';

const TOKEN_STORAGE_KEY = 'kronos_atelier_access_token';
const REFRESH_STORAGE_KEY = 'kronos_atelier_refresh_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredTokens(accessToken: string | null, refreshToken?: string | null): void {
  try {
    if (accessToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    if (refreshToken !== undefined) {
      if (refreshToken) {
        localStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
      } else {
        localStorage.removeItem(REFRESH_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage quota errors
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api/v1${endpoint}`, {
    ...options,
    headers,
  });

  const json = await response.json().catch(() => ({
    success: false,
    error: { message: `HTTP ${response.status} error` },
  }));

  if (!response.ok || json.success === false) {
    const errMessage =
      json?.error?.message || json?.message || `Request failed with status ${response.status}`;
    throw new Error(errMessage);
  }

  return json as T;
}

export const apiClient = {
  // Health & OpenAPI
  getHealth: () => request<HealthReport>('/health'),
  getOpenApi: () => request<Record<string, unknown>>('/openapi.json'),

  // Auth
  login: (email: string, password: string) =>
    request<{
      success: boolean;
      data: { user: UserProfile; accessToken: string; refreshToken: string };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (payload: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }) =>
    request<{
      success: boolean;
      data: { user: UserProfile; accessToken: string; refreshToken: string };
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    }),

  getMe: () => request<{ success: boolean; data: UserProfile }>('/auth/me'),

  updateProfile: (payload: Partial<UserProfile>) =>
    request<{ success: boolean; data: UserProfile }>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Categories
  getCategories: () => request<{ success: boolean; data: Category[] }>('/categories'),

  createCategory: (payload: { name: string; description: string }) =>
    request<{ success: boolean; data: Category }>('/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteCategory: (id: string) =>
    request<{ success: boolean }>(`/categories/${id}`, {
      method: 'DELETE',
    }),

  // Products
  getProducts: (params?: {
    search?: string;
    category?: string;
    sort?: string;
    available?: boolean;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.category && params.category !== 'all') query.set('category', params.category);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.available) query.set('available', 'true');
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<{
      success: boolean;
      data: Product[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/products${qs ? `?${qs}` : ''}`);
  },

  getProductById: (id: string) =>
    request<{ success: boolean; data: Product }>(`/products/${id}`),

  createProduct: (payload: Record<string, unknown>) =>
    request<{ success: boolean; data: Partial<Product> }>('/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProduct: (id: string, payload: Record<string, unknown>) =>
    request<{ success: boolean; data: Partial<Product> }>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteProduct: (id: string) =>
    request<{ success: boolean; message: string }>(`/products/${id}`, {
      method: 'DELETE',
    }),

  // Cart
  getCart: (promoCode = '') =>
    request<{ success: boolean; data: CartSummary }>(
      `/cart${promoCode ? `?promoCode=${encodeURIComponent(promoCode)}` : ''}`
    ),

  addToCart: (productId: string, quantity = 1) =>
    request<{ success: boolean; data: CartSummary }>('/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    }),

  updateCartItem: (productId: string, quantity: number) =>
    request<{ success: boolean; data: CartSummary }>(`/cart/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    }),

  removeCartItem: (productId: string) =>
    request<{ success: boolean; data: CartSummary }>(`/cart/${productId}`, {
      method: 'DELETE',
    }),

  applyPromoCode: (code: string) =>
    request<{ success: boolean; data: CartSummary }>('/cart/promo', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  // Wishlist
  getWishlist: () => request<{ success: boolean; data: Product[] }>('/wishlist'),

  toggleWishlist: (productId: string) =>
    request<{ success: boolean; action: 'ADDED' | 'REMOVED'; productId: string }>('/wishlist', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    }),

  // Orders & Checkout
  createOrder: (payload: {
    recipientName: string;
    recipientPhone: string;
    shippingAddress: string;
    shippingCity: string;
    shippingPostalCode: string;
    shippingCountry: string;
    paymentMethod: 'CARD' | 'WIRE_TRANSFER' | 'COD';
    promoCode?: string;
    notes?: string;
  }) =>
    request<{
      success: boolean;
      data: {
        id: string;
        orderNumber: string;
        status: string;
        paymentStatus: string;
        paymentMethod: string;
        paymentReference: string;
        totalAmount: number;
      };
    }>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMyOrders: () => request<{ success: boolean; data: OrderRecord[] }>('/orders'),

  // Reviews
  submitReview: (payload: {
    productId: string;
    rating: number;
    title: string;
    comment: string;
  }) =>
    request<{ success: boolean; data: Record<string, unknown> }>('/reviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Admin Console APIs
  getAdminOverview: () =>
    request<{
      success: boolean;
      data: {
        kpis: {
          totalRevenue: number;
          totalOrders: number;
          totalUsers: number;
          totalProducts: number;
          lowStockCount: number;
        };
        lowStockProducts: Array<{
          id: string;
          sku: string;
          name: string;
          stock_quantity: number;
          price: number;
        }>;
        ordersByStatus: Array<{ status: string; count: number; amount: number }>;
        recentLogs: Array<{
          id: string;
          level: string;
          category: string;
          action: string;
          actor_email: string;
          ip_address: string;
          details: Record<string, unknown>;
          created_at: string;
        }>;
        recentNotifications: Array<{
          id: string;
          channel: string;
          recipient: string;
          subject: string;
          message: string;
          status: string;
          created_at: string;
        }>;
      };
    }>('/admin/overview'),

  getAdminOrders: () => request<{ success: boolean; data: OrderRecord[] }>('/admin/orders'),

  updateOrderStatus: (
    orderId: string,
    payload: { status: string; paymentStatus?: string; trackingNumber?: string }
  ) =>
    request<{ success: boolean }>(`/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getAdminUsers: () =>
    request<{
      success: boolean;
      data: Array<{
        id: string;
        email: string;
        full_name: string;
        role: 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN';
        phone: string;
        city: string;
        country: string;
        is_active: number;
        last_login_at: string;
        created_at: string;
      }>;
    }>('/admin/users'),

  updateUserRole: (userId: string, role: string, isActive?: boolean) =>
    request<{ success: boolean }>(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role, isActive }),
    }),

  updateInventory: (productId: string, stockQuantity: number, isAvailable = true) =>
    request<{ success: boolean }>(`/admin/inventory/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({ stockQuantity, isAvailable }),
    }),

  getAdminReviews: () =>
    request<{ success: boolean; data: Array<Record<string, unknown>> }>('/admin/reviews'),

  moderateReview: (reviewId: string, status: 'APPROVED' | 'REJECTED') =>
    request<{ success: boolean }>(`/admin/reviews/${reviewId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  dispatchTestNotification: (channel: 'TELEGRAM' | 'EMAIL' | 'SMS', status: 'SUCCESS' | 'FAILED') =>
    request<{
      success: boolean;
      data: {
        id: string;
        channel: string;
        recipient: string;
        subject: string;
        message: string;
        status: string;
        createdAt: string;
      };
    }>('/admin/notifications/dispatch', {
      method: 'POST',
      body: JSON.stringify({ channel, status, commitSha: '8f31d9c4b021' }),
    }),
};
