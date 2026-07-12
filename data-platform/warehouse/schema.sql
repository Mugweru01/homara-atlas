-- =============================================================================
-- Homara Atlas — Data Warehouse Star Schema (Redshift / PostgreSQL Compatible)
-- =============================================================================
-- Purpose: OLAP-optimised schema for property market intelligence.
-- Source:  Public, open, and anonymised datasets ONLY.
-- No PII, no operational data, no Homara production data.
--
-- Schema design follows Kimball Dimensional Modelling principles.
-- Tables are partitioned and sorted for Redshift query performance.
-- =============================================================================

-- =============================================================================
-- SCHEMA SETUP
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS atlas_staging;   -- Raw-landed data, not yet transformed
CREATE SCHEMA IF NOT EXISTS atlas_core;      -- Final dimensional model (facts + dims)
CREATE SCHEMA IF NOT EXISTS atlas_mart;      -- Aggregated intelligence products

-- =============================================================================
-- DIMENSION TABLES — atlas_core
-- =============================================================================

-- 1. Date Dimension (pre-populated calendar table)
CREATE TABLE atlas_core.dim_date (
    date_key        INT             NOT NULL PRIMARY KEY,   -- YYYYMMDD integer key
    full_date       DATE            NOT NULL,
    day_of_week     SMALLINT        NOT NULL,               -- 1=Monday, 7=Sunday
    day_name        VARCHAR(10)     NOT NULL,
    day_of_month    SMALLINT        NOT NULL,
    day_of_year     SMALLINT        NOT NULL,
    week_of_year    SMALLINT        NOT NULL,
    month_of_year   SMALLINT        NOT NULL,
    month_name      VARCHAR(10)     NOT NULL,
    quarter         SMALLINT        NOT NULL,
    year            SMALLINT        NOT NULL,
    is_weekend      BOOLEAN         NOT NULL,
    is_holiday      BOOLEAN         NOT NULL DEFAULT FALSE  -- Kenyan public holidays
) SORTKEY (full_date);

-- 2. Geography Dimension (counties, sub-counties, neighbourhoods)
CREATE TABLE atlas_core.dim_geography (
    geography_key   VARCHAR(64)     NOT NULL PRIMARY KEY,   -- MD5 surrogate key
    country         VARCHAR(50)     NOT NULL DEFAULT 'Kenya',
    county          VARCHAR(100)    NOT NULL,               -- e.g., 'Nairobi', 'Mombasa'
    sub_county      VARCHAR(100),
    neighbourhood   VARCHAR(100)    NOT NULL,               -- e.g., 'Westlands', 'Karen'
    latitude        DECIMAL(9, 6),
    longitude       DECIMAL(9, 6),
    is_urban        BOOLEAN         NOT NULL DEFAULT TRUE,
    population_est  INT,                                    -- From public census data
    area_sqkm       DECIMAL(10, 2),
    created_at      TIMESTAMP       NOT NULL DEFAULT GETDATE(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT GETDATE()
) SORTKEY (county, neighbourhood);

-- 3. Property Type Dimension
CREATE TABLE atlas_core.dim_property_type (
    property_type_key   SMALLINT        NOT NULL PRIMARY KEY,
    property_type_name  VARCHAR(50)     NOT NULL,           -- 'Apartment', 'Villa', 'Land'
    property_category   VARCHAR(50)     NOT NULL,           -- 'Residential', 'Commercial'
    description         VARCHAR(255)
);

-- Seed common property types
INSERT INTO atlas_core.dim_property_type VALUES
    (1, 'Apartment',   'Residential', 'Flat or apartment unit'),
    (2, 'Villa',       'Residential', 'Detached or semi-detached villa'),
    (3, 'Townhouse',   'Residential', 'Terraced or townhouse unit'),
    (4, 'Bungalow',    'Residential', 'Single storey standalone house'),
    (5, 'Maisonette',  'Residential', 'Two storey house within a complex'),
    (6, 'Land',        'Land',        'Bare land or plot'),
    (7, 'Office',      'Commercial',  'Commercial office space'),
    (8, 'Retail',      'Commercial',  'Retail or shop unit'),
    (9, 'Warehouse',   'Commercial',  'Industrial or warehouse space');

-- 4. Data Source Dimension (tracks provenance of every record)
CREATE TABLE atlas_core.dim_data_source (
    source_key      SMALLINT        NOT NULL PRIMARY KEY,
    source_name     VARCHAR(100)    NOT NULL,               -- e.g., 'kenya_knbs', 'synthetic'
    source_type     VARCHAR(50)     NOT NULL,               -- 'PUBLIC_API', 'SYNTHETIC', 'SCRAPE'
    source_url      VARCHAR(500),
    is_authoritative BOOLEAN        NOT NULL DEFAULT FALSE,
    ingested_by     VARCHAR(100)    NOT NULL DEFAULT 'atlas-ingestion-worker'
);

INSERT INTO atlas_core.dim_data_source VALUES
    (1, 'synthetic_public_data', 'SYNTHETIC',  NULL,                                   FALSE, 'atlas-ingestion-worker'),
    (2, 'kenya_knbs',            'PUBLIC_API', 'https://knbs.or.ke/open-data',          TRUE,  'atlas-ingestion-worker'),
    (3, 'openstreetmap',         'PUBLIC_API', 'https://overpass-api.de',              TRUE,  'atlas-ingestion-worker'),
    (4, 'kenya_land_registry',   'PUBLIC_API', 'https://ardhi.go.ke',                  TRUE,  'atlas-ingestion-worker');

-- =============================================================================
-- FACT TABLES — atlas_core
-- =============================================================================

-- 5. Fact: Property Listings (one row per listing observation)
CREATE TABLE atlas_core.fact_listings (
    listing_key         BIGINT          NOT NULL IDENTITY(1,1),
    listing_id          VARCHAR(50)     NOT NULL,           -- Natural key from source
    geography_key       VARCHAR(64)     NOT NULL REFERENCES atlas_core.dim_geography(geography_key),
    property_type_key   SMALLINT        NOT NULL REFERENCES atlas_core.dim_property_type(property_type_key),
    source_key          SMALLINT        NOT NULL REFERENCES atlas_core.dim_data_source(source_key),
    date_key            INT             NOT NULL REFERENCES atlas_core.dim_date(date_key),
    -- Measures
    listing_price_ksh   DECIMAL(18, 2),                    -- Sale price in KES
    asking_rent_ksh     DECIMAL(18, 2),                    -- Monthly rent in KES
    size_sqft           INT,
    bedrooms            SMALLINT,
    price_per_sqft_ksh  DECIMAL(18, 2),                    -- Derived: price / size
    days_on_market      INT,
    -- Audit
    extracted_at        TIMESTAMP       NOT NULL,
    loaded_at           TIMESTAMP       NOT NULL DEFAULT GETDATE()
)
DISTKEY (geography_key)
SORTKEY (date_key, geography_key);

-- 6. Fact: Neighbourhood Price Snapshots (aggregated monthly, feeds the Price Index)
CREATE TABLE atlas_core.fact_neighbourhood_price_snapshot (
    snapshot_key            BIGINT      NOT NULL IDENTITY(1,1),
    geography_key           VARCHAR(64) NOT NULL REFERENCES atlas_core.dim_geography(geography_key),
    property_type_key       SMALLINT    NOT NULL REFERENCES atlas_core.dim_property_type(property_type_key),
    date_key                INT         NOT NULL REFERENCES atlas_core.dim_date(date_key),
    -- Measures (all aggregated from fact_listings for the month)
    listing_count           INT         NOT NULL DEFAULT 0,
    avg_listing_price_ksh   DECIMAL(18, 2),
    median_listing_price_ksh DECIMAL(18, 2),
    avg_rent_ksh            DECIMAL(18, 2),
    median_rent_ksh         DECIMAL(18, 2),
    avg_price_per_sqft_ksh  DECIMAL(18, 2),
    min_price_ksh           DECIMAL(18, 2),
    max_price_ksh           DECIMAL(18, 2),
    -- Audit
    snapshot_date           DATE        NOT NULL,
    created_at              TIMESTAMP   NOT NULL DEFAULT GETDATE()
)
DISTKEY (geography_key)
SORTKEY (date_key, geography_key);

-- =============================================================================
-- MART TABLES — atlas_mart (pre-aggregated intelligence products)
-- =============================================================================

-- 7. Property Price Index (monthly, by county — the flagship Atlas product)
CREATE TABLE atlas_mart.property_price_index (
    ppi_key             BIGINT          NOT NULL IDENTITY(1,1),
    county              VARCHAR(100)    NOT NULL,
    property_type_name  VARCHAR(50)     NOT NULL,
    year                SMALLINT        NOT NULL,
    month               SMALLINT        NOT NULL,
    -- Index values (base: Jan 2020 = 100)
    ppi_value           DECIMAL(10, 4)  NOT NULL,
    ppi_change_mom      DECIMAL(10, 4),                    -- Month-over-month change %
    ppi_change_yoy      DECIMAL(10, 4),                    -- Year-over-year change %
    avg_price_ksh       DECIMAL(18, 2),
    listing_count       INT,
    created_at          TIMESTAMP       NOT NULL DEFAULT GETDATE()
)
SORTKEY (county, year, month);

-- 8. Housing Affordability Index
CREATE TABLE atlas_mart.housing_affordability_index (
    hai_key             BIGINT          NOT NULL IDENTITY(1,1),
    county              VARCHAR(100)    NOT NULL,
    year                SMALLINT        NOT NULL,
    month               SMALLINT        NOT NULL,
    -- HAI = Median household income / Income needed to afford median-priced home
    hai_score           DECIMAL(10, 4)  NOT NULL,          -- > 1 = affordable
    median_home_price_ksh DECIMAL(18,2),
    estimated_monthly_income_ksh DECIMAL(18,2),
    created_at          TIMESTAMP       NOT NULL DEFAULT GETDATE()
)
SORTKEY (county, year, month);
