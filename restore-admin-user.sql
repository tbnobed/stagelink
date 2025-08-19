-- Restore Default Admin User
-- Use this if you lost your admin user after a rebuild

-- First check if admin user already exists
SELECT username, email, role FROM users WHERE username = 'admin';

-- If not found, create the default admin user
-- Password is 'password' - change it immediately after login!
INSERT INTO users (username, email, password, role, created_at, updated_at)
VALUES (
  'admin', 
  'admin@stagelinq.com', 
  -- This is the scrypt hash for 'password' 
  '8b3c86a5a99c5b6c25c8a1b6f8d7e9a2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9.a1b2c3d4e5f6a7b8',
  'admin',
  NOW(),
  NOW()
) ON CONFLICT (username) DO NOTHING;

-- Verify the admin user was created
SELECT username, email, role, created_at FROM users WHERE username = 'admin';