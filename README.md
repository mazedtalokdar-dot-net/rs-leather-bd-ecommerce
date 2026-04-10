<h2>Rs Leather Bd E-Commerce </h2>

<p>A modern full-stack e-commerce web application built for a leather footwear brand.  
This project includes a user shopping experience, admin panel, real-time cart updates, and order management system.</p>

---
### 🛠️ Admin Panel

<h6>User Side</h6>
- Browse products by category
- Dynamic category filtering (no reload)
- Add to cart with instant update
- Floating cart with live item count
- Checkout & order placement
- View order history (My Orders)
- Request order cancellation (Pending only)

---

<h6>Cart System</h6>
- Real-time cart updates (no page reload)
- Floating cart icon with count badge
- Center notification on add-to-cart
- Quantity update & total calculation

---

<h6>Order System</h6>
- Order placement with shipping details
- Order status tracking:
  - Pending
  - Processing
  - Delivered
  - Cancel Requested
  - Cancelled
- User cancel request system

---

<h6> Admin Panel</h6>
- Manage Products (Create / Edit / Delete)
- Manage Categories & Subcategories
- View all orders
- Update order status
- Cancel request notification system
- Create new admin users

---


<h6> Tech Stack </h6>

- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose)
- **Frontend:** Razor-like templating (raz), HTML, CSS, jQuery
- **Real-time UI:** AJAX + dynamic DOM updates

---

## 📁 Project Structure

- views/ # .raz files (UI templates)
- public/ # CSS, JS, assets
- DbModel.js # Database schemas
- app.js # Main server file
- connectToDb.js # MongoDB connection

- 
---

## 🔧 Installation & Setup

### 1. Clone the repository

git clone https://github.com/mazedtalokdar-dot-net/rs-leather-bd-ecommerce.git
cd rs-leather-bd-ecommerce


### 2. Install dependencies
install node.js on your device and run this commond on the cmd.
(npm install)

### 3. Setup MongoDB

Make sure MongoDB is running locally or provide your connection string in:
(connectToDb.js)

### 4. Run the project
run the command on your vs code terminal
(node app.js)

### Default Admin
Username: admin
Password: admin123
