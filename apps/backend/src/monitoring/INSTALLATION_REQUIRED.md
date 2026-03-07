# Installation Required

## Sentry SDK Installation

To use the Sentry monitoring module, you must install the Sentry Node.js SDK:

```bash
npm install @sentry/node
```

Or with yarn:

```bash
yarn add @sentry/node
```

## Why This Package is Required

The `@sentry/node` package provides:
- Error capture and reporting
- Performance monitoring
- Request context tracking
- Breadcrumb tracking
- User context tracking
- Integration with Express

## Version Compatibility

Recommended version: `@sentry/node@^7.0.0`

```json
{
  "dependencies": {
    "@sentry/node": "^7.0.0"
  }
}
```

## After Installation

1. Add `SENTRY_DSN` to your `.env` file
2. Follow the integration guide in `SENTRY_INTEGRATION.md`
3. Test error capture
4. Configure alerts in Sentry dashboard

## Verification

After installation, verify the package is installed:

```bash
npm list @sentry/node
```

Expected output:
```
backend@1.0.0 /path/to/backend
└── @sentry/node@7.x.x
```

## Troubleshooting

### Module Not Found Error

If you see:
```
Cannot find module '@sentry/node'
```

Solution:
```bash
npm install @sentry/node
```

### TypeScript Errors

If you see TypeScript errors, ensure types are installed:
```bash
npm install --save-dev @types/node
```

The `@sentry/node` package includes its own TypeScript definitions, so no additional `@types` package is needed for Sentry.

## Next Steps

After installing the package:
1. Configure environment variables
2. Integrate with Express (see `EXPRESS_INTEGRATION_EXAMPLE.ts`)
3. Test error capture
4. Monitor Sentry dashboard
