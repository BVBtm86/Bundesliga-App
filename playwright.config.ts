import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", fullyParallel: false, workers: 1, timeout: 30000,
  use: {baseURL: "http://127.0.0.1:3000", browserName: "chromium", channel: "chrome", screenshot: "only-on-failure"},
  projects: [
    {name:"desktop",use:{viewport:{width:1440,height:1050}}},
    {name:"mobile",use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}
  ]
});
