-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone_number text,
  matric_number text,
  profile_image text,
  role text NOT NULL DEFAULT 'user'::text CHECK (role = ANY (ARRAY['user'::text, 'admin'::text])),
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text, 'restricted'::text, 'deactivated'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  must_change_password boolean NOT NULL DEFAULT false,
  CONSTRAINT users_pkey PRIMARY KEY (user_id),
  CONSTRAINT users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.categories (
  category_id bigint NOT NULL DEFAULT nextval('categories_category_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  parent_category_id bigint,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT categories_pkey PRIMARY KEY (category_id),
  CONSTRAINT categories_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES public.categories(category_id)
);
CREATE TABLE public.products (
  product_id bigint NOT NULL DEFAULT nextval('products_product_id_seq'::regclass),
  seller_id uuid NOT NULL,
  category_id bigint NOT NULL,
  title text NOT NULL,
  description text,
  price numeric NOT NULL,
  condition text NOT NULL DEFAULT 'used_good'::text CHECK (condition = ANY (ARRAY['new'::text, 'used_like_new'::text, 'used_good'::text, 'used_fair'::text])),
  image_url text,
  status text NOT NULL DEFAULT 'available'::text CHECK (status = ANY (ARRAY['available'::text, 'sold'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  approval_status text NOT NULL DEFAULT 'pending'::text CHECK (approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'hidden'::text, 'removed'::text])),
  rejection_reason text,
  featured boolean NOT NULL DEFAULT false,
  view_count bigint NOT NULL DEFAULT 0,
  CONSTRAINT products_pkey PRIMARY KEY (product_id),
  CONSTRAINT products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(user_id),
  CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(category_id)
);
CREATE TABLE public.messages (
  message_id bigint NOT NULL DEFAULT nextval('messages_message_id_seq'::regclass),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  product_id bigint,
  message_text text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (message_id),
  CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(user_id),
  CONSTRAINT messages_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.transactions (
  transaction_id bigint NOT NULL DEFAULT nextval('transactions_transaction_id_seq'::regclass),
  product_id bigint NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  agreed_price numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (transaction_id),
  CONSTRAINT transactions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id),
  CONSTRAINT transactions_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(user_id),
  CONSTRAINT transactions_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.reviews (
  review_id bigint NOT NULL DEFAULT nextval('reviews_review_id_seq'::regclass),
  transaction_id bigint NOT NULL,
  reviewer_id uuid NOT NULL,
  reviewee_id uuid NOT NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (review_id),
  CONSTRAINT reviews_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(transaction_id),
  CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(user_id),
  CONSTRAINT reviews_reviewee_id_fkey FOREIGN KEY (reviewee_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.user_warnings (
  warning_id bigint NOT NULL DEFAULT nextval('user_warnings_warning_id_seq'::regclass),
  user_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_warnings_pkey PRIMARY KEY (warning_id),
  CONSTRAINT user_warnings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT user_warnings_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.admin_notes (
  note_id bigint NOT NULL DEFAULT nextval('admin_notes_note_id_seq'::regclass),
  user_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_notes_pkey PRIMARY KEY (note_id),
  CONSTRAINT admin_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT admin_notes_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.reports (
  report_id bigint NOT NULL DEFAULT nextval('reports_report_id_seq'::regclass),
  reporter_id uuid NOT NULL,
  category text NOT NULL CHECK (category = ANY (ARRAY['fraud'::text, 'harassment'::text, 'prohibited_item'::text, 'misleading_listing'::text, 'counterfeit'::text, 'spam'::text, 'fake_review'::text, 'other'::text])),
  reported_user_id uuid,
  reported_product_id bigint,
  reported_review_id bigint,
  description text NOT NULL,
  evidence_url text,
  status text NOT NULL DEFAULT 'new'::text CHECK (status = ANY (ARRAY['new'::text, 'under_review'::text, 'resolved'::text, 'dismissed'::text])),
  assigned_admin_id uuid,
  decision text,
  resolution_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reports_pkey PRIMARY KEY (report_id),
  CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(user_id),
  CONSTRAINT reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.users(user_id),
  CONSTRAINT reports_reported_product_id_fkey FOREIGN KEY (reported_product_id) REFERENCES public.products(product_id),
  CONSTRAINT reports_reported_review_id_fkey FOREIGN KEY (reported_review_id) REFERENCES public.reviews(review_id),
  CONSTRAINT reports_assigned_admin_id_fkey FOREIGN KEY (assigned_admin_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.audit_logs (
  log_id bigint NOT NULL DEFAULT nextval('audit_logs_log_id_seq'::regclass),
  admin_id uuid,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  reason text,
  previous_state jsonb,
  new_state jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (log_id),
  CONSTRAINT audit_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.announcements (
  announcement_id bigint NOT NULL DEFAULT nextval('announcements_announcement_id_seq'::regclass),
  title text NOT NULL,
  body text NOT NULL,
  target_type text NOT NULL DEFAULT 'all'::text CHECK (target_type = ANY (ARRAY['all'::text, 'sellers'::text, 'university'::text, 'campus'::text, 'user'::text])),
  target_value text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT announcements_pkey PRIMARY KEY (announcement_id),
  CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.universities (
  university_id bigint NOT NULL DEFAULT nextval('universities_university_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  CONSTRAINT universities_pkey PRIMARY KEY (university_id)
);
CREATE TABLE public.campuses (
  campus_id bigint NOT NULL DEFAULT nextval('campuses_campus_id_seq'::regclass),
  university_id bigint NOT NULL,
  name text NOT NULL,
  CONSTRAINT campuses_pkey PRIMARY KEY (campus_id),
  CONSTRAINT campuses_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(university_id)
);
CREATE TABLE public.faculties (
  faculty_id bigint NOT NULL DEFAULT nextval('faculties_faculty_id_seq'::regclass),
  campus_id bigint NOT NULL,
  name text NOT NULL,
  CONSTRAINT faculties_pkey PRIMARY KEY (faculty_id),
  CONSTRAINT faculties_campus_id_fkey FOREIGN KEY (campus_id) REFERENCES public.campuses(campus_id)
);
CREATE TABLE public.departments (
  department_id bigint NOT NULL DEFAULT nextval('departments_department_id_seq'::regclass),
  faculty_id bigint NOT NULL,
  name text NOT NULL,
  CONSTRAINT departments_pkey PRIMARY KEY (department_id),
  CONSTRAINT departments_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculties(faculty_id)
);
CREATE TABLE public.pickup_locations (
  pickup_location_id bigint NOT NULL DEFAULT nextval('pickup_locations_pickup_location_id_seq'::regclass),
  campus_id bigint NOT NULL,
  name text NOT NULL,
  CONSTRAINT pickup_locations_pkey PRIMARY KEY (pickup_location_id),
  CONSTRAINT pickup_locations_campus_id_fkey FOREIGN KEY (campus_id) REFERENCES public.campuses(campus_id)
);
CREATE TABLE public.favorites (
  favorite_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  product_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT favorites_pkey PRIMARY KEY (favorite_id),
  CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT favorites_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id)
);