const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

function formatLog(level, context, message, data) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        context,
        message
    };
    if (data) {
        if (data instanceof Error) {
            entry.error = { message: data.message, stack: data.stack };
        } else {
            entry.data = data;
        }
    }
    return JSON.stringify(entry);
}

function log(level, context, message, data) {
    if (LOG_LEVELS[level] > CURRENT_LEVEL) return;
    const output = formatLog(level, context, message, data);
    if (level === 'error') {
        console.error(output);
    } else if (level === 'warn') {
        console.warn(output);
    } else {
        console.log(output);
    }
}

module.exports = {
    error: (context, message, data) => log('error', context, message, data),
    warn: (context, message, data) => log('warn', context, message, data),
    info: (context, message, data) => log('info', context, message, data),
    debug: (context, message, data) => log('debug', context, message, data)
};
