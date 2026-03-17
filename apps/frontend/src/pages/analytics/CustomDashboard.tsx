import React, { useState, useEffect, useCallback } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { Settings, RotateCcw, Plus } from 'lucide-react';
import { dashboardService } from '@/services/dashboard.service';
import { Widget, WidgetSize, WidgetType, DashboardLayout } from '@/types/dashboard.types';
import { WidgetWrapper } from '@/components/dashboard/WidgetWrapper';
import { WidgetRenderer } from '@/components/dashboard/WidgetRenderer';
import { AddWidgetPanel } from '@/components/dashboard/AddWidgetPanel';
import { ExportReportButton } from '@/components/analytics/ExportReportButton';
import { useWorkspaceStore } from '@/store/workspace.store';

export function CustomDashboard() {
  const { currentWorkspaceId } = useWorkspaceStore();
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (widgetsToSave: Widget[]) => {
      try {
        setIsSaving(true);
        await dashboardService.saveLayout(widgetsToSave);
      } catch (err) {
        console.error('Failed to save layout:', err);
        setError('Failed to dashboard layout');
      } finally {
        setIsSaving(false);
      }
    }, 1000),
    []
  );

  // Load layout on mount
  useEffect(() => {
    if (currentWorkspaceId) {
      loadLayout();
    }
  }, [currentWorkspaceId]);

  // Save layout when widgets change
  useEffect(() => {
    if (widgets.length > 0 && !isLoading) {
      debouncedSave(widgets);
    }
  }, [widgets, isLoading, debouncedSave]);

  const loadLayout = async () => {
    try {
      setIsLoading(true);
      const layoutData = await dashboardService.getLayout();
      setLayout(layoutData);
      setWidgets(layoutData.widgets || []);
    } catch (err) {
      console.error('Failed to load layout:', err);
      setError('Failed to load dashboard layout');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex(widget => widget.id === active.id);
      const newIndex = widgets.findIndex(widget => widget.id === over.id);

      const newWidgets = arrayMove(widgets, oldIndex, newIndex).map((widget, index) => ({
        ...widget,
        position: index,
      }));

      setWidgets(newWidgets);
    }
  };

  const handleSizeChange = (id: string, size: WidgetSize) => {
    setWidgets(prev => prev.map(widget => 
      widget.id === id ? { ...widget, size } : widget
    ));
  };

  const handleVisibilityChange = (id: string, isVisible: boolean) => {
    setWidgets(prev => prev.map(widget => 
      widget.id === id ? { ...widget, isVisible } : widget
    ));
  };

  const handleToggleWidget = (type: WidgetType, isVisible: boolean) => {
    setWidgets(prev => prev.map(widget => 
      widget.type === type ? { ...widget, isVisible } : widget
    ));
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset your dashboard to the default layout?')) {
      return;
    }

    try {
      setIsLoading(true);
      const layoutData = await dashboardService.resetLayout();
      setLayout(layoutData);
      setWidgets(layoutData.widgets || []);
    } catch (err) {
      console.error('Failed to reset layout:', err);
      setError('Failed to reset dashboard layout');
    } finally {
      setIsLoading(false);
    }
  };

  const visibleWidgets = widgets.filter(widget => widget.isVisible);
  const sortedWidgets = [...visibleWidgets].sort((a, b) => a.position - b.position);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="col-span-2 h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Customize your analytics dashboard with drag-and-drop widgets
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <ExportReportButton />
          
          <button
            onClick={() => setIsAddPanelOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Settings className="h-4 w-4" />
            Customize
          </button>
          
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      )}

      {/* Saving Indicator */}
      {isSaving && (
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
          Saving dashboard layout...
        </div>
      )}

      {/* Dashboard Grid */}
      {sortedWidgets.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
            <Plus className="h-full w-full" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Add widgets to get started</h3>
          <p className="text-gray-600 mb-4">
            Customize your dashboard by adding analytics widgets that matter most to you.
          </p>
          <button
            onClick={() => setIsAddPanelOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Widgets
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortedWidgets.map(w => w.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-6 auto-rows-min">
              {sortedWidgets.map((widget) => (
                <WidgetWrapper
                  key={widget.id}
                  widget={widget}
                  onSizeChange={handleSizeChange}
                  onVisibilityChange={handleVisibilityChange}
                >
                  <WidgetRenderer widget={widget} />
                </WidgetWrapper>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add Widget Panel */}
      <AddWidgetPanel
        isOpen={isAddPanelOpen}
        onClose={() => setIsAddPanelOpen(false)}
        widgets={widgets}
        onToggleWidget={handleToggleWidget}
      />
    </div>
  );
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}