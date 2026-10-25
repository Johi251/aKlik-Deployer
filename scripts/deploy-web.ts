export {};
const linkFile=Bun.file('.vercel/project.json');
if(!await linkFile.exists())throw Error('Vercel-Projekt fehlt. Zuerst bunx vercel@65.2.0 link im Projektordner ausführen.');
const {orgId,projectId}=await linkFile.json();
if(typeof orgId!=='string'||!/^team_[A-Za-z0-9]+$/.test(orgId)||typeof projectId!=='string'||!/^prj_[A-Za-z0-9]+$/.test(projectId))throw Error('Ungültige Vercel-Projektverknüpfung.');
const build=Bun.spawn(['bun','run','release:web'],{stdout:'inherit',stderr:'inherit',windowsHide:true});
if(await build.exited)throw Error('Web-Build fehlgeschlagen. Kein Deployment gestartet.');
const deploy=Bun.spawn(['bunx','vercel@65.2.0','deploy','sites/aklik-deployer-online/dist','--prod','--yes','--scope',orgId],{env:{...process.env,VERCEL_ORG_ID:orgId,VERCEL_PROJECT_ID:projectId},stdout:'inherit',stderr:'inherit',stdin:'inherit',windowsHide:true});
if(await deploy.exited)throw Error('Vercel-Anmeldung oder Deployment prüfen.');
