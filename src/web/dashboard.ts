import type {Analysis} from '../types';
type RecordAnalysis=Omit<Analysis,'files'>;
export function setupDashboard(open:(name:string)=>void,inspect:(url:string)=>Promise<void>){
  const form=document.getElementById('dashboard-form') as HTMLFormElement|null;
  form?.addEventListener('submit',event=>{
    event.preventDefault();const input=document.getElementById('dashboard-url') as HTMLInputElement;
    const url=input.value.trim();if(!url)return;
    open('analyze');(document.getElementById('repo-url') as HTMLInputElement).value=url;void inspect(url);
  });
}
export function renderDashboard(analyses:RecordAnalysis[],inspect:(a:RecordAnalysis)=>void){
  const list=document.getElementById('dashboard-recent');if(!list)return;list.replaceChildren();
  for(const a of analyses.slice(0,5)){
    const row=document.createElement('button');row.type='button';row.className='repository-row';
    const name=document.createElement('strong');name.textContent=a.name;
    const meta=document.createElement('span');meta.textContent=`${a.framework} · ${a.commit.slice(0,8)}`;
    const state=document.createElement('span');state.className='repo-state';state.textContent=a.blockers.length?'Offene Punkte':'Analyse vorhanden';
    row.append(name,meta,state);row.addEventListener('click',()=>inspect(a));list.append(row);
  }
  if(!analyses.length){const empty=document.createElement('div');empty.className='repository-empty';const title=document.createElement('strong');title.textContent='Dein nächstes Projekt beginnt mit einem Link.';const text=document.createElement('p');text.textContent='Deine Prüfungen erscheinen hier mit Startweg, Voraussetzungen und Quellen.';empty.append(title,text);list.append(empty);}
  const count=document.getElementById('dashboard-count');if(count)count.textContent=String(analyses.length);
}
