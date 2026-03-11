import React, { useState, useEffect } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { Category, categoriesService } from '../../services/categories.service';

interface CategoryPickerProps {
  selectedCategoryId?: string;
  onSelect: (categoryId: string | undefined) => void;
  placeholder?: string;
  className?: string;
}

export default function CategoryPicker({
  selectedCategoryId,
  onSelect,
  placeholder = 'Select category',
  className = '',
}: CategoryPickerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const selectedCategory = categories.find(c => c._id === selectedCategoryId);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const data = await categoriesService.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (categoryId: string | undefined) => {
    onSelect(categoryId);
    setIsOpen(false);
  };

  const handleCreateNew = () => {
    // TODO: Open create category modal
    console.log('Create new category');
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white text-left hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedCategory ? (
            <>
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: selectedCategory.color }}
              />
              <span className="truncate">{selectedCategory.name}</span>
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selectedCategory && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(undefined);
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="px-3 py-2 text-gray-500">Loading...</div>
          ) : (
            <>
              {categories.length === 0 ? (
                <div className="px-3 py-2 text-gray-500">No categories found</div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleSelect(undefined)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 text-gray-500"
                  >
                    No category
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category._id}
                      type="button"
                      onClick={() => handleSelect(category._id)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="flex-1">{category.name}</span>
                      <span className="text-xs text-gray-400">
                        {category.postCount} posts
                      </span>
                    </button>
                  ))}
                </>
              )}
              <div className="border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-blue-600"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create new category</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}