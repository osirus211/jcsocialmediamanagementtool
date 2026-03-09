/**
 * Public API Documentation Routes
 * 
 * Serves interactive API documentation using Swagger UI
 */

import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();

// Load OpenAPI specification
const openApiPath = path.join(process.cwd(), 'docs', 'public-api', 'openapi.yaml');
const openApiDocument = YAML.load(openApiPath);

// Swagger UI options
const swaggerOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Social Media Scheduler API Documentation',
  customfavIcon: '/favicon.ico',
};

// Serve Swagger UI
router.use('/ui', swaggerUi.serve);
router.get('/ui', swaggerUi.setup(openApiDocument, swaggerOptions));

// Serve raw OpenAPI spec (JSON)
router.get('/openapi.json', (_req, res) => {
  res.json(openApiDocument);
});

// Serve raw OpenAPI spec (YAML)
router.get('/openapi.yaml', (_req, res) => {
  res.type('text/yaml');
  res.sendFile(openApiPath);
});

// API documentation landing page
router.get('/', (_req, res) => {
  res.json({
    message: 'Public API Documentation',
    endpoints: {
      'Interactive Documentation': '/api/public/v1/docs/ui',
      'OpenAPI Specification (JSON)': '/api/public/v1/docs/openapi.json',
      'OpenAPI Specification (YAML)': '/api/public/v1/docs/openapi.yaml',
    },
    resources: {
      'Getting Started': 'https://docs.example.com/getting-started',
      'Authentication': 'https://docs.example.com/authentication',
      'Rate Limiting': 'https://docs.example.com/rate-limiting',
      'Scopes & Permissions': 'https://docs.example.com/scopes',
      'Error Codes': 'https://docs.example.com/errors',
    },
  });
});

export default router;
