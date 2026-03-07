/**
 * PreConnectionChecklist Component
 * 
 * Displays Instagram Business account requirements before initiating OAuth.
 * Users must check all required items before proceeding with the connection.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import { useState, useEffect } from 'react';
import type { ChecklistItem } from '../types';

interface PreConnectionChecklistProps {
  onProceed: () => void;
  onShowInstructions: () => void;
}

const CHECKLIST_ITEMS: Omit<ChecklistItem, 'checked'>[] = [
  {
    id: 'business_account',
    label: 'Instagram Business or Creator Account',
    description: 'Your Instagram account must be converted to a Business or Creator account type. Personal accounts cannot be connected via API.',
    required: true,
  },
  {
    id: 'facebook_page',
    label: 'Linked to Facebook Page',
    description: 'Your Instagram Business account must be connected to a Facebook Page. This is required by Instagram\'s API.',
    required: true,
  },
  {
    id: 'admin_access',
    label: 'Admin Access to Facebook Page',
    description: 'You must have admin-level access to the Facebook Page that your Instagram account is linked to.',
    required: true,
  },
];

export function PreConnectionChecklist({ onProceed, onShowInstructions }: PreConnectionChecklistProps) {
  const STORAGE_KEY = 'instagram-connection-checklist';

  const [items, setItems] = useState<ChecklistItem[]>(() => {
    // Try to restore from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with default items to ensure we have all items
        return CHECKLIST_ITEMS.map(item => {
          const storedItem = parsed.find((p: ChecklistItem) => p.id === item.id);
          return storedItem ? { ...item, checked: storedItem.checked } : { ...item, checked: false };
        });
      }
    } catch (error) {
      console.error('Failed to restore checklist state:', error);
    }
    // Initialize with unchecked items
    return CHECKLIST_ITEMS.map(item => ({ ...item, checked: false }));
  });

  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Check if all required items are checked
  const allRequiredChecked = items
    .filter(item => item.required)
    .every(item => item.checked);

  // Save to localStorage whenever items change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save checklist state:', error);
    }
  }, [items]);

  const handleCheckboxChange = (id: string) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const toggleExpanded = (id: string) => {
    setExpandedItem(prev => (prev === id ? null : id));
  };

  const handleProceed = () => {
    // Clear checklist state when proceeding (will be restored on success)
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear checklist state:', error);
    }
    onProceed();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Before You Connect Instagram
        </h2>
        <p className="text-gray-600">
          Please verify that your Instagram account meets these requirements:
        </p>
      </div>

      <div className="space-y-4 mb-6">
        {items.map(item => (
          <div
            key={item.id}
            className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id={item.id}
                checked={item.checked}
                onChange={() => handleCheckboxChange(item.id)}
                className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="flex-1">
                <label
                  htmlFor={item.id}
                  className="block text-sm font-medium text-gray-900 cursor-pointer"
                >
                  {item.label}
                  {item.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                
                <button
                  type="button"
                  onClick={() => toggleExpanded(item.id)}
                  className="text-sm text-blue-600 hover:text-blue-700 mt-1"
                >
                  {expandedItem === item.id ? 'Hide details' : 'Show details'}
                </button>

                {expandedItem === item.id && (
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onShowInstructions}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Need Help? View Setup Instructions
        </button>

        <button
          type="button"
          onClick={handleProceed}
          disabled={!allRequiredChecked}
          className={`
            px-6 py-2.5 rounded-lg font-medium text-sm transition-colors
            ${
              allRequiredChecked
                ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          Proceed to Connect
        </button>
      </div>

      {!allRequiredChecked && (
        <p className="mt-4 text-sm text-gray-500 text-center">
          Please check all required items to continue
        </p>
      )}
    </div>
  );
}
