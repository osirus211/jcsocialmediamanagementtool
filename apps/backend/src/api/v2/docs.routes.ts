/**
 * Public API v2 - Documentation Routes
 * 
 * Serves OpenAPI documentation and Swagger UI
 */

import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { generateOpenAPISpec } from './openapi';
import { logger } from '../../utils/logger';

const router = Router();

// Generate OpenAPI spec once at startup
let openApiSpec: any;
try {
  openApiSpec = generateOpenAPISpec();
  logger.info('OpenAPI specification generated successfully');
} catch (error) {
  logger.error('Failed to generate OpenAPI specification', { error });
  openApiSpec = {
    openapi: '3.0.0',
    info: {
      title: 'Social Media Scheduler Public API',
      version: '2.0.0',
      description: 'API documentation generation failed. Please check server logs.',
    },
    paths: {},
  };
}

/**
 * GET /api/v2/docs - Swagger UI documentation
 */
router.use('/docs', swaggerUi.serve);
router.get('/docs', swaggerUi.setup(openApiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Social Media Scheduler API v2',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
  },
}));

/**
 * GET /api/v2/openapi.json - Raw OpenAPI JSON spec
 */
router.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(openApiSpec);
});

/**
 * GET /api/v2/openapi.yaml - Raw OpenAPI YAML spec
 */
router.get('/openapi.yaml', (req, res) => {
  try {
    const yaml = require('js-yaml');
    const yamlSpec = yaml.dump(openApiSpec, { 
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });
    
    res.setHeader('Content-Type', 'application/x-yaml');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(yamlSpec);
  } catch (error) {
    logger.error('Failed to convert OpenAPI spec to YAML', { error });
    res.status(500).json({
      error: 'Failed to generate YAML specification',
      code: 'YAML_GENERATION_ERROR',
    });
  }
});

export default router;