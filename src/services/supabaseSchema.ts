export const SUPABASE_SQL_SCHEMA = `-- ====================================================================
-- Queue Turn Production PostgreSQL / Supabase Database Schema
-- Run this in Supabase SQL Editor to provision tables, indexes, and RLS
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. BUSINESSES TABLE
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    business_type TEXT NOT NULL DEFAULT 'other',
    logo_url TEXT,
    address TEXT,
    phone TEXT,
    brand_color TEXT DEFAULT '#2563eb',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. QUEUES TABLE
CREATE TABLE IF NOT EXISTS public.queues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    prefix TEXT DEFAULT 'A',
    start_number INT DEFAULT 1,
    next_number INT DEFAULT 1,
    current_number INT,
    current_entry_id UUID,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
    average_service_minutes INT DEFAULT 10,
    allow_estimated_wait BOOLEAN DEFAULT TRUE,
    max_queue_size INT DEFAULT 100,
    allow_customer_cancel BOOLEAN DEFAULT TRUE,
    enable_sound BOOLEAN DEFAULT TRUE,
    active_counter_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, slug)
);

-- 4. COUNTERS TABLE
CREATE TABLE IF NOT EXISTS public.counters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue_id UUID NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'busy', 'offline')),
    current_entry_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. QUEUE ENTRIES TABLE
CREATE TABLE IF NOT EXISTS public.queue_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue_id UUID NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    display_number TEXT NOT NULL,
    sequence_number INT NOT NULL,
    customer_session_id TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'calling', 'serving', 'completed', 'skipped', 'cancelled')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    called_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    counter_id UUID REFERENCES public.counters(id) ON DELETE SET NULL,
    counter_name TEXT,
    notes TEXT
);

-- 6. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'staff')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE UNIQUE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'business')),
    status TEXT NOT NULL DEFAULT 'active',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ANALYTICS TABLE
CREATE TABLE IF NOT EXISTS public.analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue_id UUID NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_visitors INT DEFAULT 0,
    completed_visitors INT DEFAULT 0,
    skipped_visitors INT DEFAULT 0,
    average_wait_minutes NUMERIC DEFAULT 0,
    average_service_minutes NUMERIC DEFAULT 0,
    peak_hour TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(queue_id, date)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_queues_business ON public.queues(business_id);
CREATE INDEX IF NOT EXISTS idx_entries_queue_status ON public.queue_entries(queue_id, status);
CREATE INDEX IF NOT EXISTS idx_entries_session ON public.queue_entries(customer_session_id);
CREATE INDEX IF NOT EXISTS idx_counters_queue ON public.counters(queue_id);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ FOR DISPLAY & CUSTOMER QUEUE
CREATE POLICY "Public can view active queues" ON public.queues
    FOR SELECT USING (true);

CREATE POLICY "Public can view queue entries for active queues" ON public.queue_entries
    FOR SELECT USING (true);

CREATE POLICY "Public can insert queue entry to join" ON public.queue_entries
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update own queue entry status (leave queue)" ON public.queue_entries
    FOR UPDATE USING (true);

-- STAFF POLICIES
CREATE POLICY "Staff can manage business queue entries" ON public.queue_entries
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage queues" ON public.queues
    FOR ALL USING (auth.uid() IS NOT NULL);
`;
