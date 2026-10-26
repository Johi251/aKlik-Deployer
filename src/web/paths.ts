export function webBase(value='/'):string {
 if(!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(value))throw Error('Ungültiger Web-Basispfad.');
 return value;
}
export function applicationPath(path:string,base=typeof document==='undefined'?'/':document.querySelector<HTMLMetaElement>('meta[name="aklik-base"]')?.content??'/'):string {
 const prefix=webBase(base);
 if(!path.startsWith('/')||path.startsWith('//'))throw Error('Interner App-Pfad erwartet.');
 return prefix.slice(0,-1)+path;
}
