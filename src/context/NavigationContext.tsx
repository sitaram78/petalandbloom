import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getCache, setCache, removeCache } from '@/utils/cache';

export interface NavItem {
  id: string;
  label: string;
  path: string | null;
  parent_id: string | null;
  order: number;
  type: 'link' | 'dropdown';
}

interface NavigationContextType {
  navItems: NavItem[];
  loading: boolean;
  updateNavItem: (id: string, updates: Partial<NavItem>) => Promise<{ error?: Error }>;
  addNavItem: (item: Omit<NavItem, 'id'>) => Promise<{ error?: Error }>;
  deleteNavItem: (id: string) => Promise<{ error?: Error }>;
  refreshNavigation: () => Promise<void>;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNavigation = useCallback(async () => {
    setLoading(true);
    try {
      const cached = getCache<NavItem[]>('navigation_cache');
      if (cached) {
        setNavItems(cached);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('navigation')
        .select('*')
        .order('order', { ascending: true });

      if (error) throw error;
      if (data) {
        setNavItems(data);
        setCache('navigation_cache', data);
      } else {
        console.warn('No navigation data found in Supabase');
      }
    } catch (err: any) {
      console.error('Error fetching navigation:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNavigation();
  }, [fetchNavigation]);

  const updateNavItem = useCallback(async (id: string, updates: Partial<NavItem>) => {
    try {
      // Optimistic update: Update the state locally first
      setNavItems(prev => prev.map(item =>
        item.id === id ? { ...item, ...updates } : item
      ));

      const { data, error } = await supabase
        .from('navigation')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        console.warn('Update request sent, but 0 rows were changed. This is almost certainly due to Supabase RLS policies blocking the update.');
      }

      removeCache('navigation_cache');
      await fetchNavigation();
      return { error: null };
    } catch (err: any) {
      console.error('Error updating navigation item:', err);
      return { error: err };
    }
  }, [fetchNavigation]);

  const addNavItem = useCallback(async (item: Omit<NavItem, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('navigation')
        .insert([item])
        .select();
      if (error) throw error;

      if (data && data.length > 0) {
        setNavItems(prev => [...prev, data[0]].sort((a, b) => a.order - b.order));
      }

      removeCache('navigation_cache');
      await fetchNavigation();
      return { error: null };
    } catch (err: any) {
      console.error('Error adding navigation item:', err);
      return { error: err };
    }
  }, [fetchNavigation]);

  const deleteNavItem = useCallback(async (id: string) => {
    try {
      // Optimistic update: remove locally first
      setNavItems(prev => prev.filter(item => item.id !== id));

      const { error } = await supabase
        .from('navigation')
        .delete()
        .eq('id', id);
      if (error) throw error;

      removeCache('navigation_cache');
      await fetchNavigation();
      return { error: null };
    } catch (err: any) {
      console.error('Error deleting navigation item:', err);
      return { error: err };
    }
  }, [fetchNavigation]);

  const refreshNavigation = useCallback(async () => {
    removeCache('navigation_cache');
    await fetchNavigation();
  }, [fetchNavigation]);

  return (
    <NavigationContext.Provider value={{ navItems, loading, updateNavItem, addNavItem, deleteNavItem, refreshNavigation }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
