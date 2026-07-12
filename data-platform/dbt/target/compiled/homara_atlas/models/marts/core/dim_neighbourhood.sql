

/*
  Dimension Model: dim_neighbourhood
  ===========================================================================
  Source:  stg_kenya_listings
  Purpose: Build a clean, distinct neighbourhood dimension table.
           One row per unique county + neighbourhood combination.

  In production this will be enriched with:
  - Population data (Kenya National Bureau of Statistics)
  - GPS coordinates (OpenStreetMap Overpass API)
  - Administrative boundaries (county/sub-county classification)
  - Infrastructure proximity scores (future Phase)
*/

with

staging as (
    select * from "homara_atlas"."main_staging"."stg_kenya_listings"
),

-- Aggregate per neighbourhood to compute representative metrics
neighbourhood_metrics as (
    select
        geography_key,
        county,
        neighbourhood,

        -- Representative averages for the neighbourhood
        round(avg(listing_price_ksh), 2)    as avg_listing_price_ksh,
        round(avg(asking_rent_ksh), 2)      as avg_rent_ksh,
        round(avg(price_per_sqft_ksh), 2)   as avg_price_per_sqft_ksh,
        round(avg(gross_yield_pct), 2)      as avg_gross_yield_pct,
        count(distinct listing_id)          as total_listings_observed,
        min(extracted_at)                   as first_seen_at,
        max(extracted_at)                   as last_seen_at

    from staging
    group by 1, 2, 3
),

final as (
    select
        geography_key,
        county,
        neighbourhood,

        -- Classify urban tier based on county (expandable via seed table)
        case
            when county in ('Nairobi')              then 'Tier 1 — Metro'
            when county in ('Mombasa', 'Kisumu')    then 'Tier 2 — City'
            when county in ('Nakuru', 'Eldoret')    then 'Tier 3 — Town'
            else                                         'Tier 4 — Rural'
        end                                         as urban_tier,

        -- Default country (Atlas focuses on Kenya first)
        'Kenya'                                     as country,

        -- Market metrics from observed listings
        avg_listing_price_ksh,
        avg_rent_ksh,
        avg_price_per_sqft_ksh,
        avg_gross_yield_pct,
        total_listings_observed,
        first_seen_at,
        last_seen_at,
        current_timestamp                           as updated_at

    from neighbourhood_metrics
)

select * from final