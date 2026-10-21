// Owner-editable nickname lists. This is a basic filter, not full moderation:
// it catches common slurs, profanity and impersonation, and the owner can still
// remove a ranking row with admin-remove-run.mjs.
//
// How entries are compared (see server/nickname.mjs):
// - The nickname is NFKC-normalised, lower-cased, and spaces, dots, dashes and
//   underscores are removed. Look-alikes are mapped first (0→o, 1→i or l, 3→e,
//   4→a, 5→s, 7→t, 8→b, @→a, $→s, and Cyrillic/Greek letters that look Latin).
// - Write entries in lower case without spaces. Korean entries are written as-is.

// Blocked anywhere inside the nickname (strong words that rarely appear inside innocent names).
export const BLOCKED_SUBSTRINGS=[
 // English
 'fuck','fck','cunt','nigger','nigga','faggot','fagot','retard','bitch','whore','slut','asshole','motherf','shit','porn','hitler',
 // Korean (including keyboard-layout spellings such as tlqkf = 씨발, qudtls = 병신)
 '씨발','씨팔','시팔','씨바','쓰바','ㅅㅂ','ㅆㅂ','병신','븅신','ㅂㅅ','ㅄ','좆','존나','개새끼','개색기','개새기','지랄','ㅈㄹ','염병','엠창','느금','니애미','니애비','창녀','섹스','tlqkf','qudtls','wlfkf',
];

// Blocked only when they are the whole nickname (they appear inside ordinary words,
// e.g. "dick" in "Dickens", "rape" in "grape", "nazi" in "Nazir", 시발 in 시발점).
export const BLOCKED_EXACT=['ass','dick','cock','penis','vagina','sex','rape','rapist','nazi','kys','시발','새끼','미친놈','미친년','애미','애비','니미','보지','자지','걸레'];

// Reserved for the operator. Latin entries are blocked when they are the whole
// nickname, a separate word in it ("Game Admin"), or have only digits added
// ("admin01"); "Badminton" stays allowed. Korean entries are blocked anywhere.
export const RESERVED_NAMES=['admin','administrator','moderator','mod','system','odysseus','operator','staff','운영자','관리자','운영진','시스템'];
