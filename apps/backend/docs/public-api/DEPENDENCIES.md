# Public API Documentation Dependencies

The Public API documentation requires the following npm packages:

## Required Packages

```bash
npm install swagger-ui-express yamljs
npm install --save-dev @types/swagger-ui-express @types/yamljs
```

### Package Details

1. **swagger-ui-express** (^5.0.0)
   - Serves Swagger UI for interactive API documentation
   - Provides a web interface to explore and test API endpoints
   - Auto-generates documentation from OpenAPI specification

2. **yamljs** (^0.3.0)
   - Parses YAML files into JavaScript objects
   - Used to load the OpenAPI specification (openapi.yaml)
   - Lightweight YAML parser

3. **@types/swagger-ui-express** (^4.1.6)
   - TypeScript type definitions for swagger-ui-express
   - Development dependency

4. **@types/yamljs** (^0.2.34)
   - TypeScript type definitions for yamljs
   - Development dependency

## Installation

Add to `apps/backend/package.json`:

```json
{
  "dependencies": {
    "swagger-ui-express": "^5.0.0",
    "yamljs": "^0.3.0"
  },
  "devDependencies": {
    "@types/swagger-ui-express": "^4.1.6",
    "@types/yamljs": "^0.2.34"
  }
}
```

Then run:

```bash
cd apps/backend
npm install
```

## Verification

After installation, verify the packages are installed:

```bash
npm list swagger-ui-express yamljs
```

Expected output:
```
apps-backend@1.0.0 /path/to/apps/backend
├── swagger-ui-express@5.0.0
└── yamljs@0.3.0
```

## Usage

The documentation routes are automatically available at:

- **Interactive Docs**: http://localhost:3000/api/public/v1/docs/ui
- **OpenAPI JSON**: http://localhost:3000/api/public/v1/docs/openapi.json
- **OpenAPI YAML**: http://localhost:3000/api/public/v1/docs/openapi.yaml

## Troubleshooting

### Module not found errors

If you see errors like:
```
Error: Cannot find module 'swagger-ui-express'
```

Solution:
```bash
cd apps/backend
npm install swagger-ui-express yamljs
```

### TypeScript errors

If you see TypeScript errors:
```bash
npm install --save-dev @types/swagger-ui-express @types/yamljs
```

### YAML file not found

Ensure the OpenAPI specification exists at:
```
apps/backend/docs/public-api/openapi.yaml
```

The file path is resolved relative to `process.cwd()` (the backend directory).
