-- ==============================================================================
-- THE PETAL & BLOOM ATELIER — PRODUCTION AUDIT LOG SCHEMA COMPATIBILITY MIGRATION
-- Adds native first-class columns to public.audit_logs to prevent schema cache errors
-- ==============================================================================

DO $$
BEGIN
    -- 1. Ensure actor_email exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'audit_logs' 
          AND column_name = 'actor_email'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN actor_email text;
    END IF;

    -- 2. Ensure old_values exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'audit_logs' 
          AND column_name = 'old_values'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN old_values jsonb;
    END IF;

    -- 3. Ensure new_values exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'audit_logs' 
          AND column_name = 'new_values'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN new_values jsonb;
    END IF;

    -- 4. Ensure reason exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'audit_logs' 
          AND column_name = 'reason'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN reason text;
    END IF;

    -- 5. Ensure user_agent exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'audit_logs' 
          AND column_name = 'user_agent'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN user_agent text;
    END IF;
END $$;

-- Optimize index coverage for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_email ON public.audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
