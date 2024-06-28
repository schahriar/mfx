import puppeteer from 'puppeteer';
import path from "node:path";
import cp from "node:child_process";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const delay = (timeout = 1000) => {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
};

const main = async () => {
  const browser = await puppeteer.launch({
    headless: false
  });
  const page = await browser.newPage();

  const build = cp.spawn("npm", ["start"]);

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
  await page.setViewport({width: 1080, height: 1024});

  await page.waitForSelector(".dropzone");

  page.on('dialog', async dialog => {
    console.log("DIALOG", dialog.message());
  });

  const [fileChooser] = await Promise.all([
    page.waitForFileChooser(),
    await page.click(".dropzone"),
  ]);
  await fileChooser.accept([path.resolve(__dirname, "../samples/coverr-tourist-boats-573-1080p.mp4")]);
  const fileSaver = await page.waitForFileChooser();
  await fileSaver.accept(["/tmp/out.file"]);
  console.log("Click", fileSaver);

  await delay(60000);

  await browser.close();
  build.kill();
};

(async () => {
  try {
    main();
  } catch(error) {
    console.trace(error);
  }
})();
