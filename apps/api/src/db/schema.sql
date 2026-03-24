CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  user_tag TEXT NOT NULL CHECK (user_tag IN ('employee', 'employer', 'customer')),
  trade_type TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  persona_inquiry_id TEXT,
  selfie_match_passed BOOLEAN NOT NULL DEFAULT FALSE,
  profile_photo_url TEXT,
  bio TEXT,
  years_experience INTEGER,
  hourly_rate NUMERIC(10,2),
  open_to_work BOOLEAN NOT NULL DEFAULT FALSE,
  rating_average NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  trust_badge TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  union_status TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  is_business_verified BOOLEAN NOT NULL DEFAULT FALSE,
  business_name TEXT,
  business_license_url TEXT,
  ein_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  trade_category TEXT NOT NULL,
  description TEXT NOT NULL,
  hourly_rate_min NUMERIC(10,2) NOT NULL,
  hourly_rate_max NUMERIC(10,2) NOT NULL,
  job_type TEXT NOT NULL,
  benefits TEXT,
  county_location TEXT,
  location_zip TEXT NOT NULL,
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 20.00,
  stripe_payment_intent_id TEXT,
  deposit_status TEXT NOT NULL DEFAULT 'pending',
  applications_count INTEGER NOT NULL DEFAULT 0,
  views_count INTEGER NOT NULL DEFAULT 0,
  is_surge BOOLEAN NOT NULL DEFAULT FALSE,
  union_required BOOLEAN NOT NULL DEFAULT FALSE,
  certifications_required JSONB NOT NULL DEFAULT '[]'::jsonb,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_listing_id UUID NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted',
  message TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  employer_viewed BOOLEAN NOT NULL DEFAULT FALSE,
  employer_response_at TIMESTAMPTZ,
  days_without_response INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quick_cash_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_title TEXT NOT NULL,
  description TEXT NOT NULL,
  trade_category TEXT NOT NULL,
  budget_min NUMERIC(10,2) NOT NULL,
  budget_max NUMERIC(10,2) NOT NULL,
  location_zip TEXT NOT NULL,
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  is_surge BOOLEAN NOT NULL DEFAULT FALSE,
  estimated_hours NUMERIC(10,2),
  escrow_amount NUMERIC(10,2),
  stripe_payment_intent_id TEXT,
  assigned_worker_id UUID REFERENCES users(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS county_location TEXT;

CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quick_cash_post_id UUID NOT NULL REFERENCES quick_cash_posts(id) ON DELETE CASCADE,
  bid_amount NUMERIC(10,2) NOT NULL,
  message TEXT,
  availability TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewed_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  review_type TEXT NOT NULL,
  related_job_id UUID REFERENCES job_listings(id) ON DELETE SET NULL,
  related_qc_post_id UUID REFERENCES quick_cash_posts(id) ON DELETE SET NULL,
  reviewer_submitted BOOLEAN NOT NULL DEFAULT TRUE,
  reviewed_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  is_visible BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cert_name TEXT NOT NULL,
  issuing_body TEXT,
  document_url TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  persona_doc_id TEXT,
  expires_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  attachment_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_text TEXT NOT NULL,
  photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  video_url TEXT,
  is_proof_wall BOOLEAN NOT NULL DEFAULT FALSE,
  trade_tag TEXT NOT NULL,
  location_display TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  respects_count INTEGER NOT NULL DEFAULT 0,
  impressed_count INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  notes TEXT,
  pipeline_stage TEXT NOT NULL DEFAULT 'Lead',
  project_value NUMERIC(12,2),
  last_contact_at TIMESTAMPTZ,
  follow_up_at TIMESTAMPTZ,
  follow_up_sent BOOLEAN NOT NULL DEFAULT FALSE,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_tag_verified ON users(user_tag, is_verified);
CREATE INDEX IF NOT EXISTS idx_jobs_status_posted ON job_listings(status, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_quick_cash_status_posted ON quick_cash_posts(status, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_created ON social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_owner_stage ON crm_contacts(owner_id, pipeline_stage);
