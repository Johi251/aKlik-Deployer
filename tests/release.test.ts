import {test,expect} from 'bun:test';
import {sourceAllowed} from '../scripts/source-files';
test('source downloads exclude secrets, local state and generated dependencies',()=>{
 for(const name of ['.env','.env.production','.data','.git','node_modules','target','binaries','dist','dist-ext','releases','build.log'])expect(sourceAllowed(name)).toBe(false);
 for(const name of ['.env.example','Cargo.lock','index.html','src','LICENSE'])expect(sourceAllowed(name)).toBe(true);
});
