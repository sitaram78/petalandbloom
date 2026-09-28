import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { parseCSV, downloadCSV } from '@/utils/csvExporter';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditClient';

interface ProductBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  existingProducts: Array<{
    code: string;
    name: string;
    price: number;
    compareAtPrice?: number;
    category: string;
  }>;
}

interface ParsedProductRow {
  code: string;
  name: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  description: string;
  preparationDays?: string;
  madeToOrder: boolean;
  bestseller: boolean;
  featured: boolean;
  customisable: boolean;
  images: string[];
  isNew: boolean;
  oldPrice?: number;
}

interface ValidationError {
  row: number;
  code: string;
  field: string;
  message: string;
}

export default function ProductBulkImportModal({
  isOpen,
  onClose,
  onSuccess,
  existingProducts,
}: ProductBulkImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [applying, setApplying] = useState(false);
  const [importSummary, setImportSummary] = useState<{ newCount: number; updateCount: number } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const existingMap = new Map(existingProducts.map((p) => [p.code.toUpperCase().trim(), p]));

  const downloadSampleTemplate = () => {
    const headers = [
      'code',
      'name',
      'category',
      'price_inr',
      'compare_price_inr',
      'description',
      'preparation_days',
      'made_to_order',
      'bestseller',
      'featured',
      'customisable',
      'image_urls_comma_separated',
    ];

    const sampleRows = [
      [
        'ROSE-PEACH-01',
        'Peach Blossom Crochet Bouquet',
        'Bouquets',
        '1499',
        '1899',
        'Delicate peach blossoms crafted with 100% organic cotton yarn.',
        '2–3 days',
        'true',
        'true',
        'false',
        'true',
        'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&q=80&w=800',
      ],
      [
        'DAISY-MINI-02',
        'Sunlit Mini Daisy Pot',
        'Potted Blooms',
        '899',
        '',
        'Evergreen potted daisy bloom handcrafted for work desks.',
        '1–2 days',
        'false',
        'false',
        'true',
        'false',
        'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&q=80&w=800',
      ],
    ];

    downloadCSV('tpb_product_catalog_import_template', headers, sampleRows);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParsing(true);
    setErrors([]);
    setParsedRows([]);
    setImportSummary(null);
    setSuccessMessage(null);

    try {
      const text = await selectedFile.text();
      const { rows } = parseCSV(text);

      if (rows.length === 0) {
        setErrors([{ row: 0, code: 'N/A', field: 'file', message: 'CSV file is empty or missing headers.' }]);
        setParsing(false);
        return;
      }

      const validationErrors: ValidationError[] = [];
      const validRows: ParsedProductRow[] = [];
      let newItems = 0;
      let updateItems = 0;

      rows.forEach((row, index) => {
        const rowNum = index + 2; // +1 for header, +1 for 1-based indexing
        const code = (row.code || row.product_code || '').trim().toUpperCase();
        const name = (row.name || row.title || row.product_name || '').trim();
        const category = (row.category || row.category_slug || 'Bouquets').trim();
        const priceStr = (row.price_inr || row.price || '').replace(/[^\d.]/g, '').trim();
        const comparePriceStr = (row.compare_price_inr || row.compare_at_price || '').replace(/[^\d.]/g, '').trim();
        const desc = (row.description || row.desc || '').trim();
        const prepDays = (row.preparation_days || row.prep_days || '2–3 days').trim();
        const isMTO = (row.made_to_order || row.is_made_to_order || 'true').toLowerCase() === 'true';
        const isBestseller = (row.bestseller || 'false').toLowerCase() === 'true';
        const isFeatured = (row.featured || 'false').toLowerCase() === 'true';
        const isCustomisable = (row.customisable || row.customizable || 'false').toLowerCase() === 'true';
        const imagesRaw = (row.image_urls_comma_separated || row.images || '').trim();
        const images = imagesRaw ? imagesRaw.split(',').map((img) => img.trim()).filter(Boolean) : [];

        // Validation Rules
        if (!code) {
          validationErrors.push({ row: rowNum, code: 'MISSING', field: 'code', message: 'Product Code is required.' });
          return;
        }

        if (!/^[A-Z0-9_-]+$/.test(code)) {
          validationErrors.push({
            row: rowNum,
            code,
            field: 'code',
            message: 'Code must be alphanumeric (e.g. ROSE-01, BLOOM_12).',
          });
        }

        if (!name) {
          validationErrors.push({ row: rowNum, code, field: 'name', message: 'Product Name is required.' });
        }

        const price = parseFloat(priceStr);
        if (isNaN(price) || price <= 0) {
          validationErrors.push({ row: rowNum, code, field: 'price_inr', message: 'Price must be a positive number.' });
        }

        let compareAtPrice: number | undefined = undefined;
        if (comparePriceStr) {
          const comp = parseFloat(comparePriceStr);
          if (isNaN(comp) || comp <= (price || 0)) {
            validationErrors.push({
              row: rowNum,
              code,
              field: 'compare_price_inr',
              message: 'Compare price must be greater than selling price.',
            });
          } else {
            compareAtPrice = comp;
          }
        }

        const existing = existingMap.get(code);
        const isNew = !existing;
        if (isNew) newItems++;
        else updateItems++;

        validRows.push({
          code,
          name,
          category,
          price,
          compareAtPrice,
          description: desc,
          preparationDays: prepDays,
          madeToOrder: isMTO,
          bestseller: isBestseller,
          featured: isFeatured,
          customisable: isCustomisable,
          images,
          isNew,
          oldPrice: existing?.price,
        });
      });

      setErrors(validationErrors);
      setParsedRows(validRows);
      setImportSummary({ newCount: newItems, updateCount: updateItems });
    } catch (err: any) {
      setErrors([{ row: 0, code: 'PARSER', field: 'file', message: 'Failed to parse CSV: ' + err.message }]);
    } finally {
      setParsing(false);
    }
  };

  const downloadErrorReport = () => {
    const headers = ['Row #', 'Product Code', 'Field', 'Error Message'];
    const rows = errors.map((e) => [e.row, e.code, e.field, e.message]);
    downloadCSV('tpb_import_validation_errors', headers, rows);
  };

  const executeAtomicImport = async () => {
    if (parsedRows.length === 0 || errors.length > 0) return;
    setApplying(true);

    try {
      const recordsToUpsert = parsedRows.map((r) => ({
        code: r.code,
        name: r.name,
        category: r.category,
        price: r.price,
        compare_at_price: r.compareAtPrice || null,
        description: r.description,
        preparation_days: r.preparationDays,
        made_to_order: r.madeToOrder,
        bestseller: r.bestseller,
        featured: r.featured,
        customisable: r.customisable,
        images: r.images.length > 0 ? r.images : ['https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&q=80&w=800'],
      }));

      // Upsert into Supabase products table
      const { error: upsertError } = await supabase.from('products').upsert(recordsToUpsert, {
        onConflict: 'code',
      });

      if (upsertError) {
        throw upsertError;
      }

      // Record Audit Event
      logAudit({
        action: AUDIT_ACTIONS.PRODUCT_PRICE_CHANGED,
        entity: 'products',
        entity_id: 'bulk_import',
        new_values: {
          total_imported: parsedRows.length,
          new_items: importSummary?.newCount || 0,
          updated_items: importSummary?.updateCount || 0,
        },
        reason: `Bulk catalog import: ${parsedRows.length} items upserted via CSV`,
      });

      setSuccessMessage(
        `Successfully imported ${parsedRows.length} pieces (${importSummary?.newCount} new, ${importSummary?.updateCount} updated)!`
      );

      if (onSuccess) {
        await onSuccess();
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      alert('Failed to execute bulk import: ' + err.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-linen w-full max-w-4xl max-h-[90vh] rounded-sm border border-canvas-line shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
        {/* Modal Header */}
        <header className="p-6 border-b border-canvas-line flex items-center justify-between bg-canvas/40">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-rose" />
              <h2 className="heading-serif text-2xl text-ink">Two-Stage Bulk Catalog Import</h2>
            </div>
            <p className="text-xs text-ink-light mt-1">
              Validate schema, simulate dry-run diffs, and atomically update catalog pieces.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={downloadSampleTemplate}
              className="px-3 py-1.5 bg-linen border border-canvas-line text-xs font-medium text-bark hover:border-bark rounded-sm flex items-center gap-1.5 transition-all"
            >
              <Download size={13} className="text-rose" />
              Download CSV Template
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-bark/60 hover:text-ink transition-colors rounded-sm hover:bg-canvas/50"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* File Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-canvas-line hover:border-bark/50 p-8 rounded-sm text-center bg-parchment/40 hover:bg-parchment transition-all cursor-pointer group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-rose/10 text-rose flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <Upload size={24} />
            </div>
            <p className="text-sm font-medium text-ink">
              {file ? file.name : 'Click to select or drag & drop a .CSV file'}
            </p>
            <p className="text-xs text-bark/60 mt-1">
              Supports RFC 4180 CSV with UTF-8 encoding. Max 1,000 catalog pieces per batch.
            </p>
          </div>

          {parsing && (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-bark">
              <Loader2 size={24} className="animate-spin text-rose" />
              <span className="text-xs">Validating schema syntax and checking existing database codes...</span>
            </div>
          )}

          {/* Validation Errors State */}
          {errors.length > 0 && !parsing && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-800 font-semibold text-sm">
                  <AlertTriangle size={18} />
                  <span>Validation Failed ({errors.length} errors found)</span>
                </div>
                <button
                  onClick={downloadErrorReport}
                  className="px-2.5 py-1 bg-white border border-red-300 text-xs text-red-800 hover:bg-red-50 rounded-sm flex items-center gap-1.5"
                >
                  <Download size={12} />
                  Download Error Report CSV
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1 text-xs text-red-700">
                {errors.slice(0, 10).map((err, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="font-mono font-bold">Row {err.row}:</span>
                    <span>[{err.code}]</span>
                    <span>{err.message}</span>
                  </div>
                ))}
                {errors.length > 10 && (
                  <p className="italic text-red-600 font-medium">
                    ...and {errors.length - 10} more errors. Download the full report above.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Dry-Run Simulation Preview Table */}
          {parsedRows.length > 0 && errors.length === 0 && !parsing && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-canvas/30 p-3 rounded-sm border border-canvas-line">
                <div className="flex items-center gap-4 text-xs">
                  <span className="font-semibold text-ink">Dry-Run Simulation Result:</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                    {importSummary?.newCount} New Pieces
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                    {importSummary?.updateCount} Existing Updates
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
                  <ShieldCheck size={16} /> Ready for atomic commit
                </div>
              </div>

              <div className="border border-canvas-line rounded-sm overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-canvas/60 text-bark font-mono uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="p-2.5">Action</th>
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5">Title</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5 text-right">Price (₹)</th>
                      <th className="p-2.5 text-center">Images</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-canvas-line bg-parchment/30">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-canvas/40 transition-colors">
                        <td className="p-2.5">
                          {row.isNew ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              + NEW
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                              ↻ UPDATE
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono font-semibold text-ink">{row.code}</td>
                        <td className="p-2.5 text-ink truncate max-w-[200px]">{row.name}</td>
                        <td className="p-2.5 text-bark">{row.category}</td>
                        <td className="p-2.5 text-right font-medium text-ink">
                          {row.oldPrice && row.oldPrice !== row.price ? (
                            <span className="flex items-center justify-end gap-1 font-mono">
                              <span className="line-through text-bark/50">₹{row.oldPrice}</span>
                              <ArrowRight size={10} className="text-rose" />
                              <span className="text-emerald-700 font-bold">₹{row.price}</span>
                            </span>
                          ) : (
                            <span className="font-mono">₹{row.price}</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center text-bark">
                          {row.images.length > 0 ? `${row.images.length} URLs` : 'Default'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-sm flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 size={18} className="text-emerald-600" />
              {successMessage}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="p-4 border-t border-canvas-line bg-canvas/30 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-transparent text-xs font-medium text-bark hover:text-ink transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={executeAtomicImport}
            disabled={parsedRows.length === 0 || errors.length > 0 || applying || !file}
            className="px-6 py-2.5 bg-ink text-white hover:bg-bark text-xs font-medium tracking-wide uppercase rounded-sm flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-soft"
          >
            {applying ? (
              <>
                <Loader2 size={14} className="animate-spin text-rose" />
                Committing to Catalog...
              </>
            ) : (
              <>
                <CheckCircle2 size={14} className="text-rose" />
                Commit {parsedRows.length} Pieces to Database
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
