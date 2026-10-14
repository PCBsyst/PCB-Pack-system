import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const modules={};function load(name){if(modules[name])return modules[name];const exports={};modules[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:path=>load(path.replace('@/lib/',''))});return exports;}
const validate=load('registration-candidate-validation').registrationCandidateIssue;
const input={name:'홍길동',nameEn:'',birthDate:'',nationality:'',email:'',phone:''};
assert.equal(validate(input,'2026-10-14'),null);
for(const patch of [{name:' '},{birthDate:'2026-02-30'},{birthDate:'2026-10-15'},{email:'private@@example.test'},{email:'a@example'},{email:'a b@example.test'},{name:'홍\n길동'},{phone:'010\u0000'},{phone:'1'.repeat(101)},{nationality:'x'.repeat(201)}]){
 const issue=validate({...input,...patch},'2026-10-14');assert.equal(typeof issue,'string');assert.ok(!issue.includes('private@@example.test'));
}
for(const patch of [{birthDate:'2024-02-29'},{birthDate:'2026-10-14'},{name:"O'Connor"},{nameEn:'HONG GIL-DONG'},{email:' user+tag@example.test '},{phone:'+82 (10) 1234-5678 ext. 2'}])assert.equal(validate({...input,...patch},'2026-10-14'),null);
assert.equal(input.name,'홍길동');
console.log('신규 후보자 입력: 선택항목 공란·실재 날짜/접수일 대조·이메일 기본 형식·제어문자/길이 차단·국제 전화번호/이름 보존 검사 통과');
