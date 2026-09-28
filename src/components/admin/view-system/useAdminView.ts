import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type ViewMode = 'table' | 'grid' | 'kanban' | 'split';

export interface UseAdminViewOptions<T> {
  defaultMode?: ViewMode;
  storageKey?: string;
  defaultTab?: string;
  defaultSortField?: string;
  defaultSortDirection?: 'asc' | 'desc';
}

export function useAdminView<T = any>(options: UseAdminViewOptions<T> = {}) {
  const {
    defaultMode = 'table',
    storageKey,
    defaultTab = 'all',
    defaultSortField = 'created_at',
    defaultSortDirection = 'desc',
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();

  // 1. View Mode (Table / Grid / Kanban / Split)
  const initialMode = useMemo(() => {
    const fromUrl = searchParams.get('view') as ViewMode | null;
    if (fromUrl && ['table', 'grid', 'kanban', 'split'].includes(fromUrl)) return fromUrl;
    if (storageKey) {
      try {
        const stored = localStorage.getItem(`${storageKey}_view_mode`) as ViewMode | null;
        if (stored && ['table', 'grid', 'kanban', 'split'].includes(stored)) return stored;
      } catch {
        /* ignore */
      }
    }
    return defaultMode;
  }, [searchParams, storageKey, defaultMode]);

  const [viewMode, setViewModeState] = useState<ViewMode>(initialMode);

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      if (storageKey) {
        try {
          localStorage.setItem(`${storageKey}_view_mode`, mode);
        } catch {
          /* ignore */
        }
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('view', mode);
        return next;
      });
    },
    [setSearchParams, storageKey]
  );

  // 2. Search Query
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('q') || '');

  const updateSearchQuery = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (query.trim()) {
          next.set('q', query.trim());
        } else {
          next.delete('q');
        }
        return next;
      });
    },
    [setSearchParams]
  );

  // 3. Active Segment Tab
  const [activeTab, setActiveTabState] = useState<string>(() => searchParams.get('tab') || defaultTab);

  const setActiveTab = useCallback(
    (tab: string) => {
      setActiveTabState(tab);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (tab !== defaultTab) {
          next.set('tab', tab);
        } else {
          next.delete('tab');
        }
        return next;
      });
    },
    [setSearchParams, defaultTab]
  );

  // 4. Entity Inspector (slide-over drawer)
  const [selectedEntity, setSelectedEntity] = useState<T | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const inspectEntity = useCallback((entity: T | null) => {
    setSelectedEntity(entity);
    setIsDrawerOpen(!!entity);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedEntity(null);
  }, []);

  // 5. Bulk Selection Checkboxes
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelectId = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // 6. Sorting
  const [sortField, setSortField] = useState<string>(defaultSortField);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);

  const toggleSort = useCallback((field: string) => {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortDirection((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortDirection('asc');
      return field;
    });
  }, []);

  return {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery: updateSearchQuery,
    activeTab,
    setActiveTab,
    selectedEntity,
    inspectEntity,
    isDrawerOpen,
    closeDrawer,
    selectedIds,
    toggleSelectId,
    selectAll,
    clearSelection,
    sortField,
    sortDirection,
    toggleSort,
  };
}
