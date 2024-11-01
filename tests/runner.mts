import puppeteer from 'puppeteer';
import path from "node:path";
import cp from "node:child_process";
import fs from "node:fs/promises";
import assert from "node:assert";
import herb from "herb";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { TestDefinition } from './types';

herb.config({
  prependTime: true,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const shouldOverride = Object.keys(process.env).includes("CREATE_SNAPSHOTS") && process.env["CREATE_SNAPSHOTS"] !== "false";
const snapshotsDir = path.join(__dirname, "snapshots");

const delay = (timeout = 1000) => {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
};

const main = async () => {
  const browser = await puppeteer.launch({
    headless: true,
  });
  const page = await browser.newPage();
  const build = cp.spawn("npm", ["start"]);
  build.stdout.pipe(process.stdout)

  const [buildURL] = await new Promise<RegExpMatchArray>(async (resolve, reject) => {
    let text = "";
    let found = false;

    for await (const data of build.stderr) {
      text += data;

      if (text.match(/(http:\/\/localhost:\d+\/)/)) {
        resolve(text.match(/(http:\/\/localhost:\d+\/)/) as RegExpMatchArray);
        found = true;
        break;
      }
    }

    if (!found) {
      reject(new Error("Could not find a build URL"));
    }
  });

  await new Promise(async (resolve, reject) => {
    for (let i = 0; i < 20; i++) {
      try {
        cp.execSync(`curl ${buildURL}`);
        resolve(null);
        return;
      } catch (error) {
        await delay((i + 1) * 250);
      }
    }
    reject(new Error(`Build url (${buildURL}) is not responding`));
  });

  await page.goto(buildURL);
  await page.setViewport({ width: 1080, height: 1024 });

  const definitions: TestDefinition[] = await page.evaluate(() => {
    return window["definitions"];
  });

  for (let def of definitions) {
    if (def.skip) continue;
    const testName = `Testing ${def.title}`;
    herb.group(testName);
    herb.log(herb.blue("Running test"));
    await page.goto(path.join(buildURL, def.path));
    await page.waitForSelector(".container");
    const { hash, snapshot } = await page.evaluate(async () => {
      await window["results"].done;
      return window["results"];
    });

    const newSnapshot = { hash, snapshot };

    let buffer: string = "{}";
    const snapshotFilePath = path.join(snapshotsDir, `${def.id}.snapshot`);
    try {
      buffer = await fs.readFile(snapshotFilePath, { encoding: "utf8" });
    } catch (error) {
      herb.warn(`Failed to open snapshot for ${def.id}`);
    }

    const currentSnapshot = JSON.parse(buffer);

    if (shouldOverride) {
      await fs.writeFile(snapshotFilePath, JSON.stringify(newSnapshot));
      herb.warn(`Overriding snapshot in ${snapshotFilePath}`);
    } else {
      try {
        assert.deepStrictEqual(newSnapshot, currentSnapshot);
      } catch (error) {
        herb.error("Snapshot failed");
        throw error;
      }
    }

    herb.log(herb.green("Snapshot passed"));
    herb.groupEnd(testName);
  }

  await browser.close();
  build.kill();
};

(async () => {
  try {
    main();
  } catch (error) {
    console.trace(error);
  }
})();
