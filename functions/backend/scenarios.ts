import { object, exact, InputError } from './validation.js';
export const scenarioDefaults = {
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
export function scenarioInputs(raw: unknown) {
  const v = object(raw);
  exact(v, Object.keys(scenarioDefaults));
  const result = { ...scenarioDefaults };
  for (const key of Object.keys(result) as (keyof typeof result)[]) {
    const n = v[key];
    if (typeof n !== 'number' || !Number.isFinite(n))
      throw new InputError('invalid_scenario_' + key);
    result[key] = n;
  }
  if (
    result.purchase_price < 1 ||
    result.purchase_price > 1e12 ||
    result.monthly_rent < 0 ||
    result.monthly_rent > 1e9 ||
    result.annual_expenses < 0 ||
    result.annual_expenses > 1e10 ||
    result.acquisition_costs < 0 ||
    result.acquisition_costs > 1e12 ||
    result.vacancy_percent < 0 ||
    result.vacancy_percent > 100 ||
    result.deposit_percent < 0 ||
    result.deposit_percent > 100 ||
    result.interest_percent < 0 ||
    result.interest_percent > 100 ||
    !Number.isInteger(result.loan_years) ||
    result.loan_years < 1 ||
    result.loan_years > 40 ||
    result.rent_growth_percent < -50 ||
    result.rent_growth_percent > 50 ||
    result.expense_growth_percent < -50 ||
    result.expense_growth_percent > 50
  )
    throw new InputError('scenario_out_of_range');
  return result;
}
export function calculateScenario(raw: unknown) {
  const v = scenarioInputs(raw),
    loan = v.purchase_price * (1 - v.deposit_percent / 100),
    rate = v.interest_percent / 1200,
    months = v.loan_years * 12;
  // log1p/expm1 avoid cancellation and Infinity at very small positive rates.
  const payment =
    loan === 0
      ? 0
      : rate === 0
        ? loan / months
        : (loan * rate) / -Math.expm1(-months * Math.log1p(rate));
  const cash = v.purchase_price - loan + v.acquisition_costs,
    total = v.purchase_price + v.acquisition_costs;
  const projection = Array.from({ length: 10 }, (_, i) => {
    const gross = v.monthly_rent * 12 * Math.pow(1 + v.rent_growth_percent / 100, i),
      occupied = gross * (1 - v.vacancy_percent / 100),
      expenses = v.annual_expenses * Math.pow(1 + v.expense_growth_percent / 100, i),
      noi = occupied - expenses,
      debt = i < v.loan_years ? payment * 12 : 0;
    return {
      year: i + 1,
      gross_rent: gross,
      occupied_rent: occupied,
      expenses,
      net_operating_income: noi,
      debt_service: debt,
      cash_flow: noi - debt,
    };
  });
  return {
    inputs: v,
    loan_amount: loan,
    cash_required: cash,
    monthly_payment: payment,
    gross_yield_percent: ((v.monthly_rent * 12) / total) * 100,
    net_yield_percent: (projection[0].net_operating_income / total) * 100,
    cash_on_cash_percent: cash > 0 ? (projection[0].cash_flow / cash) * 100 : null,
    break_even_occupancy_percent:
      v.monthly_rent > 0
        ? ((v.annual_expenses + payment * 12) / (v.monthly_rent * 12)) * 100
        : null,
    projection,
    methodology: 'scenario/1',
    notice:
      'User assumptions, nominal KES. Fixed-rate fully amortising loan; end-of-month payments. No appreciation, sale proceeds, tax calculation, insurance, lender fees or costs beyond the amounts entered. Not a forecast or investment recommendation.',
  };
}
