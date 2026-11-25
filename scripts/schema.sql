CREATE TABLE IF NOT EXISTS library_holds (
  account text NOT NULL,
  book_id text NOT NULL,
  placed_by text NOT NULL CHECK (placed_by IN ('agent', 'person')),
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account, book_id)
);

CREATE TABLE IF NOT EXISTS library_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account text NOT NULL,
  action text NOT NULL CHECK (action IN ('placed_hold', 'viewed_holds')),
  actor text NOT NULL CHECK (actor IN ('agent', 'person')),
  book_id text,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS library_activity_account_id ON library_activity (account, id DESC);
