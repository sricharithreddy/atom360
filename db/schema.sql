-- Autoprism Insurance CRM · target database (PostgreSQL)
-- The front end's types in src/domain/types.ts mirror these tables one to one.
-- Every table carries dealer_id so one database serves many dealerships (row-level security by dealer).

create table dealers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  timezone        text not null default 'Asia/Kolkata',
  call_start_hour smallint not null default 8,      -- calls allowed from
  call_end_hour   smallint not null default 18,     -- calls allowed until
  ai_pickup_days  smallint not null default 2,      -- AI picks up a call pending for more than this
  rule_renewer_first boolean not null default true
);

create table branches (
  id        uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references dealers(id),
  name      text not null
);

create type user_role   as enum ('telecaller', 'team_lead', 'admin');
create type user_status as enum ('active', 'on_leave', 'left');

create table users (
  id          uuid primary key default gen_random_uuid(),
  dealer_id   uuid not null references dealers(id),
  branch_id   uuid references branches(id),
  name        text not null,
  mobile      text not null,
  pin_hash    text not null,
  role        user_role not null,
  status      user_status not null default 'active',
  reports_to  uuid references users(id),
  unique (dealer_id, mobile)
);

create table customers (
  id         uuid primary key default gen_random_uuid(),
  dealer_id  uuid not null references dealers(id),
  name       text not null,
  mobile     text not null,
  alt_mobile text,
  email      text,
  language   text not null default 'English',
  address    text,
  do_not_call    boolean not null default false,   -- no calls
  do_not_message boolean not null default false,   -- no WhatsApp, SMS or email either
  wrong_number   boolean not null default false
);

create table vehicles (
  id          uuid primary key default gen_random_uuid(),
  dealer_id   uuid not null references dealers(id),
  customer_id uuid not null references customers(id),
  model       text not null,
  reg_no      text not null,
  chassis_no  text,
  engine_no   text,                                  -- shown as "Motor no" when is_electric
  is_electric boolean not null default false
);

-- A policy that was in force (the one being renewed, or one we issued).
create table policies (
  id          uuid primary key default gen_random_uuid(),
  dealer_id   uuid not null references dealers(id),
  vehicle_id  uuid not null references vehicles(id),
  insurer     text not null,
  policy_no   text,
  policy_type text not null,                         -- 'OD+TP' | 'OD only' | 'TP only'
  od_start date, od_end date,
  tp_start date, tp_end date,
  premium     integer,
  idv         integer,
  ncb_percent smallint,
  issued_by   uuid references users(id),             -- who renewed or issued it with us, if anyone
  issued_on   date,
  is_renewal  boolean not null default true          -- false = the first policy we issued for this vehicle
);

create type lead_source as enum ('own_renewal', 'renewal_from_service', 'renewal_from_sales', 'winback', 'own_lost', 'other_data');
create type lead_status as enum ('not_contacted', 'not_connected', 'callback', 'follow_up', 'hot', 'renewed', 'lost');

create table leads (
  id            uuid primary key default gen_random_uuid(),
  dealer_id     uuid not null references dealers(id),
  customer_id   uuid not null references customers(id),
  vehicle_id    uuid not null references vehicles(id),
  prev_policy_id uuid references policies(id),
  source        lead_source not null,
  status        lead_status not null default 'not_contacted',
  expiry_date   date not null,
  owner_id      uuid not null references users(id),
  allotted_on   date not null default current_date,
  allotted_why  text not null,                       -- 'renewer' | 'renewer_left' | 'round_robin' | 'moved'
  why_now       text,                                -- one line the caller reads first
  next_call_at  timestamptz,
  callback_promised boolean not null default false,
  lost_reason   text,
  ai_qualified_at timestamptz,                       -- AI call ended with "wants to renew"; cleared by a human outcome
  closed_at     timestamptz
);
create index leads_queue on leads (dealer_id, owner_id, status, next_call_at);
create index leads_expiry on leads (dealer_id, expiry_date);

create type quote_kind as enum ('live', 'manual');

create table quotes (
  id        uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references dealers(id),
  lead_id   uuid not null references leads(id),
  insurer   text not null,
  kind      quote_kind not null default 'manual',
  premium   integer,                                 -- incl. GST; null until filled
  idv       integer,
  ncb_percent smallint,
  addons    text,
  payment_link text,
  link_expires_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create type call_by as enum ('caller', 'ai');

create table calls (
  id         uuid primary key default gen_random_uuid(),
  dealer_id  uuid not null references dealers(id),
  lead_id    uuid not null references leads(id),
  made_by    call_by not null default 'caller',
  user_id    uuid references users(id),              -- null for AI
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  connected  boolean,                                -- null until an outcome is logged
  duration_sec integer,
  outcome    text,                                   -- 'agreed' | 'deciding' | 'call_later' | 'closed' | 'no_answer' ...
  reason     text,
  note       text,
  manual     boolean not null default false          -- outcome logged without a call from the CRM
);
create index calls_lead on calls (lead_id, started_at desc);

create table messages (
  id        uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references dealers(id),
  lead_id   uuid not null references leads(id),
  channel   text not null,                           -- 'whatsapp' | 'sms' | 'email'
  template  text not null,
  body      text not null,
  sent_by   uuid references users(id),               -- null when automatic
  sent_at   timestamptz not null default now(),
  status    text not null default 'sent'
);

-- Who looked at a customer's full number or email, and when.
create table contact_reveals (
  id        uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references dealers(id),
  lead_id   uuid not null references leads(id),
  user_id   uuid not null references users(id),
  field     text not null,                           -- 'mobile' | 'email'
  at        timestamptz not null default now()
);

create table targets (
  user_id uuid primary key references users(id),
  policies_per_month smallint not null default 112,
  calls_per_day      smallint not null default 120
);
