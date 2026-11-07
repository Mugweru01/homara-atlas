import { createHash } from 'node:crypto';
export class InputError extends Error { constructor(public readonly code: string) { super(code); } }
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function uuid(value: string): string { if (!UUID.test(value)) throw new InputError('invalid_uuid'); return value; }
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('expected_object');
  return value as Record<string, unknown>;
}
export function exact(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new InputError('unexpected_fields');
}
export function text(value: unknown, max: number, required = true): string | null {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) throw new InputError('invalid_text');
  return value.trim();
}
export function oneOf<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new InputError('invalid_enum'); return value as T;
}
function number(value: unknown, max: number, required = true): number | null {
  if (value == null && !required) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > max) throw new InputError('invalid_number'); return value;
}
export function httpsUrl(value: unknown): string {
  const raw = text(value, 2000)!; let url: URL;
  try { url = new URL(raw); } catch { throw new InputError('invalid_url'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) throw new InputError('invalid_public_url');
  return url.toString();
}
export function instant(value: unknown, now = Date.now()): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new InputError('invalid_timestamp');
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time > now + 300000 || time < Date.UTC(2000,0,1)) throw new InputError('invalid_timestamp');
  return new Date(time).toISOString();
}
export const listingKeys = ['source_listing_id','source_url','observed_at','source_updated_at','listing_type','property_type','county_id','neighbourhood','bedrooms','bathrooms','price_amount','currency','rent_period','floor_area_sqm','plot_area_sqm','availability','status_evidence'];
export function listing(value: unknown, now = Date.now()) {
  const v = object(value); exact(v, listingKeys);
  const type = oneOf(v.listing_type, ['sale','rent']);
  if(v.property_type==='land'&&v.floor_area_sqm!=null)throw new InputError('land_requires_plot_area');
  const availability = oneOf(v.availability, ['active','withdrawn','sold','let','unknown']);
  const evidence = oneOf(v.status_evidence, ['advertisement','provider_confirmation']);
  if (['sold','let'].includes(availability) && evidence !== 'provider_confirmation') throw new InputError('unconfirmed_outcome');
  const bedrooms = v.bedrooms == null ? null : v.bedrooms;
  if (bedrooms !== null && (typeof bedrooms !== 'number' || !Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > 30)) throw new InputError('invalid_bedrooms');
  const bathrooms=v.bathrooms==null?null:v.bathrooms;
  if(bathrooms!==null&&(typeof bathrooms!=='number'||!Number.isInteger(bathrooms)||bathrooms<0||bathrooms>30))throw new InputError('invalid_bathrooms');
  const rentPeriod = type === 'rent' ? oneOf(v.rent_period, ['month','week','day']) : null;
  if (type === 'sale' && v.rent_period != null) throw new InputError('sale_has_rent_period');
  const observed = instant(v.observed_at, now);
  const updated = v.source_updated_at == null ? null : instant(v.source_updated_at, now);
  if (updated && updated > observed) throw new InputError('source_update_after_observation');
  return {
    source_listing_id: text(v.source_listing_id,160)!, source_url: httpsUrl(v.source_url), observed_at: observed, source_updated_at: updated,
    listing_type: type, property_type: oneOf(v.property_type, ['apartment','house','land','office','retail','warehouse']),
    county_id: uuid(String(v.county_id)), neighbourhood: text(v.neighbourhood,120,false), bedrooms, bathrooms,
    price_amount: number(v.price_amount,1e12)!, currency: oneOf(v.currency,['KES']), rent_period: rentPeriod,
    floor_area_sqm: number(v.floor_area_sqm,1e7,false), plot_area_sqm: number(v.plot_area_sqm,1e9,false), availability, status_evidence: evidence,
  };
}
export type Listing = ReturnType<typeof listing>;
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.keys(value).sort().map(key => JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}';
  return JSON.stringify(value);
}
export const hash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
export function pagination(query: Record<string,string>) {
  const limit = query.limit == null ? 50 : Number(query.limit), offset = query.offset == null ? 0 : Number(query.offset);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 10000) throw new InputError('invalid_pagination');
  return { limit, offset };
}
