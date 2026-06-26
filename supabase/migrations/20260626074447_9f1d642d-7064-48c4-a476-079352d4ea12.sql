
create table if not exists public.knowledge_views (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid references public.knowledge_products(id) on delete cascade,
  slug text not null,
  viewer_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists knowledge_views_slug_idx on public.knowledge_views (slug);
create index if not exists knowledge_views_kid_idx on public.knowledge_views (knowledge_id);

create table if not exists public.knowledge_ratings (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid references public.knowledge_products(id) on delete cascade,
  slug text not null,
  rater_hash text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (knowledge_id, rater_hash)
);
create index if not exists knowledge_ratings_slug_idx on public.knowledge_ratings (slug);

create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  path text not null default '/',
  visitor_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists site_visits_path_idx on public.site_visits (path);
create index if not exists site_visits_created_idx on public.site_visits (created_at desc);

grant all on public.knowledge_views to service_role;
grant all on public.knowledge_ratings to service_role;
grant all on public.site_visits to service_role;

alter table public.knowledge_views enable row level security;
alter table public.knowledge_ratings enable row level security;
alter table public.site_visits enable row level security;
