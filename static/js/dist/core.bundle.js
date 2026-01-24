(()=>{var le=(e,n)=>()=>(n||e((n={exports:{}}).exports,n),n.exports);var Ee=le((Se,F)=>{window.WheelOfHeaven=window.WheelOfHeaven||{navbar:{},search:{},ui:{}};class Z{constructor(){this.activeDropdown=null,this.dropdowns=new Map,this.init()}init(){this.bindEvents(),this.initDropdowns()}initDropdowns(){document.querySelectorAll(".navbar__dropdown").forEach(t=>{const i=t.querySelector(".navbar__dropdown-trigger"),o=t.dataset.dropdown,s=document.getElementById(`${o}-dropdown`);i&&s&&o&&this.dropdowns.set(o,{element:t,trigger:i,dropdown:s,isOpen:!1})})}bindEvents(){document.addEventListener("click",n=>{const t=n.target.closest(".navbar__dropdown-trigger");if(t){n.preventDefault(),n.stopPropagation(),this.handleTriggerClick(t);return}const i=window.innerWidth<=768,o=window.isUserScrolling||!1;!n.target.closest(".navbar-dropdown")&&!n.target.closest(".navbar__dropdown")&&!n.target.closest(".navbar__content")&&!(i&&o)&&this.closeAllDropdowns()}),document.addEventListener("keydown",n=>{n.key==="Escape"&&this.closeAllDropdowns()}),this.handleMobileNavigation()}handleTriggerClick(n){if(window.innerWidth<=768)return;const i=n.closest(".navbar__dropdown")?.dataset.dropdown;if(!i||!this.dropdowns.has(i))return;this.dropdowns.get(i).isOpen?this.closeDropdown(i):(this.closeAllDropdowns(),this.openDropdown(i))}openDropdown(n){const t=this.dropdowns.get(n);!t||t.isOpen||(t.isOpen=!0,this.activeDropdown=n,t.trigger.classList.add("navbar__dropdown-trigger--active"),t.trigger.setAttribute("aria-expanded","true"),t.dropdown.classList.add("navbar-dropdown--active"),document.body.classList.add("navbar-dropdown-open"),requestAnimationFrame(()=>{this.positionDropdown(t)}))}closeDropdown(n){const t=this.dropdowns.get(n);!t||!t.isOpen||(t.isOpen=!1,this.activeDropdown===n&&(this.activeDropdown=null),t.trigger.classList.remove("navbar__dropdown-trigger--active"),t.trigger.setAttribute("aria-expanded","false"),t.dropdown.classList.remove("navbar-dropdown--active","navbar-dropdown--align-left","navbar-dropdown--align-right"),this.hasOpenDropdowns()||document.body.classList.remove("navbar-dropdown-open"))}closeAllDropdowns(){this.dropdowns.forEach((n,t)=>{n.isOpen&&this.closeDropdown(t)})}hasOpenDropdowns(){return Array.from(this.dropdowns.values()).some(n=>n.isOpen)}positionDropdown(n){const t=n.dropdown,i=n.trigger,o=document.querySelector(".navbar");t.classList.remove("navbar-dropdown--align-left","navbar-dropdown--align-right"),requestAnimationFrame(()=>{const s=o.getBoundingClientRect(),d=i.getBoundingClientRect(),g=window.innerWidth,m=s.bottom+1;t.style.top=`${m}px`;const w=d.left+d.width/2;t.style.left=`${w}px`,t.style.transform="translateX(-50%)",requestAnimationFrame(()=>{const E=t.getBoundingClientRect();E.right>g-20?(t.classList.add("navbar-dropdown--align-right"),t.style.left="auto",t.style.right="20px",t.style.transform="none"):E.left<20&&(t.classList.add("navbar-dropdown--align-left"),t.style.left="20px",t.style.transform="none")})})}handleMobileNavigation(){const n=()=>{window.innerWidth<=768&&this.closeAllDropdowns()};window.addEventListener("resize",n);const t=document.getElementById("mobileNavToggle");t&&t.addEventListener("click",i=>{i.preventDefault(),i.stopPropagation(),this.closeAllDropdowns()}),window.addEventListener("scroll",()=>{window.isUserScrolling=!0,clearTimeout(window.scrollEndTimer),window.scrollEndTimer=setTimeout(()=>{window.isUserScrolling=!1},150)},{passive:!0})}}class ee{constructor(){this.configIcons=this.loadConfigIcons(),this.fallbackIcons={knowledge:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>`,explainers:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <path d="M12 17h.01"/>
            </svg>`,revelations:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
            </svg>`,wiki:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                <path d="M8 7h8"/>
                <path d="M8 11h8"/>
                <path d="M8 15h6"/>
            </svg>`,org:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>`,community:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>`,about:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4"/>
                <path d="M12 8h.01"/>
            </svg>`,code_of_conduct:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12l2 2 4-4"/>
                <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
                <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
                <path d="M3 12v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6"/>
            </svg>`,contributing:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>`,forums:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>`,faq:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <path d="M12 17h.01"/>
            </svg>`,social:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>
            </svg>`}}loadConfigIcons(){return window.navbarIcons||{}}async getIcon(n){if(this.configIcons[n])try{const t=await fetch(this.configIcons[n]);if(t.ok)return await t.text()}catch(t){console.warn(`Failed to load icon from ${this.configIcons[n]}:`,t)}return this.fallbackIcons[n]||""}getIconSync(n){return this.fallbackIcons[n]||""}updateIcons(){this.configIcons=this.loadConfigIcons()}}document.addEventListener("DOMContentLoaded",()=>{window.WheelOfHeaven.navbar.dropdown=new Z,window.WheelOfHeaven.navbar.icons=new ee,window.navbarDropdown=window.WheelOfHeaven.navbar.dropdown,window.dropdownIcons=window.WheelOfHeaven.navbar.icons});typeof F<"u"&&F.exports&&(F.exports={NavbarDropdown:Z,DropdownIcons:ee});const q={MOBILE_BREAKPOINT:999,SCROLL_THRESHOLD:100,SCROLL_DELTA_MIN:5,SCROLL_END_DELAY:150,ANIMATION_DELAY:150,DEBOUNCE_DELAY:100,COOKIE_DAYS:365},A=()=>window.innerWidth<=q.MOBILE_BREAKPOINT;document.addEventListener("DOMContentLoaded",()=>{const e=document.querySelector(".navbar"),n=document.getElementById("mobileNavToggle"),t=document.getElementById("mobileSearchToggle"),i=document.querySelector(".navbar__search-input");let o=!1,s=!1,d=window.scrollY,g=!1,m=!1,w=null;function E(l){document.querySelectorAll(".navbar__theme-icon").forEach(u=>{u.classList.toggle("navbar__theme-icon--light",l)})}function T(){if(o){g=!1;return}const l=window.scrollY;A()&&e?Math.abs(l-d)>q.SCROLL_DELTA_MIN&&(l>d&&l>q.SCROLL_THRESHOLD?(e.classList.add("navbar--hidden"),s&&_()):l<d&&e.classList.remove("navbar--hidden")):!A&&e&&e.classList.remove("navbar--hidden"),d=l,g=!1}function x(){g||(requestAnimationFrame(T),g=!0)}function I(){m=!0,w&&clearTimeout(w)}function W(){w=setTimeout(()=>{m=!1},q.SCROLL_END_DELAY)}window.addEventListener("scroll",()=>{I(),x(),W()},{passive:!0});function O(l,u,y=365){const k=new Date;k.setTime(k.getTime()+y*24*60*60*1e3),document.cookie=`${l}=${u};expires=${k.toUTCString()};path=/`}function R(l){const u=l+"=",y=document.cookie.split(";");for(let k=0;k<y.length;k++){let $=y[k];for(;$.charAt(0)===" ";)$=$.substring(1,$.length);if($.indexOf(u)===0)return $.substring(u.length,$.length)}return null}setTimeout(()=>{document.querySelectorAll("#theme-toggle, #mobile-theme-toggle").forEach(u=>{u.addEventListener("click",()=>{const k=document.documentElement.getAttribute("data-theme")==="light"?"dark":"light";document.documentElement.setAttribute("data-theme",k),localStorage.setItem("theme",k),E(k==="light")})})},10);const M=document.documentElement.getAttribute("data-theme")||"dark";E(M==="light");const C=document.querySelector(".navbar__search-input");C&&document.addEventListener("keydown",l=>{l.ctrlKey&&(l.key==="/"||l.key==="?")&&(l.preventDefault(),A()?f(!0):(C.focus(),C.select()))});const c=document.getElementById("mobileSearchInput"),p=document.querySelector(".navbar__mobile-search");function f(l=!s){const u=A();A&&(l&&o&&a(),s=l,e&&e.classList.toggle("navbar--search-active",l),p&&p.classList.toggle("navbar__mobile-search--active",l),l&&c&&setTimeout(()=>{c.focus()},q.ANIMATION_DELAY))}function _(){s=!1,e&&e.classList.remove("navbar--search-active"),p&&p.classList.remove("navbar__mobile-search--active"),c&&(c.value="",c.blur()),typeof window.hideSearchModal=="function"&&window.hideSearchModal()}c&&(c.addEventListener("focus",()=>{typeof window.showSearchModal=="function"&&window.showSearchModal()}),c.addEventListener("input",l=>{const u=l.target.value;i&&(i.value=u,i.dispatchEvent(new Event("input")))}),c.addEventListener("keydown",l=>{l.key==="Escape"&&(l.preventDefault(),_())}));let H=null;function D(l){H&&(H.contains(l.target)||l.preventDefault())}function r(){o=!0,H=e.querySelector(".navbar__content"),e&&e.classList.add("navbar--mobile-expanded"),n&&n.setAttribute("aria-expanded",!0),document.body.classList.add("mobile-nav-open"),document.addEventListener("touchmove",D,{passive:!1})}function a(){o=!1,e&&e.classList.remove("navbar--mobile-expanded"),n&&n.setAttribute("aria-expanded",!1),document.body.classList.remove("mobile-nav-open"),document.removeEventListener("touchmove",D),H=null,window.navbarDropdown&&window.navbarDropdown.closeAllDropdowns()}t&&t.addEventListener("click",l=>{l.preventDefault(),l.stopPropagation(),o&&a(),f()}),new MutationObserver(l=>{l.forEach(u=>{if(u.type==="attributes"&&u.attributeName==="class"){const y=document.body.classList.contains("search-modal-open");A()&&!y&&s&&setTimeout(()=>{_()},q.DEBOUNCE_DELAY)}})}).observe(document.body,{attributes:!0}),document.addEventListener("keydown",l=>{l.key==="Escape"&&s&&_()}),document.addEventListener("click",l=>{if(A()&&s&&!e.contains(l.target)&&!m){const y=document.getElementById("search-modal");(!y||!y.contains(l.target))&&_()}}),n&&e&&(n.addEventListener("click",u=>{u.preventDefault(),u.stopPropagation(),s&&_(),o?a():r()}),document.addEventListener("click",u=>{if(o&&!e.contains(u.target)&&!m){const y=document.querySelector(".navbar__content");(!y||!y.contains(u.target))&&a()}}),e.querySelectorAll(".navbar__content .navbar__link, .navbar__content .navbar-dropdown__link").forEach(u=>{u.addEventListener("click",y=>{m||a()})})),window.addEventListener("resize",()=>{const l=A();A||(e&&(e.classList.remove("navbar--hidden","navbar--mobile-expanded","navbar--search-active"),window.navbarDropdown&&window.navbarDropdown.closeAllDropdowns(),p&&p.classList.remove("navbar__mobile-search--active")),o=!1,s=!1,n&&n.setAttribute("aria-expanded",!1),c&&(c.value=""))});const h=document.querySelector(".navbar__logo");h&&h.addEventListener("touchstart",l=>{const u=h.querySelector("img, svg");u&&(u.style.animation="logo-spin 9s linear infinite",setTimeout(()=>{u.style.animation=""},9e3))});const b=document.getElementById("lang-select"),L=document.getElementById("mobile-lang-select");function J(l,u){l&&u&&l.value!==u.value&&(u.value=l.value)}b&&L&&(b.addEventListener("change",()=>{J(b,L)}),L.addEventListener("change",()=>{J(L,b),o&&a()})),t&&t.addEventListener("click",l=>{setTimeout(()=>{const u=document.getElementById("search-modal");u&&!u.classList.contains("search-modal--active")&&typeof window.showSearchModal=="function"&&window.showSearchModal()},50)})});let N=null,Y=null,B="en",S=new Set;const G="woh-recent-searches",ce=5,te={Wiki:{icon:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            <path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h6"/>
        </svg>`,label:"Wiki"},Essentials:{icon:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 12h8"/><path d="M12 8v8"/>
        </svg>`,label:"Essentials"},Explainers:{icon:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <path d="M12 17h.01"/>
        </svg>`,label:"Explainers"},Timeline:{icon:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12,6 12,12 16,14"/>
        </svg>`,label:"Timeline"},Resources:{icon:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>`,label:"Resources"},Articles:{icon:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14,2 14,8 20,8"/>
        </svg>`,label:"Articles"},Library:{icon:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
        </svg>`,label:"Library"}},de=[{term:"Elohim",section:"Wiki"},{term:"Raelism",section:"Wiki"},{term:"Genesis",section:"Wiki"},{term:"Age of Aquarius",section:"Timeline"},{term:"extraterrestrial",section:"Wiki"},{term:"creation",section:"Wiki"},{term:"ancient astronauts",section:"Explainers"},{term:"intelligent design",section:"Wiki"}];async function ue(){try{B=document.documentElement.lang||"en";let e;try{if(e=await fetch(`/search_index.${B}.json`),N=await e.json(),!N||N.length<5)throw new Error("Search index too small, falling back to English")}catch(t){console.warn(`Failed to load search index for ${B}, falling back to English:`,t),e=await fetch("/search_index.en.json"),N=await e.json(),B="en"}const n={keys:[{name:"title",weight:.5},{name:"body",weight:.5}],threshold:.3,distance:100,includeMatches:!0,includeScore:!0,minMatchCharLength:2,findAllMatches:!0,ignoreLocation:!0,useExtendedSearch:!0,shouldSort:!0,tokenize:!1,matchAllTokens:!1};Y=new Fuse(N,n),console.log("Search initialized successfully with",N.length,"items")}catch(e){console.error("Error initializing search:",e)}}function ne(e){return te[e]?.icon||""}function ie(e){const i=X(e).replace(/^\/(?:de|fr|es|ru|ja|zh|zh-Hant|ko)\//,"/").split("/").filter(Boolean);if(i.length===0)return"Home";const o=i[0];return{wiki:"Wiki",essentials:"Essentials",revelations:"Library",library:"Library",explainers:"Explainers",timeline:"Timeline",articles:"Articles",resources:"Resources"}[o]||o.charAt(0).toUpperCase()+o.slice(1)}function X(e){try{return new URL(e).pathname}catch{return e.replace(/^https?:\/\/[^\/]+/,"")}}function he(){const e=B==="en"?"":`/${B}`;return[{title:"Home",url:e||"/",section:"Home",description:"Welcome page and site overview"},{title:"Essentials",url:`${e}/essentials/`,section:"Essentials",description:"Core concepts and fundamental information"},{title:"Explainers",url:`${e}/explainers/`,section:"Explainers",description:"Detailed explanations of key topics"},{title:"Timeline",url:`${e}/timeline/`,section:"Timeline",description:"Chronological overview of events"},{title:"Wiki",url:`${e}/wiki/`,section:"Wiki",description:"Comprehensive knowledge database"},{title:"Resources",url:`${e}/resources/`,section:"Resources",description:"Books, films, and external references"}]}function oe(){try{const e=localStorage.getItem(G);return e?JSON.parse(e):[]}catch{return[]}}function ve(e){if(!e||e.trim().length<2)return;const n=oe(),t=e.trim().toLowerCase(),i=n.filter(s=>s.toLowerCase()!==t);i.unshift(e.trim());const o=i.slice(0,ce);try{localStorage.setItem(G,JSON.stringify(o))}catch(s){console.warn("Could not save recent search:",s)}}function pe(){try{localStorage.removeItem(G)}catch(e){console.warn("Could not clear recent searches:",e)}}function P(){const e=Object.entries(te).map(([n,t])=>{const i=S.has(n);return`
            <button class="search-filter-chip ${i?"search-filter-chip--active":""}"
                    data-section="${n}"
                    aria-pressed="${i}">
                <span class="search-filter-chip__icon">${t.icon}</span>
                <span class="search-filter-chip__label">${t.label}</span>
            </button>
        `}).join("");return`
        <div class="search-filters">
            <div class="search-filters__header">
                <span class="search-filters__label">Filter by section</span>
                ${S.size>0?'<button class="search-filters__clear">Clear all</button>':""}
            </div>
            <div class="search-filters__chips">${e}</div>
        </div>
    `}function fe(){const e=oe();let n="";return e.length>0&&(n+=`
            <div class="search-suggestions">
                <div class="search-suggestions__header">
                    <span class="search-suggestions__label">Recent searches</span>
                    <button class="search-suggestions__clear" id="clear-recent">Clear</button>
                </div>
                <div class="search-suggestions__list">
                    ${e.map(t=>`
                        <button class="search-suggestion" data-term="${t}">
                            <svg class="search-suggestion__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12,6 12,12 16,14"/>
                            </svg>
                            <span class="search-suggestion__text">${t}</span>
                        </button>
                    `).join("")}
                </div>
            </div>
        `),n+=`
        <div class="search-suggestions">
            <div class="search-suggestions__header">
                <span class="search-suggestions__label">Popular searches</span>
            </div>
            <div class="search-suggestions__list">
                ${de.slice(0,6).map(t=>`
                    <button class="search-suggestion" data-term="${t.term}">
                        <svg class="search-suggestion__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="m21 21-4.3-4.3"/>
                        </svg>
                        <span class="search-suggestion__text">${t.term}</span>
                        <span class="search-suggestion__section">${t.section}</span>
                    </button>
                `).join("")}
            </div>
        </div>
    `,n}function se(){return`
        <div class="search-modal__navigation">
            <h4 class="search-modal__navigation-title">Browse sections</h4>
            ${he().map(n=>`
                <a href="${n.url}" class="search-result search-result--nav">
                    <div class="search-result__left">
                        <div class="search-result__title">${n.title}</div>
                        <div class="search-result__url">${n.url}</div>
                    </div>
                    <div class="search-result__right">
                        <div class="search-result__section">
                            <span class="search-result__section-icon">${ne(n.section)}</span>
                            ${n.section}
                        </div>
                    </div>
                </a>
            `).join("")}
        </div>
    `}function re(){return`
        ${P()}
        ${fe()}
        ${se()}
    `}function ge(){const e=document.createElement("div");return e.id="search-modal",e.className="search-modal",e.innerHTML=`
        <div class="search-modal__backdrop"></div>
        <div class="search-modal__container">
            <div class="search-modal__header">
                <h3 class="search-modal__title">Search</h3>
                <div class="search-modal__shortcut">Press <kbd>Esc</kbd> to close</div>
                <button class="search-modal__close" aria-label="Close search">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="search-modal__results" id="search-results">
                ${re()}
            </div>
        </div>
    `,document.body.appendChild(e),K(e),ae(e),e}function K(e){e.addEventListener("click",n=>{const t=n.target.closest(".search-filter-chip");if(t){const o=t.dataset.section;S.has(o)?S.delete(o):S.add(o);const s=e.querySelector(".search-filters");s&&(s.outerHTML=P());const d=document.querySelector(".navbar__search-input");d&&d.value.trim()&&V(d.value)}if(n.target.closest(".search-filters__clear")){S.clear();const o=e.querySelector(".search-filters");o&&(o.outerHTML=P());const s=document.querySelector(".navbar__search-input");s&&s.value.trim()&&V(s.value)}})}function ae(e){e.addEventListener("click",n=>{const t=n.target.closest(".search-suggestion");if(t){const o=t.dataset.term,s=document.querySelector(".navbar__search-input");s&&o&&(s.value=o,V(o))}n.target.closest("#clear-recent")&&(pe(),z([],""))})}function Q(e,n){if(!n||n.trim().length<2)return e;const t=n.toLowerCase().split(/\s+/).filter(o=>o.length>=2);if(t.length===0)return e;let i=e;return t.forEach(o=>{const s=o.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),d=new RegExp(`(${s})`,"gi");i=i.replace(d,'<mark class="search-highlight">$1</mark>')}),i}function me(e,n,t=150){if(!e)return"";if(e.length<=t)return e;let i=Math.floor(e.length/2);n&&n.length>0&&n[0].indices&&n[0].indices.length>0&&(i=n[0].indices[0][0]);const o=Math.max(0,i-Math.floor(t/2)),s=Math.min(e.length,o+t);let d=e.slice(o,s);return o>0&&(d="..."+d),s<e.length&&(d=d+"..."),d}function we(e){return e.filter(n=>{const t=n.item.url,i=X(t),o=ie(t);let s=!1;B==="en"?s=!i.match(/^\/(?:de|fr|es|ru|ja|zh|zh-Hant|ko)\//):s=i.startsWith(`/${B}/`);let d=!0;return S.size>0&&(d=S.has(o)),s&&d})}function be(e){return`
        ${P()}
        <div class="search-modal__empty-state">
            <div class="search-modal__empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
            </div>
            <h4 class="search-modal__empty-title">No results found</h4>
            <p class="search-modal__empty-text">
                No matches for "<strong>${e}</strong>"${S.size>0?" in selected sections":""}.
                Try different keywords${S.size>0?" or clear filters":""}.
            </p>
        </div>
        ${se()}
    `}function _e(e,n){return`
        <div class="search-results-count">
            <span class="search-results-count__number">${e}</span>
            <span class="search-results-count__text">result${e!==1?"s":""} for "${n}"</span>
        </div>
    `}function z(e,n=""){const t=document.getElementById("search-results");if(!t)return;if(!e||e.length===0){n&&n.trim().length>=2?t.innerHTML=be(n):t.innerHTML=re(),K(document.getElementById("search-modal")),ae(document.getElementById("search-modal"));return}const i=e.slice(0,15).map(o=>{const{item:s,matches:d}=o,g=Q(s.title,n),m=me(s.body,d?.filter(x=>x.key==="body")||[],140),w=Q(m,n),E=X(s.url),T=ie(s.url);return`
            <a href="${s.url}" class="search-result">
                <div class="search-result__left">
                    <div class="search-result__title">${g}</div>
                    <div class="search-result__url">${E}</div>
                    <div class="search-result__section">
                        <span class="search-result__section-icon">${ne(T)}</span>
                        ${T}
                    </div>
                </div>
                <div class="search-result__right">
                    <div class="search-result__body">${w}</div>
                </div>
            </a>
        `}).join("");t.innerHTML=`
        ${P()}
        ${_e(e.length,n)}
        ${i}
    `,K(document.getElementById("search-modal"))}function ye(e,n){let t;return function(...o){const s=()=>{clearTimeout(t),e(...o)};clearTimeout(t),t=setTimeout(s,n)}}function V(e){if(!Y||!e.trim()||e.trim().length<2){z([]);return}const n=Y.search(e),t=we(n);z(t,e),e.trim().length>=3&&ve(e)}const ke=ye(V,150);function U(){const e=document.getElementById("search-modal"),n=document.body;e&&(window.navbarDropdown&&window.navbarDropdown.closeAllDropdowns(),e.classList.add("search-modal--active"),n.classList.add("search-modal-open"),document.querySelectorAll("main, footer, .totop").forEach(i=>{i.style.filter="blur(4px)",i.style.transition="filter 0.3s ease"}))}function j(){const e=document.getElementById("search-modal"),n=document.body;if(e){e.classList.remove("search-modal--active"),n.classList.remove("search-modal-open"),document.querySelectorAll("main, footer, .totop").forEach(o=>{o.style.filter="none"});const i=document.querySelector(".navbar__search-input");i&&(i.value=""),S.clear(),z([])}}document.addEventListener("DOMContentLoaded",async()=>{await ue();const e=ge(),n=document.querySelector(".navbar__search-input");n&&(n.addEventListener("focus",U),n.addEventListener("click",U),n.addEventListener("input",o=>{const s=o.target.value;s.trim()&&!e.classList.contains("search-modal--active")&&U(),ke(s),!s.trim()&&e.classList.contains("search-modal--active")&&z([])}),n.addEventListener("keydown",o=>{o.key==="Enter"&&o.preventDefault()}));const t=e.querySelector(".search-modal__close"),i=e.querySelector(".search-modal__backdrop");t.addEventListener("click",j),i.addEventListener("click",j),e.addEventListener("click",o=>{const s=o.target.closest(".search-result");s&&s.href&&j()}),document.addEventListener("keydown",o=>{(o.ctrlKey||o.metaKey)&&o.key==="/"&&(o.preventDefault(),n&&n.focus()),o.key==="Escape"&&(j(),n&&n.blur())})});document.addEventListener("keydown",e=>{const n=document.getElementById("search-modal");if(!n||!n.classList.contains("search-modal--active"))return;const t=n.querySelectorAll(".search-result"),o=[...n.querySelectorAll(".search-suggestion"),...t],s=document.activeElement,d=document.querySelector(".navbar__search-input");if(e.key==="ArrowDown")if(e.preventDefault(),s===d)o[0]?.focus();else{const g=Array.from(o).indexOf(s),m=Math.min(g+1,o.length-1);o[m]?.focus()}else if(e.key==="ArrowUp"){e.preventDefault();const g=Array.from(o).indexOf(s);g>0?o[g-1]?.focus():d?.focus()}});(function(){"use strict";const e="woh-reading-list";let t=[],i=null;function o(){s(),T(),W(),p(),x()}function s(){try{const r=localStorage.getItem(e);r&&(t=JSON.parse(r),t=t.filter(a=>a.url&&a.title))}catch(r){console.error("[ReadingList] Error loading:",r),t=[]}}function d(){try{localStorage.setItem(e,JSON.stringify(t))}catch(r){console.error("[ReadingList] Error saving:",r)}}function g(r){return t.findIndex(v=>v.url===r.url)!==-1?!1:(t.unshift({url:r.url,title:r.title,description:r.description||"",section:r.section||"",addedAt:Date.now()}),t.length>100&&(t=t.slice(0,100)),d(),E(r.url),O(),x(),!0)}function m(r){const a=t.findIndex(v=>v.url===r);return a!==-1?(t.splice(a,1),d(),O(),x(),!0):!1}function w(r){return t.some(a=>a.url===r)}function E(r){"serviceWorker"in navigator&&navigator.serviceWorker.controller&&navigator.serviceWorker.controller.postMessage({type:"CACHE_URLS",urls:[r]})}function T(){document.addEventListener("click",r=>{const a=r.target.closest("[data-bookmark]");if(!a)return;r.preventDefault();const v=a.dataset.url||window.location.pathname,h=a.dataset.title||document.title,b=a.dataset.description||"",L=a.dataset.section||"";w(v)?(m(v),D(f("removedFromList","Removed from reading list"))):(g({url:v,title:h,description:b,section:L}),D(f("addedToList","Added to reading list")))})}function x(){document.querySelectorAll("[data-bookmark]").forEach(a=>{const v=a.dataset.url||window.location.pathname,h=w(v);a.classList.toggle("is-bookmarked",h),a.setAttribute("aria-pressed",h);const b=a.querySelector(".bookmark-icon-filled"),L=a.querySelector(".bookmark-icon-outline");b&&L&&(b.style.display=h?"block":"none",L.style.display=h?"none":"block")}),I()}function I(){const r=document.querySelector(".reading-list-toggle__badge");if(r){const a=t.length;r.textContent=a,r.style.display=a>0?"flex":"none"}}function W(){i=document.createElement("div"),i.className="reading-list-panel",i.id="readingListPanel",i.setAttribute("role","dialog"),i.setAttribute("aria-labelledby","readingListTitle"),i.setAttribute("aria-hidden","true"),i.innerHTML=`
            <div class="reading-list-panel__backdrop"></div>
            <div class="reading-list-panel__content">
                <header class="reading-list-panel__header">
                    <h2 class="reading-list-panel__title" id="readingListTitle">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                        ${f("readingList","Reading List")}
                    </h2>
                    <button class="reading-list-panel__close" aria-label="${f("close","Close")}" data-close-reading-list>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </header>
                <div class="reading-list-panel__body">
                    <div class="reading-list-panel__empty">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                        <p>${f("emptyReadingList","Your reading list is empty")}</p>
                        <p class="reading-list-panel__empty-hint">${f("emptyReadingListHint","Bookmark articles to save them for later")}</p>
                    </div>
                    <ul class="reading-list-panel__list"></ul>
                </div>
                <footer class="reading-list-panel__footer">
                    <button class="reading-list-panel__clear" data-clear-reading-list>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        ${f("clearAll","Clear all")}
                    </button>
                </footer>
            </div>
        `,document.body.appendChild(i);const r=i.querySelector(".reading-list-panel__backdrop"),a=i.querySelector("[data-close-reading-list]"),v=i.querySelector("[data-clear-reading-list]");r?.addEventListener("click",M),a?.addEventListener("click",M),v?.addEventListener("click",c),document.addEventListener("click",h=>{h.target.closest("[data-toggle-reading-list]")&&(h.preventDefault(),C())}),O()}function O(){if(!i)return;const r=i.querySelector(".reading-list-panel__list"),a=i.querySelector(".reading-list-panel__empty"),v=i.querySelector(".reading-list-panel__footer");if(t.length===0){a.style.display="flex",r.style.display="none",v.style.display="none";return}a.style.display="none",r.style.display="block",v.style.display="flex",r.innerHTML=t.map(h=>`
            <li class="reading-list-panel__item">
                <a href="${_(h.url)}" class="reading-list-panel__link">
                    ${h.section?`<span class="reading-list-panel__section">${_(h.section)}</span>`:""}
                    <span class="reading-list-panel__item-title">${_(h.title)}</span>
                    ${h.description?`<span class="reading-list-panel__item-desc">${_(H(h.description,100))}</span>`:""}
                </a>
                <button class="reading-list-panel__remove" data-remove-url="${_(h.url)}" aria-label="${f("remove","Remove")}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </li>
        `).join(""),r.querySelectorAll("[data-remove-url]").forEach(h=>{h.addEventListener("click",b=>{b.preventDefault(),b.stopPropagation();const L=h.dataset.removeUrl;m(L),D(f("removedFromList","Removed from reading list"))})}),I()}function R(){if(!i)return;i.classList.add("reading-list-panel--open"),i.setAttribute("aria-hidden","false"),document.body.style.overflow="hidden",i.querySelector("button, a")?.focus()}function M(){i&&(i.classList.remove("reading-list-panel--open"),i.setAttribute("aria-hidden","true"),document.body.style.overflow="")}function C(){i?.classList.contains("reading-list-panel--open")?M():R()}function c(){t.length!==0&&confirm(f("confirmClear","Clear all items from your reading list?"))&&(t=[],d(),O(),x(),D(f("listCleared","Reading list cleared")))}function p(){document.addEventListener("keydown",r=>{const a=document.activeElement,v=a?.tagName?.toLowerCase();if(v==="input"||v==="textarea"||a?.isContentEditable||r.ctrlKey||r.metaKey||r.altKey)return;const h=document.querySelector(".search-modal--open, .keyboard-shortcuts-modal--open, .ask-ai__panel--open");if(r.key==="b"&&!r.shiftKey&&!h){const b=document.querySelector("[data-bookmark]");b&&(r.preventDefault(),b.click())}else r.key==="B"&&r.shiftKey&&!h?(r.preventDefault(),R()):r.key==="Escape"&&i?.classList.contains("reading-list-panel--open")&&(r.preventDefault(),M())})}function f(r,a){return window.readingListTranslations?.[r]||a}function _(r){const a=document.createElement("div");return a.textContent=r,a.innerHTML}function H(r,a){return r.length<=a?r:r.substring(0,a).trim()+"\u2026"}function D(r){const a=document.querySelector(".snackbar");if(a)a.textContent=r,a.classList.add("snackbar--visible"),setTimeout(()=>{a.classList.remove("snackbar--visible")},3e3);else{const v=document.createElement("div");v.className="snackbar snackbar--visible",v.textContent=r,document.body.appendChild(v),setTimeout(()=>{v.remove()},3e3)}}window.ReadingList={add:g,remove:m,isInList:w,getAll:()=>[...t],open:R,close:M,toggle:C},document.readyState==="loading"?document.addEventListener("DOMContentLoaded",o):o()})();(function(){"use strict";let e=null,n=navigator.onLine,t=null,i=null;function o(){s(),g(),x(),W()}function s(){"serviceWorker"in navigator&&(window.addEventListener("load",async()=>{try{const c=await navigator.serviceWorker.register("/sw.js",{scope:"/"});console.log("[PWA] Service Worker registered:",c.scope),c.addEventListener("updatefound",()=>{const p=c.installing;p.addEventListener("statechange",()=>{p.state==="installed"&&navigator.serviceWorker.controller&&M()})})}catch(c){console.error("[PWA] Service Worker registration failed:",c)}}),navigator.serviceWorker.addEventListener("message",d))}function d(c){c.data.type==="CACHE_COMPLETE"&&C("Page saved for offline reading")}function g(){window.addEventListener("beforeinstallprompt",c=>{c.preventDefault(),e=c,localStorage.getItem("pwa-install-dismissed")||m()}),window.addEventListener("appinstalled",()=>{console.log("[PWA] App installed"),e=null,w(),localStorage.setItem("pwa-installed","true")})}function m(){t||(t=document.createElement("div"),t.className="pwa-install-banner",t.innerHTML=`
            <div class="pwa-install-banner__content">
                <div class="pwa-install-banner__icon">
                    <img src="/brand/icon-192.png" alt="" width="40" height="40">
                </div>
                <div class="pwa-install-banner__text">
                    <strong>Install Wheel of Heaven</strong>
                    <span>Add to home screen for offline access</span>
                </div>
            </div>
            <div class="pwa-install-banner__actions">
                <button class="pwa-install-banner__btn pwa-install-banner__btn--dismiss" aria-label="Dismiss">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <button class="pwa-install-banner__btn pwa-install-banner__btn--install">Install</button>
            </div>
        `,document.body.appendChild(t),requestAnimationFrame(()=>{t.classList.add("pwa-install-banner--visible")}),t.querySelector(".pwa-install-banner__btn--install").addEventListener("click",T),t.querySelector(".pwa-install-banner__btn--dismiss").addEventListener("click",E))}function w(){t&&(t.classList.remove("pwa-install-banner--visible"),setTimeout(()=>{t&&t.parentNode&&t.parentNode.removeChild(t),t=null},300))}function E(){localStorage.setItem("pwa-install-dismissed","true"),w()}async function T(){if(!e)return;e.prompt();const{outcome:c}=await e.userChoice;console.log("[PWA] Install prompt outcome:",c),e=null,w()}function x(){i=document.createElement("div"),i.className="offline-indicator",i.setAttribute("role","status"),i.setAttribute("aria-live","polite"),i.innerHTML=`
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                <line x1="12" y1="20" x2="12.01" y2="20"></line>
            </svg>
            <span>You're offline</span>
        `,document.body.appendChild(i),I(),window.addEventListener("online",()=>{n=!0,I(),C("You're back online")}),window.addEventListener("offline",()=>{n=!1,I()})}function I(){i&&(n?i.classList.remove("offline-indicator--visible"):i.classList.add("offline-indicator--visible"),document.body.classList.toggle("is-offline",!n))}function W(){document.querySelectorAll("[data-save-offline]").forEach(p=>{p.addEventListener("click",()=>O(p))}),R()}function O(c){if(!("serviceWorker"in navigator)||!navigator.serviceWorker.controller){C("Offline saving not available");return}const p=window.location.pathname;navigator.serviceWorker.controller.postMessage({type:"CACHE_URLS",urls:[p]}),c&&(c.classList.add("is-saved"),c.innerHTML=`
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Saved Offline
            `)}async function R(){if("caches"in window)try{await(await caches.open("woh-pages-v1")).match(window.location.pathname)&&document.querySelectorAll("[data-save-offline]").forEach(_=>{_.classList.add("is-saved"),_.innerHTML=`
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Saved Offline
                    `})}catch(c){console.error("[PWA] Error checking cache:",c)}}function M(){const c=document.createElement("div");c.className="pwa-update-banner",c.innerHTML=`
            <span>A new version is available</span>
            <button class="pwa-update-banner__btn" onclick="location.reload()">Refresh</button>
        `,document.body.appendChild(c),requestAnimationFrame(()=>{c.classList.add("pwa-update-banner--visible")})}function C(c){const p=document.querySelector(".snackbar");if(p)p.textContent=c,p.classList.add("snackbar--visible"),setTimeout(()=>{p.classList.remove("snackbar--visible")},3e3);else{const f=document.createElement("div");f.className="snackbar snackbar--visible",f.textContent=c,document.body.appendChild(f),setTimeout(()=>{f.remove()},3e3)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",o):o()})();(function(){"use strict";const e={ROOT_MARGIN:"-80px 0px -60% 0px",THRESHOLD:0,ACTIVE_CLASS:"wiki__toc-link--active",TOC_SELECTOR:".wiki__toc-nav",HEADING_SELECTOR:"h1[id], h2[id], h3[id], h4[id]",CONTENT_SELECTOR:".wiki__content"};class n{constructor(){this.tocNav=document.querySelector(e.TOC_SELECTOR),this.contentArea=document.querySelector(e.CONTENT_SELECTOR),!(!this.tocNav||!this.contentArea)&&(this.tocLinks=this.tocNav.querySelectorAll("a[href^='#']"),this.headings=this.contentArea.querySelectorAll(e.HEADING_SELECTOR),!(this.tocLinks.length===0||this.headings.length===0)&&this.init())}init(){this.createObserver(),this.observeHeadings(),this.bindTocClicks()}createObserver(){this.observer=new IntersectionObserver(i=>{i.forEach(o=>{o.isIntersecting&&this.setActiveLink(o.target.id)})},{rootMargin:e.ROOT_MARGIN,threshold:e.THRESHOLD})}observeHeadings(){this.headings.forEach(i=>{i.id&&this.observer.observe(i)})}setActiveLink(i){this.tocLinks.forEach(s=>{s.classList.remove(e.ACTIVE_CLASS)});const o=this.tocNav.querySelector(`a[href="#${i}"]`);o&&(o.classList.add(e.ACTIVE_CLASS),this.scrollTocToView(o))}scrollTocToView(i){const o=this.tocNav,s=i.getBoundingClientRect(),d=o.getBoundingClientRect();(s.top<d.top||s.bottom>d.bottom)&&i.scrollIntoView({behavior:"smooth",block:"center"})}bindTocClicks(){this.tocLinks.forEach(i=>{i.addEventListener("click",o=>{o.preventDefault();const s=i.getAttribute("href").slice(1),d=document.getElementById(s);if(d){const w=d.getBoundingClientRect().top+window.pageYOffset-80;window.scrollTo({top:w,behavior:"smooth"}),this.setActiveLink(s),history.pushState(null,null,`#${s}`)}})})}destroy(){this.observer&&this.observer.disconnect()}}document.addEventListener("DOMContentLoaded",()=>{document.querySelector(".wiki")&&(window.tocScrollSpy=new n)})})();document.addEventListener("DOMContentLoaded",()=>{const e=document.getElementById("toTopBtn");window.addEventListener("scroll",()=>{window.scrollY>300?e.classList.add("to-top--visible"):e.classList.remove("to-top--visible")}),e.addEventListener("click",()=>{window.scrollTo({top:0,behavior:"smooth"})})})});Ee();})();
