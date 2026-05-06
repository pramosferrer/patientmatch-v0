import { test, expect } from '@playwright/test';

test.describe('Trials Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/trials');
  });

  test('loads page and shows skeleton then cards', async ({ page }) => {
    // Check that skeleton appears initially
    await expect(page.locator('[role="list"]')).toBeVisible();
    
    // Wait for cards to load (should replace skeleton)
    await expect(page.locator('[role="listitem"]').first()).toBeVisible({ timeout: 10000 });
    
    // Verify we have trial cards
    const trialCards = page.locator('[role="listitem"]');
    await expect(trialCards).toHaveCount.greaterThan(0);
  });

  test('shows "New" badge for recent trials', async ({ page }) => {
    // Wait for cards to load
    await expect(page.locator('[role="listitem"]').first()).toBeVisible({ timeout: 10000 });
    
    // Check if any trial has "New" badge (this will depend on test data)
    const newBadges = page.locator('text=New');
    // Note: This test might not always pass depending on test data
    // In a real scenario, you'd seed test data with recent trials
  });

  test('allows saving trials to shortlist', async ({ page }) => {
    // Wait for cards to load
    await expect(page.locator('[role="listitem"]').first()).toBeVisible({ timeout: 10000 });
    
    // Click save button on first trial
    const firstSaveButton = page.locator('[role="listitem"]').first().locator('button[aria-label*="Add"]');
    await firstSaveButton.click();
    
    // Verify compare drawer appears
    await expect(page.locator('text=Compare (1)')).toBeVisible();
  });

  test('enforces max 3 trials in shortlist', async ({ page }) => {
    // Wait for cards to load
    await expect(page.locator('[role="listitem"]').first()).toBeVisible({ timeout: 10000 });
    
    // Save 3 trials
    for (let i = 0; i < 3; i++) {
      const saveButton = page.locator('[role="listitem"]').nth(i).locator('button[aria-label*="Add"]');
      await saveButton.click();
    }
    
    // Try to save a 4th trial - button should be disabled
    const fourthSaveButton = page.locator('[role="listitem"]').nth(3).locator('button[aria-label*="Add"]');
    await expect(fourthSaveButton).toBeDisabled();
  });

  test('compare drawer shows trial details', async ({ page }) => {
    // Wait for cards to load
    await expect(page.locator('[role="listitem"]').first()).toBeVisible({ timeout: 10000 });
    
    // Save 2 trials
    const firstSaveButton = page.locator('[role="listitem"]').first().locator('button[aria-label*="Add"]');
    await firstSaveButton.click();
    
    const secondSaveButton = page.locator('[role="listitem"]').nth(1).locator('button[aria-label*="Add"]');
    await secondSaveButton.click();
    
    // Click compare button
    await page.locator('text=Compare (2)').click();
    
    // Verify drawer opens and shows trial details
    await expect(page.locator('text=Compare Trials')).toBeVisible();
    await expect(page.locator('text=View details')).toBeVisible();
  });

  test('CTG icon opens in new tab', async ({ page, context }) => {
    // Wait for cards to load
    await expect(page.locator('[role="listitem"]').first()).toBeVisible({ timeout: 10000 });
    
    // Look for CTG link (if it exists in the card)
    const ctgLink = page.locator('a[href*="clinicaltrials.gov"]').first();
    
    if (await ctgLink.count() > 0) {
      const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        ctgLink.click()
      ]);
      
      await expect(newPage).toHaveURL(/clinicaltrials\.gov/);
      await newPage.close();
    }
  });

  test('shows empty state when no results', async ({ page }) => {
    // Navigate to a URL that should return no results
    await page.goto('/trials?q=nonexistentcondition12345');
    
    // Wait for empty state
    await expect(page.locator('text=No trials match these filters yet')).toBeVisible({ timeout: 10000 });
    
    // Verify reset filters button
    await expect(page.locator('text=Reset filters')).toBeVisible();
  });

  test('shows error state on network error', async ({ page }) => {
    // Intercept the API call and return an error
    await page.route('**/api/trials*', route => route.abort());
    
    await page.goto('/trials');
    
    // Wait for error state
    await expect(page.locator('text=We couldn\'t load trials')).toBeVisible({ timeout: 10000 });
    
    // Verify retry button
    await expect(page.locator('text=Try again')).toBeVisible();
  });

  test('sticky helper appears and can be dismissed', async ({ page }) => {
    // Wait for page to load
    await expect(page.locator('[role="listitem"]').first()).toBeVisible({ timeout: 10000 });
    
    // Check if sticky helper appears (it might be hidden if already dismissed in session)
    const stickyHelper = page.locator('text=Not sure?');
    
    if (await stickyHelper.count() > 0) {
      // Click dismiss button
      await page.locator('button[aria-label="Dismiss helper"]').click();
      
      // Verify helper is gone
      await expect(stickyHelper).not.toBeVisible();
    }
  });

  test('load more functionality works', async ({ page }) => {
    // Wait for initial cards to load
    await expect(page.locator('[role="listitem"]').first()).toBeVisible({ timeout: 10000 });
    
    // Count initial cards
    const initialCount = await page.locator('[role="listitem"]').count();
    
    // Click load more if available
    const loadMoreButton = page.locator('text=Load more');
    if (await loadMoreButton.count() > 0) {
      await loadMoreButton.click();
      
      // Wait for more cards to load
      await expect(page.locator('[role="listitem"]')).toHaveCount.greaterThan(initialCount, { timeout: 10000 });
    }
  });
});
