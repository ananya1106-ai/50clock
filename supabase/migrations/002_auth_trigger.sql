-- ==============================================================================
-- SmartPDS Migration: 002_auth_trigger.sql
-- Automatic Profile Provisioning & Secure Role Assignment Trigger
-- ==============================================================================

-- 1. Create or replace the handle_new_user security definer function
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  is_first_user boolean;
  assigned_role text;
  user_name text;
begin
  -- Check if this is the first registered user in the entire system
  select (count(*) = 0) into is_first_user from public.user_profiles;

  -- Extract user display name or derive from email prefix
  user_name := coalesce(
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  -- Secure Role Allocation Logic:
  -- The first registered account OR pre-designated official administrator emails
  -- are granted Administrator status. All other signups receive safe default Ration Shop Dealer.
  if is_first_user or lower(new.email) in (
    'devendraagarwal907@gmail.com',
    'admin@smartpds.gov.in',
    'sunil.verma@smartpds.gov.in',
    '2k24.csai1a.2412094@gmail.com',
    'visionvibes14589@gmail.com',
    'hackathonnn123@gmail.com',
    'aglpihu2006@gmail.com'
  ) then
    assigned_role := 'Administrator';
  else
    assigned_role := 'Ration Shop Dealer';
  end if;

  -- Insert profile directly into public.user_profiles
  insert into public.user_profiles (
    id,
    email,
    name,
    role,
    designation,
    department,
    is_active,
    last_login,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    user_name,
    assigned_role,
    case
      when assigned_role = 'Administrator' then 'State Systems & Security Administrator'
      when assigned_role = 'Warehouse Operator' then 'Senior Warehouse Intake & Gate Operator'
      else 'Licensed Fair Price Shop Dealer'
    end,
    case
      when assigned_role = 'Administrator' then 'Civil Supplies IT Directorate'
      when assigned_role = 'Warehouse Operator' then 'Depot Bay Operations'
      else 'Fair Price Shop Network'
    end,
    true,
    now(),
    now(),
    now()
  )
  on conflict (id) do update set
    last_login = now(),
    updated_at = now();

  return new;
end;
$$;

-- 2. Bind trigger to Supabase auth.users table
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
