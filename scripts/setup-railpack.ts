import { must } from "../src/process";
import { RAILPACK_IMAGE, RAILPACK_VERSION, toolsStatus } from "../src/runtime";
const status = await toolsStatus();
if (!status.docker) throw new Error(status.detail);
if (!status.railpack) {
  console.log(`Lade den offiziellen Railpack-Linux-Container ${RAILPACK_VERSION}, festgelegt per Image-Digest.`);
  await must(["docker", "pull", RAILPACK_IMAGE], { timeout: 240_000, log: console.log });
}
console.log(`Railpack ${RAILPACK_VERSION} bereit. Planung und Build erfolgen unter Linux in Docker.`);
