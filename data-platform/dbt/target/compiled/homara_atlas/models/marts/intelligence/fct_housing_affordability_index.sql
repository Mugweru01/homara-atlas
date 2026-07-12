

/*
  Mart Model: fct_housing_affordability_index
  ===========================================================================
  Source:  stg_kenya_listings + (future: KNBS income data seed)
  Purpose: Monthly Housing Affordability Index (HAI) per county.

  Methodology (standard HAI):
  - HAI = (Median Household Income / Qualifying Income for Median Home) * 100
  - HAI > 100: majority of households CAN afford the median-priced home
  - HAI < 100: majority of households CANNOT afford the median-priced home

  Until live income data is ingested from KNBS, estimated county income
  figures are seeded from the seeds/county_income_estimates.csv file.

  This model powers:
  - The "Housing Affordability Index" dashboard card
  - The Atlas API /api/v1/analytics/affordability endpoint
*/

with

listings as (
    select * from "homara_atlas"."main_staging"."stg_kenya_listings"
),

-- Monthly median prices per county
monthly_prices as (
    select
        county,
        date_trunc('month', extracted_at)       as price_month,
        extract(year  from extracted_at)::int   as year,
        extract(month from extracted_at)::int   as month,

        percentile_cont(0.5) within group
            (order by listing_price_ksh)        as median_home_price_ksh,
        count(distinct listing_id)              as listing_count

    from listings
    where listing_price_ksh is not null
    group by 1, 2, 3, 4
),

-- Estimated monthly household income per county (from seed — replaced by KNBS in prod)
-- Source: Kenya National Bureau of Statistics Economic Survey estimates
county_income as (
    select
        county,
        estimated_monthly_income_ksh
    from "homara_atlas"."main_seeds"."county_income_estimates"
),

-- Standard mortgage qualifying income calculation:
-- Assumes: 20% down, 30-year term, 13% interest rate (Kenya CBK rate ~2024)
with_affordability as (
    select
        p.county,
        p.price_month,
        p.year,
        p.month,
        p.listing_count,
        p.median_home_price_ksh,
        i.estimated_monthly_income_ksh,

        -- Monthly mortgage payment on 80% of median price at 13% over 30 years
        -- M = P * [r(1+r)^n] / [(1+r)^n - 1]
        round(
            (p.median_home_price_ksh * 0.8)
            * (0.13/12 * power(1 + 0.13/12, 360))
            / (power(1 + 0.13/12, 360) - 1)
        , 2)                                    as monthly_mortgage_payment_ksh,

        -- Qualifying income = monthly mortgage / 0.28 (standard 28% housing ratio)
        round(
            ((p.median_home_price_ksh * 0.8)
            * (0.13/12 * power(1 + 0.13/12, 360))
            / (power(1 + 0.13/12, 360) - 1))
            / 0.28
        , 2)                                    as qualifying_income_ksh

    from monthly_prices p
    left join county_income i using (county)
),

final as (
    select
        md5(lower(coalesce(trim(county), '') || '-' || coalesce(trim(year::text), '') || '-' || coalesce(trim(month::text), '')))
                                                as hai_key,
        county,
        year,
        month,
        price_month,
        listing_count,
        median_home_price_ksh,
        estimated_monthly_income_ksh,
        monthly_mortgage_payment_ksh,
        qualifying_income_ksh,

        -- HAI Score
        case
            when qualifying_income_ksh > 0 and estimated_monthly_income_ksh is not null
            then round(estimated_monthly_income_ksh / qualifying_income_ksh * 100, 2)
            else null
        end                                     as hai_score,

        -- Human readable classification
        case
            when estimated_monthly_income_ksh / nullif(qualifying_income_ksh, 0) * 100 >= 120 then 'Highly Affordable'
            when estimated_monthly_income_ksh / nullif(qualifying_income_ksh, 0) * 100 >= 100 then 'Affordable'
            when estimated_monthly_income_ksh / nullif(qualifying_income_ksh, 0) * 100 >= 80  then 'Moderately Unaffordable'
            when estimated_monthly_income_ksh / nullif(qualifying_income_ksh, 0) * 100 >= 60  then 'Unaffordable'
            else 'Severely Unaffordable'
        end                                     as affordability_band,

        current_timestamp                       as created_at

    from with_affordability
)

select * from final