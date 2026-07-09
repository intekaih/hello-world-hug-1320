module.exports = {
    apps: [{
        name: 'moviecc',
        script: 'server.js',
        instances: 2,           // Termux RAM gioi han: 2 instances thay vi 4
        exec_mode: 'cluster',   // Cluster mode cho hieu nang
        autorestart: true,
        watch: false,
        max_memory_restart: '350M', // Giam tu 512M vi RAM Termux gioi han
        node_args: '--max-old-space-size=350',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        // Log
        error_file: './logs/error.log',
        out_file: './logs/access.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        merge_logs: true,
        // Graceful restart
        kill_timeout: 5000,
        listen_timeout: 8000,
        // Auto restart khi crash
        min_uptime: '10s',
        max_restarts: 10
    }]
};
