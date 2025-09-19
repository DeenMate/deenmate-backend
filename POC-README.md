# NestJS + Next.js Integration Proof of Concept

This proof of concept demonstrates how to integrate the DeenMate NestJS API with the Next.js admin dashboard into a single unified application.

## 🎯 Overview

The integration uses a **Next.js Custom Server** approach that:
- Serves both API and admin dashboard from a single port (3000)
- Eliminates CORS issues between frontend and backend
- Maintains full functionality of both applications
- Provides unified authentication and error handling
- Simplifies deployment and development workflow

## 📁 Files Created

### Core Integration Files
- `poc-server.js` - Custom server that integrates NestJS and Next.js
- `poc-package.json` - Package configuration for integrated setup
- `test-integration.js` - Comprehensive test suite for the integration
- `setup-poc.sh` - Setup script to prepare the environment

### Configuration Files
- `admin-dashboard/next.config.integrated.ts` - Next.js config for integration
- `admin-dashboard/src/lib/api.integrated.ts` - API client for integrated setup

### Documentation
- `docs/integration-research.md` - Detailed research on integration approaches
- `POC-README.md` - This file

## 🚀 Quick Start

### 1. Setup Environment
```bash
# Make setup script executable and run it
chmod +x setup-poc.sh
./setup-poc.sh
```

### 2. Start Integrated Server
```bash
# Start the integrated server
node poc-server.js
```

### 3. Access Applications
- **API**: http://localhost:3000/api
- **Admin Dashboard**: http://localhost:3000/admin
- **API Documentation**: http://localhost:3000/docs
- **Home**: http://localhost:3000/ (redirects to admin dashboard)

### 4. Run Tests
```bash
# Run integration tests
node test-integration.js
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Integrated Server                        │
│                     (Port 3000)                            │
├─────────────────────────────────────────────────────────────┤
│  Request Router                                             │
│  ├── /api/* → NestJS Application                           │
│  ├── /docs/* → Swagger Documentation                       │
│  ├── /admin/* → Next.js Admin Dashboard                    │
│  └── /* → Next.js (fallback)                               │
├─────────────────────────────────────────────────────────────┤
│  Shared Resources                                           │
│  ├── Authentication (JWT)                                  │
│  ├── Database (PostgreSQL + Prisma)                       │
│  ├── Cache (Redis + BullMQ)                               │
│  └── Logging & Monitoring                                  │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 How It Works

### 1. Custom Server (`poc-server.js`)
- Creates both NestJS and Next.js applications
- Routes requests based on URL patterns:
  - `/api/*` → NestJS API endpoints
  - `/docs/*` → Swagger documentation
  - `/admin/*` → Next.js admin dashboard
  - Everything else → Next.js (for client-side routing)

### 2. Request Flow
```
Client Request → Custom Server → Route Decision
                                    ├── API Request → NestJS → Database/External APIs
                                    └── Admin Request → Next.js → React Components
```

### 3. Authentication
- JWT tokens are shared between API and admin dashboard
- No CORS issues since both are served from same domain
- Unified session management

## 📊 Test Results

The integration test suite validates:
- ✅ API health endpoints
- ✅ Swagger documentation
- ✅ Admin dashboard loading
- ✅ API endpoints functionality
- ✅ Authentication endpoints
- ✅ Static asset serving

## 🎨 Benefits

### Development Experience
- **Single Port**: No more managing multiple ports
- **No CORS**: Eliminates cross-origin issues
- **Unified Logging**: Single log stream for debugging
- **Hot Reload**: Both API and frontend reload together

### Production Benefits
- **Simplified Deployment**: Single application to deploy
- **Better Performance**: No network latency between frontend and backend
- **Unified Monitoring**: Single application to monitor
- **Reduced Complexity**: Fewer moving parts

### Security
- **Shared Authentication**: No token passing between domains
- **Unified Security Headers**: Consistent security configuration
- **Session Management**: Shared session state

## 🔄 Migration Path

### Phase 1: Proof of Concept ✅
- [x] Research integration approaches
- [x] Build custom server
- [x] Test basic functionality
- [x] Validate authentication

### Phase 2: Full Migration (Future)
- [ ] Move all admin pages to integrated setup
- [ ] Update API client to use relative URLs
- [ ] Test all admin functionality
- [ ] Update deployment configuration
- [ ] Performance optimization

### Phase 3: Production (Future)
- [ ] Production deployment
- [ ] Monitoring and logging
- [ ] Error handling improvements
- [ ] Documentation updates

## 🛠️ Development Commands

```bash
# Setup and build everything
./setup-poc.sh

# Start integrated server
node poc-server.js

# Run tests
node test-integration.js

# Development mode (separate processes)
npm run start:dev

# Build for production
npm run build
npm start
```

## 🔍 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Kill existing processes
   pkill -f "node poc-server.js"
   pkill -f "nest start"
   pkill -f "next dev"
   ```

2. **Build Failures**
   ```bash
   # Clean and rebuild
   npm run clean
   ./setup-poc.sh
   ```

3. **Database Connection Issues**
   - Check `.env` file configuration
   - Ensure PostgreSQL is running
   - Verify database credentials

4. **Redis Connection Issues**
   - Check Redis server is running
   - Verify Redis configuration in `.env`

### Debug Mode
```bash
# Start with debug logging
DEBUG=* node poc-server.js
```

## 📈 Performance Considerations

### Optimizations Implemented
- Static file serving through Express
- Shared authentication context
- Unified error handling
- Efficient request routing

### Future Optimizations
- CDN integration for static assets
- API response caching
- Database connection pooling
- Background job optimization

## 🔒 Security Considerations

### Current Security Features
- JWT-based authentication
- CORS elimination (same-origin requests)
- Unified security headers
- Input validation through NestJS

### Additional Security Measures
- Rate limiting (can be added to NestJS)
- API key authentication for external access
- Audit logging for admin operations
- HTTPS enforcement in production

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Express.js Documentation](https://expressjs.com/)
- [Integration Research](./docs/integration-research.md)

## 🤝 Contributing

To contribute to this proof of concept:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run the test suite: `node test-integration.js`
5. Submit a pull request

## 📄 License

This proof of concept is part of the DeenMate project and follows the same licensing terms.

---

**Note**: This is a proof of concept. For production use, additional testing, security hardening, and performance optimization would be required.
