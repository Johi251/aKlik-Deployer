const status=document.getElementById('status'),note=document.getElementById('note'),launch=document.getElementById('launch');
async function check(){
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const url=new URL(tab?.url??'');
  if(url.protocol!=='https:'||!['github.com','gitlab.com','huggingface.co'].includes(url.hostname))throw Error('Öffne ein öffentliches GitHub-/GitLab-Repository oder einen Hugging-Face-Space.');
  document.getElementById('repository').textContent=url.href;
  for(let attempt=0;attempt<30;attempt++){
   const response=await fetch('http://127.0.0.1:43110/bridge/v1/status?'+new URLSearchParams({url:url.href}),{signal:AbortSignal.timeout(8000)});
   const result=await response.json();if(!response.ok)throw Error(result.error??'Prüfung fehlgeschlagen.');
   status.textContent=result.label;status.dataset.color=result.color;note.textContent=result.note;
   if(result.state==='checking'){await new Promise(resolve=>setTimeout(resolve,2000));continue;}
   const target=result.launchUrl??result.inspectUrl;
   if(target){const safe=new URL(target);if(safe.protocol==='https:'||safe.origin==='http://127.0.0.1:43110'){launch.href=safe.href;launch.textContent=result.state==='online'?'Online öffnen':'Startweg prüfen';launch.hidden=false;}}
   return;
  }
  throw Error('Prüfung dauert länger. Add-on erneut öffnen.');
 }catch(error){status.textContent='Prüfung nicht verfügbar';status.dataset.color='neutral';note.textContent=error instanceof TypeError?'Lokale App starten und dieses Add-on erneut öffnen.':error.message;}
}
void check();
