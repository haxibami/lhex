// fetch latest Windows Subsystem for Android package and extract libhoudini from it
// dependencies: bsdtar
// NOTE: requires sudo while executing, as it needs to mount vendor.img

import {
  bold,
  copy,
  crypto,
  cyan,
  DOMParser,
  Element,
  ensureDir,
  green,
  hex,
  Kia,
  parse,
  path,
  red,
} from "./deps.ts";

import { chmodDir, cleanUp, decompress, mountImage } from "./util.ts";

import type { Body, PackageInfo } from "./types.ts";

// variables
const VERSION = "0.1.0";
const endpoint = "https://store.rg-adguard.net/api/GetFiles";
const targetAppName = "MicrosoftCorporationII.WindowsSubsystemForAndroid";
const releaseType = "Nightly";
const data: Body = {
  type: "ProductId",
  url: "9P3395VX91NR",
  ring: "Retail",
};
const filelist = [
  "bin/houdini",
  "bin/houdini64",
  "bin/arm",
  "bin/arm64",
  "lib/arm",
  "lib/libhoudini.so",
  "lib64/arm64",
  "lib64/libhoudini.so",
];

const args = parse(Deno.args, {
  string: ["_"],
  boolean: ["help", "version"],
  alias: { h: "help", v: "version" },
});

const usage =
  `lhex - extract libhoudini from latest Windows Subsystem for Android package

${bold("Usage")}
  lhex <output directory> [options]

${bold("Options")}
  -h, --help                 Show this help message
  -v, --version              Show version
`;

if (args.help) {
  console.log(usage);
  Deno.exit(0);
} else if (args.version) {
  console.log(`lhex ${VERSION}`);
  Deno.exit(0);
} else if (args._.length !== 1) {
  console.log(usage);
  Deno.exit(1);
} else if (Deno.build.os !== "linux") {
  console.error(red("lhex only works on Linux"));
  Deno.exit(1);
}

// setup working directory
const workDir = await Deno.makeTempDir({ prefix: "lhex-" });
await ensureDir(workDir);
const mountPoint = path.join(workDir, "mnt/lhex");

// fetch package info html

try {
  const kia_fetch_html = new Kia({
    text: "Fetching package info...",
  });
  kia_fetch_html.start();

  const params = new URLSearchParams();
  for (const key in data) {
    params.append(key, data[key]);
  }
  const html = await fetch(endpoint, {
    method: "POST",
    body: params,
  }).then(
    (res) => {
      kia_fetch_html.succeed("Fetched package info");
      return res.text();
    },
  ).catch((err) => {
    kia_fetch_html.fail("Failed to fetch package info. Exiting...");
    console.error(
      `\n${red("Error")}: returned invalid response`,
    );
    console.trace(err);
    throw err;
  });

  // parse html and get package info
  const kia_parse_html = new Kia({
    text: "Parsing package info...",
  });
  kia_parse_html.start();

  const doc = new DOMParser().parseFromString(html, "text/html");

  if (doc === null) {
    kia_parse_html.fail("Failed to parse package info. Exiting...");
    console.error(
      `\n${red("Error")}: invalid package info html`,
    );
    throw new Error("invalid package info html");
  }

  const getPackageInfo = (rows: Element[]): PackageInfo | undefined => {
    for (const row of rows) {
      const link = row.querySelector("a");
      if (link == null) {
        continue;
      }
      const url = link.getAttribute("href");
      if (url == null) {
        continue;
      }
      const filename = link.textContent;
      const version = filename.split("_")[1];
      const checksum = row.querySelectorAll("td")[2].textContent;
      if (
        filename.includes("msixbundle") && filename.includes(targetAppName) &&
        url.split("/")[2].split(".").slice(-2).join(".") === "microsoft.com"
      ) {
        return {
          url: url,
          filename: filename,
          checksum: checksum,
          version: version,
        };
      } else {
        continue;
      }
    }
  };

  const packageInfo = getPackageInfo(
    Array.from(doc.querySelectorAll("tr")).map((row) => row as Element),
  );

  if (packageInfo === undefined) {
    kia_parse_html.fail("Failed to parse package info. Exiting...");
    console.error(
      `\n${red("error")}: no valid package info entry found`,
    );
    throw new Error("no valid package info entry found");
  } else {
    kia_parse_html.succeed("Parsed package info");
    console.log(
      `\n  ${green("URL")}: ${packageInfo.url}`,
    );
    console.log(
      `  ${green("Filename")}: ${packageInfo.filename}`,
    );
    console.log(
      `  ${green("Checksum")}: ${packageInfo.checksum}`,
    );
    console.log(
      `  ${green("Version")}: ${packageInfo.version}\n`,
    );
  }

  // fetch package
  const kia_fetch_package = new Kia({
    text: "Fetching package. This may take a while...",
  });
  kia_fetch_package.start();

  const file = await Deno.create(path.join(workDir, packageInfo.filename));

  await fetch(packageInfo.url).then((res) => {
    if (!res.ok) {
      kia_fetch_package.fail("Failed to fetch package. Exiting...");
      console.error(
        `\n${red("Error")}: server returned ${res.status}`,
      );
      throw new Error(`server returned ${res.status}`);
    } else {
      if (res.body === null) {
        kia_fetch_package.fail("Failed to fetch package. Exiting...");
        console.error(
          `\n${red("Error")}: server returned no body`,
        );
        throw new Error("server returned no body");
      }
      return res.body;
    }
  }).then(async (body) => {
    await body.pipeTo(file.writable);
  }).catch((err) => {
    kia_fetch_package.fail("Failed to fetch package. Exiting...");
    console.error(
      `\n${red("Error")}: cannot write to ${
        path.join(workDir, packageInfo.filename)
      }`,
    );
    console.trace(err);
    throw err;
  });

  kia_fetch_package.succeed("Fetched package");

  // compare checksum
  const kia_checksum = new Kia({
    text: "Comparing checksum...",
  });
  kia_checksum.start();

  const checksum = new TextDecoder().decode(hex.encode(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-1",
        await Deno.readFile(path.join(workDir, packageInfo.filename)).catch(
          (err) => {
            kia_checksum.fail("Failed to compare checksum. Exiting...");
            console.error(
              `\n${red("Error")}: no package file`,
            );
            console.trace(err);
            throw err;
          },
        ),
      ),
    ),
  ));

  if (checksum !== packageInfo.checksum) {
    kia_checksum.fail("Something wrong while comparing checksum. Exiting...");
    console.error(
      `${red("Error")}: checksum mismatch`,
    );
    throw new Error("checksum mismatch");
  } else {
    kia_checksum.succeed("Checksum matched");
  }

  // extract package
  const kia_extract = new Kia({
    text: "Extracting package...",
  });
  kia_extract.start();

  const decomp1 = await decompress(
    path.join(workDir, packageInfo.filename),
    `WsaPackage_${packageInfo.version}_x64_Release-${releaseType}.msix`,
    workDir,
  );

  if (decomp1 instanceof Error) {
    kia_extract.fail("Failed to extract package. Exiting...");
    console.error(
      `\n${red("Error")}: cannot decompress ${
        path.join(workDir, packageInfo.filename)
      }`,
    );
    console.trace(decomp1);
    throw decomp1;
  }

  const decomp2 = await decompress(
    path.join(
      workDir,
      `WsaPackage_${packageInfo.version}_x64_Release-${releaseType}.msix`,
    ),
    "vendor.img",
    workDir,
  );

  if (decomp2 instanceof Error) {
    kia_extract.fail("Failed to extract package. Exiting...");
    console.error(
      `\n${red("Error")}: cannot decompress ${
        path.join(
          workDir,
          `WsaPackage_${packageInfo.version}_x64_Release-${releaseType}.msix`,
        )
      }`,
    );
    console.trace(decomp2);
    throw decomp2;
  }

  kia_extract.succeed("Extracted package");

  // mount image
  const kia_mount = new Kia({
    text: "Mounting image...",
  });
  kia_mount.start();

  await ensureDir(mountPoint);

  const mountresult = await mountImage(
    path.join(workDir, "vendor.img"),
    mountPoint,
  );

  if (mountresult instanceof Error) {
    kia_mount.fail("Failed to mount image. Exiting...");
    console.error(
      `\n${red("Error")}: cannot mount ${path.join(workDir, "vendor.img")}`,
    );
    console.trace(mountresult);
    throw mountresult;
  }

  const chmodresult = await chmodDir(mountPoint, 777);

  if (chmodresult instanceof Error) {
    kia_mount.fail("Failed to mount image. Exiting...");
    console.error(
      `\n${red("Error")}: cannot chmod ${mountPoint}`,
    );
    console.trace(chmodresult);
    throw chmodresult;
  }

  kia_mount.succeed("Mounted image");

  // copy libhoudini
  const kia_copy = new Kia({
    text: "Copying libhoudini...",
  });
  kia_copy.start();

  const targetDir = args._[0];

  try {
    await Promise.all([
      ensureDir(path.join(targetDir, "system/bin")),
      ensureDir(path.join(targetDir, "system/lib")),
      ensureDir(path.join(targetDir, "system/lib64")),
    ]);
  } catch (err) {
    kia_copy.fail("Failed to copy libhoudini. Exiting...");
    console.error(`\n${red("Error")}: failed to create output directory`);
    console.trace(err);
    throw err;
  }

  await Promise.all(filelist.map(async (file) => {
    const origPath = path.join(mountPoint, file);
    const destPath = path.join(targetDir, "system", file);
    await copy(origPath, destPath).catch((err) => {
      kia_copy.fail("Failed to copy libhoudini. Exiting...");
      console.error(`\n${red("Error")}: failed to copy ${bold(file)}`);
      console.trace(err);
      throw err;
    });
  }));

  kia_copy.succeed("Copied libhoudini");

  console.log(`${cyan(bold("Success!"))} output directory: ${bold(targetDir)}`);
} catch (_e) {
  console.error(`${red("Error")}: Cleaning up...`);
} finally {
  // cleanup
  const kia_cleanup = new Kia({
    text: "Cleaning up...",
  });
  kia_cleanup.start();

  await cleanUp(workDir, mountPoint);

  kia_cleanup.succeed("Cleaned up");
}
