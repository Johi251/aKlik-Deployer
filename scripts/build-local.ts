import { buildMotion } from "./build-motion";
const result=await Bun.build({entrypoints:["src/web/app.ts"],target:"browser",minify:true});
if(!result.success)throw Error(result.logs.map(x=>x.message).join("\n"));
await Bun.write("public/app.js",result.outputs[0]!);
await buildMotion("public/workflow.js");
console.log(JSON.stringify({appBytes:Bun.file("public/app.js").size,motionBytes:Bun.file("public/workflow.js").size}));
