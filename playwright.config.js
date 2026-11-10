import { defineConfig } from '@playwright/test';
const port=process.env.TIEBREAK_TEST_PORT||'5174';
const baseURL=`http://localhost:${port}`;
export default defineConfig({
  testDir:'./tests/browser',fullyParallel:false,workers:1,timeout:30000,
  reporter:'list',
  use:{baseURL,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,viewport:{width:1440,height:1000},screenshot:'only-on-failure'},
  webServer:{command:'npm run build && npm run preview',url:baseURL,env:{PORT:port},reuseExistingServer:false,timeout:30000},
});
