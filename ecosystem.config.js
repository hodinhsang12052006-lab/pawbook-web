module.exports = {
  apps: [
    {
      name: "scraper-services",
      script: "npx ts-node scripts/scrape_services.ts",
      instances: 1,
      autorestart: false, // Run as a cron/task, do not infinite restart
      watch: false,
      max_memory_restart: "1G",
      cron_restart: "0 0 * * *", // Run once a day at midnight
      env: {
        NODE_ENV: "production",
        MONGO_URI: "mongodb://localhost:27017",
        PROXY_SERVER: "", // Configure dynamic rotatory proxies here
      }
    },
    {
      name: "scraper-jobs",
      script: "npx ts-node scripts/scrape_jobs.ts",
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: "1G",
      cron_restart: "0 1 * * *", // Run once a day at 1:00 AM
      env: {
        NODE_ENV: "production",
        MONGO_URI: "mongodb://localhost:27017",
        PROXY_SERVER: "",
      }
    },
    {
      name: "scraper-cvs",
      script: "npx ts-node scripts/scrape_cvs.ts",
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: "1G",
      cron_restart: "0 2 * * *", // Run once a day at 2:00 AM
      env: {
        NODE_ENV: "production",
        MONGO_URI: "mongodb://localhost:27017",
        PROXY_SERVER: "",
        RECRUITER_AUTH_TOKEN: "" // Inject cookie auth headers/tokens
      }
    }
  ]
};
