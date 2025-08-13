module.exports = {
    apps: [
      {
        name: 'mystreamingapp-backend',
        script: 'dist/app.js',
        instances: 'max',
        exec_mode: 'cluster',
        env: {
          NODE_ENV: 'development',
          PORT: 5000,
        },
        env_production: {
          NODE_ENV: 'production',
          PORT: 5000,
        },
        error_file: 'logs/error.log',
        out_file: 'logs/output.log',
        log_file: 'logs/combined.log',
        time: true,
        max_memory_restart: '1G',
        node_args: '--max-old-space-size=1024',
        watch: false,
        ignore_watch: ['node_modules', 'logs'],
        max_restarts: 10,
        min_uptime: '10s',
      },
    ],
  };