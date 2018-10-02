javascript:(()=>{
(function(){"use strict";if("github.com"!==document.location.host)return alert("This script must be run whilst on github.com");if(window.harvest||window.silo)return;const e="";const t="&s=indexed&o=desc";const n="&s=indexed&o=asc";window.silo={};window.harvest=r;Object.defineProperties(window.silo,{badApples:{value:[],writable:false,configurable:false},reap:{value:d,writable:false,configurable:false}});let o=null;Object.defineProperty(window,"that",{get:()=>o?d(o):""});let s=false;window.addEventListener("beforeunload",e=>s?e.returnValue="Your harvest hasn't finished. Are you sure you wish to cancel?":undefined);Notification.requestPermission();async function r(r,c=null){s=true;if(!/extension:|filename:|in:file|in:path/.test(r))r=`extension:${r}`;if(null==c){const e=Math.random(1e6).toString(16).replace(/\./,"").toUpperCase();c=`NOT nothack${e}`}const l=encodeURIComponent(`${r} ${c}`).replace(/%20/g,"+");const u=`https://github.com/search?q=${l}&type=Code`;try{const c=await i(u,e,r);if(c>1e3){await i(u,t,r);await i(u,n,r)}const l="Run `copy(that);` in your console to copy the URLs to your clipboard.";new Notification(`Harvest complete for ${r}`,{body:l});o=r;s=false}catch(e){s=false;console.error(e);if(a.lastResult)console.log({lastPageSnapshot:a.lastResult});throw e}}async function i(e,t,n){const o=silo[n]||(silo[n]={length:0});let s=0;let r;let i;return i=await d();async function f(){++s;if(s>=r)return i;await c(2e3);return d()}async function d(){const n=e+t+(s?`&p=${s+1}`:"");const c=await u(n);const d=await c.text().then(e=>{e=e.replace(/<img(?=\s)/gi,"<hr");return a(e)});const h=e=>d.querySelector(e);const p=e=>d.querySelectorAll(e);if(h("div.blankslate")){const e="Must include at least one user, organization, or repository";const t=e.split(" ").join("\\s+");new RegExp(t,"i").test(d.textContent)?["Failed.","GitHub's doing that weird thing again:",`\t> "${e}"`].join("\n\n"):"No results";console.error(`Skipping this one: ${n}\n`);console.error("Find it in window.silo.badApples");window.silo.badApples.push(n);f()}const w=h("#code_search_results > .code-list")||l("Search-result list not found");const m=w.querySelectorAll(".code-list-item");if(m.length<1)l("Expected at least one entry to match `.code-list-item`");for(const e of m){const t=e.querySelectorAll("hr.avatar[alt^='@']");const n=e.querySelector("a.text-bold + a[href]");if(t.length&&n&&!o[n.href]){++o.length;o[n.href]=n.href.replace(/^((?:\/[^/]+){2})\/blob(?=\/)/gim,"https://raw.githubusercontent.com$1")}}if(undefined===r){const e=p(".pagination > a[href]");if(e.length){const t=Array.from(e).filter(e=>/^\s*[0-9]+\s*$/.test(e.textContent)).map(e=>parseInt(e.textContent.trim()));r=Math.max(...t);const n=h(".codesearch-results h3");if(n&&n.textContent.match(/\b([0-9.,\s]+)\s/)){i=+RegExp.$1.replace(/\D/g,"");if(!/\b(code\s+results?)\b/.test(n.textContent)){let e=`Missing text found where "${i} code results" expected. `;e+="Please double-check <h3> contains correct number of search results";return l(e)}}else l("Unable to extract total number of results from header")}else{i=o.length;r=1}}return f()}}function a(e){const t=document.createDocumentFragment();const n=t.appendChild(document.createElement("div"));n.insertAdjacentHTML("afterbegin",e);t.root=n;a.lastResult=t;return t}function c(e){return new Promise(t=>setTimeout(()=>t(),e))}function l(e){const t=new SyntaxError(e);t.title="Unexpected Markup Error";t.fileName="harvester.js";t.message=e;console.trace(e);throw t}function u(e){return new Promise((t,n)=>{const o=new XMLHttpRequest;o.open("GET",e);o.addEventListener("readystatechange",()=>{if(XMLHttpRequest.DONE===o.readyState)t({text:()=>Promise.resolve(o.response)})});for(const e of"abort error timeout".split(" "))o.addEventListener(e,e=>n(e));o.send()})}function f(e){const t=e.match(/^https?:\/\/github.com\/([^/#]+)\/([^/#]+)\/blob\/(\w+)((?:\/[^/]+)+)/);if(!t)throw new TypeError(`Invalid GitHub permalink: ${e}`);const[,n,o,s,r]=t;return`https://raw.githubusercontent.com/${n}/${o}/${s}${r}`}function d(e){if(!/^extension:|filename:/.test(e)){const t=`extension:${e}`in silo;const n=`filename:${e}`in silo;if(t&&n){const t=`Both extension:${e} and filename:${e} properties exist in silo.`;throw new ReferenceError(`${t} Which did you mean?`)}if(t)e=`extension:${e}`;else if(n)e=`filename:${e}`}const t=silo[e]||{};return Object.keys(t).filter(e=>e!=="length").map(e=>f(t[e])).sort((e,t)=>{e=e.toLowerCase();t=t.toLowerCase();if(e<t)return-1;if(e>t)return 1;return 0}).join("\n")}})();
let q=prompt("Enter an extension or filename to harvest:");q&&harvest(q)})();