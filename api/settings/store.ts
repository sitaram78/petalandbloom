import type { IncomingMessage, ServerResponse } from 'http';
import { supabaseAdmin } from '../lib/supabaseServer';

const DEFAULT_SETTINGS = {
  whatsappNumber: '+919931653303',
  supportEmail: 'concierge@thepetalandbloom.com',
  instagramHandle: '@thepetalandbloom',
  instagramUrl: 'https://instagram.com/thepetalandbloom',
  businessHours: 'Monday – Saturday, 10 AM – 7 PM IST',
  responseTime: 'We typically respond within a few hours during business hours.',
  conciergeChannelMode: 'WHATSAPP',
  legalBusinessName: 'The Petal & Bloom Studio',
  studioAddress: 'Handmade Floral Craft Studio, India',
  gstin: 'GSTIN-PENDING-UNREGISTERED',
};

// In-memory server fallback cache
let serverCache = { ...DEFAULT_SETTINGS };

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabaseAdmin
        .from('store_settings')
        .select('*')
        .eq('id', 'primary')
        .maybeSingle();

      if (!error && data) {
        serverCache = {
          whatsappNumber: data.whatsapp_number || serverCache.whatsappNumber,
          supportEmail: data.support_email || serverCache.supportEmail,
          instagramHandle: data.instagram_handle || serverCache.instagramHandle,
          instagramUrl: data.instagram_url || serverCache.instagramUrl,
          businessHours: data.business_hours || serverCache.businessHours,
          responseTime: data.response_time || serverCache.responseTime,
          conciergeChannelMode: data.concierge_channel_mode || serverCache.conciergeChannelMode,
          legalBusinessName: data.legal_business_name || serverCache.legalBusinessName,
          studioAddress: data.studio_address || serverCache.studioAddress,
          gstin: data.gstin || serverCache.gstin,
        };
      }
    } catch (err) {
      // Return serverCache on table missing / DB offline
    }

    return res.status(200).json({ success: true, settings: serverCache });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    
    serverCache = {
      ...serverCache,
      ...payload,
    };

    try {
      const dbPayload = {
        id: 'primary',
        whatsapp_number: serverCache.whatsappNumber,
        support_email: serverCache.supportEmail,
        instagram_handle: serverCache.instagramHandle,
        instagram_url: serverCache.instagramUrl,
        business_hours: serverCache.businessHours,
        response_time: serverCache.responseTime,
        concierge_channel_mode: serverCache.conciergeChannelMode,
        legal_business_name: serverCache.legalBusinessName,
        studio_address: serverCache.studioAddress,
        gstin: serverCache.gstin,
        updated_at: new Date().toISOString(),
      };

      await supabaseAdmin
        .from('store_settings')
        .upsert(dbPayload, { onConflict: 'id' });
    } catch (err) {
      // Keep server cache valid even if DB table doesn't exist
    }

    return res.status(200).json({ success: true, settings: serverCache });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
