const isServer = (config) => config.name === 'server';

module.exports = {
  webpack: (config) => {
    if (!isServer(config)) {
      config.resolve.alias['@sentry/node'] = '@sentry/browser';
    }
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  reactStrictMode: true,
}
