from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from lxml import etree as E
import re
ROOT=Path(__file__).resolve().parents[1]
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';NS={'w':W}
translations={
'인증결정보고서':'Certification Decision Report','신청 정보':'Application Information',
'개인인증 문서 및 기록 평가':'Evaluation of Certification Documents and Records',
'☐ 지식 시험 합격':'☐ Knowledge examination passed','☐ 인성 시험 합격':'☐ Personality examination passed',
'☐ 교육 요구사항 충족':'☐ Training requirements met','☐ 학력 및 관련 업무경력 요건 충족':'☐ Academic and relevant work experience requirements met',
'☐ 해당 규격, 또는 해당 규격에 상응하는 종류의 인증 심사경력 충족':'☐ Audit experience requirements met for the applicable standard or an equivalent type of certification',
'검토 의견':'Review Comments','검증심사보고서 기록 사용시 작성 필)':'Complete when a verification audit report is used',
'인증패널 결정':'Certification Panel Decision',
'평가대상자는 ISO/IEC 17024:2012에 기반한 GPC 개인인증 요구사항을 충족하였습니다.':'The candidate has met the GPC personnel certification requirements based on ISO/IEC 17024:2012.',
'GPC는 본 평가대상자에 대해 아래와 같이 결정합니다.':'GPC makes the following decision regarding the candidate.',
'인증원 평가':'Certification Body Evaluation','지식 및 인성':'Knowledge and Personality','증빙자료':'Supporting Evidence',
'최종 승인자':'Final Approver','최종 승인일':'Final Approval Date',
}
substitutions={'결과: ':'Result: ','인증 승인 ':'Certification approved ','인증 불승인 ':'Certification not approved ','재승인 ':'Reapproved ','인증 번호: ':'Certification No.: ','유효 기간: ':'Validity Period: ','논평: ':'Comments: ','평가자: ':'Panel Members: ','평가 일자: ':'Panel Decision Date: '}
src=ROOT/'templates/FGPC-012-01-decision-report-kr.docx'
with ZipFile(src) as z:parts={n:z.read(n) for n in z.namelist()}
before=re.findall(r'\{\{\w+\}\}',parts['word/document.xml'].decode())
doc=E.fromstring(parts['word/document.xml'])
for t in doc.findall('.//w:t',NS):
 s=t.text or '';s=translations.get(s,s)
 for kr,en in substitutions.items():s=s.replace(kr,en)
 assert not re.search('[가-힣]',s),s
 t.text=s
parts['word/document.xml']=E.tostring(doc,encoding='UTF-8',xml_declaration=True,standalone=True)
assert re.findall(r'\{\{\w+\}\}',parts['word/document.xml'].decode())==before
for name in list(parts):
 if name.startswith('word/footer') and name.endswith('.xml'):
  footer=E.fromstring(parts[name])
  for t in footer.findall('.//w:t',NS):
   if t.text and '시스템 편집본' in t.text:t.text='FGPC-012-01 Rev.6 / System English v1'
   elif t.text and '국문 업무기록' in t.text:t.text='Certification record / Continued on following pages as needed'
  parts[name]=E.tostring(footer,encoding='UTF-8',xml_declaration=True,standalone=True)
with ZipFile(ROOT/'templates/FGPC-012-01-decision-report-en.docx','w',ZIP_DEFLATED) as z:
 for name,data in parts.items():z.writestr(name,data)
print('English decision report: all fields and corporate media retained')
