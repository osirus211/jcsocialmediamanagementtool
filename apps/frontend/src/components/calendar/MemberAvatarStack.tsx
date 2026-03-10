import React from 'react';
import { Post } from '@/types/post.types';

interface MemberInfo {
  _id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

interface MemberAvatarStackProps {
  posts: Post[];
  maxAvatars?: number;
}

/**
 * Generate consistent color from user ID hash
 */
const generateMemberColor = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 50%)`;
};

export const MemberAvatarStack: React.FC<MemberAvatarStackProps> = ({
  posts,
  maxAvatars = 3,
}) => {
  // Extract unique authors from posts
  const uniqueAuthors = React.useMemo(() => {
    const authorsMap = new Map<string, MemberInfo>();
    
    posts.forEach(post => {
      const createdBy = post.createdBy;
      if (typeof createdBy === 'object' && createdBy) {
        const author = createdBy as MemberInfo;
        if (!authorsMap.has(author._id)) {
          authorsMap.set(author._id, author);
        }
      }
    });
    
    return Array.from(authorsMap.values());
  }, [posts]);

  // Don't show if only one member or no posts
  if (uniqueAuthors.length <= 1) {
    return null;
  }

  const visibleAuthors = uniqueAuthors.slice(0, maxAvatars);
  const remainingCount = Math.max(0, uniqueAuthors.length - maxAvatars);
  const allAuthorNames = uniqueAuthors.map(author => `${author.firstName} ${author.lastName}`).join(', ');

  return (
    <div 
      className="flex items-center -space-x-1 mt-1"
      title={`Posts by: ${allAuthorNames}`}
    >
      {visibleAuthors.map((author, index) => {
        const memberColor = generateMemberColor(author._id);
        
        return (
          <div
            key={author._id}
            className="w-4 h-4 rounded-full border border-white flex items-center justify-center text-xs font-medium"
            style={{ 
              backgroundColor: memberColor,
              color: 'white',
              zIndex: maxAvatars - index
            }}
          >
            {author.avatar ? (
              <img
                src={author.avatar}
                alt={author.firstName}
                className="w-4 h-4 rounded-full"
              />
            ) : (
              author.firstName.charAt(0).toUpperCase()
            )}
          </div>
        );
      })}
      
      {remainingCount > 0 && (
        <div
          className="w-4 h-4 rounded-full border border-white bg-gray-400 flex items-center justify-center text-xs font-medium text-white"
          style={{ zIndex: 0 }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};