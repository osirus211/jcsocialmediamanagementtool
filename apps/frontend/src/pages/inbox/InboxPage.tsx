import { useEffect, useState } from 'react';
import { useInboxStore, InboxItem } from '@/store/inbox.store';
import { useWorkspaceStore } from '@/store/workspace.store';

export default function InboxPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspace?._id);
  const {
    items,
    unreadCount,
    isLoading,
    error,
    activeFilter,
    activePlatform,
    activeSentiment,
    unreadOnly,
    isStreamConnected,
    fetchInbox,
    markAllRead,
    markItemRead,
    setFilter,
    setPlatform,
    setSentiment,
    setUnreadOnly,
    connectStream,
  } = useInboxStore();

  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (workspaceId) {
      fetchInbox(workspaceId, true);
      connectStream(workspaceId);
    }
  }, [workspaceId, activeFilter, activePlatform, activeSentiment, unreadOnly]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'j') {
        setCurrentIndex((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.key === 'k') {
        setCurrentIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'm' && workspaceId && items[currentIndex]) {
        markItemRead(workspaceId, items[currentIndex]._id, items[currentIndex].type);
      } else if (e.key === 'Escape') {
        setSelectedItem(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, items, workspaceId]);

  const handleMarkAllRead = () => {
    if (workspaceId) {
      markAllRead(workspaceId);
    }
  };

  const handleItemClick = (item: InboxItem, index: number) => {
    setSelectedItem(item);
    setCurrentIndex(index);
    if (workspaceId && !item.readAt) {
      markItemRead(workspaceId, item._id, item.type);
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    if (sentiment === 'positive') return 'bg-green-100 text-green-800';
    if (sentiment === 'negative') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (isLoading && items.length === 0) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>;
  }

  return (
    <div className="flex h-screen">
      {/* LEFT PANEL - Filters */}
      <div className="w-60 border-r p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>
        
        <div className="space-y-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`w-full text-left px-3 py-2 rounded ${activeFilter === 'all' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
          >
            All {unreadCount > 0 && `(${unreadCount})`}
          </button>
          <button
            onClick={() => setFilter('mention')}
            className={`w-full text-left px-3 py-2 rounded ${activeFilter === 'mention' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
          >
            Mentions
          </button>
          <button
            onClick={() => setFilter('comment')}
            className={`w-full text-left px-3 py-2 rounded ${activeFilter === 'comment' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
          >
            Comments
          </button>
          <button
            onClick={() => setFilter('notification')}
            className={`w-full text-left px-3 py-2 rounded ${activeFilter === 'notification' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
          >
            Notifications
          </button>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium mb-2">Sentiment</h3>
          <div className="space-y-1">
            {['positive', 'negative', 'neutral'].map((s) => (
              <button
                key={s}
                onClick={() => setSentiment(activeSentiment === s ? null : s as any)}
                className={`w-full text-left px-3 py-1 rounded text-sm ${activeSentiment === s ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
          <span className="text-sm">Unread only</span>
        </label>
      </div>

      {/* CENTER PANEL - Feed */}
      <div className="flex-1 flex flex-col">
        <div className="border-b p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold">Inbox</h1>
            {isStreamConnected && (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Live" />
            )}
            <span className="text-sm text-gray-500">{items.length} items</span>
          </div>
          <button
            onClick={handleMarkAllRead}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Mark all read
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" role="feed" aria-live="polite">
          {items.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No items in inbox</div>
          ) : (
            items.map((item, index) => (
              <div
                key={item._id}
                onClick={() => handleItemClick(item, index)}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${currentIndex === index ? 'bg-blue-50' : ''} ${!item.readAt ? 'font-semibold' : ''}`}
              >
                <div className="flex items-start space-x-3">
                  {!item.readAt && <span className="w-2 h-2 bg-blue-600 rounded-full mt-2" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs text-gray-500">{item.type}</span>
                      {item.platform && <span className="text-xs text-gray-500">{item.platform}</span>}
                      {item.sentiment && (
                        <span className={`text-xs px-2 py-0.5 rounded ${getSentimentColor(item.sentiment)}`}>
                          {item.sentiment}
                        </span>
                      )}
                    </div>
                    {item.author && (
                      <div className="text-sm text-gray-700 mb-1">
                        {item.author.displayName || item.author.username}
                      </div>
                    )}
                    <p className="text-sm text-gray-600 line-clamp-2">{item.content}</p>
                    {item.keyword && (
                      <span className="text-xs text-blue-600 mt-1 inline-block">
                        Keyword: {item.keyword}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL - Detail */}
      {selectedItem && (
        <div className="w-96 border-l p-4 overflow-y-auto">
          <button
            onClick={() => setSelectedItem(null)}
            className="mb-4 text-sm text-gray-600 hover:text-gray-900"
          >
            ← Close
          </button>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Content</h3>
              <p className="text-sm text-gray-700">{selectedItem.content}</p>
            </div>

            {selectedItem.author && (
              <div>
                <h3 className="font-semibold mb-2">Author</h3>
                <p className="text-sm">{selectedItem.author.displayName || selectedItem.author.username}</p>
                {selectedItem.author.profileUrl && (
                  <a
                    href={selectedItem.author.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View profile
                  </a>
                )}
              </div>
            )}

            {selectedItem.sentiment && (
              <div>
                <h3 className="font-semibold mb-2">Sentiment</h3>
                <span className={`text-sm px-2 py-1 rounded ${getSentimentColor(selectedItem.sentiment)}`}>
                  {selectedItem.sentiment}
                </span>
              </div>
            )}

            {selectedItem.sourceUrl && (
              <a
                href={selectedItem.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-2 text-sm bg-gray-100 text-center rounded hover:bg-gray-200"
              >
                View source
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
