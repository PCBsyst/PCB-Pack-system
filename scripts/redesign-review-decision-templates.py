"""Rebuild legacy merged forms as predictable, width-bounded native Word tables."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from copy import deepcopy
from lxml import etree as E
import re,subprocess
from io import BytesIO
ROOT=Path(__file__).resolve().parents[1]
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';NS={'w':W};Q='{'+W+'}'
def node(tag,attrs=None,text=None):
 x=E.Element(Q+tag)
 for k,v in (attrs or {}).items():x.set(Q+k,str(v))
 x.text=text
 return x
def para(text,bold=False,size=21,heading=False):
 p=node('p');pr=node('pPr');p.append(pr)
 if heading:pr.extend([node('pStyle',{'val':'Heading2'}),node('keepNext')])
 pr.extend([node('spacing',{'before':120 if heading else 0,'after':60,'line':260,'lineRule':'auto'}),node('snapToGrid',{'val':0})])
 r=node('r');rp=node('rPr');rp.extend([node('rFonts',{'ascii':'Malgun Gothic','hAnsi':'Malgun Gothic','eastAsia':'맑은 고딕'}),node('color',{'val':'000000'}),node('sz',{'val':size})]);r.append(rp)
 if bold:rp.append(node('b'))
 for i,line in enumerate(text.split('\n')):
  if i:r.append(node('br'))
  t=node('t',text=line);t.set('{http://www.w3.org/XML/1998/namespace}space','preserve');r.append(t)
 p.append(r);return p
def text(x):
 # Preserve paragraph boundaries and all field tokens, including blank fields.
 pieces=[]
 for event,item in E.iterwalk(x,events=('start','end')):
  if event=='start' and item.tag==Q+'t':pieces.append(item.text or '')
  elif event=='start' and item.tag==Q+'br':pieces.append('\n')
  elif event=='end' and item.tag==Q+'p':pieces.append('\n')
 return ''.join(pieces).strip()
def table(rows):
 t=node('tbl');pr=node('tblPr');pr.extend([node('tblW',{'w':9500,'type':'dxa'}),node('tblLayout',{'type':'fixed'})]);t.append(pr)
 borders=node('tblBorders')
 for edge in ['top','left','bottom','right','insideH','insideV']:borders.append(node(edge,{'val':'single','sz':4,'color':'D3DBE3'}))
 pr.append(borders);m=node('tblCellMar')
 for edge in ['top','bottom','left','right']:m.append(node(edge,{'w':90 if edge in ['top','bottom'] else 130,'type':'dxa'}))
 pr.append(m);grid=node('tblGrid');grid.extend([node('gridCol',{'w':round(9500*(i+1)/60)-round(9500*i/60)}) for i in range(60)]);t.append(grid)
 for cells in rows:
  tr=node('tr');trp=node('trPr');tr.append(trp)
  # Short field rows stay together; long free text must be allowed to continue.
  if sum(map(len,cells))<300:trp.append(node('cantSplit'))
  spans=[60] if len(cells)==1 else [15,45] if len(cells)==2 else [60//len(cells)]*len(cells)
  spans[-1]+=60-sum(spans)
  for j,(value,span) in enumerate(zip(cells,spans)):
   width=round(9500*span/60);label=(j==0 if len(cells)<=2 else j%2==0 and not value.startswith(('☐','□')))
   tc=node('tc');tcp=node('tcPr');tcp.append(node('tcW',{'w':width,'type':'dxa'}))
   tcp.append(node('gridSpan',{'val':span}))
   if label:tcp.append(node('shd',{'fill':'F2F5F8'}))
   tcp.append(node('vAlign',{'val':'top'}));tc.append(tcp);tc.append(para(value,bold=label and len(value)<65,size=20));tr.append(tc)
  t.append(tr)
 return t
def norm(s):return re.sub(r'\s+','',s)
def keep_decision_block(body):
 active=False
 for item in body:
  value=norm(''.join(item.xpath('.//w:t/text()',namespaces=NS)))
  if value=='인증패널결정':active=True
  if not active:continue
  if value.startswith('유효기간:'):break
  for paragraph in ([item] if item.tag==Q+'p' else item.findall('.//w:p',NS)):
   pr=paragraph.find('w:pPr',NS)
   if pr is None:pr=node('pPr');paragraph.insert(0,pr)
   if pr.find('w:keepNext',NS) is None:pr.append(node('keepNext'))
base=ROOT/'templates/FGPC-012-03-delivery-confirmation-kr.docx'
with ZipFile(base) as z:branding={n:z.read(n) for n in z.namelist()}
for filename,code in [('FGPC-008-01-application-review-kr.docx','FGPC-008-01 Rev.14'),('FGPC-012-01-decision-report-kr.docx','FGPC-012-01 Rev.6')]:
 # Stable source makes the generator repeatable without accumulating changes.
 original=subprocess.check_output(['git','show','23674e8:templates/'+filename],cwd=ROOT)
 with ZipFile(BytesIO(original)) as z:source=E.fromstring(z.read('word/document.xml'))
 files=dict(branding);doc=E.fromstring(files['word/document.xml']);body=doc.find('w:body',NS);sect=deepcopy(body.find('w:sectPr',NS))
 for x in list(body):body.remove(x)
 oldbody=source.find('w:body',NS)
 expected=norm(''.join(oldbody.xpath('.//w:t/text()',namespaces=NS)))
 for i,x in enumerate(oldbody):
  if x.tag==Q+'sectPr':continue
  if x.tag==Q+'p':
   s=text(x)
   if not s:continue
   heading=s.replace(' ','') in ['신청정보','개인인증문서및기록평가','인증패널결정','인증원평가']
   p=para(s,bold=i==0 or heading,size=32 if i==0 else 23 if heading else 20,heading=heading)
   if i==0:p.find('w:pPr',NS).insert(0,node('pStyle',{'val':'Title'}))
   body.append(p)
  elif x.tag==Q+'tbl':
   rows=[[text(c) for c in row if c.tag in [Q+'tc',Q+'sdt']] for row in x.findall('w:tr',NS)]
   if '012-01' in filename:
    rows=[(['Grade','{{grade}}'] if '{{grade}}' in ''.join(row) else [' '.join(row)] if row and (row[0]=='☐' or '{{approveMark}}' in row[0]) else row) for row in rows]
    expected=expected.replace('항목을선택하세요.','')
   # Single-cell first rows are section titles, promoted out of merged tables.
   if rows and len(rows[0])==1 and len(rows[0][0])<90 and '{{' not in rows[0][0]:
    body.append(para(rows.pop(0)[0],True,23,True))
   if rows:body.append(table(rows))
  else:raise ValueError('Unexpected body element '+x.tag)
 actual=norm(''.join(body.xpath('.//w:t/text()',namespaces=NS)))
 if actual!=expected:
  index=next((i for i,(a,b) in enumerate(zip(actual,expected)) if a!=b),min(len(actual),len(expected)))
  raise AssertionError((filename,index,actual[max(0,index-30):index+80],expected[max(0,index-30):index+80]))
 if '012-01' in filename:keep_decision_block(body)
 margin=sect.find('w:pgMar',NS)
 for k,v in {'top':1750,'bottom':1050,'header':400,'footer':450}.items():margin.set(Q+k,str(v))
 body.append(sect);files['word/document.xml']=E.tostring(doc,encoding='UTF-8',xml_declaration=True,standalone=True)
 # Compact stable corporate header with the same logo and watermark assets.
 header=E.fromstring(files['word/headerKRdefault.xml'])
 for sz in header.findall('.//w:sz',NS):sz.set(Q+'val','15')
 for spacing in header.findall('.//w:spacing',NS):
  for k,v in {'before':0,'after':0,'line':180,'lineRule':'auto'}.items():spacing.set(Q+k,str(v))
 for extent in header.xpath('//*[local-name()="inline"]/*[local-name()="extent"]'):
  oldcx=int(extent.get('cx'));oldcy=int(extent.get('cy'));extent.set('cx','850000');extent.set('cy',str(round(oldcy*850000/oldcx)))
 files['word/headerKRdefault.xml']=E.tostring(header,encoding='UTF-8',xml_declaration=True,standalone=True)
 footer=E.fromstring(files['word/footerKRdefault.xml'])
 ts=footer.findall('.//w:t',NS)
 ts[0].text=code+'  시스템 편집본'
 ts[-1].text='국문 업무기록  |  입력 내용에 따라 다음 페이지로 이어집니다'
 files['word/footerKRdefault.xml']=E.tostring(footer,encoding='UTF-8',xml_declaration=True,standalone=True)
 with ZipFile(ROOT/'templates'/filename,'w',ZIP_DEFLATED) as z:
  for n,data in files.items():z.writestr(n,data)
 print(filename+': all text and fields retained, legacy merged layout replaced')
