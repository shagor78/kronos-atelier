# REST API v1 Reference (`/api/v1`)

Interactive OpenAPI 3.0.3 JSON specification is served live at `GET /api/v1/openapi.json`.

## Core Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Public | System, database, memory, CPU, and TLS health report |
| `GET` | `/api/v1/openapi.json` | Public | OpenAPI 3.0.3 specification |
| `POST` | `/api/v1/auth/register` | Public | Register a new `CUSTOMER` account |
| `POST` | `/api/v1/auth/login` | Public | Authenticate user and receive access + refresh JWTs |
| `POST` | `/api/v1/auth/refresh` | Public | Exchange valid refresh token for new access token |
| `POST` | `/api/v1/auth/logout` | Bearer | Revoke active user refresh sessions |
| `GET` | `/api/v1/auth/me` | Bearer | Retrieve current authenticated user profile |
| `PUT` | `/api/v1/users/profile` | Bearer | Update user contact and shipping address |
| `GET` | `/api/v1/categories` | Public | List product categories with SKU counts |
| `POST` | `/api/v1/categories` | Admin | Create a new category |
| `GET` | `/api/v1/products` | Public | Search, filter, sort, and paginate products |
| `GET` | `/api/v1/products/:id` | Public | Retrieve product details and approved reviews |
| `POST` | `/api/v1/products` | Admin | Create new product SKU |
| `PUT` | `/api/v1/products/:id` | Admin | Update product SKU |
| `DELETE` | `/api/v1/products/:id` | Admin | Delete or archive product SKU |
| `GET` | `/api/v1/cart` | Bearer | Get calculated cart state (subtotal, discount, tax, total) |
| `POST` | `/api/v1/cart` | Bearer | Add product to cart with live stock check |
| `PUT` | `/api/v1/cart/:productId` | Bearer | Update cart item quantity |
| `POST` | `/api/v1/cart/promo` | Bearer | Apply promo code (`ATELIER10`, `STUDIO15`, `KRONOS20`) |
| `GET` | `/api/v1/wishlist` | Bearer | List saved wishlist items |
| `POST` | `/api/v1/wishlist` | Bearer | Toggle product in wishlist |
| `POST` | `/api/v1/orders` | Bearer | Atomic checkout with stock deduction & notification |
| `GET` | `/api/v1/orders` | Bearer | List customer order history |
| `POST` | `/api/v1/reviews` | Bearer | Submit verified product review |
| `GET` | `/api/v1/admin/overview` | Admin | Executive KPIs, low stock alerts, audit logs, notifications |
| `GET` | `/api/v1/admin/orders` | Admin | List all orders across all customers |
| `PATCH` | `/api/v1/admin/orders/:id/status` | Admin | Update order status (restores stock on `CANCELLED`) |
| `GET` | `/api/v1/admin/users` | Admin | List all users |
| `PATCH` | `/api/v1/admin/users/:id/role` | Admin | Update user RBAC role (`CUSTOMER`, `ADMIN`, `SUPER_ADMIN`) |
| `PATCH` | `/api/v1/admin/inventory/:id` | Admin | Update product stock allocation |
