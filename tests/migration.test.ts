import {test,expect} from 'bun:test';
import {onlineAPI} from '../src/web/online-api';
test('Rebranding erhält Browser-Verlauf desselben Ursprungs über den bisherigen Speicherschlüssel',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const oldKey=['one','clicker-online-v1'].join('');
 const data={searches:[{id:'existing-search'}],analyses:[],favorites:[],reviews:[]};
 const storage=new Map([[oldKey,JSON.stringify(data)]]);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)}});
 try{const state=await onlineAPI<any>('/api/state');expect(state.searches[0].id).toBe('existing-search');expect(storage.has(oldKey)).toBe(true);}
 finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete (globalThis as any).localStorage;}
});
