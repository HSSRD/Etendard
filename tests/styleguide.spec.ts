import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, schemes } from './helpers';

test('l’index du styleguide liste les pages et n’est pas indexé', async ({
  page,
}) => {
  await page.goto('/styleguide');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Styleguide',
  );
  await expect(page.getByRole('link', { name: 'Tokens' })).toHaveAttribute(
    'href',
    '/styleguide/tokens',
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex',
  );
  for (const scheme of schemes) {
    await page.emulateMedia({ colorScheme: scheme });
    await expectNoAxeViolations(page);
  }
});
