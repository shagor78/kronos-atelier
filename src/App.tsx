import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ShoppingBag,
  Heart,
  User,
  ArrowRight,
  ArrowLeft,
  Plus,
  Minus,
  X,
  Check,
  Star,
} from 'lucide-react';
import {
  apiClient,
  getStoredToken,
  setStoredTokens,
} from './services/apiClient.ts';
import type {
  UserProfile,
  Category,
  Product,
  CartSummary,
  OrderRecord,
} from './types/ecommerce.ts';
import { ProductImage } from './components/ProductImage.tsx';
import { AdminConsole } from './components/AdminConsole.tsx';

type ActiveView =
  | 'storefront'
  | 'product_detail'
  | 'orders'
  | 'wishlist'
  | 'checkout'
  | 'admin'
  | 'api_docs';

export default function App() {
  // Navigation & View State
  const [activeView, setActiveView] = useState<ActiveView>('storefront');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isBagOpen, setIsBagOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // User & Auth State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authEmail, setAuthEmail] = useState('elena.rostova@kronos-client.com');
  const [authPassword, setAuthPassword] = useState('CustomerPass!2026');
  const [authFullName, setAuthFullName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authError, setAuthError] = useState('');

  // Catalog & Filter State
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<string>('featured');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);

  // Cart, Wishlist & Orders State
  const [cart, setCart] = useState<CartSummary>({
    items: [],
    itemCount: 0,
    subtotal: 0,
    productDiscount: 0,
    promoCode: '',
    promoDescription: '',
    promoDiscount: 0,
    discountTotal: 0,
    shippingCost: 0,
    taxTotal: 0,
    totalAmount: 0,
  });
  const [promoInput, setPromoInput] = useState('');
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [confirmedOrder, setConfirmedOrder] = useState<{
    orderNumber: string;
    status: string;
    paymentMethod: string;
    paymentReference: string;
    totalAmount: number;
  } | null>(null);

  // Checkout Form State
  const [checkoutForm, setCheckoutForm] = useState({
    recipientName: 'Elena Rostova',
    recipientPhone: '+1 (212) 555-0148',
    shippingAddress: '482 Mercer Street, Suite 4B',
    shippingCity: 'New York',
    shippingPostalCode: '10013',
    shippingCountry: 'United States',
    paymentMethod: 'CARD' as 'CARD' | 'WIRE_TRANSFER' | 'COD',
    notes: 'Architectural courier delivery — call upon arrival.',
  });

  // Review Form State
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');

  // OpenAPI Spec State
  const [openApiSpec, setOpenApiSpec] = useState<Record<string, unknown> | null>(null);

  // Global Toast Feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const notify = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Load Categories & Products
  const fetchCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const [catRes, prdRes] = await Promise.all([
        apiClient.getCategories(),
        apiClient.getProducts({
          category: selectedCategory,
          search: searchQuery,
          sort: sortOption,
          page: currentPage,
          limit: 6,
        }),
      ]);
      setCategories(catRes.data);
      setProducts(prdRes.data);
      setTotalPages(prdRes.pagination.totalPages);
    } catch (err) {
      notify('error', (err as Error).message);
    } finally {
      setLoadingCatalog(false);
    }
  }, [selectedCategory, searchQuery, sortOption, currentPage]);

  // Load User Session Data (Cart, Wishlist, Orders)
  const fetchUserData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setCurrentUser(null);
      return;
    }
    try {
      const meRes = await apiClient.getMe();
      setCurrentUser(meRes.data);
      setCheckoutForm((prev) => ({
        ...prev,
        recipientName: meRes.data.fullName || prev.recipientName,
        recipientPhone: meRes.data.phone || prev.recipientPhone,
        shippingAddress: meRes.data.shippingAddress || prev.shippingAddress,
        shippingCity: meRes.data.city || prev.shippingCity,
        shippingPostalCode: meRes.data.postalCode || prev.shippingPostalCode,
        shippingCountry: meRes.data.country || prev.shippingCountry,
      }));

      const [cartRes, wishRes, ordRes] = await Promise.all([
        apiClient.getCart(),
        apiClient.getWishlist(),
        apiClient.getMyOrders(),
      ]);
      setCart(cartRes.data);
      setWishlist(wishRes.data);
      setOrders(ordRes.data);
    } catch {
      setStoredTokens(null, null);
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Product Detail Loader
  const openProductDetail = async (productIdOrSlug: string) => {
    try {
      const res = await apiClient.getProductById(productIdOrSlug);
      setSelectedProduct(res.data);
      setActiveView('product_detail');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      notify('error', (err as Error).message);
    }
  };

  // Auth Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') {
        const res = await apiClient.login(authEmail, authPassword);
        setStoredTokens(res.data.accessToken, res.data.refreshToken);
        setCurrentUser(res.data.user);
        setIsAuthModalOpen(false);
        await fetchUserData();
        notify('success', `Signed in as ${res.data.user.fullName}`);
      } else {
        const res = await apiClient.register({
          email: authEmail,
          password: authPassword,
          fullName: authFullName,
          phone: authPhone,
        });
        setStoredTokens(res.data.accessToken, res.data.refreshToken);
        setCurrentUser(res.data.user);
        setIsAuthModalOpen(false);
        await fetchUserData();
        notify('success', `Account created for ${res.data.user.fullName}`);
      }
    } catch (err) {
      setAuthError((err as Error).message);
    }
  };

  const handleQuickRoleSignIn = async (
    email: string,
    pass: string,
    openAdminAfter = false
  ) => {
    setAuthError('');
    try {
      const res = await apiClient.login(email, pass);
      setStoredTokens(res.data.accessToken, res.data.refreshToken);
      setCurrentUser(res.data.user);
      setIsAuthModalOpen(false);
      await fetchUserData();
      notify('success', `Authenticated as ${res.data.user.fullName} (${res.data.user.role})`);
      if (openAdminAfter) {
        setActiveView('admin');
      }
    } catch (err) {
      setAuthError((err as Error).message);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch {
      // ignore
    }
    setStoredTokens(null, null);
    setCurrentUser(null);
    setCart({
      items: [],
      itemCount: 0,
      subtotal: 0,
      productDiscount: 0,
      promoCode: '',
      promoDescription: '',
      promoDiscount: 0,
      discountTotal: 0,
      shippingCost: 0,
      taxTotal: 0,
      totalAmount: 0,
    });
    setWishlist([]);
    setOrders([]);
    setActiveView('storefront');
    notify('success', 'Signed out of Kronos Atelier.');
  };

  // Cart & Wishlist Handlers
  const handleAddToCart = async (product: Product, quantity = 1) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      notify('error', 'Please sign in to add pieces to your bag.');
      return;
    }
    try {
      const res = await apiClient.addToCart(product.id, quantity);
      setCart(res.data);
      setIsBagOpen(true);
      notify('success', `Added ${product.name} to your bag.`);
    } catch (err) {
      notify('error', (err as Error).message);
    }
  };

  const handleUpdateCartQuantity = async (productId: string, nextQty: number) => {
    try {
      const res = await apiClient.updateCartItem(productId, nextQty);
      setCart(res.data);
    } catch (err) {
      notify('error', (err as Error).message);
    }
  };

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;
    try {
      const res = await apiClient.applyPromoCode(promoInput.trim());
      setCart(res.data);
      notify('success', `Applied privilege code ${res.data.promoCode}`);
    } catch (err) {
      notify('error', (err as Error).message);
    }
  };

  const handleToggleWishlist = async (productId: string) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      notify('error', 'Please sign in to save items to your wishlist.');
      return;
    }
    try {
      const res = await apiClient.toggleWishlist(productId);
      const wishRes = await apiClient.getWishlist();
      setWishlist(wishRes.data);
      notify(
        'success',
        res.action === 'ADDED' ? 'Saved to your archive wishlist.' : 'Removed from wishlist.'
      );
    } catch (err) {
      notify('error', (err as Error).message);
    }
  };

  // Checkout Handler
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.createOrder({
        ...checkoutForm,
        promoCode: cart.promoCode,
      });
      setConfirmedOrder(res.data);
      await Promise.all([fetchUserData(), fetchCatalog()]);
      notify('success', `Order ${res.data.orderNumber} confirmed.`);
    } catch (err) {
      notify('error', (err as Error).message);
    }
  };

  // Submit Review Handler
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    try {
      await apiClient.submitReview({
        productId: selectedProduct.id,
        rating: reviewRating,
        title: reviewTitle,
        comment: reviewComment,
      });
      setReviewTitle('');
      setReviewComment('');
      await openProductDetail(selectedProduct.id);
      await fetchCatalog();
      notify('success', 'Your verified review has been published.');
    } catch (err) {
      notify('error', (err as Error).message);
    }
  };

  const openApiExplorer = async () => {
    try {
      const spec = await apiClient.getOpenApi();
      setOpenApiSpec(spec);
      setActiveView('api_docs');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      notify('error', (err as Error).message);
    }
  };

  // Render Enterprise Admin Console when in admin view
  if (
    activeView === 'admin' &&
    currentUser &&
    (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')
  ) {
    return (
      <AdminConsole
        currentUser={currentUser}
        onExitAdmin={() => setActiveView('storefront')}
        onCatalogChanged={fetchCatalog}
      />
    );
  }

  const isWishlisted = (productId: string) => wishlist.some((w) => w.id === productId);

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F9F8] text-[#18181B]">
      {/* ====================================================================
          TOP BAR CONTRACT: Strict 1-Row, 3-Zone Header
          Zone 1: Single text element wordmark
          Zone 2: 5 clean text navigation links
          Zone 3: 2 primary actions (Account & Shopping Bag)
         ==================================================================== */}
      <header className="sticky top-0 z-30 bg-[#F9F9F8]/95 backdrop-blur-sm border-b border-[#E6E4E0] px-6 lg:px-12 py-4 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#storefront"
          onClick={(e) => {
            e.preventDefault();
            setActiveView('storefront');
          }}
          className="font-serif text-2xl font-semibold tracking-tight text-[#18181B] whitespace-nowrap"
        >
          Kronos Atelier
        </a>

        {/* Zone 2: 5 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-[#52525B]">
          <button
            onClick={() => {
              setSelectedCategory('all');
              setActiveView('storefront');
            }}
            className="hover:text-[#18181B] transition-colors whitespace-nowrap"
          >
            Collection
          </button>
          <button
            onClick={() => {
              setActiveView('storefront');
              document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="hover:text-[#18181B] transition-colors whitespace-nowrap"
          >
            Categories
          </button>
          <button
            onClick={() => {
              setActiveView('storefront');
              document
                .getElementById('craftsmanship-section')
                ?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="hover:text-[#18181B] transition-colors whitespace-nowrap"
          >
            Craftsmanship
          </button>
          <button
            onClick={() => {
              if (!currentUser) {
                setIsAuthModalOpen(true);
              } else {
                setActiveView('orders');
              }
            }}
            className="hover:text-[#18181B] transition-colors whitespace-nowrap"
          >
            Orders
          </button>
          <button
            onClick={() => {
              if (
                currentUser &&
                (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')
              ) {
                setActiveView('admin');
              } else {
                setIsAuthModalOpen(true);
              }
            }}
            className="hover:text-[#18181B] transition-colors whitespace-nowrap"
          >
            Admin Console
          </button>
        </nav>

        {/* Zone 3: 2 primary actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="px-3.5 py-2 text-xs font-medium text-[#18181B] hover:bg-[#EFEDE8] rounded transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <User className="w-3.5 h-3.5" />
            <span className="truncate max-w-[140px]">
              {currentUser ? currentUser.fullName.split(' ')[0] : 'Sign In'}
            </span>
          </button>

          <button
            onClick={() => setIsBagOpen(true)}
            className="px-4 py-2 text-xs font-medium text-white bg-[#18181B] hover:bg-[#27272A] rounded transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Bag</span>
            <span className="font-mono tabular-nums">({cart.itemCount})</span>
          </button>
        </div>
      </header>

      {/* Notification Banner */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md px-5 py-3.5 bg-[#18181B] text-white text-xs font-medium shadow-lg border border-[#3F3F46] flex items-center gap-3">
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="text-[#A1A1AA] hover:text-white ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ====================================================================
          VIEW 1: STOREFRONT HOMEPAGE (3 Sections + Editorial Footer)
         ==================================================================== */}
      {activeView === 'storefront' && (
        <main className="flex-1">
          {/* SECTION 1: Storefront Hero */}
          <section className="max-w-[1360px] mx-auto px-6 lg:px-12 py-12 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              <div className="lg:col-span-5 space-y-6">
                <div className="flex items-center gap-2 text-xs text-[#52525B]">
                  <span>Munich Facility</span>
                  <span aria-hidden="true">·</span>
                  <span>ISO 9001 Certified</span>
                  <span aria-hidden="true">·</span>
                  <span>Autumn / Winter Archive</span>
                </div>

                <h1 className="font-serif text-4xl sm:text-5xl lg:text-[54px] font-medium leading-[1.08] tracking-tight text-[#18181B]">
                  Architectural Luminaires & Reference Acoustic Instruments.
                </h1>

                <p className="text-base text-[#52525B] leading-relaxed max-w-[58ch]">
                  Machined from solid unlacquered brass, Grade-5 titanium, and 6061-T6 billet
                  aluminum. Engineered in Munich for mastering studios, architectural galleries,
                  and private collections.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    onClick={() =>
                      document
                        .getElementById('catalog-section')
                        ?.scrollIntoView({ behavior: 'smooth' })
                    }
                    className="px-6 py-3.5 text-xs font-semibold text-white bg-[#18181B] hover:bg-[#27272A] transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    <span>Explore the Collection</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => openProductDetail('prd_monolith_spk_01')}
                    className="px-5 py-3.5 text-xs font-medium text-[#18181B] border border-[#D4D1C9] hover:border-[#18181B] transition-colors whitespace-nowrap"
                  >
                    Inspect Monolith Monitors
                  </button>
                </div>

                <div className="pt-4 border-t border-[#E6E4E0] flex items-center gap-6 text-xs text-[#52525B]">
                  <div>
                    <span className="font-mono font-semibold text-[#18181B] tabular-nums">
                      5-Year
                    </span>{' '}
                    Calibration Warranty
                  </div>
                  <span aria-hidden="true">·</span>
                  <div>
                    Complimentary Insured Courier over{' '}
                    <span className="font-mono font-semibold text-[#18181B] tabular-nums">
                      $1,000
                    </span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="aspect-[16/9] w-full bg-[#EFEDE8] border border-[#E6E4E0] overflow-hidden relative">
                  <ProductImage
                    src="/src/assets/images/hero_architectural_lighting_1791096483269.jpg"
                    alt="Kronos Atelier Architectural Lighting and Reference Audio System"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-6 sm:p-8">
                    <div className="text-white flex flex-wrap items-end justify-between w-full gap-4">
                      <div>
                        <div className="text-xs text-white/80">
                          Featured Exhibition · Gallery Plinth 04
                        </div>
                        <div className="font-serif text-xl sm:text-2xl font-medium mt-0.5">
                          Obelisk Travertine Column & Monolith Acoustic Array
                        </div>
                      </div>
                      <button
                        onClick={() => openProductDetail('prd_gallery_floor_05')}
                        className="px-4 py-2 text-xs font-medium bg-white text-[#18181B] hover:bg-[#F4F3EF] transition-colors whitespace-nowrap"
                      >
                        View Specification · $2,890
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: Interactive Filter Bar + 3-Column Featured Collection Grid */}
          <section
            id="catalog-section"
            className="max-w-[1360px] mx-auto px-6 lg:px-12 py-12 border-t border-[#E6E4E0] space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="text-xs text-[#52525B]">
                  Serialized Production · Direct Specification
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#18181B] mt-1">
                  Current Production Archive
                </h2>
              </div>

              {/* Search & Sort Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search SKU, title, material..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E6E4E0] focus:outline-none focus:border-[#18181B]"
                  />
                </div>

                <select
                  value={sortOption}
                  onChange={(e) => {
                    setSortOption(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Sort products"
                  className="px-3.5 py-2 text-xs bg-white border border-[#E6E4E0] text-[#18181B] focus:outline-none focus:border-[#18181B]"
                >
                  <option value="featured">Sort · Featured Archive</option>
                  <option value="price_asc">Price · Low to High</option>
                  <option value="price_desc">Price · High to Low</option>
                  <option value="rating">Client Rating · Highest</option>
                </select>

                <button
                  onClick={() => setActiveView('wishlist')}
                  className="px-3.5 py-2 text-xs font-medium bg-white border border-[#E6E4E0] hover:border-[#18181B] text-[#18181B] flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span>Wishlist ({wishlist.length})</span>
                </button>
              </div>
            </div>

            {/* Interactive Segmented Category Tabs (Functional Buttons) */}
            <div className="flex items-center gap-1.5 p-1 bg-[#EFEDE8] rounded-lg overflow-x-auto w-fit max-w-full">
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  selectedCategory === 'all'
                    ? 'bg-white text-[#18181B] shadow-xs'
                    : 'text-[#52525B] hover:text-[#18181B]'
                }`}
              >
                All Objects
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'bg-white text-[#18181B] shadow-xs'
                      : 'text-[#52525B] hover:text-[#18181B]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* 3-Column Product Grid */}
            {loadingCatalog ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div
                    key={n}
                    className="bg-white border border-[#E6E4E0] h-[440px] animate-pulse p-5 flex flex-col justify-between"
                  >
                    <div className="bg-[#EFEDE8] h-[280px] w-full" />
                    <div className="space-y-2">
                      <div className="h-3 bg-[#EFEDE8] w-1/2" />
                      <div className="h-5 bg-[#EFEDE8] w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white border border-[#E6E4E0] p-12 text-center space-y-3">
                <div className="font-serif text-2xl text-[#18181B]">
                  No architectural pieces match your current filter.
                </div>
                <p className="text-xs text-[#52525B]">
                  Try clearing your search query or switching to All Objects.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="px-4 py-2 text-xs font-medium bg-[#18181B] text-white"
                >
                  Reset Archive Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {products.map((product) => (
                  <article
                    key={product.id}
                    className="group bg-white border border-[#E6E4E0] flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
                  >
                    {/* Product Image takes ~70% height on neutral backdrop */}
                    <div>
                      <div
                        onClick={() => openProductDetail(product.id)}
                        className="aspect-[4/3] w-full bg-[#F4F3EF] overflow-hidden cursor-pointer relative"
                      >
                        <ProductImage
                          src={product.image_url}
                          alt={product.name}
                          sku={product.sku}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                        />
                      </div>

                      <div className="p-6 space-y-2.5">
                        {/* Zero-Pill Metadata Discipline: Unboxed text with middot separators */}
                        <div className="flex items-center justify-between text-xs text-[#52525B]">
                          <div className="flex items-center gap-1.5 truncate">
                            <span>{product.category_name || product.brand}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{product.sku}</span>
                          </div>
                          <span className="font-mono text-[11px] shrink-0">
                            {product.stock_quantity > 0
                              ? `${product.stock_quantity} in stock`
                              : 'Out of stock'}
                          </span>
                        </div>

                        <h3
                          onClick={() => openProductDetail(product.id)}
                          className="text-base font-semibold text-[#18181B] cursor-pointer hover:underline leading-snug"
                        >
                          {product.name}
                        </h3>

                        <p className="text-xs text-[#52525B] line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      </div>
                    </div>

                    {/* Price & Actions Baseline */}
                    <div className="px-6 pb-6 pt-3 border-t border-[#F4F3EF] flex items-center justify-between gap-4">
                      <div className="font-mono tabular-nums">
                        <span className="text-[15px] font-semibold text-[#18181B]">
                          ${product.final_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        {product.discount_percent > 0 && (
                          <span className="text-xs text-[#71717A] line-through ml-2">
                            ${product.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleWishlist(product.id)}
                          aria-label={`Save ${product.name} to wishlist`}
                          className={`p-2 border transition-colors ${
                            isWishlisted(product.id)
                              ? 'border-[#18181B] bg-[#18181B] text-white'
                              : 'border-[#E6E4E0] text-[#52525B] hover:border-[#18181B] hover:text-[#18181B]'
                          }`}
                        >
                          <Heart className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleAddToCart(product, 1)}
                          disabled={product.stock_quantity <= 0}
                          className="px-4 py-2 text-xs font-medium bg-[#18181B] text-white hover:bg-[#27272A] disabled:bg-[#D4D1C9] transition-colors whitespace-nowrap"
                        >
                          {product.stock_quantity > 0 ? 'Add to Bag' : 'Allocated'}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-6">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-4 py-2 text-xs font-medium bg-white border border-[#E6E4E0] disabled:opacity-40"
                >
                  Previous Page
                </button>
                <span className="text-xs font-mono tabular-nums text-[#52525B]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-4 py-2 text-xs font-medium bg-white border border-[#E6E4E0] disabled:opacity-40"
                >
                  Next Page
                </button>
              </div>
            )}
          </section>

          {/* SECTION 3: Craftsmanship & Quantitative Proof Adjacency */}
          <section
            id="craftsmanship-section"
            className="max-w-[1360px] mx-auto px-6 lg:px-12 py-16 border-t border-[#E6E4E0]"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-5 space-y-4">
                <div className="text-xs text-[#52525B]">
                  01. Material Integrity & Metrology
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#18181B]">
                  Engineered for Zero Acoustic & Optical Compromise.
                </h2>
                <p className="text-sm text-[#52525B] leading-relaxed">
                  Every Kronos Atelier object is serialized, stress-tested for 48 hours in our
                  Munich anechoic and photometric chambers, and shipped with an individual
                  calibration certificate.
                </p>
              </div>

              <div className="lg:col-span-7 space-y-8">
                {/* Quantitative Precision Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="bg-white border border-[#E6E4E0] p-6">
                    <div className="font-mono text-2xl font-semibold tabular-nums text-[#18181B]">
                      ±1.5 dB
                    </div>
                    <div className="text-xs font-semibold text-[#18181B] mt-2">
                      Free-Field Acoustic Tolerance
                    </div>
                    <p className="text-xs text-[#52525B] mt-1 leading-relaxed">
                      Measured across 34 Hz to 28 kHz on every paired Monolith Studio Monitor.
                    </p>
                  </div>

                  <div className="bg-white border border-[#E6E4E0] p-6">
                    <div className="font-mono text-2xl font-semibold tabular-nums text-[#18181B]">
                      CRI 98+
                    </div>
                    <div className="text-xs font-semibold text-[#18181B] mt-2">
                      Photometric Color Rendering
                    </div>
                    <p className="text-xs text-[#52525B] mt-1 leading-relaxed">
                      Full-spectrum museum-grade LED arrays diffused through honed Spanish alabaster.
                    </p>
                  </div>

                  <div className="bg-white border border-[#E6E4E0] p-6">
                    <div className="font-mono text-2xl font-semibold tabular-nums text-[#18181B]">
                      6061-T6
                    </div>
                    <div className="text-xs font-semibold text-[#18181B] mt-2">
                      Monolithic Billet Chassis
                    </div>
                    <p className="text-xs text-[#52525B] mt-1 leading-relaxed">
                      5-axis CNC machined enclosures eliminating structural cabinet resonance.
                    </p>
                  </div>
                </div>

                {/* Attributable Client Testimonial */}
                <blockquote className="bg-white border border-[#E6E4E0] p-6 space-y-3">
                  <p className="font-serif text-xl italic text-[#18181B] leading-relaxed">
                    “Replacing our legacy studio nearfields and drafting luminaires with Kronos
                    Atelier hardware reduced low-mid room resonance by 4.2 dB and eliminated eye
                    fatigue during 14-hour mastering sessions.”
                  </p>
                  <footer className="text-xs text-[#52525B]">
                    <strong className="text-[#18181B] font-medium">Elena Rostova</strong> ·
                    Principal Acoustic Architect, Studio Nord Berlin
                  </footer>
                </blockquote>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ====================================================================
          VIEW 2: CONTIGUOUS PURCHASE MODULE (Product Detail View / PDP)
         ==================================================================== */}
      {activeView === 'product_detail' && selectedProduct && (
        <main className="flex-1 max-w-[1360px] mx-auto px-6 lg:px-12 py-10 w-full space-y-16">
          <div>
            <button
              onClick={() => setActiveView('storefront')}
              className="text-xs font-medium text-[#52525B] hover:text-[#18181B] flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Production Archive
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Sticky Left Gallery */}
            <div className="lg:col-span-7 space-y-4">
              <div className="aspect-[4/3] w-full bg-[#F4F3EF] border border-[#E6E4E0] overflow-hidden">
                <ProductImage
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name}
                  sku={selectedProduct.sku}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Sticky Right Contiguous Purchase Module */}
            <div className="lg:col-span-5 bg-white border border-[#E6E4E0] p-8 space-y-6 lg:sticky lg:top-24">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-[#52525B]">
                  <span>{selectedProduct.brand}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{selectedProduct.sku}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">
                    {selectedProduct.stock_quantity > 0
                      ? `${selectedProduct.stock_quantity} Available`
                      : 'Out of Stock'}
                  </span>
                </div>

                <h1 className="font-serif text-3xl font-medium text-[#18181B]">
                  {selectedProduct.name}
                </h1>

                <div className="flex items-baseline gap-3 pt-1 font-mono tabular-nums">
                  <span className="text-2xl font-semibold text-[#18181B]">
                    ${selectedProduct.final_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  {selectedProduct.discount_percent > 0 && (
                    <>
                      <span className="text-sm text-[#71717A] line-through">
                        ${selectedProduct.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-[#16A34A]">
                        Save {selectedProduct.discount_percent}%
                      </span>
                    </>
                  )}
                </div>
              </div>

              <p className="text-sm text-[#52525B] leading-relaxed">
                {selectedProduct.description}
              </p>

              {/* Contiguous Primary Purchase CTAs */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => handleAddToCart(selectedProduct, 1)}
                  disabled={selectedProduct.stock_quantity <= 0}
                  className="flex-1 py-3.5 px-6 text-xs font-semibold bg-[#18181B] text-white hover:bg-[#27272A] disabled:bg-[#D4D1C9] transition-colors whitespace-nowrap"
                >
                  {selectedProduct.stock_quantity > 0
                    ? `Add to Bag — $${selectedProduct.final_price.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}`
                    : 'Currently Allocated'}
                </button>
                <button
                  onClick={() => handleToggleWishlist(selectedProduct.id)}
                  className="py-3.5 px-4 border border-[#E6E4E0] hover:border-[#18181B] text-xs font-medium flex items-center gap-1.5"
                >
                  <Heart className="w-4 h-4" />
                </button>
              </div>

              {/* Technical Specifications Table */}
              <div className="pt-6 border-t border-[#E6E4E0] space-y-3">
                <div className="text-xs font-semibold text-[#18181B]">
                  Technical & Metrology Specifications
                </div>
                <dl className="divide-y divide-[#E6E4E0] text-xs">
                  {Object.entries(selectedProduct.specifications || {}).map(([key, val]) => (
                    <div key={key} className="py-2.5 flex justify-between gap-4">
                      <dt className="text-[#52525B]">{key}</dt>
                      <dd className="font-mono text-[#18181B] text-right">{val}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>

          {/* Verified Client Reviews & Review Submission */}
          <section className="border-t border-[#E6E4E0] pt-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5 space-y-4">
              <h2 className="font-serif text-2xl font-medium text-[#18181B]">
                Verified Client Evaluations ({selectedProduct.reviews?.length || 0})
              </h2>
              <p className="text-xs text-[#52525B]">
                Average Rating ·{' '}
                <span className="font-mono font-semibold text-[#18181B]">
                  {selectedProduct.rating_avg} / 5.0
                </span>
              </p>

              <form
                onSubmit={handleReviewSubmit}
                className="bg-white border border-[#E6E4E0] p-6 space-y-4 text-xs"
              >
                <div className="font-semibold text-[#18181B]">Submit a Verified Review</div>
                <div>
                  <label className="block text-[#52525B] mb-1">Rating</label>
                  <select
                    value={reviewRating}
                    onChange={(e) => setReviewRating(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#F9F9F8] border border-[#E6E4E0] font-mono"
                  >
                    <option value={5}>5 / 5 · Reference Standard</option>
                    <option value={4}>4 / 5 · Above Specification</option>
                    <option value={3}>3 / 5 · Meets Specification</option>
                    <option value={2}>2 / 5 · Sub-Nominal</option>
                    <option value={1}>1 / 5 · Defective</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#52525B] mb-1">Summary Headline</label>
                  <input
                    type="text"
                    required
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder="e.g., Exceptional build precision"
                    className="w-full px-3 py-2 bg-[#F9F9F8] border border-[#E6E4E0]"
                  />
                </div>
                <div>
                  <label className="block text-[#52525B] mb-1">Evaluation Notes</label>
                  <textarea
                    rows={3}
                    required
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Detail acoustic, optical, or mechanical performance..."
                    className="w-full px-3 py-2 bg-[#F9F9F8] border border-[#E6E4E0]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#18181B] text-white font-medium hover:bg-[#27272A]"
                >
                  Publish Evaluation
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-4">
              {selectedProduct.reviews && selectedProduct.reviews.length > 0 ? (
                selectedProduct.reviews.map((rev) => (
                  <article
                    key={rev.id}
                    className="bg-white border border-[#E6E4E0] p-6 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs text-[#52525B]">
                      <span className="font-medium text-[#18181B]">{rev.user_name}</span>
                      <span className="font-mono">
                        Rating {rev.rating}/5 · {rev.created_at.slice(0, 10)}
                      </span>
                    </div>
                    {rev.title && (
                      <h3 className="text-sm font-semibold text-[#18181B]">{rev.title}</h3>
                    )}
                    <p className="text-xs text-[#52525B] leading-relaxed">{rev.comment}</p>
                  </article>
                ))
              ) : (
                <div className="bg-white border border-[#E6E4E0] p-8 text-xs text-[#52525B]">
                  No client evaluations published for this SKU yet.
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {/* ====================================================================
          VIEW 3: CHECKOUT & ORDER VERIFICATION
         ==================================================================== */}
      {activeView === 'checkout' && (
        <main className="flex-1 max-w-[1160px] mx-auto px-6 lg:px-12 py-12 w-full">
          {confirmedOrder ? (
            <div className="bg-white border border-[#E6E4E0] p-8 lg:p-12 max-w-2xl mx-auto space-y-6">
              <div className="flex items-center gap-2 text-xs font-mono text-[#16A34A]">
                <Check className="w-4 h-4" />
                <span>ORDER ACQUISITION CONFIRMED</span>
              </div>
              <h1 className="font-serif text-3xl font-medium text-[#18181B]">
                Order #{confirmedOrder.orderNumber} Confirmed — Preparing Shipment
              </h1>
              <p className="text-xs text-[#52525B] leading-relaxed">
                Your acquisition has been logged with our Munich fulfillment desk. Inventory has
                been allocated and a confirmation dispatch has been recorded.
              </p>

              <div className="bg-[#F9F9F8] border border-[#E6E4E0] p-5 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[#52525B]">Order Reference:</span>
                  <span className="font-semibold text-[#18181B]">
                    {confirmedOrder.orderNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#52525B]">Order Status:</span>
                  <span className="text-[#16A34A]">{confirmedOrder.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#52525B]">Payment Method:</span>
                  <span>
                    {confirmedOrder.paymentMethod} ({confirmedOrder.paymentReference})
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#E6E4E0]">
                  <span className="text-[#52525B]">Total Settled (USD):</span>
                  <span className="font-semibold text-[#18181B]">
                    ${confirmedOrder.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <button
                  onClick={() => {
                    setConfirmedOrder(null);
                    setActiveView('orders');
                  }}
                  className="px-5 py-2.5 text-xs font-medium bg-[#18181B] text-white"
                >
                  Inspect Order History
                </button>
                <button
                  onClick={() => {
                    setConfirmedOrder(null);
                    setActiveView('storefront');
                  }}
                  className="px-5 py-2.5 text-xs font-medium border border-[#E6E4E0] text-[#18181B]"
                >
                  Return to Collection
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <form
                onSubmit={handlePlaceOrder}
                className="lg:col-span-7 bg-white border border-[#E6E4E0] p-8 space-y-6"
              >
                <div className="border-b border-[#E6E4E0] pb-4">
                  <h1 className="font-serif text-2xl font-medium text-[#18181B]">
                    Shipping & Payment Verification
                  </h1>
                  <p className="text-xs text-[#52525B] mt-1">
                    Complimentary white-glove courier shipping on orders over $1,000.00
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-medium text-[#52525B] mb-1">
                      Recipient Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={checkoutForm.recipientName}
                      onChange={(e) =>
                        setCheckoutForm({ ...checkoutForm, recipientName: e.target.value })
                      }
                      className="w-full px-3 py-2.5 bg-[#F9F9F8] border border-[#E6E4E0]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-[#52525B] mb-1">
                      Direct Contact Phone
                    </label>
                    <input
                      type="text"
                      required
                      value={checkoutForm.recipientPhone}
                      onChange={(e) =>
                        setCheckoutForm({ ...checkoutForm, recipientPhone: e.target.value })
                      }
                      className="w-full px-3 py-2.5 bg-[#F9F9F8] border border-[#E6E4E0] font-mono"
                    />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="block font-medium text-[#52525B] mb-1">
                    Street Delivery Address
                  </label>
                  <input
                    type="text"
                    required
                    value={checkoutForm.shippingAddress}
                    onChange={(e) =>
                      setCheckoutForm({ ...checkoutForm, shippingAddress: e.target.value })
                    }
                    className="w-full px-3 py-2.5 bg-[#F9F9F8] border border-[#E6E4E0]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-medium text-[#52525B] mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={checkoutForm.shippingCity}
                      onChange={(e) =>
                        setCheckoutForm({ ...checkoutForm, shippingCity: e.target.value })
                      }
                      className="w-full px-3 py-2.5 bg-[#F9F9F8] border border-[#E6E4E0]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-[#52525B] mb-1">Postal Code</label>
                    <input
                      type="text"
                      required
                      value={checkoutForm.shippingPostalCode}
                      onChange={(e) =>
                        setCheckoutForm({ ...checkoutForm, shippingPostalCode: e.target.value })
                      }
                      className="w-full px-3 py-2.5 bg-[#F9F9F8] border border-[#E6E4E0] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-[#52525B] mb-1">Country</label>
                    <input
                      type="text"
                      required
                      value={checkoutForm.shippingCountry}
                      onChange={(e) =>
                        setCheckoutForm({ ...checkoutForm, shippingCountry: e.target.value })
                      }
                      className="w-full px-3 py-2.5 bg-[#F9F9F8] border border-[#E6E4E0]"
                    />
                  </div>
                </div>

                {/* Payment Method Structure */}
                <div className="space-y-3 pt-2 border-t border-[#E6E4E0] text-xs">
                  <label className="block font-semibold text-[#18181B]">
                    Settlement Method
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(
                      [
                        { id: 'CARD', label: 'Encrypted Card Settlement' },
                        { id: 'WIRE_TRANSFER', label: 'Commercial IBAN Wire' },
                        { id: 'COD', label: 'Cash on Delivery (COD)' },
                      ] as const
                    ).map((pm) => (
                      <button
                        type="button"
                        key={pm.id}
                        onClick={() =>
                          setCheckoutForm({ ...checkoutForm, paymentMethod: pm.id })
                        }
                        className={`p-3 text-left border transition-colors ${
                          checkoutForm.paymentMethod === pm.id
                            ? 'border-[#18181B] bg-[#18181B] text-white'
                            : 'border-[#E6E4E0] bg-[#F9F9F8] text-[#18181B]'
                        }`}
                      >
                        <div className="font-mono text-[11px]">{pm.id}</div>
                        <div className="font-medium mt-0.5">{pm.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={cart.items.length === 0}
                    className="w-full py-3.5 text-xs font-semibold bg-[#18181B] text-white hover:bg-[#27272A] disabled:bg-[#D4D1C9]"
                  >
                    Authorize & Complete Acquisition · $
                    {cart.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </button>
                </div>
              </form>

              {/* Right Column Order Summary */}
              <div className="lg:col-span-5 bg-white border border-[#E6E4E0] p-8 space-y-6 h-fit">
                <h2 className="font-serif text-xl font-medium text-[#18181B]">
                  Acquisition Summary ({cart.itemCount} Items)
                </h2>

                <div className="divide-y divide-[#E6E4E0] space-y-3">
                  {cart.items.map((item) => (
                    <div key={item.cart_item_id} className="pt-3 flex justify-between gap-4 text-xs">
                      <div>
                        <div className="font-medium text-[#18181B]">{item.name}</div>
                        <div className="font-mono text-[11px] text-[#52525B]">
                          {item.quantity} × ${item.unit_discounted_price.toFixed(2)} · {item.sku}
                        </div>
                      </div>
                      <div className="font-mono tabular-nums font-medium text-[#18181B]">
                        ${item.line_total.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                <dl className="border-t border-[#E6E4E0] pt-4 space-y-2 text-xs font-mono tabular-nums">
                  <div className="flex justify-between text-[#52525B]">
                    <dt>Subtotal</dt>
                    <dd>${cart.subtotal.toFixed(2)}</dd>
                  </div>
                  {cart.discountTotal > 0 && (
                    <div className="flex justify-between text-[#16A34A]">
                      <dt>Total Discounts {cart.promoCode ? `(${cart.promoCode})` : ''}</dt>
                      <dd>-${cart.discountTotal.toFixed(2)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between text-[#52525B]">
                    <dt>Insured Courier Shipping</dt>
                    <dd>{cart.shippingCost === 0 ? 'COMPLIMENTARY' : `$${cart.shippingCost.toFixed(2)}`}</dd>
                  </div>
                  <div className="flex justify-between text-[#52525B]">
                    <dt>Estimated Tax (8%)</dt>
                    <dd>${cart.taxTotal.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-[#18181B] pt-2 border-t border-[#E6E4E0]">
                    <dt>Total Due (USD)</dt>
                    <dd>${cart.totalAmount.toFixed(2)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ====================================================================
          VIEW 4: CUSTOMER ORDER HISTORY
         ==================================================================== */}
      {activeView === 'orders' && (
        <main className="flex-1 max-w-[1160px] mx-auto px-6 lg:px-12 py-12 w-full space-y-8">
          <div className="flex items-center justify-between border-b border-[#E6E4E0] pb-4">
            <div>
              <h1 className="font-serif text-3xl font-medium text-[#18181B]">
                Order & Fulfillment History
              </h1>
              <p className="text-xs text-[#52525B] mt-1">
                Track serialized shipments, invoices, and courier dispatches
              </p>
            </div>
            <button
              onClick={() => setActiveView('storefront')}
              className="text-xs font-medium text-[#52525B] hover:text-[#18181B]"
            >
              Return to Storefront
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white border border-[#E6E4E0] p-12 text-center space-y-3">
              <div className="font-serif text-2xl text-[#18181B]">No orders recorded yet.</div>
              <button
                onClick={() => setActiveView('storefront')}
                className="px-5 py-2.5 text-xs font-medium bg-[#18181B] text-white"
              >
                Explore Collection
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((ord) => (
                <div key={ord.id} className="bg-white border border-[#E6E4E0] p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6E4E0] pb-4 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-mono font-semibold text-[#18181B]">
                        Order #{ord.order_number}
                      </div>
                      <div className="text-[#52525B]">
                        Placed {ord.created_at} · {ord.shipping_address}, {ord.shipping_city}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 font-mono">
                      <div>
                        <span className="text-[#52525B]">Payment: </span>
                        <span className="text-[#18181B]">{ord.payment_status}</span>
                      </div>
                      <div>
                        <span className="text-[#52525B]">Status: </span>
                        <span className="font-semibold text-[#16A34A]">{ord.status}</span>
                      </div>
                      <div className="text-sm font-semibold tabular-nums text-[#18181B]">
                        ${Number(ord.total_amount).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {ord.items?.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 text-xs">
                        <div className="w-14 h-14 bg-[#F4F3EF] shrink-0 overflow-hidden">
                          <ProductImage src={item.product_image} alt={item.product_name} />
                        </div>
                        <div>
                          <div className="font-medium text-[#18181B]">{item.product_name}</div>
                          <div className="font-mono text-[#52525B] mt-0.5">
                            SKU {item.product_sku} · Qty {item.quantity} · $
                            {Number(item.line_total).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ====================================================================
          VIEW 5: WISHLIST ARCHIVE
         ==================================================================== */}
      {activeView === 'wishlist' && (
        <main className="flex-1 max-w-[1160px] mx-auto px-6 lg:px-12 py-12 w-full space-y-8">
          <div className="flex items-center justify-between border-b border-[#E6E4E0] pb-4">
            <div>
              <h1 className="font-serif text-3xl font-medium text-[#18181B]">
                Saved Specification Wishlist ({wishlist.length})
              </h1>
              <p className="text-xs text-[#52525B] mt-1">
                Curated architectural luminaires and reference audio instruments
              </p>
            </div>
            <button
              onClick={() => setActiveView('storefront')}
              className="text-xs font-medium text-[#52525B] hover:text-[#18181B]"
            >
              Return to Storefront
            </button>
          </div>

          {wishlist.length === 0 ? (
            <div className="bg-white border border-[#E6E4E0] p-12 text-center space-y-3">
              <div className="font-serif text-2xl text-[#18181B]">Your wishlist is empty.</div>
              <button
                onClick={() => setActiveView('storefront')}
                className="px-5 py-2.5 text-xs font-medium bg-[#18181B] text-white"
              >
                Browse Archive
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {wishlist.map((product) => (
                <div
                  key={product.id}
                  className="bg-white border border-[#E6E4E0] p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="aspect-[4/3] bg-[#F4F3EF] overflow-hidden">
                      <ProductImage src={product.image_url} alt={product.name} />
                    </div>
                    <div className="font-mono text-xs text-[#52525B]">{product.sku}</div>
                    <h3 className="text-sm font-semibold text-[#18181B]">{product.name}</h3>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-[#E6E4E0]">
                    <span className="font-mono font-semibold text-sm">
                      ${product.final_price.toFixed(2)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleWishlist(product.id)}
                        className="px-3 py-1.5 text-xs border border-[#E6E4E0] text-[#52525B]"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => handleAddToCart(product, 1)}
                        className="px-3 py-1.5 text-xs bg-[#18181B] text-white"
                      >
                        Add to Bag
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ====================================================================
          VIEW 6: OPENAPI / SWAGGER SPECIFICATION VIEWER
         ==================================================================== */}
      {activeView === 'api_docs' && (
        <main className="flex-1 max-w-[1160px] mx-auto px-6 lg:px-12 py-12 w-full space-y-6">
          <div className="flex items-center justify-between border-b border-[#E6E4E0] pb-4">
            <div>
              <h1 className="font-serif text-3xl font-medium text-[#18181B]">
                OpenAPI 3.0.3 REST Specification (/api/v1/openapi.json)
              </h1>
              <p className="text-xs text-[#52525B] mt-1">
                Strict API separation between React frontend, Express/TypeScript backend, and SQLite relational database
              </p>
            </div>
            <button
              onClick={() => setActiveView('storefront')}
              className="px-4 py-2 text-xs font-medium bg-[#18181B] text-white"
            >
              Back to Storefront
            </button>
          </div>
          <pre className="bg-white border border-[#E6E4E0] p-6 text-xs font-mono overflow-x-auto leading-relaxed">
            {JSON.stringify(openApiSpec, null, 2)}
          </pre>
        </main>
      )}

      {/* ====================================================================
          SLIDE-OVER SHOPPING BAG DRAWER
         ==================================================================== */}
      {isBagOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col justify-between p-6 border-l border-[#E6E4E0] overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#E6E4E0] pb-4">
                <h2 className="font-serif text-2xl font-medium text-[#18181B]">
                  Shopping Bag ({cart.itemCount})
                </h2>
                <button
                  onClick={() => setIsBagOpen(false)}
                  className="text-xs text-[#52525B] hover:text-[#18181B]"
                >
                  Close
                </button>
              </div>

              {cart.items.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <p className="text-xs text-[#52525B]">Your acquisition bag is currently empty.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E6E4E0] space-y-4">
                  {cart.items.map((item) => (
                    <div key={item.cart_item_id} className="pt-4 flex gap-4 text-xs">
                      <div className="w-16 h-16 bg-[#F4F3EF] shrink-0 overflow-hidden">
                        <ProductImage src={item.image_url} alt={item.name} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="font-medium text-[#18181B]">{item.name}</div>
                        <div className="font-mono text-[11px] text-[#52525B]">{item.sku}</div>
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center border border-[#E6E4E0]">
                            <button
                              onClick={() =>
                                handleUpdateCartQuantity(item.product_id, item.quantity - 1)
                              }
                              className="p-1.5 hover:bg-[#F4F3EF]"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-3 font-mono tabular-nums">{item.quantity}</span>
                            <button
                              onClick={() =>
                                handleUpdateCartQuantity(item.product_id, item.quantity + 1)
                              }
                              className="p-1.5 hover:bg-[#F4F3EF]"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="font-mono tabular-nums font-semibold">
                            ${item.line_total.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.items.length > 0 && (
              <div className="pt-6 border-t border-[#E6E4E0] space-y-4">
                <form onSubmit={handleApplyPromo} className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder="Promo code (e.g. ATELIER10)"
                    className="flex-1 px-3 py-2 text-xs font-mono bg-[#F9F9F8] border border-[#E6E4E0]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium bg-[#F4F3EF] hover:bg-[#E6E4E0] text-[#18181B]"
                  >
                    Apply
                  </button>
                </form>

                <dl className="space-y-1.5 text-xs font-mono tabular-nums">
                  <div className="flex justify-between text-[#52525B]">
                    <dt>Subtotal</dt>
                    <dd>${cart.subtotal.toFixed(2)}</dd>
                  </div>
                  {cart.discountTotal > 0 && (
                    <div className="flex justify-between text-[#16A34A]">
                      <dt>Discount</dt>
                      <dd>-${cart.discountTotal.toFixed(2)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between text-[#52525B]">
                    <dt>Shipping</dt>
                    <dd>{cart.shippingCost === 0 ? 'FREE' : `$${cart.shippingCost.toFixed(2)}`}</dd>
                  </div>
                  <div className="flex justify-between text-[#52525B]">
                    <dt>Tax (8%)</dt>
                    <dd>${cart.taxTotal.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-[#18181B] pt-2 border-t border-[#E6E4E0]">
                    <dt>Total</dt>
                    <dd>${cart.totalAmount.toFixed(2)}</dd>
                  </div>
                </dl>

                <button
                  onClick={() => {
                    setIsBagOpen(false);
                    setConfirmedOrder(null);
                    setActiveView('checkout');
                  }}
                  className="w-full py-3.5 text-xs font-semibold bg-[#18181B] text-white hover:bg-[#27272A]"
                >
                  Proceed to Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          AUTHENTICATION & RBAC DEMO SWITCHER MODAL
         ==================================================================== */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6E4E0] w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E6E4E0] pb-3">
              <h2 className="font-serif text-2xl font-medium text-[#18181B]">
                {currentUser ? 'Account & Role Governance' : 'Kronos Atelier Identity'}
              </h2>
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="text-xs text-[#52525B] hover:text-[#18181B]"
              >
                Close
              </button>
            </div>

            {currentUser && (
              <div className="p-4 bg-[#F9F9F8] border border-[#E6E4E0] text-xs space-y-2">
                <div className="font-semibold text-[#18181B]">{currentUser.fullName}</div>
                <div className="font-mono text-[#52525B]">{currentUser.email}</div>
                <div className="font-mono text-[#16A34A]">Active Role · {currentUser.role}</div>
                <div className="flex gap-2 pt-2">
                  {(currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') && (
                    <button
                      onClick={() => {
                        setIsAuthModalOpen(false);
                        setActiveView('admin');
                      }}
                      className="px-3 py-1.5 bg-[#18181B] text-white font-medium"
                    >
                      Open Admin Console
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 border border-[#E6E4E0] text-[#991B1B] font-medium"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}

            {/* Quick RBAC Verification Switcher */}
            <div className="space-y-2 text-xs">
              <div className="font-medium text-[#52525B]">
                Instant RBAC Role Verification (Seeded Production Accounts):
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleQuickRoleSignIn(
                      'elena.rostova@kronos-client.com',
                      'CustomerPass!2026',
                      false
                    )
                  }
                  className="p-2.5 text-left border border-[#E6E4E0] hover:border-[#18181B] bg-[#F9F9F8] flex items-center justify-between"
                >
                  <span>Customer · Elena Rostova</span>
                  <span className="font-mono text-[11px] text-[#52525B]">CUSTOMER</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleQuickRoleSignIn(
                      'marcus.vance@kronos-atelier.com',
                      'AdminPass!2026',
                      true
                    )
                  }
                  className="p-2.5 text-left border border-[#E6E4E0] hover:border-[#18181B] bg-[#F9F9F8] flex items-center justify-between"
                >
                  <span>Operations Admin · Marcus Vance</span>
                  <span className="font-mono text-[11px] text-[#16A34A]">ADMIN → Console</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleQuickRoleSignIn(
                      'director@kronos-atelier.com',
                      'SuperAdmin!2026',
                      true
                    )
                  }
                  className="p-2.5 text-left border border-[#E6E4E0] hover:border-[#18181B] bg-[#F9F9F8] flex items-center justify-between"
                >
                  <span>Executive Director · Julian Mercer</span>
                  <span className="font-mono text-[11px] text-[#16A34A]">
                    SUPER_ADMIN → Console
                  </span>
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3 text-xs pt-2 border-t border-[#E6E4E0]">
              <div className="flex gap-4 pb-1">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`font-semibold ${
                    authMode === 'login' ? 'text-[#18181B] underline' : 'text-[#71717A]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className={`font-semibold ${
                    authMode === 'register' ? 'text-[#18181B] underline' : 'text-[#71717A]'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {authMode === 'register' && (
                <div>
                  <label className="block text-[#52525B] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={authFullName}
                    onChange={(e) => setAuthFullName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F9F9F8] border border-[#E6E4E0]"
                  />
                </div>
              )}

              <div>
                <label className="block text-[#52525B] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F9F9F8] border border-[#E6E4E0] font-mono"
                />
              </div>

              <div>
                <label className="block text-[#52525B] mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F9F9F8] border border-[#E6E4E0] font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#18181B] text-white font-medium hover:bg-[#27272A]"
              >
                {authMode === 'login' ? 'Authenticate with JWT' : 'Register Customer Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          QUIET EDITORIAL FOOTER (No Ornamental Telemetry Tickers)
         ==================================================================== */}
      <footer className="border-t border-[#E6E4E0] bg-white px-6 lg:px-12 py-10 mt-16">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-xs text-[#52525B]">
          <div className="space-y-1">
            <div className="font-serif text-lg font-semibold text-[#18181B]">
              Kronos Atelier GmbH
            </div>
            <div>
              Maximilianstraße 44, 80539 München · Architectural Lighting & Acoustic Systems
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <button
              onClick={() => setActiveView('storefront')}
              className="hover:text-[#18181B] transition-colors"
            >
              Collection
            </button>
            <button
              onClick={() => setActiveView('wishlist')}
              className="hover:text-[#18181B] transition-colors"
            >
              Wishlist
            </button>
            <button
              onClick={openApiExplorer}
              className="hover:text-[#18181B] transition-colors font-mono"
            >
              OpenAPI v1 Spec
            </button>
            <span>© {new Date().getFullYear()} Kronos Atelier. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
