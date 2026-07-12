-- =============================================================================
-- Homara Atlas — Redshift Spectrum External Table Definitions
-- =============================================================================
-- These DDL statements define EXTERNAL TABLES that allow Redshift to query
-- raw Parquet files stored in S3 directly, without loading them first.
-- This is the "lake house" query pattern.
--
-- Run this ONCE in your Redshift cluster to set up the external schema.
-- IAM role must have: s3:GetObject, s3:ListBucket on the Data Lake bucket.
-- =============================================================================

-- 1. Create External Schema pointing to the S3 Data Lake (via AWS Glue Catalog)
CREATE EXTERNAL SCHEMA IF NOT EXISTS atlas_raw
FROM DATA CATALOG
DATABASE 'homara_atlas_glue_db'
IAM_ROLE 'arn:aws:iam::ACCOUNT_ID:role/HomaraAtlasRedshiftRole'
CREATE EXTERNAL DATABASE IF NOT EXISTS;

-- 2. External Table: Kenya Property Listings (raw Parquet from EL pipeline)
--    Partitioned by ingestion date for efficient querying.
CREATE EXTERNAL TABLE atlas_raw.kenya_listings (
    listing_id          VARCHAR(50),
    neighbourhood       VARCHAR(100),
    county              VARCHAR(100),
    property_type       VARCHAR(50),
    bedrooms            SMALLINT,
    listing_price_ksh   DECIMAL(18, 2),
    asking_rent_ksh     DECIMAL(18, 2),
    size_sqft           INT,
    year_built          SMALLINT,
    source              VARCHAR(100),
    extracted_at        VARCHAR(50)
)
PARTITIONED BY (year INT, month INT, day INT)
STORED AS PARQUET
LOCATION 's3://homara-atlas-datalake-prod-us-east-1/raw/kenya/listings/'
TABLE PROPERTIES ('classification'='parquet');

-- 3. Add today's partition (run daily via Airflow DAG)
-- Replace YYYY, MM, DD with actual values or parametrize in Airflow
ALTER TABLE atlas_raw.kenya_listings
ADD PARTITION (year=2026, month=07, day=12)
LOCATION 's3://homara-atlas-datalake-prod-us-east-1/raw/kenya/listings/2026/07/12/';
