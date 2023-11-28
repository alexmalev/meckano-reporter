/* eslint-disable no-await-in-loop */
import { test, expect } from "@playwright/test";

const logger = console;

const hebrewMonths = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

test("fill hours", async ({ page }) => {
  if (!process.env.USERNAME || !process.env.PASSWORD) {
    logger.error("Missing username or password in .env file");
    throw new Error("Missing username or password");
  }

  logger.log("Navigating to meckano");
  await page.goto("https://app.meckano.co.il");

  logger.log("Logging in");
  await page.locator("#email").fill(process.env.USERNAME!);
  await page.locator("#password").fill(process.env.PASSWORD!);
  await page.locator("#submitButtons").getByRole("button").click();
  await page.waitForLoadState("networkidle");

  logger.log("Navigating to attendance page");
  await page.locator("#li-monthly-employee-report").click();
  await page.locator(".employee-report").waitFor({ state: "visible" });

  logger.log("validating that the month is correct");
  const monthToFill = new Date().getMonth();
  const reportMonth = await page
    .locator(".report-select-date")
    .first()
    .locator(".sbSelector")
    .innerText();

  const reportMonthIndex = hebrewMonths.indexOf(reportMonth!);
  if (monthToFill < reportMonthIndex) {
    logger.log("Going back a month");
    await page.locator(".arrowRight").click();
    await page.locator(".employee-report").waitFor({ state: "visible" });
  }

  const isDone = async () => {
    const reportedHours = await page.locator(".presence-hours").textContent();
    const requiredHours = await page.locator(".standard-hours").textContent();
    logger.log(`${reportedHours} / ${requiredHours}`);
    return reportedHours === requiredHours;
  };

  const calculateEndTime = (startTime: string, missingHours: string) => {
    const [startHours, startMinutes] = startTime.split(":");
    const [missingHoursInt, missingMinutesInt] = missingHours
      .split(":")
      .map((x) => Number(x));
    const endTime = new Date(
      0,
      0,
      0,
      Number(startHours) + missingHoursInt,
      Number(startMinutes) + missingMinutesInt,
    );
    return `${endTime.getHours()}:${
      endTime.getMinutes() === 0 ? "00" : endTime.getMinutes()
    }`;
  };

  logger.log("Performing magic");

  const startTime = "09:00";

  const missingRowLocator = page.locator("tr[data-report_data_id]", {
    has: page.locator("td.undertime", { hasText: ":" }),
  });
  const allRowsToFill = await missingRowLocator.all();

  const datesToFill = await Promise.all(
    allRowsToFill.map(async (row) => {
      const missingHours = await row.locator("td.undertime").innerText();
      const date = await row.locator(".employee-information").innerText();
      return {
        date,
        endTime: calculateEndTime(startTime, missingHours),
      };
    }),
  );

  await page.locator(".free-reporting").click();

  const reportLocator = page.locator(".hours-report");
  await expect(reportLocator).toBeVisible();

  // eslint-disable-next-line no-restricted-syntax
  for (const { date, endTime } of datesToFill) {
    const rowToFill = page.locator("tr", {
      has: page.locator(".dateText", { hasText: date }),
    });
    await rowToFill.locator("input.checkIn").fill(startTime.replace(":", ""));
    await rowToFill.locator("input.checkOut").fill(endTime.replace(":", ""));
  }

  await page.locator("button.update-freeReporting").click();

  logger.log(
    "Waiting for the report to be submitted. this will take a couple of seconds",
  );

  await expect(page.locator("#freeReporting-dialog")).toBeHidden({
    timeout: 120000,
  });

  expect(await isDone()).toBeTruthy();

  logger.log(`Done!. Visit ${page.url()} to verify and lock the report`);
});
