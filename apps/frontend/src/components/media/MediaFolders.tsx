import { useState, useCallback } from 'react';
import { 
  Folder, 
  FolderOpen, 
  Plus, 
  MoreHorizontal, 
  Edit2, 
  Trash2,
  Clock,
  Image as ImageIcon
} from 'lucide-react';

export interface MediaFolder {
  id: string;
  name: string;
  parentFolderId?: string;
  mediaCount: number;
  createdAt: Date;
}

interface MediaFoldersProps {
  folders: MediaFolder[];
  currentFolderId?: string;
  onFolderSelect: (folderId?: string) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onDeleteFolder: (folderId: string) => void;
}

export function MediaFolders({
  folders,
  currentFolderId,
  onFolderSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: MediaFoldersProps) {
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleCreateFolder = useCallback(() => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setShowCreateForm(false);
    }
  }, [newFolderName, onCreateFolder]);

  const handleRenameStart = useCallback((folder: MediaFolder) => {
    setEditingFolderId(folder.id);
    setEditingName(folder.name);
  }, []);

  const handleRenameSubmit = useCallback(() => {
    if (editingFolderId && editingName.trim()) {
      onRenameFolder(editingFolderId, editingName.trim());
      setEditingFolderId(null);
      setEditingName('');
    }
  }, [editingFolderId, editingName, onRenameFolder]);

  const handleRenameCancel = useCallback(() => {
    setEditingFolderId(null);
    setEditingName('');
  }, []);

  // Default folders
  const defaultFolders = [
    { id: undefined, name: 'All Media', icon: ImageIcon, isDefault: true },
    { id: 'recent', name: 'Recent', icon: Clock, isDefault: true },
    { id: 'unorganized', name: 'Unorganized', icon: Folder, isDefault: true },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">Folders</h3>
          <button
            onClick={() => setShowCreateForm(true)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Create Folder Form */}
        {showCreateForm && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setShowCreateForm(false);
              }}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded mb-2"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateFolder}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Default Folders */}
        <div className="space-y-1 mb-4">
          {defaultFolders.map((folder) => (
            <FolderItem
              key={folder.id || 'all'}
              folder={{
                id: folder.id || '',
                name: folder.name,
                mediaCount: folder.id === undefined ? folders.reduce((sum, f) => sum + f.mediaCount, 0) : 0,
                createdAt: new Date(),
              }}
              icon={folder.icon}
              isSelected={currentFolderId === folder.id}
              isDefault={folder.isDefault}
              onClick={() => onFolderSelect(folder.id)}
            />
          ))}
        </div>

        {/* Custom Folders */}
        {folders.length > 0 && (
          <>
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Custom Folders
              </h4>
              <div className="space-y-1">
                {folders.map((folder) => (
                  <FolderItem
                    key={folder.id}
                    folder={folder}
                    isSelected={currentFolderId === folder.id}
                    isEditing={editingFolderId === folder.id}
                    editingName={editingName}
                    onEditingNameChange={setEditingName}
                    onClick={() => onFolderSelect(folder.id)}
                    onRename={() => handleRenameStart(folder)}
                    onRenameSubmit={handleRenameSubmit}
                    onRenameCancel={handleRenameCancel}
                    onDelete={() => onDeleteFolder(folder.id)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface FolderItemProps {
  folder: MediaFolder;
  icon?: React.ComponentType<{ className?: string }>;
  isSelected?: boolean;
  isDefault?: boolean;
  isEditing?: boolean;
  editingName?: string;
  onEditingNameChange?: (name: string) => void;
  onClick: () => void;
  onRename?: () => void;
  onRenameSubmit?: () => void;
  onRenameCancel?: () => void;
  onDelete?: () => void;
}

function FolderItem({
  folder,
  icon: Icon = Folder,
  isSelected,
  isDefault,
  isEditing,
  editingName,
  onEditingNameChange,
  onClick,
  onRename,
  onRenameSubmit,
  onRenameCancel,
  onDelete,
}: FolderItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={`group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-blue-50 text-blue-700' 
          : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0" onClick={onClick}>
        <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
        
        {isEditing ? (
          <input
            type="text"
            value={editingName}
            onChange={(e) => onEditingNameChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameSubmit?.();
              if (e.key === 'Escape') onRenameCancel?.();
            }}
            onBlur={onRenameCancel}
            className="flex-1 px-1 py-0.5 text-sm border border-gray-300 rounded"
            autoFocus
          />
        ) : (
          <span className="text-sm truncate">{folder.name}</span>
        )}
        
        {folder.mediaCount > 0 && (
          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
            {folder.mediaCount}
          </span>
        )}
      </div>

      {!isDefault && !isEditing && (
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
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[120px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRename?.();
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit2 className="w-3 h-3" />
                Rename
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
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
  );
}