import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import PizZip from 'pizzip';
import {context,POST,request,packagePOST,packageRequest} from './create-english-application-samples.mjs';
const directory='../output/english-evidence/qa';mkdirSync(directory,{recursive:true});
const requirements=['교육요건','학력요건','업무경력요건','심사·실무경력요건'];
for(const kind of ['normal','long']){
 const input=structuredClone(context);
 input.evidenceReview={version:1,documents:[{id:'evidence',kind:'교육수료증',fileName:'synthetic-evidence.pdf',sha256:'',reference:'1쪽',fields:{name:input.candidate.name,email:'EXCLUDED-PRIVATE@example.test'}}],careers:[],audits:[],
 links:requirements.map((requirement,i)=>({requirement,documentIds:['evidence'],reference:`국문 위치 ${i+1}`,note:`국문 근거 대조 ${i+1}`,confirmed:true,result:'충족',
 english:{reference:`Page 1 item ${i+1}`,note:kind==='long'?`Evidence note ${i+1}. `+'The synthetic source records were compared. '.repeat(10):`Evidence note ${i+1}. The submitted source was checked & matched <synthetic>.`,confirmed:true,result:'충족'}}))};
 input.reviewRequirements=Object.fromEntries(requirements.map(key=>[key,'충족']));
 const response=await POST(request(input));assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());
 const xml=new PizZip(bytes).file('word/document.xml').asText();
 for(const text of ['Requirement Evidence Appendix','synthetic-evidence.pdf','Evidence comparison: Confirmed','Evidence note 4.'])assert.ok(xml.includes(text),text);
 for(const text of ['국문 근거','국문 위치','EXCLUDED-PRIVATE','{{'])assert.ok(!xml.includes(text),text);
 writeFileSync(`${directory}/${kind}.docx`,bytes);
 const bundle=await packagePOST(packageRequest(input));assert.equal(bundle.status,200);assert.equal(bundle.headers.get('X-Package-Complete'),'true');
 const packageBytes=Buffer.from(await bundle.arrayBuffer());const archive=new PizZip(packageBytes);const manifest=JSON.parse(archive.file('package_manifest.json').asText());assert.equal(manifest.documentCount,6);
 assert.equal(bundle.headers.get('X-Package-SHA256'),createHash('sha256').update(packageBytes).digest('hex'));
 if(kind==='normal')writeFileSync(`${directory}/bilingual-evidence-package.zip`,packageBytes);
 input.evidenceReview.links[0].english.confirmed=false;const rejected=await POST(request(input));assert.equal(rejected.status,422);assert.equal(rejected.headers.get('Content-Disposition'),null);
 assert.equal((await packagePOST(packageRequest(input))).status,422);
}
console.log('영문 근거 실제 문서/6종 패키지: 일반·장문 부록·전용 의견·XML 이스케이프·미확인 차단 통과 (인증/DB 모의)');
