// /models/DbModel.js
const mongoose = require("mongoose");

// ---------- Category ----------
const subCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true }, // optional (future use)
  },
  { _id: false },
);

const catSchema = new mongoose.Schema(
  {
    categoryname: { type: String, required: true, trim: true, unique: true },
    subcategories: { type: [subCategorySchema], default: [] },
  },
  { timestamps: true },
);

// ---------- Product ----------
const prodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "categories" },
    subcategory: { type: String, trim: true },
    price: { type: Number, required: true, default: 0 },
    stock: { type: Number, required: true, default: 0 },
    description: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true },
);

// ---------- User ----------
const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true }, // demo-purpose (plain text)
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true },
);

// ---------- Cart ----------
const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "products",
      required: true,
    },
    name: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    qty: { type: Number, required: true, default: 1 },
    imageUrl: { type: String, trim: true },
  },
  { _id: false },
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      unique: true,
    },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true },
);

// ---------- Order ----------
const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "products",
      required: true,
    },
    name: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    qty: { type: Number, required: true, default: 1 },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    items: { type: [orderItemSchema], default: [] },
    shipping: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
    },
    total: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "delivered",
        "cancelled",
        "cancel_requested",
      ],
      default: "pending",
    },
  },
  { timestamps: true },
);

module.exports = {
  categoryModel: mongoose.model("categories", catSchema),
  productModel: mongoose.model("products", prodSchema),
  userModel: mongoose.model("users", userSchema),
  cartModel: mongoose.model("carts", cartSchema),
  orderModel: mongoose.model("orders", orderSchema),
};
