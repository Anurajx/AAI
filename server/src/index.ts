import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import authRoutes from "./routes/authRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import stockRoutes from "./routes/stockRoutes";
import procurementRoutes from "./routes/procurementRoutes";
import reportsRoutes from "./routes/reportsRoutes";
import adminRoutes from "./routes/adminRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import { initCronJobs } from "./utils/cron";
import { prisma } from "./db";

// Load environmental configuration
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const PORT = Number(process.env.PORT || 5000);

const parseAllowedOrigins = (rawOrigins?: string) =>
  (rawOrigins || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "https://aai-client.vercel.app",
].filter(Boolean) as string[];

const corsOrigins = [
  ...new Set([
    ...allowedOrigins,
    ...parseAllowedOrigins(process.env.CORS_ORIGINS),
  ]),
];

// Middleware
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isAllowed = corsOrigins.some((allowedOrigin) => {
        if (!allowedOrigin) return false;
        if (allowedOrigin === "*") return true;
        return allowedOrigin === origin;
      });

      if (isAllowed) {
        callback(null, true);
        return;
      }

      if (
        origin.startsWith("http://127.0.0.1") ||
        origin.startsWith("http://localhost") ||
        origin.startsWith("https://")
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded assets (mock or files)
app.use("/uploads", express.static("uploads"));

// Health check endpoint
app.get("/health", (req, res) => {
  res
    .status(200)
    .json({ success: true, message: "AeroStock backend is operational." });
});

// REST Routing - API V1
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", inventoryRoutes);
app.use("/api/v1", stockRoutes);
app.use("/api/v1", procurementRoutes);
app.use("/api/v1/reports", reportsRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1", adminRoutes);
app.use("/api/v1/notifications", notificationRoutes);

// Global Error Handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Unhandled Server Error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "An internal server error occurred.",
    });
  },
);

// Initialize background stock auditing scheduler
initCronJobs();

async function startServer() {
  try {
    await prisma.$connect();
    console.log("[AeroStock Server] Database connected");
  } catch (err) {
    console.error(
      "[AeroStock Server] Cannot connect to PostgreSQL at localhost:5432",
    );
    console.error(
      "[AeroStock Server] Start the database first: npm run db:up (from project root)",
    );
    console.error(
      "[AeroStock Server] Or ensure Docker Desktop / PostgreSQL is running, then run: npm run db:push",
    );
    process.exit(1);
  }

  const startListening = (port: number, attempt = 0) => {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`[AeroStock Server] Running on http://localhost:${port}`);
      console.log(
        `[AeroStock Server] API v1 base: http://localhost:${port}/api/v1`,
      );
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE" && attempt < 10) {
        const nextPort = port + 1;
        console.warn(
          `[AeroStock Server] Port ${port} is busy, trying ${nextPort}...`,
        );
        server.close(() => startListening(nextPort, attempt + 1));
      } else {
        console.error("[AeroStock Server] Failed to start server", error);
        process.exit(1);
      }
    });
  };

  startListening(PORT);
}

startServer();
