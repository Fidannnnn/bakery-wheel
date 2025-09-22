CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  device_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prizes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,        -- 'coffee' | 'pastry' | 'discount'
  value TEXT,                -- '10%' or SKU
  weight INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS spins (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  prize_id INT NOT NULL REFERENCES prizes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_hash TEXT,
  device_hash TEXT
);

CREATE TABLE IF NOT EXISTS codes (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  prize_id INT NOT NULL REFERENCES prizes(id),
  code TEXT UNIQUE NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ,
  redeemed_by TEXT,
  status TEXT NOT NULL DEFAULT 'issued'  -- issued | redeemed | expired
);

INSERT INTO prizes (name,type,value,weight,active) VALUES
('Free Coffee','coffee',NULL,45,TRUE),
('Mini Pastry','pastry','SKU:MINI_PASTRY',35,TRUE),
('10% Off','discount','10%',18,TRUE),
('20% Off','discount','20%',2,TRUE)
ON CONFLICT DO NOTHING;
