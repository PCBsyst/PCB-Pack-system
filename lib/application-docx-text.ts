import PizZip from "pizzip";

/** Browser-only: no network, storage, macros or external XML resources. */
export async function readApplicationDocx(file: File): Promise<string> {
  if (!/\.docx$/i.test(file.name)) throw new Error("현재는 Word(.docx)만 읽을 수 있습니다. PDF·이미지·스캔·구형 DOC는 AI/OCR 연결 후 지원합니다.");
  if (!file.size || file.size > 8*1024*1024) throw new Error("비어 있지 않은 8MB 이하 DOCX를 선택해 주세요.");
  let zip: PizZip;
  try { zip=new PizZip(await file.arrayBuffer()); } catch { throw new Error("DOCX 구조를 읽지 못했습니다. 암호 설정이나 파일 손상을 확인해 주세요."); }
  const entries=Object.values(zip.files);
  if(entries.length>1500)throw new Error("신청서 내부 파일 수가 너무 많습니다.");
  let total=0;
  for(const entry of entries) {
    const info=entry as unknown as {_data?:{uncompressedSize?:number}};
    const size=info._data?.uncompressedSize;
    if(!entry.dir && (!Number.isSafeInteger(size) || (size??-1)<0))throw new Error("DOCX 내부 크기를 확인하지 못했습니다.");
    total+=size??0;
    if(total>50*1024*1024)throw new Error("압축 해제된 신청서가 너무 큽니다.");
  }
  if(zip.file("word/vbaProject.bin") || !zip.file("[Content_Types].xml"))throw new Error("지원하지 않는 Word 문서입니다.");
  const main=zip.file("word/document.xml");
  if(!main || ((main as unknown as {_data:{uncompressedSize:number}})._data.uncompressedSize)>2*1024*1024)throw new Error("신청서 본문이 없거나 너무 큽니다.");
  // Read only the main XML with a hard streaming limit. ZIP metadata alone is
  // untrusted: asText() would inflate the entire entry before checking its size.
  const data=(main as unknown as {_data:{compressionMethod:string;uncompressedSize:number;getCompressedContent:()=>Uint8Array}})._data;
  const compressed=new Uint8Array(data.getCompressedContent());
  let bytes:Uint8Array;
  if(data.compressionMethod==="\x00\x00")bytes=compressed;
  else if(data.compressionMethod==="\x08\x00") {
    const reader=new Blob([new Uint8Array(compressed)]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
    const chunks:Uint8Array[]=[];let length=0;
    try { while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>2*1024*1024)throw new Error("신청서 본문 압축 해제 한도를 초과했습니다.");chunks.push(part.value);} }
    catch {await reader.cancel().catch(()=>{});throw new Error("신청서 압축 데이터를 안전하게 읽지 못했습니다.");}
    bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  } else throw new Error("지원하지 않는 Word 압축 방식입니다.");
  if(bytes.byteLength>2*1024*1024||bytes.byteLength!==data.uncompressedSize)throw new Error("신청서 본문 크기가 일치하지 않습니다.");
  const xml=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error("외부 XML 정의를 포함한 문서는 처리하지 않습니다.");
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  if(doc.getElementsByTagName("parsererror").length)throw new Error("신청서 본문 XML을 읽지 못했습니다.");
  const ns="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const body=doc.getElementsByTagNameNS(ns,"body")[0];
  if(!body)throw new Error("Word 본문을 찾지 못했습니다.");
  const walk=(node:Node,depth=0):string=>{
    if(depth>100)throw new Error("신청서 본문 구조가 너무 복잡합니다.");
    if(node.nodeType!==1)return "";
    const element=node as Element;
    if(element.namespaceURI===ns) {
      if(element.localName==="t")return element.textContent??"";
      if(["tab"].includes(element.localName))return "\t";
      if(["br","cr"].includes(element.localName))return "\n";
      if(["del","instrText","drawing","object"].includes(element.localName))return "";
    }
    const text=Array.from(node.childNodes).map(child=>walk(child,depth+1)).join("");
    if(element.namespaceURI!==ns)return text;
    if(element.localName==="tc")return text.trim().replace(/\n+/g," ")+"\t";
    return text+(["p","tr"].includes(element.localName)?"\n":"");
  };
  const text=walk(body).trim();
  if(!text || text.length>1_000_000)throw new Error("읽을 수 있는 신청서 텍스트가 없거나 너무 큽니다. 이미지로 된 Word는 OCR이 필요합니다.");
  return text;
}
