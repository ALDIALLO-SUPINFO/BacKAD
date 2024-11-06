// src/middleware/logger.js

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

const getStatusColor = (status) => {
    if (status >= 500) return colors.red;
    if (status >= 400) return colors.yellow;
    if (status >= 300) return colors.cyan;
    if (status >= 200) return colors.green;
    return colors.reset;
};

const formatTime = (time) => {
    if (time < 100) return `${time}ms`;
    if (time < 1000) return `${time.toFixed(0)}ms`;
    return `${(time/1000).toFixed(2)}s`;
};

const loggerMiddleware = (req, res, next) => {
    const start = Date.now();
    const { method, originalUrl, ip } = req;

    // Ajouter un ID unique à la requête
    req.requestId = Math.random().toString(36).substring(7);

    // Intercepter la fin de la réponse
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const statusColor = getStatusColor(status);

        console.log(
            `${colors.dim}[${new Date().toISOString()}]${colors.reset} ` +
            `${colors.bright}${method}${colors.reset} ` +
            `${originalUrl} ` +
            `${statusColor}${status}${colors.reset} ` +
            `${colors.yellow}${formatTime(duration)}${colors.reset} ` +
            `${colors.dim}${ip}${colors.reset} ` +
            `${colors.magenta}#${req.requestId}${colors.reset}`
        );

        // Log du body en développement
        if (process.env.NODE_ENV === 'development' && req.method !== 'GET') {
            console.log(colors.dim, 'Body:', JSON.stringify(req.body, null, 2), colors.reset);
        }

        // Log des erreurs
        if (status >= 400) {
            console.error(
                colors.red,
                `Error #${req.requestId}:`,
                res.locals.error || 'No error details',
                colors.reset
            );
        }
    });

    next();
};

module.exports = { loggerMiddleware };