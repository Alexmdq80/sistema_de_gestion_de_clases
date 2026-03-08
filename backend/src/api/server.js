import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from '../config/database.js';
import { errorHandler } from '../utils/errors.js';

// Initialize environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'error',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// API routes
import apiRoutes from './routes/index.js';
import practicantesRoutes from './routes/practicantes.js';
import authRoutes from './routes/auth.js'; // Import auth routes
import tiposAbonoRoutes from './routes/tiposAbono.js'; // Import tiposAbono routes
import pagosRoutes from './routes/pagos.js'; // Import pagos routes
import lugaresRoutes from './routes/lugares.js'; // Import lugares routes
import actividadesRoutes from './routes/actividades.js'; // Import actividades routes
import horariosRoutes from './routes/horarios.js'; // Import horarios routes
import asistenciaRoutes from './routes/asistencia.js'; // Import asistencia routes
import sociosRoutes from './routes/socios.js'; // Import socios routes
import pagosSociosRoutes from './routes/pagosSocios.js'; // Import pagosSocios routes
import usersRoutes from './routes/users.js'; // Import users routes
import deudasRoutes from './routes/deudas.js'; // Import deudas routes
import cajaRoutes from './routes/caja.js'; // Import caja routes
import categoriasCajaRoutes from './routes/categoriasCaja.js'; // Import categorias caja routes

app.use('/api', apiRoutes);
app.use('/api/practicantes', practicantesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tipos-abono', tiposAbonoRoutes); // Mount tiposAbono routes
app.use('/api/pagos', pagosRoutes); // Mount pagos routes
app.use('/api/lugares', lugaresRoutes); // Mount lugares routes
app.use('/api/actividades', actividadesRoutes); // Mount actividades routes
app.use('/api/horarios', horariosRoutes); // Mount horarios routes
app.use('/api/asistencia', asistenciaRoutes); // Mount asistencia routes (includes /api/asistencia/clases)
app.use('/api/socios', sociosRoutes); // Mount socios routes
app.use('/api/pagos-socios', pagosSociosRoutes); // Mount pagosSocios routes
app.use('/api/users', usersRoutes); // Mount users routes
app.use('/api/deudas', deudasRoutes); // Mount deudas routes
app.use('/api/caja', cajaRoutes); // Mount caja routes
app.use('/api/categorias-caja', categoriasCajaRoutes); // Mount categorias caja routes

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    details: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // Test database connection
  const dbConnected = await testConnection();
  if (dbConnected) {
    console.log('Database connection: OK');
  } else {
    console.warn('Database connection: FAILED - Please check your database configuration');
  }
});

export default app;
