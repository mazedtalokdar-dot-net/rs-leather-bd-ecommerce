const express = require("express");
const session = require("express-session");
const path = require("path");
const http = require("http");
const raz = require("raz");
const { Server } = require("socket.io");

const connectToDB = require("./connectToDb");
const db = require("./models/DbModel"); // <-- .js যোগ করো

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ---------------- View engine (Raz) ----------------
raz.register(app);
app.set("views", path.join(__dirname, "views"));

// ---------------- Middleware ----------------
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: "rsleatherbd_secret_2025",
    resave: false,
    saveUninitialized: true,
  }),
);

// socket.io instance কে req এ পাঠাচ্ছি
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ---------------- DB connect + default admin ----------------
async function ensureDefaultAdmin() {
  try {
    const count = await db.userModel.countDocuments({ role: "admin" });
    if (count === 0) {
      const a = await db.userModel.create({
        name: "Super Admin",
        email: "admin@rsleatherbd.com",
        username: "admin",
        password: "admin123", // demo purpose only
        role: "admin",
      });
      console.log(
        "Default admin created:",
        a.username,
        "/",
        a.password,
        "(demo only)",
      );
    }
  } catch (err) {
    console.error("Failed to ensure default admin:", err);
  }
}

connectToDB()
  .then(async () => {
    console.log("MongoDB connected.");
    await ensureDefaultAdmin();
  })
  .catch((e) => console.error("DB connect error:", e));

// ---------------- Helpers ----------------
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect("/login");
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === "admin") {
    return next();
  }
  return res.redirect("/admin-login");
}

function viewAuth(req) {
  return !!(req.session && req.session.user);
}

async function getCounts() {
  const [p, c, u, o] = await Promise.all([
    db.productModel.countDocuments({}),
    db.categoryModel.countDocuments({}),
    db.userModel.countDocuments({}),
    db.orderModel.countDocuments({}),
  ]);
  return { p, c, u, o };
}

function calcTotal(items) {
  return items.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 0), 0);
}

// ---------------- Socket.IO basic ----------------
io.on("connection", (socket) => {
  // console.log("client connected");
});

// =================================================
//                     ROUTES
// =================================================

// -------------- Home --------------
app.get("/", async (req, res) => {
  try {
    const [categories, products] = await Promise.all([
      db.categoryModel.find({}).lean(),
      db.productModel.find({ status: "active" }).sort({ createdAt: -1 }).lean(),
    ]);

    res.render("index", {
      title: "Home",
      authenticated: viewAuth(req),
      categories,
      products,
      q: "",
      msg: "",
    });
  } catch (err) {
    console.error(err);
    res.render("index", {
      title: "Home",
      authenticated: viewAuth(req),
      categories: [],
      products: [],
      q: "",
      msg: "Something went wrong loading products.",
    });
  }
});

// -------------- Search --------------
app.get("/search", async (req, res) => {
  const q = (req.query.q || "").trim();

  try {
    const [categories, products] = await Promise.all([
      db.categoryModel.find({}).lean(),
      db.productModel
        .find({ name: { $regex: q, $options: "i" }, status: "active" })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    res.render("index", {
      title: "Search",
      authenticated: viewAuth(req),
      categories,
      products,
      q,
      msg: "",
    });
  } catch (err) {
    console.error(err);
    res.render("index", {
      title: "Search",
      authenticated: viewAuth(req),
      categories: [],
      products: [],
      q,
      msg: "Search failed.",
    });
  }
});

// =================================================
//                AUTH (User + Admin)
// =================================================

// ----- User Login -----
app.get("/login", (req, res) => {
  res.render("login", {
    authenticated: viewAuth(req),
    msg: "",
  });
});

app.post("/login", handleUserLogin);
app.post("/Login", handleUserLogin); // পুরানো route থাকলে

async function handleUserLogin(req, res) {
  const { uname, pass } = req.body;
  try {
    const user = await db.userModel
      .findOne({ username: uname, password: pass })
      .lean();

    if (!user) {
      return res.render("login", {
        authenticated: false,
        msg: "Invalid username or password.",
      });
    }

    req.session.user = {
      _id: user._id,
      name: user.name,
      role: user.role || "user",
    };

    return res.redirect("/");
  } catch (err) {
    console.error(err);
    return res.render("login", {
      authenticated: false,
      msg: "Something went wrong.",
    });
  }
}

// ----- Admin Login -----
app.get("/admin-login", (req, res) => {
  res.render("admin-login", {
    authenticated: viewAuth(req),
    msg: "",
  });
});

app.post("/admin-login", async (req, res) => {
  const { uname, pass } = req.body;

  try {
    // আগে চেষ্টা: আসল admin আছে কি না
    let admin = await db.userModel
      .findOne({ username: uname, password: pass, role: "admin" })
      .lean();

    // যদি কোনো admin না থাকে, আর uname/pass ডিফল্ট হয়, তাহলে এখানেই create
    if (!admin) {
      const adminCount = await db.userModel.countDocuments({ role: "admin" });
      if (adminCount === 0 && uname === "admin" && pass === "admin123") {
        const created = await db.userModel.create({
          username: "admin",
          password: "admin123",
          role: "admin",
        });
        admin = {
          _id: created._id,
          name: created.name || "Super Admin",
          role: created.role,
        };
      }
    }

    if (!admin) {
      return res.render("admin-login", {
        authenticated: false,
        msg: "Invalid admin credentials.",
      });
    }

    req.session.user = {
      _id: admin._id,
      name: admin.name || "Admin",
      role: admin.role || "admin",
    };

    return res.redirect("/admin");
  } catch (err) {
    console.error(err);
    return res.render("admin-login", {
      authenticated: false,
      msg: "Something went wrong.",
    });
  }
});

// ----- Register -----
app.get("/register", (req, res) => {
  res.render("register", {
    authenticated: viewAuth(req),
    msg: "",
  });
});

app.post("/register", async (req, res) => {
  const { name, email, username, password, role } = req.body;

  try {
    const exists = await db.userModel.findOne({ username }).lean();
    if (exists) {
      return res.render("register", {
        authenticated: viewAuth(req),
        msg: "This username is already taken.",
      });
    }

    const user = await db.userModel.create({
      name,
      email,
      username,
      password, // demo only
      role: role === "admin" ? "admin" : "user",
    });

    req.session.user = {
      _id: user._id,
      name: user.name,
      role: user.role,
    };

    return res.redirect("/");
  } catch (err) {
    console.error(err);
    return res.render("register", {
      authenticated: viewAuth(req),
      msg: "Registration failed. Try again.",
    });
  }
});

// ----- Logout -----
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

//----Showing MY Orders To them who has  orders
app.get("/nav-state", async (req, res) => {
  try {
    if (!(req.session && req.session.user)) {
      return res.json({ authenticated: false, hasOrders: false });
    }

    const userId = req.session.user._id;
    const count = await db.orderModel.countDocuments({ userId: userId });

    return res.json({
      authenticated: true,
      hasOrders: count > 0,
    });
  } catch (err) {
    console.error(err);
    return res.json({ authenticated: false, hasOrders: false });
  }
});

// =================================================
//                    ADMIN
// =================================================

// ----- Admin Dashboard -----
app.get("/admin", requireAdmin, async (req, res) => {
  try {
    const counts = await getCounts();
    const cancelRequestCount = await db.orderModel.countDocuments({
      status: "cancel_requested",
    });

    res.render("admin", {
      authenticated: viewAuth(req),
      counts,
      cancelRequestCount,
      title: "Admin Dashboard",
    });
  } catch (err) {
    console.error(err);
    res.render("admin", {
      authenticated: viewAuth(req),
      counts: { p: 0, c: 0, u: 0, o: 0 },
      cancelRequestCount: 0,
      title: "Admin Dashboard",
    });
  }
});

// ----- Create Admin (from dashboard) -----
app.get("/admin/create-admin", requireAdmin, (req, res) => {
  res.render("create-admin", {
    authenticated: viewAuth(req),
    msg: "",
  });
});

app.post("/admin/create-admin", requireAdmin, async (req, res) => {
  const { name, email, password } = req.body;

  try {
    if (!name || !email || !password) {
      return res.render("create-admin", {
        authenticated: viewAuth(req),
        msg: "All fields are required.",
      });
    }

    const exists = await db.userModel
      .findOne({
        $or: [
          { email: email.toLowerCase() },
          { username: email.toLowerCase() },
        ],
      })
      .lean();

    if (exists) {
      return res.render("create-admin", {
        authenticated: viewAuth(req),
        msg: "An admin/user with this email already exists.",
      });
    }

    await db.userModel.create({
      name,
      email: email.toLowerCase(),
      username: email.toLowerCase(),
      password,
      role: "admin",
    });

    return res.render("create-admin", {
      authenticated: viewAuth(req),
      msg: "Admin created successfully. They can login using admin-login.",
    });
  } catch (err) {
    console.error(err);
    return res.render("create-admin", {
      authenticated: viewAuth(req),
      msg: "Failed to create admin. Please try again.",
    });
  }
});

// =================================================
//                CATEGORY MANAGEMENT
// =================================================

app.get("/categories", requireAdmin, async (req, res) => {
  const categories = await db.categoryModel.find({}).lean();
  res.render("categories", {
    authenticated: viewAuth(req),
    categories,
    title: "Category Management",
    msg: "",
  });
});

app.get("/create-category", requireAdmin, (req, res) => {
  res.render("create-category", {
    authenticated: viewAuth(req),
    title: "Create Category",
    msg: "",
  });
});

app.post("/save-category", requireAdmin, async (req, res) => {
  try {
    const cname = (req.body.cname || "").trim();
    const subnames = Array.isArray(req.body.subname)
      ? req.body.subname
      : req.body.subname
        ? [req.body.subname]
        : [];

    const subs = subnames.filter(Boolean).map((n) => ({ name: n.trim() }));

    await db.categoryModel.create({
      categoryname: cname,
      subcategories: subs,
    });

    res.redirect("/categories");
  } catch (err) {
    console.error(err);
    res.render("create-category", {
      authenticated: viewAuth(req),
      title: "Create Category",
      msg: "Failed to create category.",
    });
  }
});

app.get("/edit-category/:id", requireAdmin, async (req, res) => {
  const cat = await db.categoryModel.findById(req.params.id).lean();
  if (!cat) return res.redirect("/categories");

  res.render("create-category", {
    authenticated: viewAuth(req),
    title: "Edit Category",
    edit: true,
    category: cat,
    msg: "",
  });
});

app.post("/update-category/:id", requireAdmin, async (req, res) => {
  try {
    const cname = (req.body.cname || "").trim();
    const subnames = Array.isArray(req.body.subname)
      ? req.body.subname
      : req.body.subname
        ? [req.body.subname]
        : [];

    const subs = subnames.filter(Boolean).map((n) => ({ name: n.trim() }));

    await db.categoryModel.findByIdAndUpdate(req.params.id, {
      $set: { categoryname: cname, subcategories: subs },
    });

    res.redirect("/categories");
  } catch (err) {
    console.error(err);
    res.redirect("/categories");
  }
});

app.get("/delete-category/:id", requireAdmin, async (req, res) => {
  try {
    await db.categoryModel.findByIdAndDelete(req.params.id);
  } catch (err) {
    console.error(err);
  }
  res.redirect("/categories");
});

// =================================================
//                PRODUCT MANAGEMENT
// =================================================

app.get("/products", requireAdmin, async (req, res) => {
  const products = await db.productModel
    .find({})
    .sort({ createdAt: -1 })
    .lean();
  res.render("products", {
    authenticated: viewAuth(req),
    title: "Product Management",
    products,
  });
});

app.get("/create-product", requireAdmin, async (req, res) => {
  const categories = await db.categoryModel.find({}).lean();
  res.render("create-product", {
    authenticated: viewAuth(req),
    title: "Create Product",
    categories,
    msg: "",
  });
});

app.post("/save-product", requireAdmin, async (req, res) => {
  try {
    const {
      name,
      price,
      stock,
      categoryId,
      subcategory,
      description,
      imageUrl,
      status,
    } = req.body;

    const doc = await db.productModel.create({
      name,
      slug: (name || "").toLowerCase().replace(/\s+/g, "-"),
      price: Number(price || 0),
      stock: Number(stock || 0),
      categoryId: categoryId || null,
      subcategory: subcategory || "",
      description: description || "",
      imageUrl: imageUrl || "",
      status: status || "active",
    });

    // Real-time event: নতুন প্রোডাক্ট অ্যাড হয়েছে
    req.io.emit("product-added", {
      _id: String(doc._id),
      name: doc.name,
      price: doc.price,
      imageUrl: doc.imageUrl || "",
      status: doc.status,
      createdAt: doc.createdAt,
      categoryId: doc.categoryId || null,
    });

    res.redirect("/products");
  } catch (err) {
    console.error(err);
    res.redirect("/products");
  }
});

app.get("/edit-product/:id", requireAdmin, async (req, res) => {
  const [product, categories] = await Promise.all([
    db.productModel.findById(req.params.id).lean(),
    db.categoryModel.find({}).lean(),
  ]);

  if (!product) return res.redirect("/products");

  res.render("create-product", {
    authenticated: viewAuth(req),
    title: "Edit Product",
    categories,
    product,
    edit: true,
    msg: "",
  });
});

app.post("/update-product/:id", requireAdmin, async (req, res) => {
  try {
    const {
      name,
      price,
      stock,
      categoryId,
      subcategory,
      description,
      imageUrl,
      status,
    } = req.body;

    await db.productModel.findByIdAndUpdate(req.params.id, {
      $set: {
        name,
        slug: (name || "").toLowerCase().replace(/\s+/g, "-"),
        price: Number(price || 0),
        stock: Number(stock || 0),
        categoryId: categoryId || null,
        subcategory: subcategory || "",
        description: description || "",
        imageUrl: imageUrl || "",
        status: status || "active",
      },
    });

    req.io.emit("product-updated", { _id: String(req.params.id) });
    res.redirect("/products");
  } catch (err) {
    console.error(err);
    res.redirect("/products");
  }
});

app.get("/delete-product/:id", requireAdmin, async (req, res) => {
  try {
    await db.productModel.findByIdAndDelete(req.params.id);
    req.io.emit("product-deleted", { _id: String(req.params.id) });
  } catch (err) {
    console.error(err);
  }
  res.redirect("/products");
});

// =================================================
//                       CART
// =================================================

// Common handler for: GET /addcart, POST /addtocart, POST /add-to-cart
async function handleAddToCart(req, res) {
  try {
    if (!(req.session && req.session.user)) {
      return res.json({ ok: false, msg: "Please login to add items." });
    }

    const userId = req.session.user._id;

    const productId =
      req.body.productId ||
      req.body.pid ||
      req.query.productId ||
      req.query.pid ||
      req.query.id;

    const qtyRaw = req.body.qty || req.query.qty || 1;

    console.log("productId:", productId);
    console.log("req.query:", req.query);

    const product = await db.productModel.findById(productId).lean();

    console.log("product:", product);

    if (!product) {
      return res.json({ ok: false, msg: "Product not available." });
    }

    const quantity = Math.max(1, Number(qtyRaw || 1));

    // একজন user-এর একটাই cart থাকবে
    let cart = await db.cartModel.findOne({ userId: userId });

    if (!cart) {
      cart = new db.cartModel({
        userId: userId,
        items: [],
      });
    }

    // cart.items-এর মধ্যে এই product আগে আছে কিনা
    const existingIndex = cart.items.findIndex(
      (item) => String(item.productId) === String(product._id),
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].qty += quantity;
      cart.items[existingIndex].price = product.price;
      cart.items[existingIndex].name = product.name;
      cart.items[existingIndex].imageUrl = product.imageUrl || "";
    } else {
      cart.items.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        qty: quantity,
        imageUrl: product.imageUrl || "",
      });
    }

    await cart.save();

    const count = cart.items.reduce((sum, item) => sum + (item.qty || 0), 0);

    return res.json({
      ok: true,
      msg: "Added to cart",
      cartCount: count,
    });
  } catch (err) {
    console.error("ADD TO CART ERROR:", err);
    return res.json({ ok: false, msg: "Failed to add to cart" });
  }
}

// পুরোনো front-end – GET /addcart?id=...
app.get("/addcart", isAuthenticated, handleAddToCart, (req, res) => {
  const count = req.session.cart ? req.session.cart.length : 0;

  return res.json({
    ok: true,
    msg: "Added to cart",
    cartCount: count,
  });
});

// নতুন POST রুটগুলোও রেখে দিচ্ছি
app.post("/addtocart", isAuthenticated, handleAddToCart);
app.post("/add-to-cart", isAuthenticated, handleAddToCart);

app.get("/cart", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user._id;

    const cart = await db.cartModel.findOne({ userId: userId }).lean();

    const items = cart ? cart.items : [];
    const total = items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.qty || 0),
      0,
    );

    res.render("cart", {
      authenticated: viewAuth(req),
      items,
      total,
      title: "Your Cart",
    });
  } catch (err) {
    console.error(err);
    res.render("cart", {
      authenticated: viewAuth(req),
      items: [],
      total: 0,
      title: "Your Cart",
    });
  }
});

app.post("/cart/update", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { productId, qty } = req.body;

    const cart = await db.cartModel.findOne({ userId: userId });

    if (!cart) {
      return res.json({ ok: false });
    }

    const index = cart.items.findIndex(
      (item) => String(item.productId) === String(productId),
    );

    if (index > -1) {
      const q = Math.max(0, Number(qty || 0));

      if (q === 0) {
        cart.items.splice(index, 1);
      } else {
        cart.items[index].qty = q;
      }

      await cart.save();
    }

    const total = cart.items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.qty || 0),
      0,
    );

    return res.json({ ok: true, total });
  } catch (err) {
    console.error(err);
    return res.json({ ok: false });
  }
});

// cart-count (যদি future এ mini badge দেখাতে চাও)
app.get("/cart-count", async (req, res) => {
  try {
    if (!(req.session && req.session.user)) {
      return res.json({ ok: false, count: 0 });
    }

    const userId = req.session.user._id;
    const cart = await db.cartModel.findOne({ userId: userId }).lean();

    const count = cart
      ? cart.items.reduce((sum, item) => sum + (item.qty || 0), 0)
      : 0;

    return res.json({ ok: true, count });
  } catch (err) {
    console.error(err);
    return res.json({ ok: false, count: 0 });
  }
});

// =================================================
//             CHECKOUT / ORDERS
// =================================================

app.get("/checkout", isAuthenticated, async (req, res) => {
  const cart = await db.cartModel
    .findOne({ userId: req.session.user._id })
    .lean();

  const items = cart && cart.items ? cart.items : [];
  const total = calcTotal(items);

  if (items.length === 0) return res.redirect("/cart");

  res.render("checkout", {
    authenticated: viewAuth(req),
    items,
    total,
    title: "Checkout",
    msg: "",
  });
});

app.post("/confirm", isAuthenticated, async (req, res) => {
  const { name, phone, address } = req.body;

  try {
    const cart = await db.cartModel
      .findOne({ userId: req.session.user._id })
      .lean();

    if (!cart || cart.items.length === 0) return res.redirect("/cart");

    const total = calcTotal(cart.items);

    await db.orderModel.create({
      userId: req.session.user._id,
      items: cart.items.map((it) => ({
        productId: it.productId,
        name: it.name,
        price: it.price,
        qty: it.qty,
      })),
      shipping: { name, phone, address },
      total,
      status: "pending",
    });

    await db.cartModel.updateOne(
      { userId: req.session.user._id },
      { $set: { items: [] } },
    );

    res.render("confirm", {
      authenticated: viewAuth(req),
      title: "Order Confirmed",
      total,
    });
  } catch (err) {
    console.error(err);
    res.render("checkout", {
      authenticated: viewAuth(req),
      items: [],
      total: 0,
      title: "Checkout",
      msg: "Order failed. Try again.",
    });
  }
});

// ----- My Orders (user side) -----
app.get("/my-orders", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user._id;

    const orders = await db.orderModel
      .find({ userId: userId })
      .sort({ createdAt: -1 })
      .lean();

    res.render("my-orders", {
      authenticated: viewAuth(req),
      orders,
      title: "My Orders",
      msg: "",
    });
  } catch (err) {
    console.error(err);
    res.render("my-orders", {
      authenticated: viewAuth(req),
      orders: [],
      title: "My Orders",
      msg: "Could not load your orders.",
    });
  }
});

//---To send order cancel request to admin by the user
app.post("/my-orders/request-cancel/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const orderId = req.params.id;

    const order = await db.orderModel.findOne({
      _id: orderId,
      userId: userId,
    });

    if (!order) {
      return res.redirect("/my-orders");
    }

    // শুধু pending order হলে request করা যাবে
    if (order.status !== "pending") {
      return res.redirect("/my-orders");
    }

    order.status = "cancel_requested";
    await order.save();

    return res.redirect("/my-orders");
  } catch (err) {
    console.error(err);
    return res.redirect("/my-orders");
  }
});

// ----- Order list (admin) -----
app.get("/orderlist", requireAdmin, async (req, res) => {
  const orders = await db.orderModel.find({}).sort({ createdAt: -1 }).lean();

  res.render("orderlist", {
    authenticated: viewAuth(req),
    orders,
    title: "Orders",
  });
});

app.post("/order-status/:id", requireAdmin, async (req, res) => {
  const { status } = req.body;

  try {
    await db.orderModel.findByIdAndUpdate(req.params.id, {
      $set: { status },
    });
  } catch (err) {
    console.error(err);
  }

  res.redirect("/orderlist");
});

// =================================================
//                 START SERVER
// =================================================

const PORT = 1000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
