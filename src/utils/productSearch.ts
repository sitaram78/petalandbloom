import { Product } from '@/data/products';
import { formatPrice } from '@/data/products';

export interface SearchCriteria {
  query?: string;
  category?: string;
  occasion?: string;
  budget?: string;
  customOnly?: boolean;
  validCategories?: string[];
}

export function filterProducts(products: Product[], criteria: SearchCriteria) {
  const { query, category, occasion, budget, customOnly, validCategories } = criteria;

  return products.filter((p) => {
    // Category filter
    if (category && category !== 'all') {
      if (p.category?.toLowerCase().trim() !== category.toLowerCase().trim()) {
        return false;
      }
    } else if (category === 'all' && validCategories && validCategories.length > 0) {
      // If "All" is selected but we have a list of valid categories,
      // only show products that belong to one of those categories.
      if (!validCategories.includes(p.category?.toLowerCase().trim() || '')) {
        return false;
      }
    }

    // Occasion filter
    if (occasion && (!p.occasions || !p.occasions.some(o => o.toLowerCase() === occasion.toLowerCase()))) {
      return false;
    }

    // Budget filter (assumes budget string comes from budgetFilters.param)
    // Since we don't have the budgetFilters mapping here, we handle it outside or pass the min/max
    // For now, we leave the specific budget logic to the caller or extend this utility.

    // Custom only filter
    if (customOnly && !p.customisable) {
      return false;
    }

    // Search query filter
    if (query) {
      const q = query.trim().toLowerCase();
      if (q.length < 2) return true;

      // Budget keywords
      const budgetMatch = q.match(/under\s*(\d+)/);
      if (budgetMatch) {
        const max = parseInt(budgetMatch[1], 10);
        if (p.price > max) return false;
      } else if (q.includes('premium') || q.includes('2000') || q.includes('expensive')) {
        if (p.price < 2000) return false;
      } else {
        const haystack = [
          p.name, p.description, p.code, p.category,
          ...(p.occasions || []),
          ...(p.colors || []),
          formatPrice(p.price),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
    }

    return true;
  });
}
