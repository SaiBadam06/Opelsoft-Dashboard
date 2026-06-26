-- Add new document types to the existing enum
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'work_auth';
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'driving_licence';
