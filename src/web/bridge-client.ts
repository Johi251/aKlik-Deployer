import type {RepositoryScan} from '../repository-scan';
export async function checkLocalBridge(url:string,signal:AbortSignal,receive:(result:RepositoryScan)=>void):Promise<void>{
  const local=['localhost','127.0.0.1'].includes(location.hostname)&&location.port==='43110';
  const extension=['chrome-extension:','moz-extension:'].includes(location.protocol);
  if(!local&&!extension)return;
  const repo=new URL(url);if(!['github.com','gitlab.com','huggingface.co'].includes(repo.hostname))return;
  const endpoint=(local?'':'http://127.0.0.1:43110')+'/bridge/v1/status?'+new URLSearchParams({url});
  try{for(let attempt=0;attempt<30;attempt++){
    const response=await fetch(endpoint,{signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])});if(!response.ok)return;
    const result=await response.json();
    if(result.schema!=='aklik-deployer.status.v1'||!['checking','online','local','needs_review','error'].includes(result.state)||typeof result.note!=='string')return;
    receive(result);if(result.state!=='checking')return;
    await new Promise<void>((resolve,reject)=>{const stop=()=>{clearTimeout(timer);reject(signal.reason);};const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},2000);if(signal.aborted)stop();else signal.addEventListener('abort',stop,{once:true});});
  }}catch{/* Missing local engine falls back to the ordinary source report. */}
}
