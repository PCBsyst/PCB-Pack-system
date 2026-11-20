from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from copy import deepcopy
from lxml import etree as E
import re,json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'output/delivery-confirmation/qa'
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS={'w':W}
def el(tag,attrs=None,text=None):
 x=E.Element('{'+W+'}'+tag)
 for k,v in (attrs or {}).items(): x.set('{'+W+'}'+k,str(v))
 if text is not None:x.text=text
 return x
def p(text='',bold=False,size=21,style=None):
 x=el('p'); pr=el('pPr')
 if style:pr.append(el('pStyle',{'val':style}));pr.append(el('keepNext'))
 pr.append(el('snapToGrid',{'val':0}));pr.append(el('spacing',{'before':0,'after':40,'line':240,'lineRule':'auto'}))
 x.append(pr);r=el('r');rp=el('rPr');rp.append(el('rFonts',{'ascii':'Malgun Gothic','hAnsi':'Malgun Gothic','eastAsia':'맑은 고딕'}))
 if bold:rp.append(el('b'))
 rp.append(el('color',{'val':'000000'}));rp.append(el('sz',{'val':size}))
 r.append(rp);t=el('t',text=text);t.set('{http://www.w3.org/XML/1998/namespace}space','preserve');r.append(t);x.append(r);return x
def table(rows,widths,header=False):
 t=el('tbl');pr=el('tblPr');pr.append(el('tblW',{'w':sum(widths),'type':'dxa'}));b=el('tblBorders')
 for side in ['top','left','bottom','right','insideH','insideV']:b.append(el(side,{'val':'single','sz':4,'color':'CBD5E1'}))
 pr.append(b);pr.append(el('tblLayout',{'type':'fixed'}));m=el('tblCellMar')
 for side in ['top','bottom','left','right']:m.append(el(side,{'w':60 if side in ['top','bottom'] else 100,'type':'dxa'}))
 pr.append(m);t.append(pr);grid=el('tblGrid')
 for width in widths:grid.append(el('gridCol',{'w':width}))
 t.append(grid)
 for i,row in enumerate(rows):
  tr=el('tr')
  if header and i==0:trp=el('trPr');trp.append(el('tblHeader'));tr.append(trp)
  for j,text in enumerate(row):
   tc=el('tc');tcp=el('tcPr');tcp.append(el('tcW',{'w':widths[j],'type':'dxa'}))
   if header and i==0:tcp.append(el('shd',{'fill':'EDF2F7'}))
   tcp.append(el('vAlign',{'val':'center'}))
   tc.append(tcp);tc.append(p(text,bold=header and i==0,size=20));tr.append(tc)
  t.append(tr)
 return t
source=ROOT/'templates/FGPC-012-03-delivery-confirmation-en.docx'
with ZipFile(source) as z: files={n:z.read(n) for n in z.namelist()}
original=E.fromstring(files['word/document.xml']);body=original.find('w:body',NS);sect=deepcopy(body.find('w:sectPr',NS))
assert sect is not None
margin=sect.find('w:pgMar',NS);assert margin is not None
for key,value in {'top':3000,'header':560,'bottom':1440,'footer':454}.items():margin.set('{'+W+'}'+key,str(value))
for node in list(body):body.remove(node)
body.append(p('문서전달확인서',bold=True,size=32,style='Title'))
body.append(p('신청부터 인증서 발행과 송부까지의 문서별 기록을 확인합니다.',size=20))
body.append(table([['후보자명','{{candidateName}}','Job 번호','{{jobNo}}'],['신청표준','{{standard}}','신청등급','{{grade}}'],['인증번호','{{certificationNo}}','작성일','{{deliveryConfirmationDate}}']],[1300,3450,1300,3450]))
body.append(p('문서별 접수 및 확인 기록',bold=True,size=23,style='Heading2'))
items=[('application','FGPC-008-01','신청서'),('career','-','경력증명서'),('education','-','교육수료증'),('diploma','-','학력 증빙자료'),('auditLog','FGPC-008-02','심사이력 기록'),('agreement','FGPC-008-04','인증계약서'),('examNotice','FGPC-010-04','시험통보서'),('examAnswers','GPC-EXAM-ANS','시험답안지'),('decisionReport','FGPC-012-01','인증결정보고서'),('certificate','FGPC-012-02','개인인증서'),('survey','FGPC-010-03','고객 설문서'),('deliveryConfirmation','FGPC-012-03','문서전달확인서')]
rows=[['양식번호','문서','확인','기록일','비고']]+[[form,title,'{{'+key+'Mark}}','{{'+key+'Date}}','{{'+key+'Comment}}'] for key,form,title in items]
body.append(table(rows,[1650,2200,1100,1550,3000],header=True))
body.append(p('확인란은 시스템에 기록한 확인 여부와 적용 구분을 표시합니다. 미확인은 미제출 판정이나 고객 수령 확인을 뜻하지 않습니다.',size=18))
body.append(p('검토 및 인증 처리 일정',bold=True,size=23,style='Heading2'))
body.append(table([['신청 접수일','{{receivedAt}}','서류 검토일','{{reviewedAt}}'],['2차 검증일','{{verifiedAt}}','심의일','{{decisionDate}}'],['최종 승인일','{{finalApprovalDate}}','초안 발행일','{{draftIssuedAt}}'],['인증서 발행일','{{issueDate}}','인증 만료일','{{expiryDate}}']],[1500,3250,1500,3250]))
body.append(p('교육 및 전달 기록',bold=True,size=23,style='Heading2'))
for value in ['{{note}}','{{invoiceNote}}','{{dispatchNote}}','{{ownerNote}}']:body.append(p(value,size=20))
body.append(p('운송장 번호는 배송 추적용이며 실제 고객 수령 여부는 별도로 확인합니다.',size=18));body.append(sect)
files['word/document.xml']=E.tostring(original,xml_declaration=True,encoding='UTF-8',standalone=True)
# Keep the original corporate branding and explicitly identify the new system translation.
footer=E.fromstring(files['word/footer2.xml'])
for node in list(footer):footer.remove(node)
foot_table=table([['FGPC-012-03 시스템 국문 v1','']],[6500,3000])
for border in foot_table.find('w:tblPr/w:tblBorders',NS):border.set('{'+W+'}val','nil')
top_border=foot_table.find('w:tblPr/w:tblBorders/w:top',NS);top_border.set('{'+W+'}val','single');top_border.set('{'+W+'}color','203B56')
for paragraph in foot_table.findall('.//w:p',NS):
 for size_node in paragraph.findall('.//w:sz',NS):size_node.set('{'+W+'}val','16')
page_paragraph=foot_table.findall('w:tr/w:tc/w:p',NS)[1];page_paragraph.find('w:pPr',NS).append(el('jc',{'val':'right'}))
for instruction in ['PAGE','NUMPAGES']:
 if instruction=='NUMPAGES':page_paragraph.append(p(' / ',size=16).find('w:r',NS))
 field=el('fldSimple',{'instr':instruction});field.append(p('1',size=16).find('w:r',NS));page_paragraph.append(field)
footer.append(foot_table);footer.append(p('영문 원본 FGPC-012-03 Rev.4 기반',size=15));files['word/footer2.xml']=E.tostring(footer,xml_declaration=True,encoding='UTF-8',standalone=True)
old_header=E.fromstring(files['word/header2.xml']);header=deepcopy(old_header)
for node in list(header):header.remove(node)
head_table=table([['','']],[2100,7400]);head_borders=head_table.find('w:tblPr/w:tblBorders',NS)
for border in head_borders:border.set('{'+W+'}val','nil')
head_borders.find('w:bottom',NS).set('{'+W+'}val','single');head_borders.find('w:bottom',NS).set('{'+W+'}color','203B56')
cells=head_table.findall('w:tr/w:tc',NS)
original_drawings=old_header.findall('.//w:drawing',NS);assert len(original_drawings)==2
logo=deepcopy(original_drawings[0]);anchor=logo[0]
inline=E.Element('{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}inline',distT='0',distB='0',distL='0',distR='0')
for child in anchor:
 if E.QName(child).localname in ['extent','effectExtent','docPr','cNvGraphicFramePr','graphic']:inline.append(deepcopy(child))
logo.replace(anchor,inline)
logo_paragraph=cells[0].find('w:p',NS);logo_paragraph.find('w:r',NS).append(logo)
for node in list(cells[1]):
 if node.tag=='{'+W+'}p':cells[1].remove(node)
for i,line in enumerate(['Global Personnel Certification Co., Ltd.','Rm. 402-2, Daeryung techno town, 638, Seobusaet-gil,','Geumcheon-gu, Seoul, Korea','Tel: +82 2 6749 0710    Fax: +82 2 6749 0711','e-mail: info@gpcert.org','Web site: www.gpcert.org']):
 paragraph=p(line,bold=i==0,size=20 if i==0 else 17);paragraph.find('w:pPr',NS).append(el('jc',{'val':'right'}));cells[1].append(paragraph)
header.append(head_table)
for node in old_header:
 if node.tag!='{'+W+'}tbl' and node.find('.//w:drawing',NS) is original_drawings[-1]:header.append(deepcopy(node))
files['word/header2.xml']=E.tostring(header,xml_declaration=True,encoding='UTF-8',standalone=True)
rels=E.fromstring(files['word/_rels/document.xml.rels']);types=E.fromstring(files['[Content_Types].xml'])
for node in list(sect.findall('w:titlePg',NS)):sect.remove(node)
settings=E.fromstring(files['word/settings.xml'])
for node in list(settings.findall('w:evenAndOddHeaders',NS)):settings.remove(node)
files['word/settings.xml']=E.tostring(settings,xml_declaration=True,encoding='UTF-8',standalone=True)
for kind in ['header','footer']:
 for ref in list(sect.findall('w:'+kind+'Reference',NS)):sect.remove(ref)
position=0
for kind in ['header','footer']:
 for page_type in ['default']:
  name=kind+'KR'+page_type+'.xml';rid='rIdKR'+kind+page_type
  files['word/'+name]=files['word/'+kind+'2.xml']
  source_rels='word/_rels/'+kind+'2.xml.rels'
  if source_rels in files:files['word/_rels/'+name+'.rels']=files[source_rels]
  E.SubElement(rels,'{http://schemas.openxmlformats.org/package/2006/relationships}Relationship',Id=rid,Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/'+kind,Target=name)
  E.SubElement(types,'{http://schemas.openxmlformats.org/package/2006/content-types}Override',PartName='/word/'+name,ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.'+kind+'+xml')
  ref=el(kind+'Reference',{'type':page_type});ref.set('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id',rid);sect.insert(position,ref);position+=1
files['word/_rels/document.xml.rels']=E.tostring(rels,xml_declaration=True,encoding='UTF-8',standalone=True)
files['[Content_Types].xml']=E.tostring(types,xml_declaration=True,encoding='UTF-8',standalone=True)
files['word/document.xml']=E.tostring(original,xml_declaration=True,encoding='UTF-8',standalone=True)
def save(path,content):
 path.parent.mkdir(parents=True,exist_ok=True)
 with ZipFile(path,'w',ZIP_DEFLATED) as z:
  for n,data in content.items():z.writestr(n,data)
formal=ROOT/'templates/FGPC-012-03-delivery-confirmation-kr.docx';save(formal,files)
values={'candidateName':'완전가상후보','jobNo':'QMS260099','standard':'ISO 9001','grade':'선임심사원','certificationNo':'26140099','receivedAt':'2026-11-02','reviewedAt':'2026-11-03','verifiedAt':'2026-11-04','decisionDate':'2026-11-12','finalApprovalDate':'2026-11-17','draftIssuedAt':'2026-11-18','issueDate':'2026-11-19','expiryDate':'2029-11-19','note':'비지정 연수기관: 완전가상 교육기관 / 교육 종료일: 2026-10-16 / 시험통보일: 2026-10-19 / 시험일: 2026-10-26','invoiceNote':'인보이스: SYNTHETIC-INV-001 / 발행일: 2026-11-05 / 입금일: 2026-11-06','dispatchNote':'원본 송부일: 2026-11-20 / 운송장 번호: SYNTHETIC-TRACK-001','ownerNote':'담당자: 가상담당자'}
for key,_,_ in items:values.update({key+'Mark':'■',key+'Date':'2026-11-02',key+'Comment':'가상 자료 대조 완료'})
values.update({'examNoticeDate':'2026-10-19','examAnswersDate':'2026-10-26','decisionReportDate':'2026-11-12','certificateDate':'2026-11-19','deliveryConfirmationDate':'2026-11-20'})
results=[]
for name in ['normal','long','missing']:
 data=dict(values)
 if name=='long':
  data['candidateName']='완전가상후보 긴 이름 검증'
  for key,_,_ in items:data[key+'Comment']='가상 증빙의 항목과 기록일을 대조했습니다. '+('장문 비고의 줄바꿈과 페이지 이어짐을 확인합니다. '*8)
  data['note']+=' / '+('교육 및 시험 기록 장문 검증입니다. '*30)
 if name=='missing':
  for key,_,_ in items:data.update({key+'Mark':'□',key+'Date':'-',key+'Comment':'미확인'})
  data.update({'auditLogMark':'해당 없음','auditLogComment':'신청 등급 기준으로 해당 없음','dispatchNote':'원본 송부일: - / 운송장 번호: -','reviewedAt':'-','verifiedAt':'-'})
 doc=E.fromstring(files['word/document.xml'])
 for node in doc.findall('.//w:t',NS):
  if node.text:node.text=re.sub(r'\{\{(\w+)\}\}',lambda m:data[m[1]],node.text)
 target=OUT/('delivery-'+name+'.docx');content=dict(files);content['word/document.xml']=E.tostring(doc,xml_declaration=True,encoding='UTF-8',standalone=True);save(target,content);results.append(str(target))
print(json.dumps({'template':str(formal),'samples':results},ensure_ascii=False,indent=2))
