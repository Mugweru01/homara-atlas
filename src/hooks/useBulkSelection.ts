import { useState, useCallback } from 'react';

export function useBulkSelection<T extends { id: string }>() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const toggleAll = useCallback((items: T[]) => {
    setSelectedIds(prev => {
      const allIds = items.map(item => item.id);
      const allSelected = allIds.every(id => prev.has(id));
      
      if (allSelected) {
        return new Set();
      } else {
        return new Set(allIds);
      }
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  const isAllSelected = useCallback((items: T[]) => {
    if (items.length === 0) return false;
    return items.every(item => selectedIds.has(item.id));
  }, [selectedIds]);

  return {
    selectedIds: Array.from(selectedIds),
    selectedCount: selectedIds.size,
    toggleSelection,
    toggleAll,
    clearSelection,
    isSelected,
    isAllSelected,
  };
}

