import { supabaseAdmin } from './supabaseServer';

export interface DelhiveryScanDetail {
  scanDateTime: string;
  scanType?: string;
  scan: string;
  scannedLocation: string;
  instructions?: string;
  statusCode?: string;
}

export interface DelhiveryLiveTrackingResult {
  success: boolean;
  carrier: 'DELHIVERY';
  awbNumber: string;
  status: string;
  statusType?: string;
  statusCode?: string;
  statusDateTime?: string;
  currentLocation?: string;
  origin?: string;
  destination?: string;
  expectedDeliveryDate?: string | null;
  pickupDate?: string | null;
  scans: DelhiveryScanDetail[];
  trackingUrl: string;
  isDelivered: boolean;
  cachedAt?: string;
  errorMessage?: string;
}

interface CacheEntry {
  data: DelhiveryLiveTrackingResult;
  expiresAt: number;
}

// In-memory cache for tracking results (5 minutes for active shipments, 1 hour for delivered)
const trackingCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const DELIVERED_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Retrieves the Delhivery API Token with multi-tier resolution:
 * 1. Process environment variable DELHIVERY_API_KEY
 * 2. store_settings table in Supabase
 */
export async function getDelhiveryApiKey(): Promise<string> {
  const envKey = process.env.DELHIVERY_API_KEY?.trim();
  if (envKey) return envKey;

  try {
    const { data, error } = await supabaseAdmin
      .from('store_settings')
      .select('delhivery_api_key')
      .eq('id', 'primary')
      .maybeSingle();

    if (!error && data?.delhivery_api_key?.trim()) {
      return data.delhivery_api_key.trim();
    }
  } catch (err) {
    console.warn('[Delhivery Service] Failed to retrieve API key from store_settings:', err);
  }

  return '';
}

/**
 * Clears cached tracking data for a specific AWB or entirely
 */
export function clearDelhiveryTrackingCache(awbNumber?: string): void {
  if (awbNumber) {
    trackingCache.delete(awbNumber.trim().toUpperCase());
  } else {
    trackingCache.clear();
  }
}

/**
 * Builds the official Delhivery public tracking portal URL
 */
export function getDelhiveryTrackingUrl(awbNumber: string): string {
  const cleanAwb = encodeURIComponent(awbNumber.trim());
  return `https://www.delhivery.com/track/package/${cleanAwb}`;
}

/**
 * Fetches real-time package tracking details directly from Delhivery API.
 * Includes automatic caching, multi-format response parsing, and resilient fallback.
 */
export async function fetchDelhiveryLiveTracking(
  awbNumber: string,
  options?: {
    forceRefresh?: boolean;
    apiKey?: string;
  }
): Promise<DelhiveryLiveTrackingResult> {
  const cleanAwb = (awbNumber || '').trim().toUpperCase();

  if (!cleanAwb) {
    return {
      success: false,
      carrier: 'DELHIVERY',
      awbNumber: '',
      status: 'Unknown',
      scans: [],
      trackingUrl: 'https://www.delhivery.com',
      isDelivered: false,
      errorMessage: 'Invalid or missing AWB number.',
    };
  }

  const trackingUrl = getDelhiveryTrackingUrl(cleanAwb);

  // Check cache unless forceRefresh is explicitly requested
  if (!options?.forceRefresh) {
    const cached = trackingCache.get(cleanAwb);
    if (cached && Date.now() < cached.expiresAt) {
      return {
        ...cached.data,
        cachedAt: new Date(cached.expiresAt - (cached.data.isDelivered ? DELIVERED_CACHE_TTL_MS : CACHE_TTL_MS)).toISOString(),
      };
    }
  }

  const token = options?.apiKey?.trim() || (await getDelhiveryApiKey());

  if (!token) {
    // Graceful fallback when API key is not yet set
    return {
      success: false,
      carrier: 'DELHIVERY',
      awbNumber: cleanAwb,
      status: 'Dispatched',
      currentLocation: 'In Transit with Courier',
      scans: [],
      trackingUrl,
      isDelivered: false,
      errorMessage: 'Delhivery API key not configured. Tracking available via official Delhivery portal.',
    };
  }

  try {
    const endpoint = `https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(cleanAwb)}`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Token ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn(`[Delhivery API Error] HTTP ${response.status} for AWB ${cleanAwb}:`, errorText);
      return {
        success: false,
        carrier: 'DELHIVERY',
        awbNumber: cleanAwb,
        status: 'In Transit',
        scans: [],
        trackingUrl,
        isDelivered: false,
        errorMessage: `Delhivery API returned status ${response.status}.`,
      };
    }

    const json: any = await response.json();

    // Delhivery schema: { ShipmentData: [ { Shipment: { ... } } ] }
    const shipmentDataList = Array.isArray(json?.ShipmentData) ? json.ShipmentData : [];
    const firstItem = shipmentDataList[0];
    const shipment = firstItem?.Shipment || firstItem || null;

    if (!shipment) {
      return {
        success: false,
        carrier: 'DELHIVERY',
        awbNumber: cleanAwb,
        status: 'Manifested',
        currentLocation: 'Awaiting Courier Pickup',
        scans: [],
        trackingUrl,
        isDelivered: false,
        errorMessage: 'Shipment data not yet available on Delhivery network.',
      };
    }

    // Extract Status info
    let statusText = 'In Transit';
    let statusDateTime: string | undefined;
    let statusCode: string | undefined;
    let statusType: string | undefined;

    if (typeof shipment.Status === 'string') {
      statusText = shipment.Status;
    } else if (shipment.Status && typeof shipment.Status === 'object') {
      statusText = shipment.Status.Status || shipment.Status.status || statusText;
      statusDateTime = shipment.Status.StatusDateTime || shipment.Status.statusDateTime;
      statusCode = shipment.Status.StatusCode || shipment.Status.statusCode;
      statusType = shipment.Status.StatusType || shipment.Status.statusType;
    }

    // Extract Checkpoint Scans
    const rawScans = Array.isArray(shipment.Scans) ? shipment.Scans : [];
    const normalizedScans: DelhiveryScanDetail[] = [];

    for (const scanItem of rawScans) {
      const detail = scanItem?.ScanDetail || scanItem;
      if (!detail) continue;

      const scanTime = detail.ScanDateTime || detail.scanDateTime || '';
      const scanDesc = detail.Scan || detail.scan || detail.Instructions || 'In Transit';
      const scanLoc = detail.ScannedLocation || detail.scannedLocation || detail.ScannedCity || 'Transit Hub';

      normalizedScans.push({
        scanDateTime: scanTime,
        scanType: detail.ScanType || detail.scanType,
        scan: scanDesc,
        scannedLocation: scanLoc,
        instructions: detail.Instructions || detail.instructions,
        statusCode: detail.StatusCode || detail.statusCode,
      });
    }

    // Sort scans chronologically (latest scan at index 0 or chronological)
    normalizedScans.sort((a, b) => {
      const tA = new Date(a.scanDateTime).getTime() || 0;
      const tB = new Date(b.scanDateTime).getTime() || 0;
      return tB - tA; // Newest first
    });

    const latestScan = normalizedScans[0];
    const currentLocation = latestScan?.scannedLocation || shipment.Destination || 'In Transit';

    const normalizedStatusLower = statusText.toLowerCase();
    const isDelivered = normalizedStatusLower.includes('deliver') && !normalizedStatusLower.includes('undeliver');

    const result: DelhiveryLiveTrackingResult = {
      success: true,
      carrier: 'DELHIVERY',
      awbNumber: cleanAwb,
      status: statusText,
      statusType,
      statusCode,
      statusDateTime: statusDateTime || latestScan?.scanDateTime,
      currentLocation,
      origin: shipment.Origin || shipment.PickupLocation,
      destination: shipment.Destination,
      expectedDeliveryDate: shipment.ExpectedDeliveryDate || shipment.PromisedDeliveryDate || null,
      pickupDate: shipment.PickUpDate || shipment.PickUpTime || null,
      scans: normalizedScans,
      trackingUrl,
      isDelivered,
    };

    // Store in cache
    const ttl = isDelivered ? DELIVERED_CACHE_TTL_MS : CACHE_TTL_MS;
    trackingCache.set(cleanAwb, {
      data: result,
      expiresAt: Date.now() + ttl,
    });

    return result;
  } catch (err: any) {
    console.error(`[Delhivery Service Fetch Error] AWB ${cleanAwb}:`, err);
    return {
      success: false,
      carrier: 'DELHIVERY',
      awbNumber: cleanAwb,
      status: 'In Transit',
      scans: [],
      trackingUrl,
      isDelivered: false,
      errorMessage: err.message || 'Failed to connect to Delhivery tracking service.',
    };
  }
}
