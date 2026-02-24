# UI Test Suite

Comprehensive UI tests for the Enrichment Express preschool management system.

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure test credentials**:
   - Open `.env.test` in the root directory
   - Add your Vercel deployment URL and test credentials:
     ```
     BASE_URL=https://your-app.vercel.app
     TEST_USERNAME=your-test-email@example.com
     TEST_PASSWORD=your-test-password
     ```

3. **Verify browser installation**:
   ```bash
   npx playwright install chromium
   ```

## Running Tests

### Run all tests
```bash
npm test
```

### Run specific test suite
```bash
npm run test:auth          # Authentication tests
npm run test:grading       # Grading and scanner tests
npm run test:reports       # Report generation tests
npm run test:smoke         # Critical path smoke tests
```

### Run in UI mode (interactive)
```bash
npm run test:ui
```

### Run in headed mode (see browser)
```bash
npm run test:headed
```

### Debug a specific test
```bash
npx playwright test tests/auth/login.spec.ts --debug
```

## Test Structure

```
tests/
├── auth/                      # Authentication tests
│   ├── login.spec.ts         # Login/logout functionality
│   └── password-reset.spec.ts # Password reset flows
├── student/                   # Student management tests
│   └── batch-management.spec.ts # Batch CRUD operations
├── grading/                   # Grading tests
│   └── scanner.spec.ts       # OCR and grade entry
├── reports/                   # Report tests
│   └── report-generation.spec.ts # Report generation flows
├── learning-summaries/        # Learning summary tests
│   └── learning-summary.spec.ts # Auto-generated summaries
├── edge-cases/               # Edge case tests
│   └── error-handling.spec.ts # Error scenarios
├── smoke/                    # Smoke tests
│   └── critical-path.spec.ts # Critical user flows
└── helpers/                  # Test utilities
    ├── auth.helper.ts        # Authentication helpers
    └── navigation.helper.ts  # Navigation helpers
```

## Test Coverage

### Authentication ✅
- Login with valid/invalid credentials
- Logout
- Session persistence
- Password reset flow

### Student Management ✅
- Batch listing and creation
- Student CRUD operations
- Batch/student association

### Grading ✅
- Scanner interface
- Manual grade entry
- OCR photo upload
- Grade validation

### Reports ✅
- Report generation (single & batch)
- Report viewing
- PlayPack activities
- Progress tracking

### Learning Summaries ✅
- Auto-generation from last 3 reports
- Display for students with 2+ reports
- Queue processing

### Edge Cases ✅
- Network errors
- API timeouts
- Form validation
- Empty states
- Special characters & XSS prevention
- Session expiration
- Mobile responsiveness

### Smoke Tests ✅
- Complete critical workflows
- No JavaScript errors
- Performance benchmarks
- Supabase connectivity

## Viewing Test Results

After running tests:

1. **HTML Report**:
   ```bash
   npx playwright show-report
   ```

2. **JUnit XML** (for CI/CD):
   - Located at `test-results/junit.xml`

3. **Screenshots & Videos**:
   - Failed tests automatically capture screenshots and videos
   - Located in `test-results/` directory

## Writing New Tests

1. Create a new `.spec.ts` file in the appropriate directory
2. Import helpers:
   ```typescript
   import { test, expect } from '@playwright/test';
   import { login } from '../helpers/auth.helper';
   ```

3. Write tests using Playwright API:
   ```typescript
   test('should do something', async ({ page }) => {
     await page.goto('/');
     await login(page, process.env.TEST_USERNAME!, process.env.TEST_PASSWORD!);
     // ... test logic
   });
   ```

## CI/CD Integration

Add to your GitHub Actions or CI pipeline:

```yaml
- name: Install dependencies
  run: npm install

- name: Install Playwright browsers
  run: npx playwright install chromium

- name: Run tests
  run: npm test
  env:
    BASE_URL: ${{ secrets.BASE_URL }}
    TEST_USERNAME: ${{ secrets.TEST_USERNAME }}
    TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}

- name: Upload test results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

## Troubleshooting

### Tests fail with timeout
- Increase timeout in `playwright.config.ts`
- Check network connectivity
- Verify Vercel deployment is accessible

### Authentication fails
- Verify credentials in `.env.test`
- Check if test user exists in database
- Ensure Supabase is not blocking requests

### Elements not found
- Check if selectors match current UI
- Wait for elements to load: `await page.waitForSelector()`
- Use `page.pause()` to debug interactively

## Best Practices

1. **Always login in beforeEach** for authenticated tests
2. **Use helpers** for common operations (login, navigation)
3. **Use data-testid** attributes for stable selectors
4. **Wait for network idle** before assertions
5. **Clean up after tests** (logout, clear data if needed)
6. **Keep tests independent** - each test should work in isolation

## Support

For issues or questions:
1. Check the [Playwright documentation](https://playwright.dev)
2. Review test output and screenshots in `test-results/`
3. Run tests in debug mode: `npx playwright test --debug`
