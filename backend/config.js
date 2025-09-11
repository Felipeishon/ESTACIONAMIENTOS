require('dotenv').config();

const config = {
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    numberOfSpots: 27,
    spotNames: [
        'MATTA6060', 'MATTA6067', 'MISTRAL1017', 'MISTRAL1018', 'MISTRAL3005',
        'MISTRAL3006', 'MISTRAL3100', 'MISTRAL3101', 'MISTRAL3103', 'MISTRAL3104',
        'MISTRAL4087', 'MISTRAL4088', 'MISTRAL4089', 'MISTRAL4090', 'MISTRAL4137',
        'MISTRAL4140', 'MISTRAL4147', 'RADISON1', 'RADISON2', 'RADISON3',
        'RADISON4', 'RADISON5', 'RADISON6', 'RADISON7', 'RADISON8',
        'RADISON9', 'RADISON10'
    ],
    logLevel: process.env.LOG_LEVEL || 'info',
    allowedOrigins: process.env.ALLOWED_ORIGINS ?
        process.env.ALLOWED_ORIGINS.split(',') :
        ['http://localhost:3000', 'http://localhost:8000'],
    dbPath: process.env.DB_PATH || './db.json',
    allowedEmailDomain: `@${process.env.ALLOWED_EMAIL_DOMAIN || 'gmail.com'}`,
    apiNinjasKey: process.env.API_NINJAS_KEY || 'YOUR_API_KEY',
    email: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        // Use 'true' string in .env for secure, as env vars are strings
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        from: process.env.EMAIL_FROM || `"Sistema de Reservas" <${process.env.EMAIL_USER}>`
    },
    jwtSecret: process.env.JWT_SECRET || 'a-very-secret-key',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123'
};

module.exports = config;