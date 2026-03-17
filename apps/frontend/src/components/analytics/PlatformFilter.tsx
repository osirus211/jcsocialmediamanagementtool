import { useState } from 'react';
import { Filter, X } from 'lucide-react';

interface Platform {
  id: string;
  name: string;
  icon: string;
}

interface PlatformFilterProps {
  platforms: Platform[];
  selectedPlatforms: string[];
  onChange: (platforms: string[]) => void;
}

export function PlatformFilter({ platforms, selectedPlatforms, onChange }: PlatformFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePlatformToggle = (platformId: string) => {
    const newSelection = selectedPlatforms.includes(platformId)
      ? selectedPlatforms.filter(id => id !== platformId)
      : [...selectedPlatforms, platformId];
    
    // Ensure at least one platform remains selected
    if (newSelection.length === 0) {
      return;
    }
    
    onChange(newSelection);
  };

  const handleSelectAll = () => {
    onChange([]);
    setIsOpen(false);
  };

  const handleClearAll = () => {
    // Keep at least one platform selected
    if (platforms.length > 0) {
      onChange([platforms[0].id]);
    }
  };

  const getDisplayText = () => {
    if (selectedPlatforms.length === 0) {
      return 'All platforms';
    }
    if (selectedPlatforms.length === 1) {
      const platform = platforms.find(p => p.id === selectedPlatforms[0]);
      return platform ? platform.name : 'Unknown platform';
    }
    return `${selectedPlatforms.length} platforms`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        aria-label="Filter by platform"
      >
        <Filter className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium">{getDisplayText()}</span>
        {selectedPlatforms.length > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-blue-600 rounded-full">
            {selectedPlatforms.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">Filter Platforms</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    All
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {platforms.map((platform) => {
                  const isSelected = selectedPlatforms.length === 0 || selectedPlatforms.includes(platform.id);
                  const isLastSelected = selectedPlatforms.length === 1 && selectedPlatforms.includes(platform.id);
                  
                  return (
                    <label
                      key={platform.id}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handlePlatformToggle(platform.id)}
                        disabled={isLastSelected}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="text-lg" role="img" aria-label={platform.name}>
                        {platform.icon}
                      </span>
                      <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                        {platform.name}
                      </span>
                    </label>
                  );
                })}
              </div>

              {selectedPlatforms.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <div className="text-xs text-gray-500 mb-2">Selected platforms:</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedPlatforms.map((platformId) => {
                      const platform = platforms.find(p => p.id === platformId);
                      if (!platform) return null;
                      
                      return (
                        <span
                          key={platformId}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md"
                        >
                          <span role="img" aria-label={platform.name}>{platform.icon}</span>
                          {platform.name}
                          {selectedPlatforms.length > 1 && (
                            <button
                              onClick={() => handlePlatformToggle(platformId)}
                              className="ml-1 hover:text-blue-900"
                              aria-label={`Remove ${platform.name} filter`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}