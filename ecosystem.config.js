module.exports = {
  apps: [{
    name: 'upwork-proposal-generator',
    script: './backend/server.js',
    cwd: '/root/upwork-proposal-generator',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/root/upwork-proposal-generator/logs/error.log',
    out_file: '/root/upwork-proposal-generator/logs/out.log',
    log_file: '/root/upwork-proposal-generator/logs/combined.log',
    time: true
  }]
};
