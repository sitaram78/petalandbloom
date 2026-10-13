export type MaterialType =
  | 'YARN'
  | 'PIPE_CLEANER'
  | 'FLORAL_WIRE'
  | 'PACKAGING'
  | 'TOOLS'
  | 'OTHER';

export type ColorFamily =
  | 'RED'
  | 'GREEN'
  | 'PINK'
  | 'WHITE'
  | 'PURPLE'
  | 'YELLOW'
  | 'BLUE'
  | 'OTHER';

export interface RawMaterialProcurement {
  id: string;
  material_type: MaterialType;
  color_family: ColorFamily;
  description: string;
  quantity_label: string;
  price_in_paise: number;
  purchase_date: string;
  vendor_name?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcurementSpendSummary {
  totalSpendPaise: number;
  byType: Record<MaterialType, number>;
  byColor: Record<string, number>;
  recentPurchases: RawMaterialProcurement[];
}

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  YARN: 'Yarn / Crochet Wool',
  PIPE_CLEANER: 'Pipe Cleaner (Chenille Stems)',
  FLORAL_WIRE: 'Floral Wire & Tape',
  PACKAGING: 'Gift Boxes & Ribbons',
  TOOLS: 'Tools & Glue Supplies',
  OTHER: 'Other Craft Supplies',
};

export const COLOR_FAMILY_LABELS: Record<ColorFamily, { name: string; hex: string }> = {
  RED: { name: 'Red & Burgundy', hex: '#C93B3B' },
  GREEN: { name: 'Sage & Olive Green', hex: '#4A6B53' },
  PINK: { name: 'Blush & Dusty Pink', hex: '#D4838F' },
  WHITE: { name: 'Cream & Ivory White', hex: '#B0A080' },
  PURPLE: { name: 'Lavender & Lilac', hex: '#9B7AA8' },
  YELLOW: { name: 'Sunflower Yellow', hex: '#D99B26' },
  BLUE: { name: 'Sky & Ocean Blue', hex: '#5B7FA6' },
  OTHER: { name: 'Neutral / Mixed', hex: '#8A7D72' },
};
