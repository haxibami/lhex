async function isMounted(mountPoint: string): Promise<boolean> {
  const subp = Deno.run({
    cmd: ["mountpoint", mountPoint],
    stdout: "null",
    stderr: "null",
  });
  const { code } = await subp.status();
  return code === 0;
}

export async function mountImage(
  imagePath: string,
  mountPoint: string,
): Promise<void | Error> {
  if (await isMounted(mountPoint)) {
    throw new Error(`${mountPoint} is already mounted`);
  }
  const subp = Deno.run({
    cmd: [
      "sudo",
      "mount",
      "-o",
      "loop",
      imagePath,
      mountPoint,
    ],
  });
  const { code } = await subp.status();
  if (code !== 0) {
    return new Error(`Failed to mount ${imagePath} to ${mountPoint}`);
  }
}

async function unmountImage(
  mountPoint: string,
): Promise<void | Error> {
  if (!await isMounted(mountPoint)) {
    return;
  }
  const subp = Deno.run({
    cmd: ["sudo", "umount", mountPoint],
  });
  const { code } = await subp.status();
  if (code !== 0) {
    return new Error(`Failed to unmount ${mountPoint}`);
  }
}

export async function decompress(
  filePath: string,
  elementPath: string,
  destPath: string,
): Promise<void | Error> {
  const subp = Deno.run({
    cmd: ["bsdtar", "-xf", filePath, "-C", destPath, elementPath],
  });
  const { code } = await subp.status();
  if (code !== 0) {
    return new Error(`Failed to decompress ${filePath}`);
  }
}

export async function chmodDir(
  path: string,
  mode: number,
): Promise<void | Error> {
  const subp = Deno.run({
    cmd: ["sudo", "chmod", "-R", mode.toString(), path],
  });
  const { code } = await subp.status();
  if (code !== 0) {
    return new Error(`Failed to chmod ${path}`);
  }
}

export async function cleanUp(
  workDir: string,
  mountPoint: string,
): Promise<void | Error> {
  if (await isMounted(mountPoint)) {
    const res = await unmountImage(mountPoint);
    if (res instanceof Error) {
      return res;
    }
  }
  await Deno.remove(workDir, { recursive: true });
}
