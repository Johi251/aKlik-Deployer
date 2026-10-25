import { resolve } from "node:path";
export async function buildMotion(output:string) {
  const result=await Bun.build({entrypoints:[resolve(import.meta.dir,"../src/web/motion-entry.tsx")],target:"browser",minify:true});
  if(!result.success)throw Error(result.logs.map(x=>x.message).join("\n"));
  await Bun.write(output,result.outputs[0]!);
}
