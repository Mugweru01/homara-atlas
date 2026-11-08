export type Series = {
  geography: string;
  market_type: string;
  period_start: string;
  period_end: string;
  median_price: string;
  sample_count: number | null;
  methodology: string;
  source_url: string;
  retrieved_at: string;
  attribution: string;
  license: string;
  source: string;
  slug: string;
  collection_paused: boolean;
  collection_old: boolean;
};
export type Evidence = {
  counties: {
    id: string;
    name: string;
    reference_name: string | null;
    metadata: { region?: string; population_2019?: number; area_km2?: number } | null;
  }[];
  series: Series[];
  amenities: {
    county_id: string;
    category: string;
    count: number;
    coverage: string;
    retrieved_at: string;
  }[];
  captured_at: string;
  notice: string;
};
export type Filters = { county_ids: string[]; market_type: string; as_of: string | null };
export type Inputs = {
  purchase_price: number;
  monthly_rent: number;
  vacancy_percent: number;
  annual_expenses: number;
  acquisition_costs: number;
  deposit_percent: number;
  interest_percent: number;
  loan_years: number;
  rent_growth_percent: number;
  expense_growth_percent: number;
};
export type Scenario = {
  loan_amount: number;
  cash_required: number;
  monthly_payment: number;
  gross_yield_percent: number;
  net_yield_percent: number;
  cash_on_cash_percent: number | null;
  break_even_occupancy_percent: number | null;
  projection: {
    year: number;
    cash_flow: number;
    gross_rent: number;
    expenses: number;
    debt_service: number;
  }[];
  notice: string;
};
export const initial: Inputs = {
  purchase_price: 10000000,
  monthly_rent: 60000,
  vacancy_percent: 8,
  annual_expenses: 120000,
  acquisition_costs: 500000,
  deposit_percent: 30,
  interest_percent: 14,
  loan_years: 20,
  rent_growth_percent: 0,
  expense_growth_percent: 0,
};
export const fields: Record<keyof Inputs, string> = {
  purchase_price: 'Purchase price · KSh',
  monthly_rent: 'Monthly rent · KSh',
  vacancy_percent: 'Vacancy · %',
  annual_expenses: 'Annual operating expenses · KSh',
  acquisition_costs: 'Acquisition costs · KSh',
  deposit_percent: 'Deposit · %',
  interest_percent: 'Fixed annual interest · %',
  loan_years: 'Loan term · years',
  rent_growth_percent: 'Annual rent change · %',
  expense_growth_percent: 'Annual expense change · %',
};
export const clean = (v: string) => v.toLowerCase().replace(/[^a-z]/g, '');
export const money = (n: number | string | null | undefined) =>
  n == null
    ? 'Not available'
    : new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        maximumFractionDigits: 0,
      }).format(Number(n));
export const percent = (n: number | null) => (n === null ? 'Not defined' : n.toFixed(2) + '%');
export const month = (s: string) => s.slice(0, 7);
export function download(name: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export type Amenity = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  source_url: string;
  retrieved_at: string;
  coverage: string;
  attribution: string;
  license: string;
};
export type Saved = {
  id: string;
  name: string;
  created_at: string;
  payload: { filters: Filters; scenario: Inputs | null };
  evidence: Evidence;
};
