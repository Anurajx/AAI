"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const inventoryRoutes_1 = __importDefault(require("./routes/inventoryRoutes"));
const stockRoutes_1 = __importDefault(require("./routes/stockRoutes"));
const procurementRoutes_1 = __importDefault(require("./routes/procurementRoutes"));
const reportsRoutes_1 = __importDefault(require("./routes/reportsRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const cron_1 = require("./utils/cron");
const db_1 = require("./db");
// Load environmental configuration
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Serve uploaded assets (mock or files)
app.use('/uploads', express_1.default.static('uploads'));
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ success: true, message: 'AeroStock backend is operational.' });
});
// REST Routing - API V1
app.use('/api/v1/auth', authRoutes_1.default);
app.use('/api/v1', inventoryRoutes_1.default);
app.use('/api/v1', stockRoutes_1.default);
app.use('/api/v1', procurementRoutes_1.default);
app.use('/api/v1/reports', reportsRoutes_1.default);
app.use('/api/v1/admin', adminRoutes_1.default);
app.use('/api/v1', adminRoutes_1.default);
app.use('/api/v1/notifications', notificationRoutes_1.default);
// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'An internal server error occurred.'
    });
});
// Initialize background stock auditing scheduler
(0, cron_1.initCronJobs)();
async function startServer() {
    try {
        await db_1.prisma.$connect();
        console.log('[AeroStock Server] Database connected');
    }
    catch (err) {
        console.error('[AeroStock Server] Cannot connect to PostgreSQL at localhost:5432');
        console.error('[AeroStock Server] Start the database first: npm run db:up (from project root)');
        console.error('[AeroStock Server] Or ensure Docker Desktop / PostgreSQL is running, then run: npm run db:push');
        process.exit(1);
    }
    app.listen(PORT, () => {
        console.log(`[AeroStock Server] Running on http://localhost:${PORT}`);
        console.log(`[AeroStock Server] API v1 base: http://localhost:${PORT}/api/v1`);
    });
}
startServer();
