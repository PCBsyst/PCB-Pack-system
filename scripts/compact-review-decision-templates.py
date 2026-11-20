"""Compact built-in forms while preserving text, fields and all corporate media."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from lxml import etree as E
import re

ROOT=Path(__file__).resolve().parents[1]
NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W='{'+NS['w']+'}'
def set_child(parent,name,attrs):
    child=parent.find(W+name)
    if child is None: child=E.SubElement(parent,W+name)
    for key,value in attrs.items(): child.set(W+key,str(value))
    return child

for name in ['FGPC-008-01-application-review-kr.docx','FGPC-012-01-decision-report-kr.docx']:
    path=ROOT/'templates'/name
    with ZipFile(path) as z: parts={n:z.read(n) for n in z.namelist()}
    root=E.fromstring(parts['word/document.xml'])
    before=root.xpath('//w:t/text()',namespaces=NS)
    for p in root.xpath('//w:body//w:p',namespaces=NS):
        pr=p.find(W+'pPr')
        if pr is None: pr=E.Element(W+'pPr');p.insert(0,pr)
        set_child(pr,'spacing',{'before':0,'after':40,'line':240,'lineRule':'auto'})
        for rp in p.xpath('./w:r/w:rPr',namespaces=NS):
            for size in rp.findall(W+'sz')+rp.findall(W+'szCs'):
                if int(size.get(W+'val','20'))<=24: size.set(W+'val','20')
    # Empty body spacers are layout residue, never remove table cells or breaks.
    for p in list(root.xpath('//w:body/w:p',namespaces=NS)):
        if not p.xpath('.//w:t|.//w:drawing|.//w:pict|.//w:br|.//w:sectPr|.//w:fldChar',namespaces=NS):
            p.getparent().remove(p)
    for margin in root.xpath('//w:tblCellMar/w:top|//w:tblCellMar/w:bottom',namespaces=NS): margin.set(W+'w','40')
    assert root.xpath('//w:t/text()',namespaces=NS)==before,name
    parts['word/document.xml']=E.tostring(root,encoding='UTF-8',xml_declaration=True,standalone=True)
    with ZipFile(path,'w',ZIP_DEFLATED) as z:
        for n,data in parts.items():z.writestr(n,data)
    print(name+': preserved all text and corporate parts')
