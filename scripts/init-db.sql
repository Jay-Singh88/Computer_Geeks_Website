-- Computer Geeks invoicing system schema.
-- Run ONCE, manually, against the Vercel Postgres database:
--   psql "$POSTGRES_URL" -f scripts/init-db.sql
-- Safe to re-run (every statement is idempotent).

CREATE TABLE IF NOT EXISTS clients (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001;

CREATE TABLE IF NOT EXISTS invoices (
  id                          SERIAL PRIMARY KEY,
  number                      TEXT NOT NULL UNIQUE,           -- 'INV-1001'
  client_id                   INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  status                      TEXT NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','sent','paid','void')),
  currency                    TEXT NOT NULL DEFAULT 'INR',    -- ISO 4217
  subtotal_cents              INTEGER NOT NULL DEFAULT 0,
  tax_rate_percent            NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_cents                   INTEGER NOT NULL DEFAULT 0,
  total_cents                 INTEGER NOT NULL DEFAULT 0,
  notes                       TEXT,
  due_date                    DATE,
  issued_at                   TIMESTAMPTZ,
  paid_at                     TIMESTAMPTZ,
  public_token                TEXT NOT NULL UNIQUE,           -- crypto.randomUUID(), app-generated
  stripe_checkout_session_id  TEXT,
  stripe_payment_intent_id    TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_public_token_idx ON invoices(public_token);
CREATE INDEX IF NOT EXISTS invoices_status_idx       ON invoices(status);
CREATE INDEX IF NOT EXISTS invoices_client_id_idx    ON invoices(client_id);

CREATE TABLE IF NOT EXISTS invoice_items (
  id                SERIAL PRIMARY KEY,
  invoice_id        INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description       TEXT NOT NULL,
  quantity          NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price_cents  INTEGER NOT NULL,
  amount_cents      INTEGER NOT NULL,     -- quantity * unit_price_cents, computed app-side
  sort_order        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON invoice_items(invoice_id);

-- Brute-force protection for /api/admin/login (see api/_lib/auth.js).
CREATE TABLE IF NOT EXISTS login_attempts (
  ip               TEXT PRIMARY KEY,
  failed_count     INTEGER NOT NULL DEFAULT 0,
  first_failed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until     TIMESTAMPTZ
);
