import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { VersioningType } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "4",
  });

  // Global prefix
  app.setGlobalPrefix("api");

  // CORS
  app.enableCors();

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle("DeenMate API")
    .setDescription(
      `
    `,
    )
    .setVersion("2.0.0")
    .setContact(
      "DeenMate Team",
      "https://deenmate.app/",
      "support@deenmate.app",
    )
    .setLicense("MIT", "https://opensource.org/licenses/MIT")
    .addServer("http://localhost:3000/", "Development Server")
    .addServer("https://api.deenmate.app/", "Production Server")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        in: "header",
        name: "Authorization",
        description: "Enter JWT token as: Bearer <token>",
      },
      "bearer",
    )
    .addApiKey(
      {
        type: "apiKey",
        name: "x-admin-api-key",
        in: "header",
        description: "Admin API key for sync operations",
      },
      "admin-api-key",
    )
    .addTag("Prayer v1", "Prayer times and methods (Aladhan.com compatible)")
    .addTag(
      "Quran v4",
      "Quran chapters, verses, and translations (Quran.com compatible)",
    )
    .addTag("Hadith v4", "Hadith collections and search")
    .addTag("Zakat v4", "Zakat calculations and Nisab values")
    .addTag("Audio v4", "Quran audio recitations and files")
    .addTag("Admin v4", "Administrative sync and management endpoints")
    .addTag("Finance v4", "Gold and silver price data")
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: false,
    include: [], // Include all modules
  });

  // Setup Swagger UI with custom options
  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      docExpansion: "none",
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
    },
    customSiteTitle: "DeenMate API Documentation",
    customfavIcon: "/favicon.ico",
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { color: #2c5530; }
    `,
  });

  // JSON endpoint for OpenAPI
  app.getHttpAdapter().get("/docs-json", (req, res) => {
    res.type("application/json").send(document);
  });

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger UI:              http://localhost:${port}/docs`);
  console.log(`Swagger JSON:            http://localhost:${port}/docs-json`);
  console.log(`Admin Dashboard:          http://localhost:${port}/admin`);
  console.log(`Admin Login:              http://localhost:${port}/admin/login`);
}
bootstrap();
