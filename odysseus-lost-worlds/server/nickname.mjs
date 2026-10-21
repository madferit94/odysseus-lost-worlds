// Nickname clean-up and basic filtering for the public ranking.
// A basic filter, not full moderation: the lists live in nickname-blocklist.mjs.
import {BLOCKED_SUBSTRINGS,BLOCKED_EXACT,RESERVED_NAMES} from './nickname-blocklist.mjs';

const NICKNAME_PATTERN=/^[\p{L}\p{N} _.-]{1,16}$/u;
const COMPAT_JAMO=/[\u3131-\u318E]+/gu; // Hangul compatibility jamo (ㄱ…ㆎ)
const SEPARATORS=/[\s_.\-]+/gu;
// Digits and symbols people use in place of letters ("adm1n", "$h1t", "@dmin").
const DIGIT_LOOKALIKES={'0':'o','3':'e','4':'a','5':'s','7':'t','8':'b','@':'a','$':'s','!':'i','|':'l'};
const SCRIPT_LOOKALIKES={'а':'a','в':'b','е':'e','ё':'e','к':'k','м':'m','н':'h','о':'o','р':'p','с':'c','т':'t','у':'y','х':'x','і':'i','ї':'i','ј':'j','ѕ':'s','һ':'h','ԁ':'d','ԛ':'q','ԝ':'w','ӏ':'l',
 'α':'a','β':'b','ε':'e','η':'n','ι':'i','κ':'k','μ':'u','ν':'v','ο':'o','ρ':'p','τ':'t','υ':'u','χ':'x','ω':'w','ς':'s','σ':'o','γ':'y','λ':'l'};

// NFKC (full-width letters, ligatures and styled letters become plain ones), trim,
// and collapse runs of spaces. Standalone Korean jamo such as ㅋ are left as typed:
// NFKC would turn them into conjoining jamo that some fonts draw oddly.
export function normalizeNickname(raw){
 if(typeof raw!=='string')return '';
 let out='',last=0;
 for(const m of raw.matchAll(COMPAT_JAMO)){out+=raw.slice(last,m.index).normalize('NFKC')+m[0];last=m.index+m[0].length;}
 out+=raw.slice(last).normalize('NFKC');
 return out.replace(/\s+/gu,' ').trim();
}

// Comparison keys: lower-case, separators removed, Cyrillic/Greek look-alikes mapped.
// plain keeps digits; variants also map digit look-alikes ("1" can be "i" or "l")
// and add a copy with repeated letters collapsed ("fuuuck").
function keys(text){
 const plain=[...text.normalize('NFKC').toLowerCase().replace(SEPARATORS,'')].map(c=>SCRIPT_LOOKALIKES[c]||c).join('');
 const mapped=[...plain].map(c=>DIGIT_LOOKALIKES[c]||c).join('');
 const variants=new Set([mapped.replaceAll('1','i'),mapped.replaceAll('1','l')]);
 for(const v of [...variants])variants.add(v.replace(/(.)\1+/gu,'$1'));
 return {plain,variants:[...variants]};
}
const entryKey=entry=>keys(entry).variants[0];
const SUBSTRINGS=BLOCKED_SUBSTRINGS.map(entryKey),EXACT=new Set(BLOCKED_EXACT.map(entryKey));
const RESERVED=RESERVED_NAMES.map(name=>({key:entryKey(name),anywhere:/\p{Script=Hangul}/u.test(name)}));
// A Latin reserved name matches the whole text, the text with digits only added
// before or after it ("admin01"), or a look-alike spelling ("adm1n").
function matchesReserved(text,key){
 const {plain,variants}=keys(text);
 return variants.includes(key)||keys(plain.replace(/^\d+|\d+$/gu,'')).variants.includes(key);
}

function scriptOf(ch){
 if(/\p{Script=Latin}/u.test(ch))return 'latin';
 if(/\p{Script=Cyrillic}/u.test(ch))return 'cyrillic';
 if(/\p{Script=Greek}/u.test(ch))return 'greek';
 return null;
}

// Returns {nickname} when allowed or {code,error} when rejected.
export function checkNickname(raw){
 const nickname=normalizeNickname(raw);
 if(!NICKNAME_PATTERN.test(nickname))return {code:'nickname_format',error:'Use 1–16 letters, numbers, spaces, dots, dashes or underscores.'};
 const scripts=new Set([...nickname].map(scriptOf).filter(Boolean));
 if(scripts.size>1)return {code:'nickname_mixed_script',error:'Use one alphabet in your nickname. Latin letters cannot be mixed with Cyrillic or Greek letters.'};
 const {variants}=keys(nickname);
 const words=nickname.split(SEPARATORS).filter(Boolean);
 const reserved=RESERVED.some(({key,anywhere})=>anywhere?variants.some(v=>v.includes(key)):matchesReserved(nickname,key)||words.some(w=>matchesReserved(w,key)));
 if(reserved)return {code:'nickname_reserved',error:'That nickname is reserved. Please choose another.'};
 if(variants.some(v=>EXACT.has(v)||SUBSTRINGS.some(entry=>v.includes(entry))))return {code:'nickname_blocked',error:'That nickname is not allowed. Please choose another.'};
 return {nickname};
}
