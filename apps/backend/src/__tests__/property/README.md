# Property-Based Testing Guide

## What is Property-Based Testing?

Property-based testing is a testing methodology where you define properties (invariants) that should always hold true for your code, rather than testing specific input/output examples. The testing framework (fast-check) generates hundreds of random inputs to verify these properties.

### Benefits
- **Discovers edge cases** you wouldn't think to test manually
- **Tests behavior** rather than specific implementations
- **Provides better coverage** with fewer test cases
- **Catches regressions** when refactoring

## How to Run Property Tests

```bash
# Run all property tests
npm test -- --testPathPattern=property

# Run specific property test file
npm test -- --testPathPattern=post-scheduling.property

# Run with verbose output
npm test -- --testPathPattern=property --verbose

# Run with coverage
npm test:coverage -- --testPathPattern=property
```

## How to Add New Properties

### 1. Create a new test file
```typescript
import * as fc from 'fast-check';
import { describe, it, expect } from '@jest/globals';

describe('Your Feature Properties', () => {
  it('property description', async () => {
    await fc.assert(
      fc.property(
        fc.string(), // Arbitrary generator
        (input) => {
          // Your property assertion
          expect(yourFunction(input)).toBeSomething();
        }
      )
    );
  });
});
```

### 2. Always include concrete examples
```typescript
// Concrete example for sanity check
it('concrete example: specific case should work', () => {
  const result = yourFunction('specific input');
  expect(result).toBe('expected output');
});
```

## Fast-Check Arbitraries Used in This Project

### Basic Types
- `fc.string()` - Random strings
- `fc.integer()` - Random integers
- `fc.boolean()` - Random booleans
- `fc.date()` - Random dates
- `fc.uuid()` - Random UUIDs

### Constrained Types
- `fc.string({ minLength: 1, maxLength: 100 })` - Bounded strings
- `fc.integer({ min: 0, max: 100 })` - Bounded integers
- `fc.constantFrom('a', 'b', 'c')` - Pick from specific values
- `fc.array(fc.string(), { maxLength: 10 })` - Bounded arrays

### Complex Types
- `fc.record({ id: fc.uuid(), name: fc.string() })` - Objects
- `fc.webUrl()` - Valid URLs
- `fc.ipV4()` - IPv4 addresses
- `fc.subarray(['a', 'b', 'c'])` - Subsets of arrays

### Custom Arbitraries
```typescript
// Custom arbitrary for your domain
const postArbitrary = fc.record({
  id: fc.uuid(),
  content: fc.string({ maxLength: 280 }),
  platform: fc.constantFrom('twitter', 'linkedin', 'instagram'),
  scheduledAt: fc.date({ min: new Date() })
});
```

## How to Reproduce Failing Cases

When a property test fails, fast-check provides a seed to reproduce the exact failure:

```bash
# Example failure output
Property failed after 42 runs
Seed: 1234567890
Counterexample: ["problematic input"]

# Reproduce the failure
npm test -- --testPathPattern=your-test --seed=1234567890
```

You can also set a specific seed in your test:
```typescript
fc.assert(
  fc.property(fc.string(), (input) => {
    // Your test
  }),
  { seed: 1234567890 } // Reproduce specific case
);
```

## Property Test Patterns

### 1. Round-trip Properties
```typescript
// Encoding then decoding should return original
fc.property(fc.string(), (original) => {
  const encoded = encode(original);
  const decoded = decode(encoded);
  expect(decoded).toBe(original);
});
```

### 2. Invariant Properties
```typescript
// Array length should never decrease when adding
fc.property(fc.array(fc.string()), fc.string(), (arr, item) => {
  const newArr = addItem(arr, item);
  expect(newArr.length).toBeGreaterThanOrEqual(arr.length);
});
```

### 3. Idempotent Properties
```typescript
// Applying operation twice should be same as once
fc.property(fc.string(), (input) => {
  const once = normalize(input);
  const twice = normalize(once);
  expect(twice).toBe(once);
});
```

### 4. Comparison Properties
```typescript
// Alternative implementations should agree
fc.property(fc.array(fc.integer()), (arr) => {
  const result1 = sortMethod1(arr);
  const result2 = sortMethod2(arr);
  expect(result1).toEqual(result2);
});
```

## Best Practices

### 1. Start Simple
Begin with basic properties and gradually add complexity.

### 2. Use Preconditions
Filter out invalid inputs when needed:
```typescript
fc.property(
  fc.string().filter(s => s.length > 0), // Non-empty strings only
  (input) => {
    // Your test
  }
);
```

### 3. Test Edge Cases
Use specific generators for edge cases:
```typescript
fc.property(
  fc.oneof(
    fc.constant(''), // Empty string
    fc.string({ minLength: 1000 }), // Very long string
    fc.string().filter(s => /^\s+$/.test(s)) // Whitespace only
  ),
  (input) => {
    // Your test should handle all these cases
  }
);
```

### 4. Mock External Dependencies
Always mock database calls, HTTP requests, etc.:
```typescript
beforeEach(() => {
  jest.clearAllMocks();
  (ExternalService.call as jest.Mock).mockResolvedValue(mockResponse);
});
```

### 5. Keep Properties Simple
Each property should test one specific invariant. Complex properties are harder to debug when they fail.

## Debugging Failed Properties

1. **Read the counterexample** - fast-check shows the exact input that caused failure
2. **Add logging** - Use `console.log` to understand what's happening
3. **Simplify the property** - Remove complexity to isolate the issue
4. **Add concrete tests** - Create specific unit tests for the failing case
5. **Use smaller inputs** - Reduce the size of generated data to make debugging easier

## Integration with CI/CD

Property tests run as part of the regular test suite. They're particularly valuable for:
- **Pre-commit hooks** - Catch issues before they reach the repository
- **Pull request validation** - Ensure new code doesn't break invariants
- **Nightly builds** - Run with higher iteration counts for thorough testing

## Performance Considerations

- Property tests run 100 iterations by default
- Increase iterations for critical code paths:
  ```typescript
  fc.assert(property, { numRuns: 1000 });
  ```
- Use `fc.sample()` to generate test data outside of properties when needed
- Mock expensive operations (database, network calls)

## Further Reading

- [fast-check documentation](https://fast-check.dev/)
- [Property-Based Testing patterns](https://hypothesis.works/articles/what-is-property-based-testing/)
- [Choosing properties to test](https://fsharpforfunandprofit.com/posts/property-based-testing-2/)