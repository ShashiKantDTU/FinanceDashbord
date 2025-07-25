module.exports = {
  siteUrl: 'https://brandname.com',
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
  },
  exclude: ['/api/*'],
  changefreq: 'daily',
  priority: 0.7,
  sitemapSize: 5000,
};