{{
    config(
        materialized='view',
        schema='staging',
        tags=['staging', 'kenya']
    )
}}

/*
  Staging Model: stg_kenya_listings
  ===========================================================================
  Source:  atlas_raw.kenya_listings  (Redshift Spectrum / S3 Data Lake)
  Purpose: Clean, cast, rename, and enrich raw Kenya property listing records.

  Rules applied at this layer:
  - Cast all columns to their correct data types
  - Rename source columns to Atlas naming conventions
  - Derive computed columns (price_per_sqft, geography_key)
  - Filter out obviously bad records (null listing_id, zero/negative prices)
  - No aggregation — this model is 1:1 with the source rows

  This model feeds into:
  - dim_neighbourhood (dimension population)
  - fct_property_price_index (mart aggregation)
*/

with

source as (
    select * from {{ source('atlas_raw', 'kenya_listings') }}
),

cleaned as (
    select
        -- Identity
        listing_id,

        -- Geography (Geography key: MD5 of county + neighbourhood for joining to dim_geography)
        md5(lower(coalesce(trim(county), '') || '-' || coalesce(trim(neighbourhood), ''))) as geography_key,
        county,
        neighbourhood,

        -- Property attributes
        trim(property_type)                             as property_type,
        cast(bedrooms as integer)                       as bedrooms,
        cast(size_sqft as integer)                      as size_sqft,
        cast(year_built as integer)                     as year_built,

        -- Financial measures (in KES)
        cast(listing_price_ksh as decimal(18, 2))       as listing_price_ksh,
        cast(asking_rent_ksh as decimal(18, 2))         as asking_rent_ksh,

        -- Derived measures
        case
            when size_sqft > 0
            then round(cast(listing_price_ksh as decimal(18, 2)) / size_sqft, 2)
            else null
        end                                             as price_per_sqft_ksh,

        -- Gross yield estimate (annual rent / price * 100)
        case
            when listing_price_ksh > 0 and asking_rent_ksh > 0
            then round((asking_rent_ksh * 12) / listing_price_ksh * 100, 2)
            else null
        end                                             as gross_yield_pct,

        -- Provenance
        source                                          as data_source,
        cast(extracted_at as timestamp)                 as extracted_at,
        current_timestamp                               as _loaded_at

    from source

    where
        listing_id      is not null
        and listing_price_ksh > 0
        and county      is not null
        and neighbourhood is not null
)

select * from cleaned
