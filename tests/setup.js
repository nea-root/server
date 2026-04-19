// Provide env vars before any module loads
process.env.JWT_SECRET = 'test_jwt_secret_32chars_minimum!!';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32chars_min!!';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.MONGODB_URI = 'mongodb://localhost:27017/nea_test';
process.env.SMTP_HOST = 'smtp.test.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@test.com';
process.env.SMTP_PASS = 'testpass';
process.env.FROM_EMAIL = 'noreply@test.com';
process.env.FROM_NAME = 'Test';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
process.env.EMERGENCY_NUMBER = '911';
process.env.CLIENT_URL = 'http://localhost:3000';
