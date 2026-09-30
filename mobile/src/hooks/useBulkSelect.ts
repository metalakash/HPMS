/**
 * useBulkSelect Hook
 * Manage item selection state for bulk operations
 */

import { useState, useCallback, useMemo } from 'react';

interface Item {
  id: string;
  title: string;
  type: string;
  status: string;
}

export const useBulkSelect = (items: Item[], maxSelectable: number = 1000) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedItems = useMemo(() => {
    return items.filter(i => selectedIds.has(i.id));
  }, [items, selectedIds]);

  const isSelected = useCallback((id: string): boolean => {
    return selectedIds.has(id);
  }, [selectedIds]);

  const toggleItem = useCallback((id: string): void => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        if (newSet.size < maxSelectable) {
          newSet.add(id);
        }
      }
      return newSet;
    });
  }, [maxSelectable]);

  const selectAll = useCallback((): void => {
    const allIds = new Set(items.slice(0, maxSelectable).map(i => i.id));
    setSelectedIds(allIds);
  }, [items, maxSelectable]);

  const clearSelection = useCallback((): void => {
    setSelectedIds(new Set());
  }, []);

  const selectByType = useCallback((type: string): void => {
    const typeItems = items.filter(i => i.type === type);
    const newSet = new Set(typeItems.slice(0, maxSelectable).map(i => i.id));
    setSelectedIds(newSet);
  }, [items, maxSelectable]);

  const deselectByType = useCallback((type: string): void => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      items.forEach(item => {
        if (item.type === type) {
          newSet.delete(item.id);
        }
      });
      return newSet;
    });
  }, [items]);

  const toggleByType = useCallback((type: string): void => {
    const typeItems = items.filter(i => i.type === type);
    const allTypeItemsSelected = typeItems.every(i => selectedIds.has(i.id));

    if (allTypeItemsSelected) {
      deselectByType(type);
    } else {
      selectByType(type);
    }
  }, [items, selectedIds, selectByType, deselectByType]);

  const isMaxReached = selectedIds.size >= maxSelectable;

  const canSelectMore = useCallback((count: number): boolean => {
    return selectedIds.size + count <= maxSelectable;
  }, [selectedIds.size, maxSelectable]);

  return {
    selectedIds,
    selectedItems,
    count: selectedIds.size,
    isSelected,
    toggleItem,
    selectAll,
    clearSelection,
    selectByType,
    deselectByType,
    toggleByType,
    isMaxReached,
    canSelectMore,
    hasSelection: selectedIds.size > 0,
    allSelected: selectedIds.size === items.length && items.length > 0,
    reset: clearSelection,
  };
};
