import { Sparkles } from 'lucide-react';

interface AIToggleButtonProps {
  onClick: () => void;
  isActive: boolean;
  hasSuggestions?: boolean;
  disabled?: boolean;
}

export function AIToggleButton({
  onClick,
  isActive,
  hasSuggestions = false,
  disabled = false,
}: AIToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        relative px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2 min-h-[44px]
        ${isActive
          ? 'bg-purple-100 text-purple-700 border border-purple-300'
          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      aria-label={`${isActive ? 'Hide' : 'Show'} AI assistant`}
      aria-pressed={isActive}
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      <span>AI</span>
      
      {hasSuggestions && !isActive && (
        <div 
          className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full animate-pulse"
          aria-hidden="true"
        />
      )}
    </button>
  );
}