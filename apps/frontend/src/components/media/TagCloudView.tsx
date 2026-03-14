import { useMemo } from 'react';
import { Hash } from 'lucide-react';

interface TagCloudViewProps {
  tags: Array<{
    name: string;
    count: number;
  }>;
  selectedTag?: string;
  onTagClick: (tag: string) => void;
  maxTags?: number;
}

export function TagCloudView({ 
  tags, 
  selectedTag, 
  onTagClick, 
  maxTags = 50 
}: TagCloudViewProps) {
  const sortedTags = useMemo(() => {
    return tags
      .sort((a, b) => b.count - a.count)
      .slice(0, maxTags);
  }, [tags, maxTags]);

  const getTagSize = (count: number, maxCount: number): string => {
    const ratio = count / maxCount;
    if (ratio > 0.8) return 'text-lg';
    if (ratio > 0.6) return 'text-base';
    if (ratio > 0.4) return 'text-sm';
    return 'text-xs';
  };

  const maxCount = Math.max(...sortedTags.map(t => t.count));

  if (sortedTags.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Hash className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p>No tags yet</p>
        <p className="text-sm">Add tags to your media to see them here</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Tag Cloud</h3>
      
      <div className="flex flex-wrap gap-2">
        {sortedTags.map((tag) => (
          <button
            key={tag.name}
            onClick={() => onTagClick(tag.name)}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full transition-all hover:scale-105 ${
              selectedTag === tag.name
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${getTagSize(tag.count, maxCount)}`}
          >
            <Hash className="w-3 h-3" />
            {tag.name}
            <span className="ml-1 text-xs opacity-75">
              {tag.count}
            </span>
          </button>
        ))}
      </div>
      
      {tags.length > maxTags && (
        <p className="text-sm text-gray-500 mt-3">
          Showing top {maxTags} of {tags.length} tags
        </p>
      )}
    </div>
  );
}