-- ==============================================================================
-- Homara Atlas: Operational Schema
-- ==============================================================================
-- Safe to re-run: all statements use IF NOT EXISTS / DROP IF EXISTS guards.
-- Run this in: Supabase Dashboard → SQL Editor
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name              VARCHAR(255) NOT NULL,
    billing_email     VARCHAR(255) NOT NULL,
    subscription_tier VARCHAR(50)  DEFAULT 'FREE',
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. User Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    role            VARCHAR(50) DEFAULT 'VIEWER',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Developer API Keys
CREATE TABLE IF NOT EXISTS public.api_keys (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    key_hash        VARCHAR(255) NOT NULL UNIQUE,
    key_prefix      VARCHAR(10)  NOT NULL,
    name            VARCHAR(100) NOT NULL,
    is_active       BOOLEAN      DEFAULT TRUE,
    expires_at      TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at    TIMESTAMP WITH TIME ZONE
);

-- 4. Ingestion Job Logs
CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_name      VARCHAR(100) NOT NULL,
    status            VARCHAR(50)  NOT NULL,
    records_processed INT          DEFAULT 0,
    error_message     TEXT,
    started_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at      TIMESTAMP WITH TIME ZONE
);

-- Row Level Security
ALTER TABLE public.organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_jobs  ENABLE ROW LEVEL SECURITY;

-- Drop policies before recreating (idempotent)
DROP POLICY IF EXISTS "Users see their own org"       ON public.organizations;
DROP POLICY IF EXISTS "Users see org profiles"         ON public.user_profiles;
DROP POLICY IF EXISTS "Users see org API keys"         ON public.api_keys;
DROP POLICY IF EXISTS "Anyone can view ingestion jobs" ON public.ingestion_jobs;

-- RLS Policies
CREATE POLICY "Users see their own org" ON public.organizations
    FOR SELECT USING (id IN (
        SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users see org profiles" ON public.user_profiles
    FOR SELECT USING (organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users see org API keys" ON public.api_keys
    FOR SELECT USING (organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Anyone can view ingestion jobs" ON public.ingestion_jobs
    FOR SELECT USING (true);
