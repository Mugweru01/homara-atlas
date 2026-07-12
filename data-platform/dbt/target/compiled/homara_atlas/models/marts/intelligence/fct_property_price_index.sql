

/*
  Mart Model: fct_property_price_index
  ===========================================================================
  Source:  stg_kenya_listings
  Purpose: The flagship Homara Atlas intelligence product.
           Computes a monthly Property Price Index (PPI) by county
           and property type.

  Methodology:
  - Base period: January 2020 (index = 100) via var('base_price_index_year')
  - Index = (current period avg price / base period avg price) * 100
  - Month-over-month % change
  - Year-over-year % change
  - Listing volume per period

  This model powers:
  - The "Property Price Index" dashboard card
  - The "Price Trends" chart
  - The Atlas Intelligence API /api/v1/analytics/price-index endpoint
*/

with

staged as (
    select * from "homara_atlas"."main_staging"."stg_kenya_listings"
),

-- Monthly aggregation per county + property type
monthly_averages as (
    select
        county,
        property_type,
        date_trunc('month', extracted_at)       as price_month,
        extract(year  from extracted_at)::int   as year,
        extract(month from extracted_at)::int   as month,

        count(distinct listing_id)              as listing_count,
        round(avg(listing_price_ksh), 2)        as avg_price_ksh,
        round(avg(asking_rent_ksh), 2)          as avg_rent_ksh,
        round(avg(price_per_sqft_ksh), 2)       as avg_price_per_sqft_ksh,
        round(avg(gross_yield_pct), 2)          as avg_gross_yield_pct,

        -- Percentile metrics for richer index
        percentile_cont(0.5) within group
            (order by listing_price_ksh)        as median_price_ksh

    from staged
    where listing_price_ksh is not null
    group by 1, 2, 3, 4, 5
),

-- Base period: average price per county + property type in the base year
base_period as (
    select
        county,
        property_type,
        round(avg(avg_price_ksh), 2)            as base_avg_price_ksh
    from monthly_averages
    where year = 2020
    group by 1, 2
),

-- Join current to base to compute the index value
with_index as (
    select
        m.county,
        m.property_type,
        m.price_month,
        m.year,
        m.month,
        m.listing_count,
        m.avg_price_ksh,
        m.median_price_ksh,
        m.avg_rent_ksh,
        m.avg_price_per_sqft_ksh,
        m.avg_gross_yield_pct,

        -- PPI value (100 = base year)
        case
            when b.base_avg_price_ksh > 0
            then round((m.avg_price_ksh / b.base_avg_price_ksh) * 100, 4)
            else null
        end                                     as ppi_value

    from monthly_averages m
    left join base_period b
        on m.county = b.county
        and m.property_type = b.property_type
),

-- Compute MoM and YoY changes using LAG
with_changes as (
    select
        *,

        -- Month-over-month PPI change (%)
        round(
            (ppi_value - lag(ppi_value, 1) over (
                partition by county, property_type
                order by price_month
            )) / nullif(lag(ppi_value, 1) over (
                partition by county, property_type
                order by price_month
            ), 0) * 100
        , 2)                                    as ppi_change_mom_pct,

        -- Year-over-year PPI change (%)
        round(
            (ppi_value - lag(ppi_value, 12) over (
                partition by county, property_type
                order by price_month
            )) / nullif(lag(ppi_value, 12) over (
                partition by county, property_type
                order by price_month
            ), 0) * 100
        , 2)                                    as ppi_change_yoy_pct

    from with_index
),

final as (
    select
        -- Surrogate key
        md5(lower(coalesce(trim(county), '') || '-' || coalesce(trim(property_type), '') || '-' || coalesce(trim(year::text), '') || '-' || coalesce(trim(month::text), '')))
                                                as ppi_key,
        county,
        property_type,
        year,
        month,
        price_month,
        listing_count,
        avg_price_ksh,
        median_price_ksh,
        avg_rent_ksh,
        avg_price_per_sqft_ksh,
        avg_gross_yield_pct,
        ppi_value,
        ppi_change_mom_pct,
        ppi_change_yoy_pct,
        current_timestamp                       as created_at

    from with_changes
)

select * from final