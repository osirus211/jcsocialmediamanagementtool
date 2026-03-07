/**
 * Property-Based Tests for PreConnectionChecklist
 * 
 * Feature: instagram-business-oauth-via-facebook
 * Property 1: Checklist completion enables OAuth
 * Validates: Requirements 1.4
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { PreConnectionChecklist } from '../PreConnectionChecklist';
import { checklistStateArbitrary } from '../../test/arbitraries';

describe('Feature: instagram-business-oauth-via-facebook, Property 1: Checklist completion enables OAuth', () => {
  afterEach(() => {
    cleanup();
  });

  it('should only enable proceed button when all required items are checked', () => {
    fc.assert(
      fc.property(checklistStateArbitrary, (checklistState) => {
        const onProceed = () => {};
        const onShowInstructions = () => {};

        const { container, unmount } = render(
          <PreConnectionChecklist
            onProceed={onProceed}
            onShowInstructions={onShowInstructions}
          />
        );

        // Get all checkboxes
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes).toHaveLength(3);

        // Simulate checking based on arbitrary state
        const businessAccountCheckbox = checkboxes[0] as HTMLInputElement;
        const facebookPageCheckbox = checkboxes[1] as HTMLInputElement;
        const adminAccessCheckbox = checkboxes[2] as HTMLInputElement;

        // Check boxes according to arbitrary state
        if (checklistState.businessAccount) businessAccountCheckbox.click();
        if (checklistState.facebookPageLinked) facebookPageCheckbox.click();
        if (checklistState.adminAccess) adminAccessCheckbox.click();

        // Get proceed button
        const proceedButton = container.querySelector('button[type="button"]:not([class*="text-blue-600"])') as HTMLButtonElement;

        // Property: Button should be enabled if and only if all items are checked
        const allChecked =
          checklistState.businessAccount &&
          checklistState.facebookPageLinked &&
          checklistState.adminAccess;

        if (allChecked) {
          expect(proceedButton).not.toBeDisabled();
        } else {
          expect(proceedButton).toBeDisabled();
        }

        // Cleanup
        unmount();
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain button state consistency across multiple check/uncheck operations', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          checkboxIndex: fc.integer({ min: 0, max: 2 }),
          shouldCheck: fc.boolean(),
        }), { minLength: 1, maxLength: 20 }),
        (operations) => {
          const onProceed = () => {};
          const onShowInstructions = () => {};

          const { container, unmount } = render(
            <PreConnectionChecklist
              onProceed={onProceed}
              onShowInstructions={onShowInstructions}
            />
          );

          const checkboxes = container.querySelectorAll('input[type="checkbox"]');
          const proceedButton = container.querySelector('button[type="button"]:not([class*="text-blue-600"])') as HTMLButtonElement;

          // Track expected state
          const checkedState = [false, false, false];

          // Apply operations
          operations.forEach(op => {
            const checkbox = checkboxes[op.checkboxIndex] as HTMLInputElement;
            const currentlyChecked = checkbox.checked;

            if (op.shouldCheck && !currentlyChecked) {
              checkbox.click();
              checkedState[op.checkboxIndex] = true;
            } else if (!op.shouldCheck && currentlyChecked) {
              checkbox.click();
              checkedState[op.checkboxIndex] = false;
            }
          });

          // Property: Button enabled state should match whether all are checked
          const allChecked = checkedState.every(state => state);
          
          if (allChecked) {
            expect(proceedButton).not.toBeDisabled();
          } else {
            expect(proceedButton).toBeDisabled();
          }

          // Cleanup
          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
