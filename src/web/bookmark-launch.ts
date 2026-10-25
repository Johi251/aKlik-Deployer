import {parseRepo} from '../repo-model';
import type {Analysis,Project} from '../types';
import {recognizedOpenSourceLicense} from '../discovery';

export function localBookmarkLaunch(origin:string):boolean {
  return ['http://127.0.0.1:43110','http://localhost:43110'].includes(origin);
}
export async function startBookmarkRepository(value:string,origin=location.origin,request:typeof fetch=fetch):Promise<Project>{
  if(!localBookmarkLaunch(origin))throw Error('Zum Starten den Bookmarks Manager in der lokalen aKlik-Deployer-App öffnen.');
  const repository=parseRepo(value);
  // A direct Bookmarks entry also needs the normal HttpOnly app session.
  const session=await request('/',{credentials:'same-origin'});
  if(!session.ok)throw Error('Lokale aKlik-Deployer-App ist nicht erreichbar.');
  await session.body?.cancel();
  async function post<T>(path:string,body:unknown):Promise<T>{
    const response=await request(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Aklik-Deployer':'1'},body:JSON.stringify(body)});
    const result=await response.json();if(!response.ok)throw Error(result.error??'Lokaler Start fehlgeschlagen.');return result;
  }
  const analysis=await post<Omit<Analysis,'files'>>('/api/analyze',{url:repository.url+(repository.ref?'/tree/'+repository.ref:'')});
  if(analysis.blockers.length||analysis.archived||!recognizedOpenSourceLicense(analysis.license)||analysis.env.some(e=>e.required)||!['dockerfile','compose','railpack'].includes(analysis.strategy))throw Error('Dieses Projekt benötigt weitere Angaben oder eine manuelle Prüfung. Den Startplan in aKlik-Deployer öffnen.');
  return post<Project>('/api/start',{analysisId:analysis.id,env:{},port:analysis.ports[0]??3000});
}
