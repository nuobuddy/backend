-- Initialize database schema for nuobuddy

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' NOT NULL,
    "isActive" BOOLEAN DEFAULT true NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'))
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "difyConversationId" VARCHAR(255),
    title VARCHAR(255),
    share BOOLEAN DEFAULT false NOT NULL,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    "conversationId" UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    description VARCHAR(255),
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations("userId");
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages("conversationId");
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Insert default system settings
INSERT INTO system_settings (key, value, description) VALUES
    ('site_name', 'Nuobuddy', 'Site name'),
    ('site_description', 'AI Buddy System', 'Site description'),
    ('max_conversations_per_user', '50', 'Maximum conversations per user')
ON CONFLICT (key) DO NOTHING;

-- Insert default admin account (password: admin123456)
INSERT INTO users (username, email, "passwordHash", role) VALUES
    ('admin', 'admin@nuobuddy.com', '$2b$10$znhzmaig0JivpCLgc67t0.F72C3dBPOrnDINCHIKGp159sggYNkpq', 'admin')
ON CONFLICT (email) DO NOTHING;
