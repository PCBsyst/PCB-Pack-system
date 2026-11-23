import PizZip from 'pizzip';
import type {PackageContext} from '@/lib/prototype-package';
import type {Job} from '@/types/certification';
import {boundedDownloadBlob} from '@/lib/bounded-download';
import {documentErrorMessage} from '@/lib/document-errors';
const digest=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
export async function fetchHtmlPackage(context:PackageContext,job:Job,signal?:AbortSignal){
 const response=await fetch('/api/documents/html-package',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({context,job,language:'KR'}),signal});
 if(!response.ok)throw Error(await documentErrorMessage(response));
 if(response.headers.get('Content-Type')!=='application/zip'||response.headers.get('X-HTML-Package-Version')!=='HTML-PACK-01 v1')throw Error('HTML 묶음 응답 형식을 확인하지 못했습니다.');
 const blob=await boundedDownloadBlob(response,Number(response.headers.get('X-HTML-Package-Bytes')),15*1024*1024),bytes=await blob.arrayBuffer();
 if(await digest(bytes)!==response.headers.get('X-HTML-Package-SHA256'))throw Error('HTML 묶음 무결성 확인에 실패했습니다.');
 const zip=new PizZip(bytes),names=['Application_Review_KR.html','Decision_Review_KR.html','Delivery_Confirmation_KR.html'];
 if(Object.keys(zip.files).sort().join('|')!==[...names,'manifest.json'].sort().join('|'))throw Error('HTML 묶음의 문서 구성을 확인하지 못했습니다.');
 const manifest=JSON.parse(zip.file('manifest.json')!.asText());
 if(manifest.version!=='HTML-PACK-01 v1'||manifest.status!=='DESIGN_PREVIEW'||!Array.isArray(manifest.documents)||manifest.documents.length!==3)throw Error('HTML 묶음 명세를 확인하지 못했습니다.');
 for(const name of names){const entries=manifest.documents.filter((d:{name:string})=>d.name===name),data=zip.file(name)!.asUint8Array();if(data.length>5*1024*1024||entries.length!==1||await digest(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength) as ArrayBuffer)!==entries[0].sha256)throw Error('HTML 문서 무결성 확인에 실패했습니다.');}
 return {blob,documents:names.map(name=>({name,html:zip.file(name)!.asText()})),fileName:`${job.jobNo.replace(/[^A-Za-z0-9_-]/g,'_')}_HTML_Review_KR.zip`};
}
