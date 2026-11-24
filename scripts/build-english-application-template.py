"""Translate fixed labels in a copy of the retained Korean system form."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from lxml import etree as E
import re

ROOT = Path(__file__).resolve().parents[1]
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
TRANSLATIONS = {
    '개인인증 신청서(최초, 갱신)': 'Personnel Certification Application and Document Review',
    'Registration Number: (GPC 내부직원에 의해 기재)': 'Registration Number completed by GPC staff',
    '개인 정보': 'Personal Information', '성    명': 'Name',
    '자국어) {{candidateName}}': 'Name on record: {{candidateName}}',
    '영어) {{candidateNameEn}}': 'English: {{candidateNameEn}}',
    '생년월일': 'Date of birth', '성    별': 'Gender', '☐ 남성': '☐ Male', '☐ 여성': '☐ Female',
    '국    적': 'Nationality', '주    소': 'Address', '전자메일': 'Email', '전화번호': 'Phone',
    '심사원 등급': 'Auditor Grade', '신청하고자 하는 란에 표시해 주세요': 'Select the certification type standard and grade',
    '{{initialMark}} 최초 인증': '{{initialMark}} Initial certification', '{{renewalMark}} 갱신 인증': '{{renewalMark}} Renewal',
    '☐ 심사원보': '☐ Provisional auditor', '☐ 심사원': '☐ Auditor', '☐ 선임심사원': '☐ Lead auditor',
    '☐ 검증심사원': '☐ Verification auditor', '☐ 내부심사원': '☐ Internal auditor',
    '본 신청서로 동시에 두가지 이상의 표준을 신청하는 경우, ': 'When applying for two or more standards with this application, ',
    '아래 공란에 신청하고자 하는 규격 및 심사원의 등급을 기재해 주시기 바랍니다. ': 'enter the requested standards and auditor grades below. ',
    '예) 9001 – 선임심사원 / 13485 – 심사원': 'Example: 9001 – Lead auditor / 13485 – Auditor',
    '신청 규격 및 등급: {{standard}} - {{grade}}': 'Requested standard and grade: {{standard}} - {{grade}}',
    '★ ★ [ISO/IEC 27001, 27701, 42001 규격 신청자 필수 확인 사항]': 'Required Acknowledgement for ISO IEC 27001 27701 and 42001 Applicants',
    '해당 3개 표준은 신청 등급에 따라 요구되는 학력 및 전공 요건이 엄격히 구분되오니 반드시 확인하시기 바랍니다.': 'For these three standards, the required education and major differ by grade. Check the applicable requirements.',
    '심사원보: 고졸 이상 (전공 무관) 등록 가능': 'Provisional auditor: high school graduation or above, regardless of major.',
    '심사원 이상 (승급 및 신규 등록): 대학 졸업 이상의 학력 보유자로 전자·정보통신·정보처리기술·정보보호 관련 전공 필수 ': 'Auditor and higher grades, including upgrades and new registrations: university graduation or above with a major related to electronics, information and communication, information processing technology or information security. ',
    "※ 주의사항: 현재 전공 무관으로 '심사원보' 등급에 등록하시더라도, 추후 '심사원' 자격으로 승급하기 위해서는 반드시 위의 심사원 필수 요건(관련 전공 학위 또는 대체 자격증)을 별도로 충족하셔야 합니다.": 'Even if registered as a provisional auditor without a related major, an upgrade to auditor requires separate fulfilment of the auditor requirements above, including a related degree or an alternative qualification.',
    '☐ 해당 규격은 추후 심사원으로 승급할 때 별도의 학력/전공 요건이 필요하다는 점을 충분히 안내받았으며, 본 내용을 확인 및 숙지하였습니다. (해당 규격 신청자 필수 체크 ✔)': '☐ I have been informed that an upgrade to auditor for these standards requires separate education and major requirements. I have read and understood this information. Required for applicants to these standards.',
    '모든 신청자는 학력, 경력,교육, 심사이력에 대한 정보를 적절히 기입하시기 바랍니다. 만일 공란이 불충분할 경우 표를 복사해서 사용해 주세요.': 'Complete the education, work experience, training and audit experience sections. Copy the tables if more space is needed.',
    '최종 학력': 'Highest Education', '최  종  학  력': 'Education level',
    '☐ 고졸': '☐ High school', '☐ 대졸(2년제)': '☐ College two year', '☐ 대졸(4년제)': '☐ University four year', '☐ 대학원졸': '☐ Graduate school',
    '학  위': 'Degree', '☐ 전문학사': '☐ Associate', '☐ 학사': '☐ Bachelor', '☐ 석사': '☐ Master', '☐ 박사': '☐ Doctor', '전  공  학  과': 'Major',
    '업무기술란에는 신청 표준과 관련하여 수행한 업무 내용을 확인할 수 있도록 자세히 기재해주시기 바랍니다. 만일 공란이 불충분할 경우 표를 복사해서 사용해 주세요.': 'Describe duties in enough detail to show their relevance to the requested standard. Copy the table if more space is needed.',
    '업무 경력': 'Work Experience', '조 직 명': 'Organization', '부   서': 'Department', '기   간': 'Period', '업무 기술': 'Duties',
    '심사원 교육 수료증 정보를 기입하세요. 만일 공란이 불충분할 경우 표를 복사해서 사용해 주세요.': 'Enter the details from the auditor training certificate. Copy the table if more space is needed.',
    '심사원 교육 과정': 'Auditor Training', '표준': 'Standard', '예) ISO 9001:2015': 'Example: ISO 9001:2015', '교육 과정': 'Course',
    '☐ 정규교육과정': '☐ Full course', '☐ 자격확대과정': '☐ Qualification extension', '☐ 자격전환과정': '☐ Qualification transfer',
    '교육 기간': 'Training period', '교육 기관': 'Training provider',
    '각 심사원 등급에는 최소한의 심사경력에 대한 요구사항이 있습니다.': 'Each auditor grade has minimum audit experience requirements.',
    '신청 유형에 따라 표시하고, 필요한 경우 증빙자료로서 심사로그시트를 추가로 제출해주세요.': 'Select the applicable grade and provide an audit log as supporting evidence where required.',
    '심사 이력': 'Audit Experience', '해당 없음': 'Not applicable', '(우측 요건 중 1개 이상 충족 시 체크)': 'Select when at least one requirement on the right is met',
    '최근 3년 이내 심사원으로서 20M/D 이상의 심사 이력 ': 'At least 20 audit days as an auditor within the last three years ',
    '(최초 혹은 갱신 1회 이상 포함)': 'including at least one initial or renewal audit',
    '심사이력을 대체하기 위한 현장 검증심사 진행': 'On site verification audit in place of audit experience',
    '최근 3년 이내 심사원으로서 35M/D 이상의 심사 이력 ': 'At least 35 audit days as an auditor within the last three years ',
    '(그 중 선임심사원으로서 15M/D 이상 심사 이력 포함)': 'including at least 15 days as a lead auditor',
    '최근 3년 이내 선임심사원으로서 15M/D 이상의 심사 이력 (공인된 개인인증기관으로부터 선임심사원 자격 취득 후의 심사 이력만 가능)': 'At least 15 audit days as a lead auditor within the last three years. Only audits performed after obtaining lead auditor certification from an accredited personnel certification body qualify.',
    '최근 3년 이내 내부심사원으로서 15M/D 이상의 심사 이력 (5회 이상)': 'At least 15 audit days as an internal auditor within the last three years, covering at least five audits.',
    '특별 요구사항': 'Special Requirements', '신청 시 특별 요구사항(장애, 언어)가 있습니까?': 'Do you have special requirements relating to disability or language?',
    '☐ 아니오  ☐ 예(있는 경우, 구체적인 내용을 아래에 기재해주세요)': '☐ No  ☐ Yes. If yes, give details below.',
    '제출 문서 목록 (*표시는 반드시 제출되어야 하는 문서입니다.)': 'Submitted Documents Asterisk Indicates Required Documents',
    '학력증명서*': 'Education certificate*', '경력증명서': 'Work experience certificate', '심사원과정 수료증*': 'Auditor training certificate*',
    '로그시트 (해당 시)': 'Audit log if applicable', '기타:': 'Other:',
    '선언문': 'Declaration', '인증 신청자는 GPC 행동강령에 동의하며 인증 요구사항을 준수할 것을 선언합니다.': 'I agree to the GPC Code of Conduct and declare that I will comply with the certification requirements.',
    '인증 신청자 본인은 자격인증을 신청함에 있어 증빙서류의 진위 확인을 위한 개인정보 제공에 동의하며 자격 인증을 위해 제출한 서류가 사실과 상이할 경우 어떠한 불이익도 감수할 것입니다.': 'I consent to providing personal information to verify the authenticity of supporting documents for certification. I accept any consequences if the submitted documents are found to be untrue.',
    '자격 유지기간 동안 자격과 관련하여 변동사항이 발생했을 경우, 즉시 GPC에 통보할 것을 약속합니다.': 'I undertake to notify GPC immediately of any changes relevant to my certification during its validity period.',
    '서      명': 'Signature', '일    자': 'Date', '등록정보* 반드시 GPC에 의해 작성되어야 합니다.': 'Registration and Document Review Completed by GPC',
    '접수일:': 'Received date:', '종합 검토결과: {{reviewResult}} / 검토의견: {{reviewComment}}': 'Overall review result: {{reviewResult}} / Review comments: {{reviewComment}}',
    '이 신청서는 검토되었으며 검토 결과에 따라 다음 절차를 수행합니다.': 'This application has been reviewed. The next steps will follow the review results.',
    '검토자: {{reviewer}}  검토일: {{reviewedAt}}': 'Reviewer: {{reviewer}}  Review date: {{reviewedAt}}',
    '검증인: {{verifier}}  검증일: {{verifiedAt}}  검증결과: {{verificationResult}}': 'Verifier: {{verifier}}  Verification date: {{verifiedAt}}  Result: {{verificationResult}}',
}

source = ROOT / 'templates/FGPC-008-01-application-review-kr.docx'
with ZipFile(source) as archive:
    parts = {name: archive.read(name) for name in archive.namelist()}
original_body = parts['word/document.xml']
doc = E.fromstring(original_body)
for text in doc.findall('.//w:t', NS):
    value = text.text or ''
    text.text = TRANSLATIONS.get(value, value)
    assert not re.search('[가-힣]', text.text), value
    if '{{reviewComment}}' in text.text:
        # A populated review can exceed one page. Keeping this legacy row
        # together leaves a mostly empty page before Word eventually splits it.
        row = next(text.iterancestors('{'+NS['w']+'}tr'))
        for keep in row.findall('w:trPr/w:cantSplit', NS):
            keep.getparent().remove(keep)
        for bold in text.getparent().findall('w:rPr/w:b', NS):
            bold.getparent().remove(bold)
parts['word/document.xml'] = E.tostring(doc, encoding='UTF-8', xml_declaration=True, standalone=True)
assert re.findall(rb'\{\{\w+\}\}', parts['word/document.xml']) == re.findall(rb'\{\{\w+\}\}', original_body)
for name in list(parts):
    if name.startswith('word/footer') and name.endswith('.xml'):
        footer = E.fromstring(parts[name])
        for text in footer.findall('.//w:t', NS):
            if text.text and '시스템 편집본' in text.text:
                text.text = 'FGPC-008-01 Rev.14 / System English v1'
            elif text.text and '국문 업무기록' in text.text:
                text.text = 'Certification record / Continued on following pages as needed'
        parts[name] = E.tostring(footer, encoding='UTF-8', xml_declaration=True, standalone=True)
with ZipFile(ROOT / 'templates/FGPC-008-01-application-review-en.docx', 'w', ZIP_DEFLATED) as archive:
    for name, data in parts.items():
        archive.writestr(name, data)
print('영문 신청서류 검토서: 모든 입력 필드와 기업 표시 보존')
