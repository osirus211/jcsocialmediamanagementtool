import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Folder, 
  FolderOpen, 
  Plus, 
  MoreHorizontal, 
  Edit2, 
  Trash2,
  ChevronRight,
  ChevronDown,
  Palette,
  Image as ImageIcon,
  Clock,
  FolderX,
  Move
} from 'lucide-react';

export interface MediaFolderNode {
  id: string;
  name: string;
  color: string;
  icon: string;
  mediaCount: number;
  parentFolderId: string | null;
  children: MediaFolderNode[];
  createdAt: Date;
  updatedAt: Date;
}

interface MediaFolderTreeProps {
  folders: MediaFolderNode[];
  currentFolderId?: string;
  onFolderSelect: (folderId?: string) => void;
  onCreateFolder: (name: string, parentId?: string, color?: string, icon?: string) => void;
  onUpdateFolder: (folderId: string, updates: { name?: string; color?: string; icon?: string; parentFolderId?: string }) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveMedia: (mediaIds: string[], folderId?: string) => void;
  className?: string;
}

const FOLDER_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6B7280', // Gray
];

const FOLDER_ICONS = [
  'folder',
  'folder-open',
  'image',
  'video',
  'file',
  'star',
  'heart',
  'bookmark',
  'tag',
  'archive',
];

export function MediaFolderTree({
  folders,
  currentFolderId,
  onFolderSelect,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onMoveMedia,
  className = '',
}: MediaFolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState({ name: '', color: '', icon: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | undefined>();
  const [newFolderData, setNewFolderData] = useState({ name: '', color: '#3B82F6', icon: 'folder' });
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const toggleExpanded = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  const handleCreateFolder = useCallback(() => {
    if (newFolderData.name.trim()) {
      onCreateFolder(
        newFolderData.name.trim(),
        createParentId,
        newFolderData.color,
        newFolderData.icon
      );
      setNewFolderData({ name: '', color: '#3B82F6', icon: 'folder' });
      setShowCreateForm(false);
      setCreateParentId(undefined);
    }
  }, [newFolderData, createParentId, onCreateFolder]);

  const handleEditStart = useCallback((folder: MediaFolderNode) => {
    setEditingFolderId(folder.id);
    setEditingData({
      name: folder.name,
      color: folder.color,
      icon: folder.icon,
    });
  }, []);

  const handleEditSubmit = useCallback(() => {
    if (editingFolderId && editingData.name.trim()) {
      onUpdateFolder(editingFolderId, {
        name: editingData.name.trim(),
        color: editingData.color,
        icon: editingData.icon,
      });
      setEditingFolderId(null);
      setEditingData({ name: '', color: '', icon: '' });
    }
  }, [editingFolderId, editingData, onUpdateFolder]);

  const handleEditCancel = useCallback(() => {
    setEditingFolderId(null);
    setEditingData({ name: '', color: '', icon: '' });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, folderId?: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolderId(folderId || null);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverFolderId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, folderId?: string) => {
    e.preventDefault();
    setDragOverFolderId(null);
    
    try {
      const mediaIds = JSON.parse(e.dataTransfer.getData('application/json'));
      if (Array.isArray(mediaIds)) {
        onMoveMedia(mediaIds, folderId);
      }
    } catch (error) {
      console.error('Failed to parse dropped data:', error);
    }
  }, [onMoveMedia]);

  // Default folders
  const defaultFolders = [
    { 
      id: undefined, 
      name: 'All Media', 
      icon: 'image', 
      color: '#6B7280',
      mediaCount: folders.reduce((sum, f) => sum + f.mediaCount, 0),
      isDefault: true 
    },
    { 
      id: 'recent', 
      name: 'Recent', 
      icon: 'clock', 
      color: '#10B981',
      mediaCount: 0,
      isDefault: true 
    },
    { 
      id: 'unorganized', 
      name: 'Unorganized', 
      icon: 'folder-x', 
      color: '#F59E0B',
      mediaCount: 0,
      isDefault: true 
    },
  ];

  return (
    <div className={`bg-white border-r border-gray-200 h-full overflow-y-auto ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">Media Library</h3>
          <button
            onClick={() => {
              setShowCreateForm(true);
              setCreateParentId(undefined);
            }}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            title="Create folder"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Create Folder Form */}
        {showCreateForm && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Folder name"
                value={newFolderData.name}
                onChange={(e) => setNewFolderData(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') setShowCreateForm(false);
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
              
              {/* Color Picker */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
                <div className="flex gap-1">
                  {FOLDER_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewFolderData(prev => ({ ...prev, color }))}
                      className={`w-6 h-6 rounded-full border-2 ${
                        newFolderData.color === color ? 'border-gray-400' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Icon Picker */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Icon</label>
                <div className="flex gap-1 flex-wrap">
                  {FOLDER_ICONS.map(iconName => (
                    <button
                      key={iconName}
                      onClick={() => setNewFolderData(prev => ({ ...prev, icon: iconName }))}
                      className={`p-1 rounded border ${
                        newFolderData.icon === iconName 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <FolderIcon name={iconName} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderData.name.trim()}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Default Folders */}
        <div className="space-y-1 mb-4">
          {defaultFolders.map((folder) => (
            <DefaultFolderItem
              key={folder.id || 'all'}
              folder={folder}
              isSelected={currentFolderId === folder.id}
              onClick={() => onFolderSelect(folder.id)}
              onDragOver={(e) => handleDragOver(e, folder.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, folder.id)}
              isDragOver={dragOverFolderId === (folder.id || null)}
            />
          ))}
        </div>

        {/* Custom Folders */}
        {folders.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Custom Folders
            </h4>
            <div className="space-y-1">
              {folders.map((folder) => (
                <FolderTreeNode
                  key={folder.id}
                  folder={folder}
                  level={0}
                  isSelected={currentFolderId === folder.id}
                  isExpanded={expandedFolders.has(folder.id)}
                  isEditing={editingFolderId === folder.id}
                  editingData={editingData}
                  isDragOver={dragOverFolderId === folder.id}
                  onToggleExpanded={() => toggleExpanded(folder.id)}
                  onSelect={() => onFolderSelect(folder.id)}
                  onEdit={() => handleEditStart(folder)}
                  onEditSubmit={handleEditSubmit}
                  onEditCancel={handleEditCancel}
                  onEditDataChange={setEditingData}
                  onDelete={() => onDeleteFolder(folder.id)}
                  onCreateChild={() => {
                    setCreateParentId(folder.id);
                    setShowCreateForm(true);
                  }}
                  onDragOver={(e) => handleDragOver(e, folder.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, folder.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface DefaultFolderItemProps {
  folder: {
    id?: string;
    name: string;
    icon: string;
    color: string;
    mediaCount: number;
    isDefault: boolean;
  };
  isSelected: boolean;
  isDragOver: boolean;
  onClick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

function DefaultFolderItem({
  folder,
  isSelected,
  isDragOver,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: DefaultFolderItemProps) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-all ${
        isSelected 
          ? 'bg-blue-50 text-blue-700 border border-blue-200' 
          : 'text-gray-700 hover:bg-gray-50'
      } ${isDragOver ? 'bg-blue-100 border-2 border-blue-300 border-dashed' : ''}`}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <FolderIcon 
        name={folder.icon} 
        className={`w-4 h-4 flex-shrink-0`}
        style={{ color: folder.color }}
      />
      <span className="text-sm font-medium flex-1">{folder.name}</span>
      {folder.mediaCount > 0 && (
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {folder.mediaCount}
        </span>
      )}
    </div>
  );
}

interface FolderTreeNodeProps {
  folder: MediaFolderNode;
  level: number;
  isSelected: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  editingData: { name: string; color: string; icon: string };
  isDragOver: boolean;
  onToggleExpanded: () => void;
  onSelect: () => void;
  onEdit: () => void;
  onEditSubmit: () => void;
  onEditCancel: () => void;
  onEditDataChange: (data: { name: string; color: string; icon: string }) => void;
  onDelete: () => void;
  onCreateChild: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

function FolderTreeNode({
  folder,
  level,
  isSelected,
  isExpanded,
  isEditing,
  editingData,
  isDragOver,
  onToggleExpanded,
  onSelect,
  onEdit,
  onEditSubmit,
  onEditCancel,
  onEditDataChange,
  onDelete,
  onCreateChild,
  onDragOver,
  onDragLeave,
  onDrop,
}: FolderTreeNodeProps) {
  const [showMenu, setShowMenu] = useState(false);
  const hasChildren = folder.children.length > 0;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-all ${
          isSelected 
            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
            : 'text-gray-700 hover:bg-gray-50'
        } ${isDragOver ? 'bg-blue-100 border-2 border-blue-300 border-dashed' : ''}`}
        style={{ paddingLeft: `${8 + level * 16}px` }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpanded();
          }}
          className={`p-0.5 rounded hover:bg-gray-200 ${!hasChildren ? 'invisible' : ''}`}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )
          )}
        </button>

        {/* Folder Content */}
        <div className="flex items-center gap-2 flex-1 min-w-0" onClick={onSelect}>
          <FolderIcon 
            name={folder.icon} 
            className="w-4 h-4 flex-shrink-0"
            style={{ color: folder.color }}
          />
          
          {isEditing ? (
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={editingData.name}
                onChange={(e) => onEditDataChange({ ...editingData, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onEditSubmit();
                  if (e.key === 'Escape') onEditCancel();
                }}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                autoFocus
              />
              <div className="flex gap-1">
                {FOLDER_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditDataChange({ ...editingData, color });
                    }}
                    className={`w-4 h-4 rounded-full border ${
                      editingData.color === color ? 'border-gray-400' : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              <span className="text-sm truncate flex-1">{folder.name}</span>
              {folder.mediaCount > 0 && (
                <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {folder.mediaCount}
                </span>
              )}
            </>
          )}
        </div>

        {/* Actions Menu */}
        {!isEditing && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <MoreHorizontal className="w-3 h-3" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[140px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateChild();
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Plus className="w-3 h-3" />
                  Add Subfolder
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {folder.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              level={level + 1}
              isSelected={false} // Children selection handled separately
              isExpanded={false} // Children expansion handled separately
              isEditing={false}
              editingData={{ name: '', color: '', icon: '' }}
              isDragOver={false}
              onToggleExpanded={() => {}}
              onSelect={() => onSelect()}
              onEdit={() => {}}
              onEditSubmit={() => {}}
              onEditCancel={() => {}}
              onEditDataChange={() => {}}
              onDelete={() => {}}
              onCreateChild={() => {}}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FolderIconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

function FolderIcon({ name, className, style }: FolderIconProps) {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    'folder': Folder,
    'folder-open': FolderOpen,
    'image': ImageIcon,
    'clock': Clock,
    'folder-x': FolderX,
    'move': Move,
  };

  const IconComponent = iconMap[name] || Folder;
  return <IconComponent className={className} style={style} />;
}