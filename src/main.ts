import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix("api/v1");

  // CORS
  app.enableCors();

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('DeenMate API')
    .setDescription('Production-ready backend for Quran, Prayer Times, Hadith, Zakat')
    .setVersion('1.0.0')
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
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: false,
  });

  SwaggerModule.setup('docs', app, document);

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
