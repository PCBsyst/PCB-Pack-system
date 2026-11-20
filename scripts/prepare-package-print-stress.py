"""Create synthetic long-comment print cases from actual API-generated samples."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from lxml import etree as E
ROOT=Path(__file__).resolve().parents[2]/'output/full-workflow/qa/documents'
NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W='{'+NS['w']+'}'
for suffix,needle in [('Application_Review_KR','완전 가상 증빙과 기본정보 대조'),('Certification_Decision_Report_KR','가상 위원 A 승인')]:
    src=ROOT/('OHS260001_'+suffix+'.docx')
    with ZipFile(src) as z:parts={n:z.read(n) for n in z.namelist()}
    tree=E.fromstring(parts['word/document.xml'])
    matches=tree.xpath('//w:t[contains(text(), $needle)]',namespaces=NS,needle=needle)
    assert matches,needle
    target=matches[0]
    run=target.getparent()
    for i in range(24):
        E.SubElement(run,W+'br')
        E.SubElement(run,W+'t').text=f'{i+1}. 장문 출력 검증용 가상 기록입니다. 교육 학력 및 경력 증빙을 대조하였으며 이 문장은 페이지 분할 후에도 누락 없이 표시되어야 합니다.'
    parts['word/document.xml']=E.tostring(tree,encoding='UTF-8',xml_declaration=True,standalone=True)
    with ZipFile(ROOT/('STRESS_'+suffix+'.docx'),'w',ZIP_DEFLATED) as z:
        for n,data in parts.items():z.writestr(n,data)
    print(suffix+': 24 synthetic comment lines')
