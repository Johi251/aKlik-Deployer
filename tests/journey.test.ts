import {expect,test} from 'bun:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {WorkflowScene,workflowScenes} from '../src/web/workflow-scenes';
import {motionStyleHash} from '../src/motion-policy';
test('Remotion-Szenen zeigen die vier echten Abläufe in Desktop- und Mobilformat',()=>{
 for(const width of [480,720])for(let i=0;i<4;i++){const html=renderToStaticMarkup(createElement(WorkflowScene,{frame:i*180+179,width}));expect(html).toContain(`data-workflow-scene="${i}"`);expect(html).toContain(workflowScenes[i]!.name);expect(html).not.toContain('NaN');expect(html).not.toContain('<image');expect(html).not.toMatch(/(?:href|src)=/);}
});
test('Der Remotion-Reset ist gezielt per CSP-Hash freigegeben',()=>{expect(motionStyleHash).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/);expect(motionStyleHash).not.toContain('unsafe-inline');});
