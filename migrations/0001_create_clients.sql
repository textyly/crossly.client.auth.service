-- Clients (authenticated accounts) for crossly.client.auth.service.
--
-- client_id == the token `sub`; immutable, reused from the guest's id on
-- promote-in-place. Identity is the (provider, provider_subject) pair — the
-- provider's stable subject. email is for display/contact only, NEVER a
-- matching key. Guests are not stored here — only clients that have logged in.

CREATE TABLE IF NOT EXISTS clients (
    client_id        UUID PRIMARY KEY,
    provider         TEXT NOT NULL,
    provider_subject TEXT NOT NULL,
    email            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at    TIMESTAMPTZ,
    UNIQUE (provider, provider_subject)
);
