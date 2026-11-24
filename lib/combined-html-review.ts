export const reviewDocumentChoices=[{name:"Application_Review_KR.html",label:"신청서류 검토서"},{name:"Decision_Review_KR.html",label:"인증결정보고서"},{name:"Delivery_Confirmation_KR.html",label:"문서전달확인서"}];
/** Combine verified, server-generated review copies. No uploaded HTML is accepted. */
export function combineReviewHtml(documents:Array<{name:string;html:string}>,selected:string[]=reviewDocumentChoices.map(d=>d.name)) {
 const names=['Application_Review_KR.html','Decision_Review_KR.html','Delivery_Confirmation_KR.html'];
 if(documents.length!==3||names.some(name=>documents.filter(d=>d.name===name).length!==1))throw Error('통합 검토 문서 구성이 올바르지 않습니다.');
 if(!selected.length||new Set(selected).size!==selected.length||selected.some(name=>!names.includes(name)))throw Error('출력할 문서를 한 개 이상 올바르게 선택해 주세요.');
 const styles:string[]=[],bodies:string[]=[];
 for(const name of names){
  const html=documents.find(d=>d.name===name)!.html;
  if(!html.startsWith('<!doctype html>')||/<script\b|<iframe\b|<form\b|\son\w+\s*=/i.test(html))throw Error('안전한 통합 검토 문서를 확인하지 못했습니다.');
  const style=html.match(/<style>([\s\S]*?)<\/style>/i),body=html.match(/<body>([\s\S]*?)<\/body>/i);
  if(!style||!body)throw Error('통합 검토 문서 내용을 확인하지 못했습니다.');
  if(!selected.includes(name))continue;
  styles.push(style[1]);bodies.push(`<article class="bundle-document">${body[1]}</article>`);
 }
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"><title>국문 ${selected.length}종 통합 검토본</title><style>${styles.join('\n')}
 .bundle-document{display:block}.bundle-document+.bundle-document{margin-top:32px}@page{size:A4;margin:15mm 16mm;@top-left{content:"GPC / 국문 ${selected.length}종 통합 검토본";font:7pt Arial;color:#536579}@bottom-left{content:"HTML 통합 디자인 검토본";font:7pt Arial;color:#536579}@bottom-right{content:counter(page) " / " counter(pages);font:8pt Arial;color:#536579}}@media print{.bundle-document+.bundle-document{break-before:page;margin-top:0}.bundle-document .sheet{margin:0;padding:0;box-shadow:none;max-width:none}}
 </style></head><body>${bodies.join('\n')}</body></html>`;
}
