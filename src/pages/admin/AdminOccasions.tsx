import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  Check,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  Filter,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Tag,
  RefreshCw,
  LayoutGrid,
  Table as TableIcon,
  HelpCircle,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import AdminLayout from '@/components/AdminLayout';
import AdminViewHeader from '@/components/admin/view-system/AdminViewHeader';
import AdminEntityDrawer from '@/components/admin/view-system/AdminEntityDrawer';
import { useNotification } from '@/context/NotificationContext';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditClient';
import { formatPrice } from '@/data/products';
import {
  fetchOccasions,
  createOccasion,
  updateOccasion,
  deleteOccasion,
  fetchProductsForOccasionLinking,
  bulkLinkProductsToOccasion,
  generateSlug,
  productMatchesOccasion,
  type OccasionWithProductCount,
  type CatalogProductForLinking,
} from '@/services/occasionService';

const PRESET_EMOJIS = ['🪔', '❤️', '🎂', '🥂', '🌷', '💍', '🤝', '🪷', '✨', '🌸', '🎁', '🎉'];

export default function AdminOccasions() {
  const { showNotification } = useNotification();

  // Occasions State
  const [occasions, setOccasions] = useState<OccasionWithProductCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Occasion Create / Edit Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingOccasion, setEditingOccasion] = useState<OccasionWithProductCount | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formEmoji, setFormEmoji] = useState('🌸');
  const [formDescription, setFormDescription] = useState('');
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formBannerImageUrl, setFormBannerImageUrl] = useState('');
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Occasion Delete State
  const [occasionToDelete, setOccasionToDelete] = useState<OccasionWithProductCount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk Product Linker Drawer State
  const [linkingOccasion, setLinkingOccasion] = useState<OccasionWithProductCount | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProductForLinking[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedProductCodes, setSelectedProductCodes] = useState<Set<string>>(new Set());
  const [initialProductCodes, setInitialProductCodes] = useState<Set<string>>(new Set());
  const [drawerSearch, setDrawerSearch] = useState('');
  const [drawerCategoryFilter, setDrawerCategoryFilter] = useState('ALL');
  const [drawerViewFilter, setDrawerViewFilter] = useState<'ALL' | 'LINKED' | 'UNLINKED'>('ALL');
  const [savingLinks, setSavingLinks] = useState(false);

  // Load Occasions Catalog
  const loadOccasions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOccasions({ includeProductCount: true });
      setOccasions(data);
    } catch (err: any) {
      console.error('Error fetching occasions:', err);
      showNotification('Could not load occasions: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadOccasions();
  }, [loadOccasions]);

  // Derived KPIs
  const totalOccasions = occasions.length;
  const activeOccasions = occasions.filter((o) => o.is_active).length;
  const totalLinkedPieces = useMemo(() => {
    return occasions.reduce((acc, curr) => acc + (curr.product_count || 0), 0);
  }, [occasions]);

  // Filtered Occasions
  const filteredOccasions = useMemo(() => {
    return occasions.filter((occ) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        occ.name.toLowerCase().includes(query) ||
        occ.slug.toLowerCase().includes(query) ||
        (occ.description && occ.description.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && occ.is_active) ||
        (statusFilter === 'INACTIVE' && !occ.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [occasions, searchQuery, statusFilter]);

  // Handle Form Open (New / Edit)
  const openCreateModal = () => {
    setEditingOccasion(null);
    setFormName('');
    setFormSlug('');
    setFormEmoji('🌸');
    setFormDescription('');
    setFormDisplayOrder(occasions.length + 1);
    setFormIsActive(true);
    setFormBannerImageUrl('');
    setIsFormModalOpen(true);
  };

  const openEditModal = (occ: OccasionWithProductCount) => {
    setEditingOccasion(occ);
    setFormName(occ.name);
    setFormSlug(occ.slug);
    setFormEmoji(occ.emoji || '🌸');
    setFormDescription(occ.description || '');
    setFormDisplayOrder(occ.display_order || 0);
    setFormIsActive(occ.is_active);
    setFormBannerImageUrl(occ.banner_image_url || '');
    setIsFormModalOpen(true);
  };

  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!editingOccasion) {
      setFormSlug(generateSlug(val));
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBanner(true);
    try {
      const fileExt = file.name.split('.').pop();
      const cleanSlug = formSlug.trim() || generateSlug(formName) || 'temp';
      const fileName = `occasion-${cleanSlug}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `site-assets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('site-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('site-assets')
        .getPublicUrl(filePath);

      setFormBannerImageUrl(publicUrl);
      showNotification('Banner photo uploaded successfully!', 'success');
    } catch (err: any) {
      console.error('Error uploading banner image:', err);
      showNotification('Upload failed: ' + err.message, 'error');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSaveOccasion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showNotification('Please enter an occasion name.', 'warning');
      return;
    }

    const cleanSlug = formSlug.trim() || generateSlug(formName);
    const cleanBanner = formBannerImageUrl.trim() || null;
    setSavingForm(true);

    try {
      if (editingOccasion) {
        await updateOccasion(editingOccasion.id, {
          name: formName.trim(),
          slug: cleanSlug,
          emoji: formEmoji.trim() || '🌸',
          description: formDescription.trim() || null,
          banner_image_url: cleanBanner,
          display_order: Number(formDisplayOrder) || 0,
          is_active: formIsActive,
        });

        // Sync with site_assets key for Studio Visuals
        if (cleanBanner) {
          try {
            await supabase.from('site_assets').upsert({
              key: `occasion_${cleanSlug}_hero`,
              image_url: cleanBanner,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'key' });
          } catch (_) {}
        }

        logAudit({
          action: AUDIT_ACTIONS.SETTINGS_UPDATED,
          entity: 'occasions',
          entity_id: cleanSlug,
          new_values: { name: formName, slug: cleanSlug },
        });

        showNotification(`Updated occasion "${formName}"`, 'success');
      } else {
        await createOccasion({
          name: formName.trim(),
          slug: cleanSlug,
          emoji: formEmoji.trim() || '🌸',
          description: formDescription.trim() || null,
          banner_image_url: cleanBanner,
          display_order: Number(formDisplayOrder) || 0,
          is_active: formIsActive,
        });

        // Sync with site_assets key for Studio Visuals
        if (cleanBanner) {
          try {
            await supabase.from('site_assets').upsert({
              key: `occasion_${cleanSlug}_hero`,
              image_url: cleanBanner,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'key' });
          } catch (_) {}
        }

        logAudit({
          action: AUDIT_ACTIONS.SETTINGS_UPDATED,
          entity: 'occasions',
          entity_id: cleanSlug,
          new_values: { name: formName, slug: cleanSlug },
        });

        showNotification(`Created occasion "${formName}"`, 'success');
      }

      setIsFormModalOpen(false);
      await loadOccasions();
    } catch (err: any) {
      console.error('Error saving occasion:', err);
      showNotification('Failed to save occasion: ' + err.message, 'error');
    } finally {
      setSavingForm(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (occ: OccasionWithProductCount) => {
    const nextStatus = !occ.is_active;
    // Optimistic update
    setOccasions((prev) =>
      prev.map((o) => (o.id === occ.id ? { ...o, is_active: nextStatus } : o))
    );

    try {
      await updateOccasion(occ.id, { is_active: nextStatus });
      showNotification(
        `Occasion "${occ.name}" is now ${nextStatus ? 'active' : 'hidden'}`,
        'success'
      );
    } catch (err: any) {
      console.error('Error updating status:', err);
      // Revert
      setOccasions((prev) =>
        prev.map((o) => (o.id === occ.id ? { ...o, is_active: occ.is_active } : o))
      );
      showNotification('Could not update status: ' + err.message, 'error');
    }
  };

  // Delete occasion
  const handleDeleteOccasion = async () => {
    if (!occasionToDelete) return;
    setIsDeleting(true);
    try {
      await deleteOccasion(occasionToDelete.id);
      showNotification(`Deleted occasion "${occasionToDelete.name}"`, 'success');
      setOccasionToDelete(null);
      await loadOccasions();
    } catch (err: any) {
      console.error('Error deleting occasion:', err);
      showNotification('Could not delete occasion: ' + err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Bulk Linker Drawer
  const openBulkLinker = async (occ: OccasionWithProductCount) => {
    setLinkingOccasion(occ);
    setDrawerSearch('');
    setDrawerCategoryFilter('ALL');
    setDrawerViewFilter('ALL');
    setCatalogLoading(true);

    try {
      const products = await fetchProductsForOccasionLinking();
      setCatalogProducts(products);

      // Determine which products currently match this occasion
      const matchedCodes = new Set<string>();
      products.forEach((p) => {
        if (productMatchesOccasion(p.occasions, occ)) {
          matchedCodes.add(p.code);
        }
      });

      setSelectedProductCodes(new Set(matchedCodes));
      setInitialProductCodes(new Set(matchedCodes));
    } catch (err: any) {
      console.error('Error loading products for linking:', err);
      showNotification('Failed to load catalog products: ' + err.message, 'error');
    } finally {
      setCatalogLoading(false);
    }
  };

  // Toggle single product selection in drawer
  const toggleProductSelection = (code: string) => {
    setSelectedProductCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  // Filtered catalog for drawer
  const drawerFilteredProducts = useMemo(() => {
    if (!linkingOccasion) return [];

    return catalogProducts.filter((product) => {
      const q = drawerSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.code.toLowerCase().includes(q);

      const matchesCat =
        drawerCategoryFilter === 'ALL' ||
        product.category_slug.toLowerCase() === drawerCategoryFilter.toLowerCase();

      const isSelected = selectedProductCodes.has(product.code);
      const matchesView =
        drawerViewFilter === 'ALL' ||
        (drawerViewFilter === 'LINKED' && isSelected) ||
        (drawerViewFilter === 'UNLINKED' && !isSelected);

      return matchesSearch && matchesCat && matchesView;
    });
  }, [
    catalogProducts,
    linkingOccasion,
    drawerSearch,
    drawerCategoryFilter,
    drawerViewFilter,
    selectedProductCodes,
  ]);

  // Drawer Select All / Deselect All Filtered
  const handleSelectAllFiltered = () => {
    setSelectedProductCodes((prev) => {
      const next = new Set(prev);
      drawerFilteredProducts.forEach((p) => next.add(p.code));
      return next;
    });
  };

  const handleDeselectAllFiltered = () => {
    setSelectedProductCodes((prev) => {
      const next = new Set(prev);
      drawerFilteredProducts.forEach((p) => next.delete(p.code));
      return next;
    });
  };

  // Save Bulk Links
  const handleSaveBulkLinks = async () => {
    if (!linkingOccasion) return;
    setSavingLinks(true);

    const toLink: string[] = [];
    const toUnlink: string[] = [];

    // Find items newly selected
    selectedProductCodes.forEach((code) => {
      if (!initialProductCodes.has(code)) {
        toLink.push(code);
      }
    });

    // Find items unselected
    initialProductCodes.forEach((code) => {
      if (!selectedProductCodes.has(code)) {
        toUnlink.push(code);
      }
    });

    try {
      const result = await bulkLinkProductsToOccasion(
        linkingOccasion.slug,
        toLink,
        toUnlink
      );

      logAudit({
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        entity: 'occasions_linking',
        entity_id: linkingOccasion.slug,
        new_values: {
          occasion: linkingOccasion.slug,
          linkedCount: result.linkedCount,
          unlinkedCount: result.unlinkedCount,
          totalActiveLinked: selectedProductCodes.size,
        },
      });

      showNotification(
        `Catalog updated: Linked ${result.linkedCount} pieces, detached ${result.unlinkedCount} pieces for "${linkingOccasion.name}".`,
        'success'
      );

      setLinkingOccasion(null);
      await loadOccasions();
    } catch (err: any) {
      console.error('Error saving bulk links:', err);
      showNotification('Failed to update product occasions: ' + err.message, 'error');
    } finally {
      setSavingLinks(false);
    }
  };

  // Distinct Categories from catalog products for drawer filter
  const drawerCategories = useMemo(() => {
    const set = new Set<string>();
    catalogProducts.forEach((p) => {
      if (p.category_slug) set.add(p.category_slug);
    });
    return Array.from(set).sort();
  }, [catalogProducts]);

  // Calculate drawer pending changes
  const pendingAddedCount = useMemo(() => {
    let count = 0;
    selectedProductCodes.forEach((c) => {
      if (!initialProductCodes.has(c)) count++;
    });
    return count;
  }, [selectedProductCodes, initialProductCodes]);

  const pendingRemovedCount = useMemo(() => {
    let count = 0;
    initialProductCodes.forEach((c) => {
      if (!selectedProductCodes.has(c)) count++;
    });
    return count;
  }, [selectedProductCodes, initialProductCodes]);

  return (
    <AdminLayout activePage="occasions">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
        {/* Header with KPIs and Primary CTA */}
        <AdminViewHeader
          category="Catalog & Festive Architecture"
          title="Occasions & Festivals"
          subtitle="Curate celebratory moments, seasonal campaigns, and bulk-link catalog pieces across your boutique and discount engine."
          stats={[
            {
              label: 'Total Occasions',
              value: totalOccasions,
              subtext: 'Configured in central catalog',
              icon: <Layers size={18} />,
            },
            {
              label: 'Active on Storefront',
              value: activeOccasions,
              subtext: 'Visible in filters & gift finder',
              icon: <Sparkles size={18} />,
            },
            {
              label: 'Catalog Links',
              value: totalLinkedPieces,
              subtext: 'Products mapped to occasions',
              icon: <Package size={18} />,
            },
          ]}
          primaryAction={{
            label: 'Add Occasion',
            onClick: openCreateModal,
            icon: <Plus size={15} />,
          }}
          secondaryActions={[
            {
              label: 'Refresh',
              onClick: loadOccasions,
              icon: <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />,
            },
          ]}
        />

        {/* Toolbar: Search, Status Filters, View Mode Switcher */}
        <div className="bg-linen p-4 rounded-sm border border-canvas-line shadow-soft flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search occasions by title, slug, or details..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-light hover:text-ink"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Segment Tabs */}
            <div className="hidden sm:flex items-center bg-canvas/40 p-1 border border-canvas-line rounded-sm text-xs">
              {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1 font-medium transition-colors rounded-xs ${
                    statusFilter === tab
                      ? 'bg-ink text-white shadow-xs'
                      : 'text-ink-light hover:text-ink'
                  }`}
                >
                  {tab === 'ALL' ? 'All' : tab === 'ACTIVE' ? 'Active' : 'Hidden'}
                </button>
              ))}
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="flex items-center bg-white border border-canvas-line rounded-sm p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-xs transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-linen text-bark shadow-xs'
                    : 'text-ink-light hover:text-ink'
                }`}
                title="Grid view"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-xs transition-colors ${
                  viewMode === 'table'
                    ? 'bg-linen text-bark shadow-xs'
                    : 'text-ink-light hover:text-ink'
                }`}
                title="Table view"
              >
                <TableIcon size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Content Section: Loading, Empty, or Occasions List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-7 h-7 text-bark animate-spin" />
            <p className="text-xs uppercase tracking-widest text-ink-light font-medium font-sans">
              Loading occasions catalog...
            </p>
          </div>
        ) : filteredOccasions.length === 0 ? (
          <div className="bg-linen p-12 text-center border border-canvas-line rounded-sm shadow-soft space-y-4">
            <div className="w-12 h-12 rounded-full bg-silk/40 flex items-center justify-center mx-auto text-bark">
              <Sparkles size={24} />
            </div>
            <h3 className="heading-serif text-xl text-bark">No Occasions Found</h3>
            <p className="text-xs text-ink-light max-w-md mx-auto">
              {searchQuery
                ? `No occasions match "${searchQuery}". Try clearing your search query.`
                : 'No occasions have been configured yet. Create your first festive occasion to link catalog pieces.'}
            </p>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-ink text-white hover:bg-bark text-xs font-medium uppercase tracking-wider rounded-sm inline-flex items-center gap-1.5 transition-all shadow-soft"
            >
              <Plus size={14} />
              <span>Create Occasion</span>
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid Cards View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOccasions.map((occ) => (
              <div
                key={occ.id}
                className="bg-white border border-canvas-line rounded-sm shadow-soft hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {occ.banner_image_url && (
                  <div className="aspect-[16/9] w-full overflow-hidden bg-linen border-b border-canvas-line relative">
                    <img
                      src={occ.banner_image_url}
                      alt={occ.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="p-6 space-y-4">
                  {/* Card Header: Emoji, Title, Status Toggle */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-sm bg-linen border border-canvas-line flex items-center justify-center text-2xl shadow-xs flex-shrink-0">
                        {occ.emoji || '🌸'}
                      </div>
                      <div>
                        <h3 className="heading-serif text-lg text-bark leading-snug group-hover:text-rose transition-colors">
                          {occ.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-[10px] text-ink-light font-mono bg-linen px-1.5 py-0.5 rounded-xs border border-canvas-line">
                            {occ.slug}
                          </code>
                          <span className="text-[10px] text-ink-light">#{occ.display_order}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleActive(occ)}
                      className={`px-2 py-1 text-[10px] font-medium uppercase tracking-wider rounded-xs border transition-colors flex items-center gap-1 ${
                        occ.is_active
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200'
                      }`}
                      title={occ.is_active ? 'Click to hide from storefront' : 'Click to make active'}
                    >
                      {occ.is_active ? (
                        <>
                          <Check size={11} /> Active
                        </>
                      ) : (
                        <>
                          <EyeOff size={11} /> Hidden
                        </>
                      )}
                    </button>
                  </div>

                  {/* Description */}
                  {occ.description ? (
                    <p className="text-xs text-ink-light line-clamp-2 leading-relaxed">
                      {occ.description}
                    </p>
                  ) : (
                    <p className="text-xs text-ink-light/50 italic">No description provided</p>
                  )}

                  {/* Product Count Badge */}
                  <div className="pt-2 border-t border-canvas-line flex items-center justify-between text-xs">
                    <span className="text-ink-light flex items-center gap-1.5">
                      <Package size={14} className="text-bark" />
                      Linked Catalog Pieces:
                    </span>
                    <span className="font-semibold text-bark bg-linen px-2.5 py-0.5 rounded-full border border-canvas-line">
                      {occ.product_count ?? 0} pieces
                    </span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="px-6 py-3.5 bg-linen/50 border-t border-canvas-line flex items-center justify-between gap-2">
                  <button
                    onClick={() => openBulkLinker(occ)}
                    className="flex-1 py-1.5 px-3 bg-bark text-white hover:bg-ink text-xs font-medium rounded-sm flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    title="Open bulk catalog linker drawer"
                  >
                    <Package size={13} />
                    <span>Manage Linked Pieces</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(occ)}
                      className="p-1.5 text-ink-light hover:text-ink hover:bg-white rounded-xs border border-transparent hover:border-canvas-line transition-all"
                      title="Edit occasion details"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setOccasionToDelete(occ)}
                      className="p-1.5 text-ink-light hover:text-rose hover:bg-white rounded-xs border border-transparent hover:border-canvas-line transition-all"
                      title="Delete occasion"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white border border-canvas-line rounded-sm shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-linen border-b border-canvas-line text-[11px] font-semibold text-bark uppercase tracking-wider">
                    <th className="py-3 px-4">Occasion</th>
                    <th className="py-3 px-4">Slug</th>
                    <th className="py-3 px-4">Display Order</th>
                    <th className="py-3 px-4">Linked Pieces</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-canvas-line text-xs">
                  {filteredOccasions.map((occ) => (
                    <tr key={occ.id} className="hover:bg-linen/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xl flex-shrink-0">{occ.emoji || '🌸'}</span>
                          <div>
                            <p className="font-medium text-bark text-sm">{occ.name}</p>
                            {occ.description && (
                              <p className="text-[11px] text-ink-light line-clamp-1 max-w-xs">
                                {occ.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-ink-light text-[11px]">
                        {occ.slug}
                      </td>
                      <td className="py-3 px-4 text-ink-light">{occ.display_order}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-medium bg-linen px-2.5 py-0.5 rounded-full border border-canvas-line text-bark">
                          <Package size={12} /> {occ.product_count ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleActive(occ)}
                          className={`px-2 py-0.5 text-[10px] font-medium rounded-xs border ${
                            occ.is_active
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                          }`}
                        >
                          {occ.is_active ? 'Active' : 'Hidden'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openBulkLinker(occ)}
                            className="px-2.5 py-1 bg-bark text-white hover:bg-ink text-[11px] font-medium rounded-xs flex items-center gap-1 shadow-xs transition-colors"
                          >
                            <Package size={12} /> Link Pieces
                          </button>
                          <button
                            onClick={() => openEditModal(occ)}
                            className="p-1 text-ink-light hover:text-ink"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setOccasionToDelete(occ)}
                            className="p-1 text-ink-light hover:text-rose"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BULK PRODUCT LINKER DRAWER */}
        <AdminEntityDrawer
          isOpen={!!linkingOccasion}
          onClose={() => setLinkingOccasion(null)}
          title={`Link Pieces: ${linkingOccasion?.name || ''}`}
          subtitle={`Assign catalog pieces to this festive occasion with 1-click batch selection.`}
          badge={
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-silk/40 border border-silk rounded-full text-xs font-medium text-bark">
              <span className="text-base">{linkingOccasion?.emoji || '🌸'}</span>
              <span>Occasion: {linkingOccasion?.slug}</span>
            </div>
          }
          widthClass="max-w-2xl sm:max-w-3xl"
          footerActions={
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-ink-light">
                {pendingAddedCount > 0 && (
                  <span className="text-emerald-700 font-medium mr-2">
                    +{pendingAddedCount} linking
                  </span>
                )}
                {pendingRemovedCount > 0 && (
                  <span className="text-rose font-medium mr-2">
                    -{pendingRemovedCount} detaching
                  </span>
                )}
                <span>Total: {selectedProductCodes.size} pieces selected</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLinkingOccasion(null)}
                  className="px-4 py-2 border border-canvas-line text-xs font-medium text-ink-light hover:text-ink rounded-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBulkLinks}
                  disabled={savingLinks}
                  className="px-5 py-2 bg-ink text-white hover:bg-bark text-xs font-medium uppercase tracking-wider rounded-sm flex items-center gap-1.5 transition-all shadow-soft disabled:opacity-50"
                >
                  {savingLinks ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          }
        >
          {catalogLoading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-6 h-6 text-bark animate-spin" />
              <p className="text-xs uppercase tracking-widest text-ink-light font-medium">
                Loading atelier products...
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Drawer Search & Category Filters */}
              <div className="space-y-3 bg-white p-4 border border-canvas-line rounded-sm">
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <div className="relative flex-1 w-full">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light"
                    />
                    <input
                      type="text"
                      value={drawerSearch}
                      onChange={(e) => setDrawerSearch(e.target.value)}
                      placeholder="Search pieces by title or product code..."
                      className="w-full pl-8 pr-7 py-1.5 bg-linen border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                    />
                    {drawerSearch && (
                      <button
                        onClick={() => setDrawerSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-light hover:text-ink"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Category Filter */}
                  <select
                    value={drawerCategoryFilter}
                    onChange={(e) => setDrawerCategoryFilter(e.target.value)}
                    className="w-full sm:w-44 py-1.5 px-2 bg-linen border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                  >
                    <option value="ALL">All Categories</option>
                    {drawerCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sub-toolbar: Segment Filter & Quick Selection Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-canvas-line text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-ink-light font-medium mr-1">Show:</span>
                    {(['ALL', 'LINKED', 'UNLINKED'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setDrawerViewFilter(mode)}
                        className={`px-2.5 py-0.5 rounded-xs text-[11px] font-medium transition-colors ${
                          drawerViewFilter === mode
                            ? 'bg-bark text-white'
                            : 'bg-linen text-ink-light hover:text-ink'
                        }`}
                      >
                        {mode === 'ALL'
                          ? `All (${catalogProducts.length})`
                          : mode === 'LINKED'
                          ? `Linked (${selectedProductCodes.size})`
                          : `Unlinked (${catalogProducts.length - selectedProductCodes.size})`}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="text-[11px] text-bark hover:text-rose font-medium underline"
                    >
                      Select all filtered
                    </button>
                    <span className="text-zinc-300">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllFiltered}
                      className="text-[11px] text-ink-light hover:text-rose font-medium underline"
                    >
                      Deselect all filtered
                    </button>
                  </div>
                </div>
              </div>

              {/* Product Checklist Grid */}
              {drawerFilteredProducts.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink-light bg-white border border-canvas-line rounded-sm">
                  No pieces match the filter criteria.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
                  {drawerFilteredProducts.map((p) => {
                    const isChecked = selectedProductCodes.has(p.code);
                    const thumb = p.images?.[0] || '/placeholder-bloom.svg';

                    return (
                      <div
                        key={p.code}
                        onClick={() => toggleProductSelection(p.code)}
                        className={`p-3 rounded-sm border cursor-pointer transition-all flex items-start gap-3 select-none ${
                          isChecked
                            ? 'bg-rose/5 border-rose shadow-xs'
                            : 'bg-white border-canvas-line hover:border-bark/40'
                        }`}
                      >
                        {/* Checkbox box */}
                        <div
                          className={`w-4 h-4 rounded-xs border flex items-center justify-center flex-shrink-0 mt-1 transition-colors ${
                            isChecked
                              ? 'bg-rose border-rose text-white'
                              : 'border-zinc-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check size={12} strokeWidth={3} />}
                        </div>

                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded-xs bg-linen border border-canvas-line overflow-hidden flex-shrink-0">
                          <img
                            src={thumb}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-bloom.svg';
                            }}
                          />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-serif text-xs font-semibold text-bark truncate leading-snug">
                            {p.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-ink-light font-mono">
                              {p.code}
                            </span>
                            <span className="text-[10px] text-bark font-medium">
                              ₹{(p.price_in_paise / 100).toFixed(0)}
                            </span>
                          </div>

                          {/* Existing occasions tags */}
                          {p.occasions && p.occasions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {p.occasions.slice(0, 3).map((occTag, i) => (
                                <span
                                  key={i}
                                  className="text-[9px] bg-linen px-1 py-0.2 rounded-xs text-ink-light border border-canvas-line truncate max-w-[90px]"
                                >
                                  {occTag}
                                </span>
                              ))}
                              {p.occasions.length > 3 && (
                                <span className="text-[9px] text-ink-light font-medium">
                                  +{p.occasions.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </AdminEntityDrawer>

        {/* CREATE / EDIT OCCASION MODAL */}
        {isFormModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-fadeIn"
              onClick={() => setIsFormModalOpen(false)}
            />
            <div className="relative bg-linen border border-canvas-line rounded-sm shadow-2xl max-w-lg w-full z-10 overflow-hidden animate-slideUp">
              <header className="p-5 border-b border-canvas-line bg-canvas/40 flex items-center justify-between">
                <div>
                  <h3 className="heading-serif text-xl text-bark">
                    {editingOccasion ? 'Edit Occasion' : 'Create New Occasion'}
                  </h3>
                  <p className="text-xs text-ink-light">
                    {editingOccasion
                      ? 'Update occasion attributes and storefront display.'
                      : 'Define a festive moment for catalog categorization and promo scoping.'}
                  </p>
                </div>
                <button
                  onClick={() => setIsFormModalOpen(false)}
                  className="p-1 text-ink-light hover:text-ink rounded-xs"
                >
                  <X size={18} />
                </button>
              </header>

              <form onSubmit={handleSaveOccasion} className="p-6 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-bark mb-1">
                    Occasion Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Diwali & Festive, Mother's Day..."
                    className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-bark mb-1">
                    URL / System Slug *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSlug}
                    onChange={(e) => setFormSlug(generateSlug(e.target.value))}
                    placeholder="e.g. diwali, mothers-day"
                    className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink font-mono focus:outline-none focus:border-bark"
                  />
                  <p className="text-[10px] text-ink-light mt-0.5">
                    Used for URL filters, coupon scoping, and API matching.
                  </p>
                </div>

                {/* Emoji Picker */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-bark mb-1">
                    Symbol / Emoji
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={formEmoji}
                      onChange={(e) => setFormEmoji(e.target.value)}
                      className="w-14 text-center py-2 bg-white border border-canvas-line rounded-sm text-lg focus:outline-none focus:border-bark"
                    />
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {PRESET_EMOJIS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setFormEmoji(em)}
                          className={`w-7 h-7 text-sm rounded-xs border flex items-center justify-center transition-all ${
                            formEmoji === em
                              ? 'bg-rose/10 border-rose shadow-xs'
                              : 'bg-white border-canvas-line hover:border-bark/40'
                          }`}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-bark mb-1">
                    Storefront Description
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief description for gift finder and festive category headers..."
                    className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark resize-none"
                  />
                </div>

                {/* Hero Banner Image */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-bark mb-1">
                    Occasion Hero Banner (16:9 ratio)
                  </label>
                  <div className="space-y-2">
                    {formBannerImageUrl ? (
                      <div className="relative aspect-video rounded-sm overflow-hidden border border-canvas-line bg-linen/50 group">
                        <img
                          src={formBannerImageUrl}
                          alt="Banner preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setFormBannerImageUrl('')}
                          className="absolute top-2 right-2 p-1.5 bg-bark/80 hover:bg-bark text-white rounded-full transition-colors"
                          title="Remove banner image"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="aspect-video rounded-sm border border-dashed border-canvas-line bg-linen/20 flex flex-col items-center justify-center p-3 text-center">
                        <ImageIcon size={20} className="text-ink-light/40 mb-1" />
                        <p className="text-[11px] text-ink-light">No banner uploaded yet</p>
                        <p className="text-[10px] text-ink-light/60">Displayed on /shop when this occasion is active</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 bg-linen hover:bg-silk/60 border border-canvas-line text-xs font-medium text-bark rounded-sm cursor-pointer flex items-center gap-1.5 transition-colors">
                        {uploadingBanner ? (
                          <>
                            <Loader2 size={13} className="animate-spin text-bark" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={13} />
                            <span>Upload Image</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleBannerUpload}
                          disabled={uploadingBanner}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="url"
                        value={formBannerImageUrl}
                        onChange={(e) => setFormBannerImageUrl(e.target.value)}
                        placeholder="Or paste image URL..."
                        className="flex-1 px-3 py-1.5 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                      />
                    </div>
                  </div>
                </div>

                {/* Display Order & Active Toggle */}
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-bark mb-1">
                      Display Priority
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formDisplayOrder}
                      onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-bark mb-1">
                      Status
                    </label>
                    <div className="flex items-center gap-2 pt-1.5">
                      <input
                        type="checkbox"
                        id="formIsActive"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="w-4 h-4 rounded-xs border-canvas-line text-bark focus:ring-bark"
                      />
                      <label htmlFor="formIsActive" className="text-xs text-ink cursor-pointer">
                        Active on storefront
                      </label>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <footer className="pt-4 border-t border-canvas-line flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsFormModalOpen(false)}
                    className="px-4 py-2 border border-canvas-line text-xs font-medium text-ink-light hover:text-ink rounded-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingForm}
                    className="px-5 py-2 bg-ink text-white hover:bg-bark text-xs font-medium uppercase tracking-wider rounded-sm flex items-center gap-1.5 transition-all shadow-soft disabled:opacity-50"
                  >
                    {savingForm ? (
                      <>
                        <Loader2 size={13} className="animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Check size={13} /> {editingOccasion ? 'Update Occasion' : 'Create Occasion'}
                      </>
                    )}
                  </button>
                </footer>
              </form>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION MODAL */}
        {occasionToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-fadeIn"
              onClick={() => setOccasionToDelete(null)}
            />
            <div className="relative bg-white border border-canvas-line rounded-sm shadow-2xl max-w-sm w-full z-10 p-6 space-y-4 animate-slideUp">
              <div className="w-10 h-10 rounded-full bg-rose/10 text-rose flex items-center justify-center mx-auto">
                <Trash2 size={20} />
              </div>
              <div className="text-center space-y-1">
                <h3 className="heading-serif text-lg text-bark">Delete Occasion?</h3>
                <p className="text-xs text-ink-light">
                  Are you sure you want to delete &ldquo;{occasionToDelete.name}&rdquo;? This will remove the occasion configuration from the system.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOccasionToDelete(null)}
                  className="flex-1 py-2 border border-canvas-line text-xs font-medium text-ink-light hover:text-ink rounded-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteOccasion}
                  disabled={isDeleting}
                  className="flex-1 py-2 bg-rose text-white hover:bg-rose-dark text-xs font-medium uppercase tracking-wider rounded-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? <Loader2 size={13} className="animate-spin" /> : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
