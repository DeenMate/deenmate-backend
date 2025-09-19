/**
 * Proof of Concept: Next.js Custom Server with NestJS Integration
 * 
 * This demonstrates how to integrate Next.js admin dashboard with NestJS API
 * in a single application using a custom server.
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');

// Configuration
const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || 'localhost';

// Initialize Next.js app
const nextApp = next({ 
  dev, 
  dir: './admin-dashboard', // Point to admin dashboard directory
  conf: {
    // Next.js configuration
    experimental: {
      serverComponentsExternalPackages: ['@nestjs/common', '@nestjs/core']
    }
  }
});

const handle = nextApp.getRequestHandler();

async function createIntegratedServer() {
  try {
    console.log('🚀 Starting integrated server...');
    
    // Prepare Next.js app
    await nextApp.prepare();
    console.log('✅ Next.js app prepared');
    
    // Create NestJS application
    const nestApp = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });
    
    // Initialize NestJS app
    await nestApp.init();
    console.log('✅ NestJS app initialized');
    
    // Get Express instance from NestJS
    const expressApp = nestApp.getHttpAdapter().getInstance();
    
    // Create HTTP server
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        const { pathname, query } = parsedUrl;
        
        console.log(`📡 ${req.method} ${pathname}`);
        
        // Route API calls to NestJS
        if (pathname.startsWith('/api/')) {
          console.log(`🔧 Routing to NestJS: ${pathname}`);
          return expressApp(req, res);
        }
        
        // Route admin dashboard to Next.js
        if (pathname.startsWith('/admin') || pathname === '/') {
          console.log(`🎨 Routing to Next.js: ${pathname}`);
          return handle(req, res, parsedUrl);
        }
        
        // Route Swagger docs to NestJS
        if (pathname.startsWith('/docs')) {
          console.log(`📚 Routing to Swagger: ${pathname}`);
          return expressApp(req, res);
        }
        
        // Default: route to Next.js
        console.log(`🎨 Default routing to Next.js: ${pathname}`);
        return handle(req, res, parsedUrl);
        
      } catch (error) {
        console.error('❌ Server error:', error);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
    
    // Start server
    server.listen(port, hostname, (err) => {
      if (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
      }
      
      console.log('🎉 Integrated server started successfully!');
      console.log(`📡 API Server: http://${hostname}:${port}/api`);
      console.log(`🎨 Admin Dashboard: http://${hostname}:${port}/admin`);
      console.log(`📚 API Documentation: http://${hostname}:${port}/docs`);
      console.log(`🏠 Home: http://${hostname}:${port}/`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('🛑 SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', async () => {
      console.log('🛑 SIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ Failed to create integrated server:', error);
    process.exit(1);
  }
}

// Start the integrated server
createIntegratedServer();
