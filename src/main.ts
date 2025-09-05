import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { VersioningType } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '4',
  });

  // Global prefix
  app.setGlobalPrefix("api");

  // CORS
  app.enableCors();

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('DeenMate API')
    .setDescription(`
# 🕌 DeenMate API - Multi-Version Islamic Services

## 🎯 **API Versions & Compatibility**

### **Prayer API v1** - Aladhan.com Compatible
- **Base URL**: \`/api/v1/prayer/\`
- **Compatibility**: 100% compatible with Aladhan.com API
- **Features**: Prayer times, methods, locations, calendar, qibla direction
- **Parameters**: Uses \`latitude\`/\`longitude\` (not \`lat\`/\`lng\`)

### **Quran API v4** - Quran.com Compatible  
- **Base URL**: \`/api/v4/quran/\`
- **Compatibility**: 100% compatible with Quran.com API
- **Features**: Chapters, verses, translations, recitations, search

### **Other APIs v4** - DeenMate Native
- **Base URL**: \`/api/v4/\`
- **Modules**: Hadith, Zakat, Audio, Admin Sync, Finance

## 🚀 **Key Features**
- ✅ **Live Data Integration** - Real-time data from upstream APIs
- ✅ **Perfect Upstream Compatibility** - Drop-in replacement for Aladhan/Quran.com
- ✅ **Graceful Fallback** - Automatic fallback to upstream APIs when needed
- ✅ **Multi-Version Architecture** - Module-wise versioning for optimal compatibility
- ✅ **Production Ready** - PostgreSQL, Redis, scheduled sync jobs

## 📚 **Quick Start**
1. **Prayer Times**: \`GET /api/v1/prayer/timings?latitude=23.8103&longitude=90.4125\`
2. **Quran Chapters**: \`GET /api/v4/quran/chapters?page=1&limit=10\`
3. **Prayer Methods**: \`GET /api/v1/prayer/methods\`

## 🔐 **Authentication**
Admin endpoints require \`x-admin-api-key\` header for sync operations.
    `)
    .setVersion('2.0.0')
    .setContact('DeenMate Team', 'https://deenmate.app/', 'support@deenmate.app')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:3000/', 'Development Server')
    .addServer('https://api.deenmate.app/', 'Production Server')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        name: 'Authorization',
        description: 'Enter JWT token as: Bearer <token>'
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-admin-api-key',
        in: 'header',
        description: 'Admin API key for sync operations'
      },
      'admin-api-key'
    )
    .addTag('Prayer v1', 'Prayer times and methods (Aladhan.com compatible)')
    .addTag('Quran v4', 'Quran chapters, verses, and translations (Quran.com compatible)')
    .addTag('Hadith v4', 'Hadith collections and search')
    .addTag('Zakat v4', 'Zakat calculations and Nisab values')
    .addTag('Audio v4', 'Quran audio recitations and files')
    .addTag('Admin v4', 'Administrative sync and management endpoints')
    .addTag('Finance v4', 'Gold and silver price data')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: false,
    include: [], // Include all modules
  });

  // Setup Swagger UI with custom options
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      docExpansion: 'none',
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
    },
    customSiteTitle: 'DeenMate API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { color: #2c5530; }
    `,
  });

  // JSON endpoint for OpenAPI
  app.getHttpAdapter().get('/docs-json', (req, res) => {
    res.type('application/json').send(document);
  });

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger UI:              http://localhost:${port}/docs`);
  console.log(`Swagger JSON:            http://localhost:${port}/docs-json`);
}
bootstrap();
