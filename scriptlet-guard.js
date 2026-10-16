// uBlock Origin's YouTube rules hook JSON.stringify six times ("trusted-edit-inbound-object"). Every hook copies the whole argument
// (JSON.parse(JSON.stringify(x))) BEFORE it checks whether the object is one it wants to change, and YouTube stringifies large objects all the
// time: six extra copies per call made a video take 6 to 10 seconds to start and burned about 10 CPU seconds where 3 are enough.
// These rules only ever change objects that carry a given top-level key (the player request has "attestationRequest"), so one cheap check in
// front of the copy makes every other call free and leaves the rules doing exactly what they did.
const COPY = /const s=t=>\{let e;try\{e=i\.JSON_parse\(i\.JSON_stringify\(t\)\)\}catch\{\}/;
const KEY = /\.\.\.\[`JSON\\\.stringify`,`-?\d+`,`\\\[\\\?\\\.(\w+)\\\]/;

// The rules apply to the object itself or to its direct children (a list of requests), like the filter in the rule does; looking one level down is cheap.
const CHECK = (key) => `if(!t||typeof t!=="object")return;{const k="${key}";let h=k in t;if(!h){for(const v of Array.isArray(t)?t:Object.values(t)){if(v&&typeof v==="object"&&k in v){h=true;break}}}if(!h)return}`;

function guard(code) {
  if (typeof code !== 'string' || !code.includes('editInboundObjectFn(true,')) return code;
  const m = KEY.exec(code);
  if (!m || !COPY.test(code)) return code; // any other shape (a newer uBlock Origin): leave it exactly as it is
  return code.replace(COPY, `const s=t=>{${CHECK(m[1])}let e;try{e=i.JSON_parse(i.JSON_stringify(t))}catch{}`);
}

module.exports = { guard, guardAll: (list) => (Array.isArray(list) ? list.map(guard) : list) };
