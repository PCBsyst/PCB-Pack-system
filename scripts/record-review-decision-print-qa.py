"""Record verified synthetic print evidence and check template content preservation."""
from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
from hashlib import sha256
import subprocess,json,re
from lxml import etree as E
import pdfplumber
ROOT=Path(__file__).resolve().parents[1]
QA=ROOT.parent/'output/full-workflow/qa/documents'
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
proof={'reviewedAt':'2026-11-20','renderer':'Microsoft Word','manualPageReview':True,'templates':[],
       'notes':['가상 API 출력물 및 의견 24줄 출력 스트레스 문서만 사용','LibreOffice 미설치로 기본 렌더러 실패 후 설치된 Word 사용','서버 PDF 변환 추가 아님','운영 DB RLS MFA 및 실제 고객 데이터 검증 별도']}
for name in ['FGPC-008-01-application-review-kr.docx','FGPC-012-01-decision-report-kr.docx']:
    raw=(ROOT/'templates'/name).read_bytes()
    old=subprocess.check_output(['git','show','8557868:templates/'+name],cwd=ROOT)
    with ZipFile(BytesIO(raw)) as current,ZipFile(BytesIO(old)) as source:
        def texts(z):return E.fromstring(z.read('word/document.xml')).xpath('//w:t/text()',namespaces=ns)
        assert texts(current)==texts(source),name
        for part in source.namelist():
            if part.startswith('word/media/') or re.match(r'word/(header|footer)\d+\.xml$',part):
                assert source.read(part)==current.read(part),(name,part)
    proof['templates'].append({'file':name,'sha256':sha256(raw).hexdigest(),'textAndCorporatePartsPreserved':True})
proof['cases']=json.loads((QA/'render-results.json').read_text(encoding='utf-8-sig'))
for case in proof['cases']:
    if 'Delivery' in case['name']:continue
    with pdfplumber.open(QA/case['name'].replace('.docx','.pdf')) as pdf:
        assert len(pdf.pages)==case['pages']
        text='\n'.join(page.extract_text() or '' for page in pdf.pages)
        assert '{{' not in text
        if case['name'].startswith('STRESS_'):
            for i in range(1,25):assert f'{i}. 장문 출력' in text,(case['name'],i)
            assert '가상대표자' in text if 'Decision' in case['name'] else '가상검증자' in text
        assert all(len((p.extract_text() or '').splitlines())>12 for p in pdf.pages),'본문 없는 빈 페이지'
(ROOT/'docs/qa/review-decision-print-v1.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('본문 및 기업 표시 원본 동일 / 장문 1~24와 확인자 누락 없음 / 빈 페이지 없음')
