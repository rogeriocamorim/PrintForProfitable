import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "./services/passport.js";
import authRoutes from "./routes/auth.js";
import farmRoutes from "./routes/farms.js";
import wizardRoutes from "./routes/wizard.js";
import modelRoutes from "./routes/models.js";
import adminRoutes from "./routes/admin.js";
import printerRoutes from "./routes/printers.js";
import filamentRoutes from "./routes/filaments.js";
import platformRoutes from "./routes/platforms.js";
import shippingRoutes from "./routes/shipping.js";
import orderRoutes from "./routes/orders.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists (with thumbnails subdirectory)
const uploadsDir = path.join(__dirname, "../uploads");
const thumbnailsDir = path.join(uploadsDir, "thumbnails");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Serve uploaded thumbnails and images statically
app.use("/api/uploads/thumbnails", express.static(thumbnailsDir));
const imagesDir = path.join(__dirname, "../uploads/images");
app.use("/api/uploads/images", express.static(imagesDir));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/farms", farmRoutes);
app.use("/api/wizard", wizardRoutes);
app.use("/api/models", modelRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/printers", printerRoutes);
app.use("/api/filaments", filamentRoutes);
app.use("/api/platforms", platformRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/orders", orderRoutes);

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
