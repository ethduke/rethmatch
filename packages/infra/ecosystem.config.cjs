module.exports = {
  apps: [
    {
      name: "poke",
      script: "pnpm",
      args: "start:poke",
      cron_restart: "0 * * * *", // Restart every hour.
    },
    {
      name: "indexer",
      script: "pnpm",
      args: "start:indexer",
      cron_restart: "0 * * * *", // Restart every hour.
    },
    {
      name: "auth",
      script: "pnpm",
      args: "start:auth",
      cron_restart: "0 * * * *", // Restart every hour.
    },
  ],
};
