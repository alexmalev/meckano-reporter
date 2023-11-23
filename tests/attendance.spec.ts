/* eslint-disable no-continue */
/* eslint-disable no-await-in-loop */
import { test, expect } from "@playwright/test";

const logger = console;

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
  while (!(await isDone())) {
    const rowToFill = page
      .locator("tr[data-report_data_id]", {
        has: page.locator(".undertime", { hasText: ":" }),
      })
      .first();
    const rowId = await rowToFill.locator(".employee-information").innerText();
    const currentRow = page.locator("tr[data-report_data_id]", {
      has: page.locator(".employee-information", { hasText: rowId }),
    });
    const missingHours = await currentRow.locator("td.undertime").innerText();
    if (!missingHours) continue;

    const startTime = "09:00";
    const endTime = calculateEndTime(startTime, missingHours);

    const startTimeTd = currentRow.locator("td.checkin");
    await startTimeTd.locator("span.checkin").click();

    const startTimeInput = startTimeTd.locator(".report-entry");
    await startTimeInput.waitFor({ state: "visible" });
    await startTimeInput.fill(startTime.replace(":", ""));
    await startTimeInput.press("Enter");
    await expect(startTimeTd.locator("span.checkin")).toHaveText(startTime);

    const endTimeTd = currentRow.locator("td.checkout");
    await endTimeTd.locator("span.checkout").click();

    const endTimeInput = endTimeTd.locator(".report-entry");
    await endTimeInput.waitFor({ state: "visible" });
    await endTimeInput.fill(endTime.replace(":", ""));
    await startTimeInput.press("Enter");
    await expect(currentRow.locator("td.total-hours")).toHaveText(missingHours);
  }
  logger.log(`Done!. Visit ${page.url()} to verify and lock the report`);
});
