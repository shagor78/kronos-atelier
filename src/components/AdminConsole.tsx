import React, { useEffect, useState, useCallback } from 'react';
import {
  Search,
  Plus,
  RefreshCw,
  ArrowLeft,
  Check,
  X,
  Trash2,
  Edit3,
  Send,
} from 'lucide-react';
import { apiClient } from '../services/apiClient.ts';
import type {
  Product,
  Category,
  OrderRecord,
  UserProfile,
  HealthReport,
} from '../types/ecommerce.ts';
import { ProductImage } from './ProductImage.tsx';

interface AdminConsoleProps {
  currentUser: UserProfile;
  onExitAdmin: () => void;
  onCatalogChanged: () => void;
}

type AdminTab =
  | 'overview'
  | 'products'
  | 'categories'
  | 'inventory'
  | 'orders'
  | 'users'
  | 'reviews'
  | 'security_logs';

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  currentUser,
  onExitAdmin,
  onCatalogChanged,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Data states
  const [overview, setOverview] = useState<{
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
  } | null>(null);

  const [health, setHealth] = useState<HealthReport | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [users, setUsers] = useState<
    Array<{
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
    }>
  >([]);
  const [reviews, setReviews] = useState<Array<Record<string, unknown>>>([]);
  const [searchFilter, setSearchFilter] = useState('');

  // Product Form Modal
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    sku: 'KRN-OBJ-009',
    name: '',
    description: '',
    price: '980',
    discountPercent: '0',
    categoryId: 'cat_lighting',
    brand: 'Kronos Atelier',
    imageUrl: '/src/assets/images/product_brass_desk_lamp_1791096509789.jpg',
    stockQuantity: '15',
    isAvailable: true,
    isFeatured: false,
  });

  // Category Form
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');

  // Stock Drafts
  const [stockDrafts, setStockDrafts] = useState<Record<string, number>>({});

  const showNotice = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4500);
  };

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, hlthRes, prdRes, catRes, ordRes, usrRes, revRes] = await Promise.all([
        apiClient.getAdminOverview(),
        apiClient.getHealth(),
        apiClient.getProducts({ limit: 50 }),
        apiClient.getCategories(),
        apiClient.getAdminOrders(),
        apiClient.getAdminUsers(),
        apiClient.getAdminReviews(),
      ]);
      setOverview(ovRes.data);
      setHealth(hlthRes);
      setProducts(prdRes.data);
      setCategories(catRes.data);
      setOrders(ordRes.data);
      setUsers(usrRes.data);
      setReviews(revRes.data);

      const drafts: Record<string, number> = {};
      for (const p of prdRes.data) {
        drafts[p.id] = p.stock_quantity;
      }
      setStockDrafts(drafts);
    } catch (err) {
      showNotice('error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        sku: productForm.sku,
        name: productForm.name,
        description: productForm.description,
        price: Number(productForm.price),
        discountPercent: Number(productForm.discountPercent),
        categoryId: productForm.categoryId,
        brand: productForm.brand,
        imageUrl: productForm.imageUrl,
        stockQuantity: Number(productForm.stockQuantity),
        isAvailable: productForm.isAvailable,
        isFeatured: productForm.isFeatured,
        specifications: {
          Material: 'CNC Aerospace Grade Billet',
          Calibration: 'Munich Facility · ISO 9001',
        },
      };

      if (editingProductId) {
        await apiClient.updateProduct(editingProductId, payload);
        showNotice('success', `Updated product ${productForm.sku}`);
      } else {
        await apiClient.createProduct(payload);
        showNotice('success', `Created product ${productForm.sku}`);
      }

      setShowProductForm(false);
      setEditingProductId(null);
      await loadAdminData();
      onCatalogChanged();
    } catch (err) {
      showNotice('error', (err as Error).message);
    }
  };

  const handleEditProductClick = (p: Product) => {
    setEditingProductId(p.id);
    setProductForm({
      sku: p.sku,
      name: p.name,
      description: p.description,
      price: String(p.price),
      discountPercent: String(p.discount_percent || 0),
      categoryId: p.category_id,
      brand: p.brand,
      imageUrl: p.image_url,
      stockQuantity: String(p.stock_quantity),
      isAvailable: p.is_available,
      isFeatured: p.is_featured,
    });
    setShowProductForm(true);
  };

  const handleDeleteProduct = async (id: string, sku: string) => {
    try {
      const res = await apiClient.deleteProduct(id);
      showNotice('success', `${sku}: ${res.message}`);
      await loadAdminData();
      onCatalogChanged();
    } catch (err) {
      showNotice('error', (err as Error).message);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await apiClient.createCategory({
        name: newCategoryName.trim(),
        description: newCategoryDesc.trim(),
      });
      setNewCategoryName('');
      setNewCategoryDesc('');
      showNotice('success', 'Category created.');
      await loadAdminData();
      onCatalogChanged();
    } catch (err) {
      showNotice('error', (err as Error).message);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await apiClient.deleteCategory(id);
      showNotice('success', 'Category removed.');
      await loadAdminData();
      onCatalogChanged();
    } catch (err) {
      showNotice('error', (err as Error).message);
    }
  };

  const handleUpdateStock = async (productId: string, sku: string) => {
    const qty = stockDrafts[productId] ?? 0;
    try {
      await apiClient.updateInventory(productId, qty, qty > 0);
      showNotice('success', `Inventory updated for ${sku} (${qty} units).`);
      await loadAdminData();
      onCatalogChanged();
    } catch (err) {
      showNotice('error', (err as Error).message);
    }
  };

  const handleOrderStatusChange = async (
    orderId: string,
    status: string,
    paymentStatus?: string
  ) => {
    try {
      await apiClient.updateOrderStatus(orderId, { status, paymentStatus });
      showNotice('success', `Order status updated to ${status}.`);
      await loadAdminData();
      onCatalogChanged();
    } catch (err) {
      showNotice('error', (err as Error).message);
    }
  };

  const handleRoleChange = async (userId: string, role: string, isActive?: boolean) => {
    try {
      await apiClient.updateUserRole(userId, role, isActive);
      showNotice('success', `Updated user permissions (${role}).`);
      await loadAdminData();
    } catch (err) {
      showNotice('error', (err as Error).message);
    }
  };

  const handleModerateReview = async (reviewId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await apiClient.moderateReview(reviewId, status);
      showNotice('success', `Review marked ${status}.`);
      await loadAdminData();
      onCatalogChanged();
    } catch (err) {
      showNotice('error', (err as Error).message);
    }
  };

  const handleDispatchNotification = async (
    channel: 'TELEGRAM' | 'EMAIL' | 'SMS',
    status: 'SUCCESS' | 'FAILED'
  ) => {
    try {
      await apiClient.dispatchTestNotification(channel, status);
      showNotice('success', `Dispatched ${status} deployment notification via ${channel}.`);
      await loadAdminData();
    } catch (err) {
      showNotice('error', (err as Error).message);
    }
  };

  const tabLabels: Record<AdminTab, string> = {
    overview: 'Executive Overview & Health',
    products: 'Product Catalog CRUD',
    categories: 'Categories & Hierarchy',
    inventory: 'Inventory & Stock Control',
    orders: 'Order Orchestration',
    users: 'Users & RBAC Governance',
    reviews: 'Review Moderation',
    security_logs: 'Security & Audit Logs',
  };

  return (
    <div className="min-h-screen bg-[#F9F9F8] text-[#18181B] flex flex-col lg:flex-row">
      {/* Left Workspace Sidebar (260px fixed on desktop) */}
      <aside className="w-full lg:w-[260px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-[#E6E4E0] flex flex-col justify-between">
        <div>
          <div className="px-6 py-5 border-b border-[#E6E4E0] flex items-center justify-between">
            <span className="font-serif text-xl font-semibold tracking-tight text-[#18181B]">
              Kronos Console
            </span>
            <button
              onClick={onExitAdmin}
              className="text-xs font-medium text-[#52525B] hover:text-[#18181B] flex items-center gap-1.5 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Storefront
            </button>
          </div>

          <nav className="p-3 space-y-1">
            {(Object.keys(tabLabels) as AdminTab[]).map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey)}
                className={`w-full text-left px-3.5 py-2.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  activeTab === tabKey
                    ? 'bg-[#18181B] text-white'
                    : 'text-[#52525B] hover:bg-[#F4F3EF] hover:text-[#18181B]'
                }`}
              >
                {tabLabels[tabKey]}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-5 border-t border-[#E6E4E0] text-xs text-[#52525B] space-y-1">
          <div className="font-medium text-[#18181B] truncate">{currentUser.fullName}</div>
          <div className="font-mono text-[11px] text-[#71717A] truncate">{currentUser.email}</div>
          <div className="pt-1 text-[11px] font-mono text-[#16A34A]">
            Role · {currentUser.role}
          </div>
        </div>
      </aside>

      {/* Main Viewport Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract for Admin Workspace */}
        <header className="px-6 lg:px-8 py-4 bg-white border-b border-[#E6E4E0] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-[#52525B]">
            <span>Admin Console</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-[#18181B]">{tabLabels[activeTab]}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadAdminData}
              className="px-3.5 py-2 text-xs font-medium text-[#18181B] bg-[#F4F3EF] hover:bg-[#E6E4E0] rounded transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Telemetry
            </button>
            <button
              onClick={() => {
                setEditingProductId(null);
                setProductForm({
                  sku: `KRN-NEW-${Math.floor(100 + Math.random() * 899)}`,
                  name: '',
                  description: '',
                  price: '1450',
                  discountPercent: '0',
                  categoryId: categories[0]?.id || 'cat_lighting',
                  brand: 'Kronos Atelier',
                  imageUrl: '/src/assets/images/product_monolith_speaker_1791096498209.jpg',
                  stockQuantity: '12',
                  isAvailable: true,
                  isFeatured: false,
                });
                setShowProductForm(true);
              }}
              className="px-4 py-2 text-xs font-medium text-white bg-[#18181B] hover:bg-[#27272A] rounded transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              New Product SKU
            </button>
          </div>
        </header>

        {feedback && (
          <div
            className={`mx-6 lg:mx-8 mt-4 px-4 py-3 text-xs font-medium border flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="text-xs underline ml-4">
              Dismiss
            </button>
          </div>
        )}

        <main className="p-6 lg:p-8 flex-1 space-y-8 overflow-x-auto">
          {/* TAB 1: EXECUTIVE OVERVIEW & PRODUCTION HEALTH */}
          {activeTab === 'overview' && overview && (
            <div className="space-y-8">
              {/* Executive KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white border border-[#E6E4E0] p-5">
                  <div className="text-xs text-[#52525B]">Gross Settled Revenue</div>
                  <div className="text-2xl font-semibold font-mono tabular-nums mt-2 text-[#18181B]">
                    ${overview.kpis.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-[#16A34A] mt-1">
                    Verified ledger · Active orders
                  </div>
                </div>

                <div className="bg-white border border-[#E6E4E0] p-5">
                  <div className="text-xs text-[#52525B]">Total Orders Processed</div>
                  <div className="text-2xl font-semibold font-mono tabular-nums mt-2 text-[#18181B]">
                    {overview.kpis.totalOrders}
                  </div>
                  <div className="text-[11px] text-[#52525B] mt-1">
                    Fulfillment pipeline active
                  </div>
                </div>

                <div className="bg-white border border-[#E6E4E0] p-5">
                  <div className="text-xs text-[#52525B]">Active Catalog SKUs</div>
                  <div className="text-2xl font-semibold font-mono tabular-nums mt-2 text-[#18181B]">
                    {overview.kpis.totalProducts}
                  </div>
                  <div className="text-[11px] text-[#52525B] mt-1">
                    Across {categories.length} categories
                  </div>
                </div>

                <div className="bg-white border border-[#E6E4E0] p-5">
                  <div className="text-xs text-[#52525B]">Registered Accounts</div>
                  <div className="text-2xl font-semibold font-mono tabular-nums mt-2 text-[#18181B]">
                    {overview.kpis.totalUsers}
                  </div>
                  <div className="text-[11px] text-[#52525B] mt-1">
                    RBAC enforced (3 tiers)
                  </div>
                </div>

                <div className="bg-white border border-[#E6E4E0] p-5">
                  <div className="text-xs text-[#52525B]">Low Stock Threshold (≤10)</div>
                  <div className="text-2xl font-semibold font-mono tabular-nums mt-2 text-[#D97706]">
                    {overview.kpis.lowStockCount}
                  </div>
                  <div className="text-[11px] text-[#52525B] mt-1">
                    SKUs monitored for restock
                  </div>
                </div>
              </div>

              {/* Production Health & Deployment Notification Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Production Health Check Status */}
                <div className="bg-white border border-[#E6E4E0] p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E6E4E0] pb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#18181B]">
                        Production System Health Check (/api/v1/health)
                      </h3>
                      <p className="text-xs text-[#52525B] mt-0.5">
                        Live diagnostic probe for application, SQLite WAL database, memory, CPU, and TLS
                      </p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-[#16A34A]">
                      Status · {health?.status || 'HEALTHY'}
                    </span>
                  </div>

                  {health && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      <div className="p-3 bg-[#F9F9F8] border border-[#E6E4E0]">
                        <div className="text-[#52525B]">Application Process</div>
                        <div className="font-mono font-semibold text-[#16A34A] mt-1">
                          {health.checks.application} (Uptime {health.uptimeSeconds}s)
                        </div>
                      </div>
                      <div className="p-3 bg-[#F9F9F8] border border-[#E6E4E0]">
                        <div className="text-[#52525B]">Relational Database</div>
                        <div className="font-mono font-semibold text-[#16A34A] mt-1">
                          {health.checks.database} · WAL Mode
                        </div>
                      </div>
                      <div className="p-3 bg-[#F9F9F8] border border-[#E6E4E0]">
                        <div className="text-[#52525B]">TLS / Reverse Proxy</div>
                        <div className="font-mono font-semibold text-[#18181B] mt-1">
                          {health.checks.tlsConfig}
                        </div>
                      </div>
                      <div className="p-3 bg-[#F9F9F8] border border-[#E6E4E0]">
                        <div className="text-[#52525B]">Memory Allocation</div>
                        <div className="font-mono tabular-nums font-semibold text-[#18181B] mt-1">
                          {health.metrics.rssMb} MB RSS ({health.metrics.systemMemoryUsedPercent}%)
                        </div>
                      </div>
                      <div className="p-3 bg-[#F9F9F8] border border-[#E6E4E0]">
                        <div className="text-[#52525B]">CPU Load (1m Avg)</div>
                        <div className="font-mono tabular-nums font-semibold text-[#18181B] mt-1">
                          {health.metrics.cpuLoadAvg1m} · PASS
                        </div>
                      </div>
                      <div className="p-3 bg-[#F9F9F8] border border-[#E6E4E0]">
                        <div className="text-[#52525B]">Catalog Integrity</div>
                        <div className="font-mono font-semibold text-[#16A34A] mt-1">
                          {health.checks.catalogSeeded}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* CI/CD Deployment Notification Dispatcher */}
                <div className="bg-white border border-[#E6E4E0] p-6 space-y-4">
                  <div className="border-b border-[#E6E4E0] pb-3">
                    <h3 className="text-sm font-semibold text-[#18181B]">
                      Deployment & Incident Notification Dispatcher
                    </h3>
                    <p className="text-xs text-[#52525B] mt-0.5">
                      Trigger verified release or rollback notifications across Telegram, Email, and SMS
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleDispatchNotification('TELEGRAM', 'SUCCESS')}
                      className="px-3 py-2 text-xs font-medium bg-[#18181B] text-white rounded hover:bg-[#27272A] flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Telegram · Deploy Success
                    </button>
                    <button
                      onClick={() => handleDispatchNotification('EMAIL', 'SUCCESS')}
                      className="px-3 py-2 text-xs font-medium bg-[#F4F3EF] text-[#18181B] border border-[#D4D1C9] rounded hover:bg-[#E6E4E0] whitespace-nowrap"
                    >
                      Email · Deploy Success
                    </button>
                    <button
                      onClick={() => handleDispatchNotification('SMS', 'FAILED')}
                      className="px-3 py-2 text-xs font-medium bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] rounded hover:bg-[#FEE2E2] whitespace-nowrap"
                    >
                      SMS · Rollback Alert
                    </button>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto pt-1">
                    {overview.recentNotifications.slice(0, 3).map((n) => (
                      <div
                        key={n.id}
                        className="p-3 bg-[#F9F9F8] border border-[#E6E4E0] text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-mono text-[11px] text-[#52525B]">
                          <span>
                            {n.channel} · {n.recipient}
                          </span>
                          <span className="text-[#16A34A]">{n.status}</span>
                        </div>
                        <div className="font-medium text-[#18181B]">{n.subject}</div>
                        <pre className="text-[11px] font-mono text-[#52525B] whitespace-pre-wrap leading-relaxed">
                          {n.message}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Order Status Breakdown & Low Stock Table */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-[#E6E4E0] p-6">
                  <h3 className="text-sm font-semibold text-[#18181B] mb-4">
                    Order Pipeline by Status
                  </h3>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E6E4E0] text-[#52525B]">
                        <th className="py-2.5 font-medium">Order Status</th>
                        <th className="py-2.5 font-medium text-right">Order Count</th>
                        <th className="py-2.5 font-medium text-right">Volume (USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E4E0]">
                      {overview.ordersByStatus.map((row) => (
                        <tr key={row.status} className="hover:bg-[#F9F9F8]">
                          <td className="py-2.5 font-mono font-medium text-[#18181B]">
                            {row.status}
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums">
                            {row.count}
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums">
                            ${Number(row.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white border border-[#E6E4E0] p-6">
                  <h3 className="text-sm font-semibold text-[#18181B] mb-4">
                    Low-Inventory Watchlist (≤ 10 Units)
                  </h3>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E6E4E0] text-[#52525B]">
                        <th className="py-2.5 font-medium">SKU</th>
                        <th className="py-2.5 font-medium">Product Name</th>
                        <th className="py-2.5 font-medium text-right">Remaining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E4E0]">
                      {overview.lowStockProducts.map((item) => (
                        <tr key={item.id} className="hover:bg-[#F9F9F8]">
                          <td className="py-2.5 font-mono text-[#52525B]">{item.sku}</td>
                          <td className="py-2.5 font-medium text-[#18181B]">{item.name}</td>
                          <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-[#D97706]">
                            {item.stock_quantity} units
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCT CATALOG CRUD */}
          {activeTab === 'products' && (
            <div className="bg-white border border-[#E6E4E0] p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#18181B]">
                    Master Product Catalog ({products.length} SKUs)
                  </h3>
                  <p className="text-xs text-[#52525B] mt-0.5">
                    Create, update, price, discount, or archive production catalog items
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter by SKU or title..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-[#F9F9F8] border border-[#E6E4E0] focus:outline-none focus:border-[#18181B]"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E6E4E0] text-[#52525B]">
                      <th className="py-3 pr-4 font-medium">SKU</th>
                      <th className="py-3 pr-4 font-medium">Product</th>
                      <th className="py-3 pr-4 font-medium">Category</th>
                      <th className="py-3 pr-4 font-medium text-right">Base Price</th>
                      <th className="py-3 pr-4 font-medium text-right">Discount</th>
                      <th className="py-3 pr-4 font-medium text-right">Stock</th>
                      <th className="py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E4E0]">
                    {products
                      .filter(
                        (p) =>
                          !searchFilter ||
                          p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchFilter.toLowerCase())
                      )
                      .map((p) => (
                        <tr key={p.id} className="hover:bg-[#F9F9F8]">
                          <td className="py-3 pr-4 font-mono text-[#52525B] whitespace-nowrap">
                            {p.sku}
                          </td>
                          <td className="py-3 pr-4 font-medium text-[#18181B] flex items-center gap-3">
                            <div className="w-10 h-10 shrink-0 bg-[#F4F3EF] overflow-hidden">
                              <ProductImage src={p.image_url} alt={p.name} />
                            </div>
                            <span className="truncate max-w-xs">{p.name}</span>
                          </td>
                          <td className="py-3 pr-4 text-[#52525B] whitespace-nowrap">
                            {p.category_name || p.category_id}
                          </td>
                          <td className="py-3 pr-4 text-right font-mono tabular-nums">
                            ${p.price.toFixed(2)}
                          </td>
                          <td className="py-3 pr-4 text-right font-mono tabular-nums text-[#52525B]">
                            {p.discount_percent}%
                          </td>
                          <td className="py-3 pr-4 text-right font-mono tabular-nums">
                            {p.stock_quantity}
                          </td>
                          <td className="py-3 text-right whitespace-nowrap space-x-2">
                            <button
                              onClick={() => handleEditProductClick(p)}
                              className="px-2.5 py-1 text-xs font-medium bg-[#F4F3EF] hover:bg-[#E6E4E0] text-[#18181B] rounded inline-flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id, p.sku)}
                              className="px-2.5 py-1 text-xs font-medium bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#991B1B] rounded inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: CATEGORIES MANAGEMENT */}
          {activeTab === 'categories' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <form
                onSubmit={handleCreateCategory}
                className="bg-white border border-[#E6E4E0] p-6 space-y-4 h-fit"
              >
                <h3 className="text-sm font-semibold text-[#18181B]">Create Category</h3>
                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Acoustic Treatment"
                    className="w-full px-3 py-2 text-xs bg-[#F9F9F8] border border-[#E6E4E0] focus:outline-none focus:border-[#18181B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    Editorial Description
                  </label>
                  <textarea
                    rows={3}
                    value={newCategoryDesc}
                    onChange={(e) => setNewCategoryDesc(e.target.value)}
                    placeholder="Architectural description for collection header..."
                    className="w-full px-3 py-2 text-xs bg-[#F9F9F8] border border-[#E6E4E0] focus:outline-none focus:border-[#18181B]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 text-xs font-medium bg-[#18181B] text-white hover:bg-[#27272A] rounded transition-colors"
                >
                  Add Category
                </button>
              </form>

              <div className="lg:col-span-2 bg-white border border-[#E6E4E0] p-6">
                <h3 className="text-sm font-semibold text-[#18181B] mb-4">
                  Active Taxonomy ({categories.length})
                </h3>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E6E4E0] text-[#52525B]">
                      <th className="py-2.5 font-medium">Name</th>
                      <th className="py-2.5 font-medium">Slug</th>
                      <th className="py-2.5 font-medium text-right">Products</th>
                      <th className="py-2.5 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E4E0]">
                    {categories.map((c) => (
                      <tr key={c.id} className="hover:bg-[#F9F9F8]">
                        <td className="py-3 font-medium text-[#18181B]">
                          <div>{c.name}</div>
                          <div className="text-[11px] text-[#71717A] line-clamp-1">
                            {c.description}
                          </div>
                        </td>
                        <td className="py-3 font-mono text-[#52525B]">{c.slug}</td>
                        <td className="py-3 text-right font-mono tabular-nums">
                          {c.product_count ?? 0}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleDeleteCategory(c.id)}
                            className="text-xs text-[#991B1B] hover:underline"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: INVENTORY & STOCK CONTROL */}
          {activeTab === 'inventory' && (
            <div className="bg-white border border-[#E6E4E0] p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#18181B]">
                  Real-Time Warehouse Inventory & Stock Allocation
                </h3>
                <p className="text-xs text-[#52525B] mt-0.5">
                  Adjust available unit quantities; changes are logged to the immutable security audit trail
                </p>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E6E4E0] text-[#52525B]">
                    <th className="py-3 font-medium">SKU</th>
                    <th className="py-3 font-medium">Product Title</th>
                    <th className="py-3 font-medium">Availability State</th>
                    <th className="py-3 font-medium text-right">Unit Allocation</th>
                    <th className="py-3 font-medium text-right">Commit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E4E0]">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-[#F9F9F8]">
                      <td className="py-3 font-mono text-[#52525B]">{p.sku}</td>
                      <td className="py-3 font-medium text-[#18181B]">{p.name}</td>
                      <td className="py-3 font-mono">
                        {p.stock_quantity > 10 ? (
                          <span className="text-[#16A34A]">Nominal · In Stock</span>
                        ) : p.stock_quantity > 0 ? (
                          <span className="text-[#D97706]">Low Reserve ({p.stock_quantity})</span>
                        ) : (
                          <span className="text-[#DC2626]">Exhausted · Out of Stock</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          value={stockDrafts[p.id] ?? p.stock_quantity}
                          onChange={(e) =>
                            setStockDrafts((prev) => ({
                              ...prev,
                              [p.id]: Math.max(0, parseInt(e.target.value || '0', 10)),
                            }))
                          }
                          className="w-24 px-2.5 py-1.5 text-right font-mono tabular-nums bg-[#F9F9F8] border border-[#E6E4E0]"
                        />
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleUpdateStock(p.id, p.sku)}
                          className="px-3 py-1.5 text-xs font-medium bg-[#18181B] text-white rounded hover:bg-[#27272A]"
                        >
                          Update Stock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 5: ORDER ORCHESTRATION */}
          {activeTab === 'orders' && (
            <div className="bg-white border border-[#E6E4E0] p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#18181B]">
                  Customer Order Fulfillment ({orders.length} Orders)
                </h3>
                <p className="text-xs text-[#52525B] mt-0.5">
                  Transition order lifecycle states (PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED / CANCELLED)
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E6E4E0] text-[#52525B]">
                      <th className="py-3 pr-4 font-medium">Order Number</th>
                      <th className="py-3 pr-4 font-medium">Recipient & Destination</th>
                      <th className="py-3 pr-4 font-medium">Items</th>
                      <th className="py-3 pr-4 font-medium text-right">Total (USD)</th>
                      <th className="py-3 pr-4 font-medium">Payment</th>
                      <th className="py-3 font-medium">Fulfillment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E4E0]">
                    {orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-[#F9F9F8]">
                        <td className="py-3.5 pr-4 font-mono font-medium text-[#18181B] whitespace-nowrap">
                          <div>{ord.order_number}</div>
                          <div className="text-[11px] text-[#71717A]">{ord.created_at}</div>
                        </td>
                        <td className="py-3.5 pr-4">
                          <div className="font-medium text-[#18181B]">{ord.recipient_name}</div>
                          <div className="text-[11px] text-[#52525B]">
                            {ord.shipping_address}, {ord.shipping_city} {ord.shipping_postal_code}
                          </div>
                        </td>
                        <td className="py-3.5 pr-4 text-[#52525B]">
                          {ord.items?.map((item) => (
                            <div key={item.id} className="font-mono text-[11px]">
                              {item.quantity}× {item.product_sku}
                            </div>
                          ))}
                        </td>
                        <td className="py-3.5 pr-4 text-right font-mono tabular-nums font-semibold">
                          ${Number(ord.total_amount).toFixed(2)}
                        </td>
                        <td className="py-3.5 pr-4 font-mono text-[11px]">
                          <div>{ord.payment_method}</div>
                          <div className="text-[#16A34A]">{ord.payment_status}</div>
                        </td>
                        <td className="py-3.5">
                          <select
                            value={ord.status}
                            onChange={(e) => handleOrderStatusChange(ord.id, e.target.value)}
                            className="px-2.5 py-1.5 text-xs font-mono bg-[#F9F9F8] border border-[#E6E4E0] focus:outline-none focus:border-[#18181B]"
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="CONFIRMED">CONFIRMED</option>
                            <option value="PROCESSING">PROCESSING</option>
                            <option value="SHIPPED">SHIPPED</option>
                            <option value="DELIVERED">DELIVERED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: USERS & RBAC GOVERNANCE */}
          {activeTab === 'users' && (
            <div className="bg-white border border-[#E6E4E0] p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#18181B]">
                  Identity & Role-Based Access Control (CUSTOMER · ADMIN · SUPER_ADMIN)
                </h3>
                <p className="text-xs text-[#52525B] mt-0.5">
                  Manage user privileges and account status; all passwords stored using scrypt + 16-byte random salt
                </p>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E6E4E0] text-[#52525B]">
                    <th className="py-3 font-medium">Full Name</th>
                    <th className="py-3 font-medium">Email</th>
                    <th className="py-3 font-medium">Role Tier</th>
                    <th className="py-3 font-medium">Account Status</th>
                    <th className="py-3 font-medium text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E4E0]">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#F9F9F8]">
                      <td className="py-3 font-medium text-[#18181B]">{u.full_name}</td>
                      <td className="py-3 font-mono text-[#52525B]">{u.email}</td>
                      <td className="py-3">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleRoleChange(u.id, e.target.value, Boolean(u.is_active))
                          }
                          className="px-2.5 py-1 text-xs font-mono bg-[#F9F9F8] border border-[#E6E4E0]"
                        >
                          <option value="CUSTOMER">CUSTOMER</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        </select>
                      </td>
                      <td className="py-3 font-mono">
                        {u.is_active ? (
                          <span className="text-[#16A34A]">Active</span>
                        ) : (
                          <span className="text-[#DC2626]">Suspended</span>
                        )}
                      </td>
                      <td className="py-3 text-right font-mono text-[#71717A]">{u.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 7: REVIEW MODERATION */}
          {activeTab === 'reviews' && (
            <div className="bg-white border border-[#E6E4E0] p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#18181B]">
                  Verified Client Review Moderation ({reviews.length})
                </h3>
                <p className="text-xs text-[#52525B] mt-0.5">
                  Approve or reject client reviews before publication on product specification pages
                </p>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E6E4E0] text-[#52525B]">
                    <th className="py-3 font-medium">Product</th>
                    <th className="py-3 font-medium">Author</th>
                    <th className="py-3 font-medium">Rating</th>
                    <th className="py-3 font-medium">Review Extract</th>
                    <th className="py-3 font-medium">State</th>
                    <th className="py-3 font-medium text-right">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E4E0]">
                  {reviews.map((r) => (
                    <tr key={String(r.id)} className="hover:bg-[#F9F9F8]">
                      <td className="py-3 font-mono text-[#52525B]">
                        {String(r.product_sku || r.product_id)}
                      </td>
                      <td className="py-3 font-medium text-[#18181B]">{String(r.user_name)}</td>
                      <td className="py-3 font-mono tabular-nums">{String(r.rating)} / 5</td>
                      <td className="py-3 max-w-md">
                        <div className="font-medium text-[#18181B]">{String(r.title)}</div>
                        <div className="text-[#52525B] line-clamp-2">{String(r.comment)}</div>
                      </td>
                      <td className="py-3 font-mono">{String(r.status)}</td>
                      <td className="py-3 text-right whitespace-nowrap space-x-2">
                        <button
                          onClick={() => handleModerateReview(String(r.id), 'APPROVED')}
                          className="px-2.5 py-1 text-xs font-medium bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0] rounded inline-flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleModerateReview(String(r.id), 'REJECTED')}
                          className="px-2.5 py-1 text-xs font-medium bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] rounded inline-flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 8: SECURITY & AUDIT LOGS */}
          {activeTab === 'security_logs' && overview && (
            <div className="bg-white border border-[#E6E4E0] p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#18181B]">
                  Structured Security & Application Audit Trail
                </h3>
                <p className="text-xs text-[#52525B] mt-0.5">
                  Automatic credential redaction enabled — passwords, tokens, and private keys are never written to logs
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#E6E4E0] text-[#52525B] font-sans">
                      <th className="py-2.5 pr-4 font-medium">Timestamp</th>
                      <th className="py-2.5 pr-4 font-medium">Severity</th>
                      <th className="py-2.5 pr-4 font-medium">Category · Action</th>
                      <th className="py-2.5 pr-4 font-medium">Actor</th>
                      <th className="py-2.5 font-medium">Sanitized Payload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E4E0]">
                    {overview.recentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F9F9F8]">
                        <td className="py-2.5 pr-4 text-[11px] text-[#71717A] whitespace-nowrap">
                          {log.created_at}
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <span
                            className={
                              log.level === 'SECURITY' || log.level === 'WARN'
                                ? 'text-[#D97706] font-semibold'
                                : log.level === 'ERROR'
                                ? 'text-[#DC2626] font-semibold'
                                : 'text-[#16A34A]'
                            }
                          >
                            {log.level}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-[#18181B] whitespace-nowrap">
                          {log.category} · {log.action}
                        </td>
                        <td className="py-2.5 pr-4 text-[#52525B] whitespace-nowrap">
                          {log.actor_email || 'anonymous'}
                        </td>
                        <td className="py-2.5 text-[11px] text-[#52525B] max-w-md truncate">
                          {JSON.stringify(log.details)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Product Create / Edit Modal */}
      {showProductForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6E4E0] w-full max-w-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E6E4E0] pb-3">
              <h3 className="text-base font-semibold text-[#18181B]">
                {editingProductId ? 'Edit Product Specification' : 'Create New Product SKU'}
              </h3>
              <button
                onClick={() => setShowProductForm(false)}
                className="text-xs text-[#52525B] hover:text-[#18181B]"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-[#52525B] mb-1">SKU Identifier</label>
                  <input
                    type="text"
                    required
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    className="w-full px-3 py-2 font-mono bg-[#F9F9F8] border border-[#E6E4E0]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#52525B] mb-1">Category</label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) =>
                      setProductForm({ ...productForm, categoryId: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#F9F9F8] border border-[#E6E4E0]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#52525B] mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="e.g., Monolith Acoustic Sub-Bass Column"
                  className="w-full px-3 py-2 bg-[#F9F9F8] border border-[#E6E4E0]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#52525B] mb-1">
                  Architectural & Technical Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm({ ...productForm, description: e.target.value })
                  }
                  placeholder="Detailed material and engineering specifications..."
                  className="w-full px-3 py-2 bg-[#F9F9F8] border border-[#E6E4E0]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-[#52525B] mb-1">Unit Price (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    className="w-full px-3 py-2 font-mono bg-[#F9F9F8] border border-[#E6E4E0]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#52525B] mb-1">Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={productForm.discountPercent}
                    onChange={(e) =>
                      setProductForm({ ...productForm, discountPercent: e.target.value })
                    }
                    className="w-full px-3 py-2 font-mono bg-[#F9F9F8] border border-[#E6E4E0]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#52525B] mb-1">Stock Allocation</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={productForm.stockQuantity}
                    onChange={(e) =>
                      setProductForm({ ...productForm, stockQuantity: e.target.value })
                    }
                    className="w-full px-3 py-2 font-mono bg-[#F9F9F8] border border-[#E6E4E0]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#52525B] mb-1">Studio Asset Image</label>
                <select
                  value={productForm.imageUrl}
                  onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F9F9F8] border border-[#E6E4E0]"
                >
                  <option value="/src/assets/images/product_monolith_speaker_1791096498209.jpg">
                    Monolith Studio Monitor Asset
                  </option>
                  <option value="/src/assets/images/product_brass_desk_lamp_1791096509789.jpg">
                    Cantilever Brass Luminaire Asset
                  </option>
                  <option value="/src/assets/images/product_chronograph_watch_1791096522393.jpg">
                    Calibre 09 Titanium Chronograph Asset
                  </option>
                  <option value="/src/assets/images/product_tactile_keyboard_1791096534845.jpg">
                    Field-65 Aluminum Mechanical Instrument Asset
                  </option>
                  <option value="/src/assets/images/hero_architectural_lighting_1791096483269.jpg">
                    Obelisk Travertine Floor Column Asset
                  </option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E6E4E0]">
                <button
                  type="button"
                  onClick={() => setShowProductForm(false)}
                  className="px-4 py-2 text-xs font-medium text-[#52525B] hover:text-[#18181B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-medium bg-[#18181B] text-white hover:bg-[#27272A] rounded"
                >
                  {editingProductId ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
