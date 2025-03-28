\*\*\*\*# E-commerce Backend API

This is the backend API for an e-commerce platform, supporting both user-facing and admin panel functionalities. It includes features for managing products, orders, categories, analytics, and more.

---

## Features

### **User Panel API**

- **User Profile**:
  - View and update user profile.
  - View user orders and wishlist.
  - Add or remove items from the wishlist.
- **Products**:
  - Browse all products with filters (e.g., category, price).
  - View details of a specific product.
- **Cart**:
  - Add, update, or remove items in the cart.
  - View items in the cart.
- **Orders**:
  - Place an order.
  - View details of specific orders.

---

### **Admin Panel API**

- **Authentication**:
  - Admin login and logout.
- **Dashboard**:
  - View statistics such as total sales, orders, and users.
- **User Management**:
  - View, update, or delete users.
- **Product Management**:
  - Add, update, or delete products.
  - Assign categories and sub-categories to products.
  - Add attributes to products (e.g., color, size).
- **Order Management**:
  - View, update, or cancel orders.
  - Update delivery timelines.
  - Change order status (e.g., pending, confirmed, shipped, delivered).
  - Confirm or reject orders.
- **Category Management**:
  - Add, update, or delete categories and sub-categories.

---

### **Additional Features**

#### **Sales Analytics**

- Generate detailed sales analytics, including:
  - List of most performing products.
  - Sales reports (e.g., total revenue, sales trends).
  - Order reports (e.g., total orders, canceled orders, completed orders).
  - Recent orders for quick access.
  - Best-selling products.
  - Category performance stats (e.g., sales per category).

#### **Product Attributes**

- Products can have attributes such as:
  - **Color** (e.g., red, blue, green, etc.).
  - Each attribute can have:
    - **Default images** (specific to the attribute).
    - Option to **override the default image** with a custom image for a specific product.
    - **Separate price** for the attribute (e.g., a red variant may cost more than a blue variant).
    - **Separate product count** (inventory) for each attribute.

#### **Attribute Management**

- Attributes can be **saved in groups** for reuse. For example:
  - Create a preset group for the "Colors" attribute with predefined options like **Red, Blue, Green, Purple**, etc.
  - When adding attributes to a product, the saved presets can be quickly selected and applied.

---

### **Suggested Additional Features**

#### **User Notifications**

- Implement a notification system to inform users about:
  - Order status updates (e.g., shipped, delivered).
  - Promotions and discounts.
  - Wishlist item availability.

#### **Search and Recommendations**

- **Search**:
  - Add a search API with support for:
    - Full-text search.
    - Filters (e.g., price range, category).
    - Sorting (e.g., relevance, price).
- **Recommendations**:
  - Implement a recommendation engine to suggest products based on:
    - User browsing history.
    - Purchase history.
    - Wishlist items.

#### **Inventory Management**

- Add APIs for inventory tracking:
  - Low stock alerts.
  - Automatic stock updates after orders.

#### **Coupons and Discounts**

- Extend the coupon system to include:
  - Percentage-based discounts.
  - Buy-one-get-one (BOGO) offers.
  - Expiry dates for coupons.

#### **Advanced Role-Based Access Control (RBAC)**

- Extend the role-based access system to:
  - Allow custom roles with specific permissions.
  - Provide an admin interface to manage roles and permissions.

#### **Return and Refund Management**

- Add APIs to handle:
  - Return requests.
  - Refund processing.

#### **Customer Support Integration**

- Integrate a ticketing system for customer support.
- Provide APIs to manage support tickets.

---

## API Endpoints

### **User Panel**

- **User Profile**:
  - `GET /api/user/profile` - Get user profile details.
  - `PUT /api/user/profile` - Update user profile.
  - `GET /api/user/orders` - Get all orders for the logged-in user.
  - `GET /api/user/wishlist` - Get user's wishlist.
  - `POST /api/user/wishlist` - Add an item to the wishlist.
  - `DELETE /api/user/wishlist/:itemId` - Remove an item from the wishlist.
- **Products**:
  - `GET /api/products` - Get all products (with filters like category, price, etc.).
  - `GET /api/products/:productId` - Get details of a specific product.
- **Cart**:
  - `GET /api/cart` - Get items in the user's cart.
  - `POST /api/cart` - Add an item to the cart.
  - `PUT /api/cart/:itemId` - Update quantity of an item in the cart.
  - `DELETE /api/cart/:itemId` - Remove an item from the cart.
- **Orders**:
  - `POST /api/orders` - Place an order.
  - `GET /api/orders/:orderId` - Get details of a specific order.
- **Reviews**:
  - `POST /api/products/:productId/reviews` - Add a review for a product.
  - `GET /api/products/:productId/reviews` - Get reviews for a product.

### **Admin Panel**

- **Authentication**:
  - `POST /api/admin/login` - Admin login.
  - `POST /api/admin/logout` - Admin logout.
- **Dashboard**:
  - `GET /api/admin/dashboard` - Get dashboard statistics (e.g., total sales, orders, users).
- **User Management**:
  - `GET /api/admin/users` - Get all users.
  - `GET /api/admin/users/:userId` - Get details of a specific user.
  - `PUT /api/admin/users/:userId` - Update user details.
  - `DELETE /api/admin/users/:userId` - Delete a user.
- **Product Management**:
  - `GET /api/admin/products` - Get all products.
  - `POST /api/admin/products` - Add a new product.
  - `PUT /api/admin/products/:productId` - Update product details.
  - `DELETE /api/admin/products/:productId` - Delete a product.
  - `POST /api/admin/products/:productId/attributes` - Add attributes to a product.
  - `PUT /api/admin/products/:productId/attributes/:attributeId` - Update attributes of a product.
  - `DELETE /api/admin/products/:productId/attributes/:attributeId` - Remove attributes from a product.
- **Order Management**:
  - `GET /api/admin/orders` - Get all orders.
  - `GET /api/admin/orders/:orderId` - Get details of a specific order.
  - `PUT /api/admin/orders/:orderId` - Update order status (e.g., shipped, delivered).
  - `DELETE /api/admin/orders/:orderId` - Cancel an order.
  - `PUT /api/admin/orders/:orderId/timeline` - Update delivery timeline for an order.
  - `POST /api/admin/orders/:orderId/confirm` - Confirm an order.
  - `POST /api/admin/orders/:orderId/reject` - Reject an order.

### **Additional Features**

- **Sales Analytics**:

  - `GET /api/admin/analytics/sales` - Get sales analytics (e.g., revenue, trends).
  - `GET /api/admin/analytics/orders` - Get order analytics (e.g., total, canceled, completed).
  - `GET /api/admin/analytics/products` - Get product performance stats (e.g., best-selling products).
  - `GET /api/admin/analytics/categories` - Get category performance stats.

- **Product Attributes**:
  - `GET /api/admin/attributes` - Get all attribute groups.
  - `POST /api/admin/attributes` - Create a new attribute group.
  - `PUT /api/admin/attributes/:attributeId` - Update an attribute group.
  - `DELETE /api/admin/attributes/:attributeId` - Delete an attribute group.

---

Then create a middleware to allow access to something based on the roles that were dynamically added.
You can create a new model/system to check if there is a role based access required (if you want to do this, optionally create another schema)
This compares with the current role of the user to know if the user can perform such operation
