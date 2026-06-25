-- Run in Supabase SQL Editor to confirm RLS is enabled and policies exist.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'profiles';
-- Expect: rowsecurity = true

select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by policyname;
-- Expect: read own profile (SELECT), admin reads all profiles (SELECT),
--         update own profile (UPDATE), admin updates any profile (UPDATE)
