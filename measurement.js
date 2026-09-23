(function () {
  'use strict';
  const ROOT = '/tenshoku-shindan/';
  const MID = 'G-90J1ZQGPLF';
  const KEY = 'tenshokuAttributionV1';
  const OPT = 'tenshokuAnalyticsDisabled';
  const page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
  const clean = (s, fallback) => /^[a-zA-Z0-9]{1,50}$/.test(s || '') ? s : fallback;
  const params = new URLSearchParams(location.search);
  const now = Date.now();
  let attribution = {source:'direct', medium:'none', campaign:'none', post:'none', time:now};
  let disabled = false;
  try { disabled = localStorage.getItem(OPT) === '1'; } catch (_) {}
  let ref = null;
  try { ref = new URL(document.referrer); } catch (_) {}
  try {
    const old = JSON.parse(sessionStorage.getItem(KEY));
    if (old && now - old.time < 1800000 && (!ref || ref.origin === location.origin)) attribution = old;
  } catch (_) {}
  if (ref && ref.origin !== location.origin) {
    attribution = {source:/^(www\.)?(t\.co|x\.com|twitter\.com)$/.test(ref.hostname) ? 'x' : 'referral',medium:'referral',campaign:'none',post:'none',time:now};
  }
  // Only planned campaign tokens are accepted; never copy arbitrary URLs or quiz answers.
  const source = params.get('utm_source');
  if (['x','twitter','note'].includes(source)) {
    attribution = {source:source === 'twitter' ? 'x' : source,
      medium:['social','paidSocial'].includes(params.get('utm_medium')) ? params.get('utm_medium') : 'social',
      campaign:/^test\d{6}$/.test(params.get('utm_campaign') || '') ? params.get('utm_campaign') : 'none',
      post:/^(p\d{1,20}|profile|pinned)$/.test(params.get('utm_content') || '') ? params.get('utm_content') : 'none',time:now};
  }
  attribution.time = now;
  try { if (!disabled) sessionStorage.setItem(KEY, JSON.stringify(attribution)); } catch (_) {}
  const context = {article_id:clean(page,'page'),traffic_source:attribution.source,
    traffic_medium:attribution.medium,campaign_id:attribution.campaign,post_id:attribution.post};
  const live = location.hostname === 'novacore-lab.github.io' && location.pathname.startsWith(ROOT);
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = gtag;
  if (live && !disabled) {
    const safeUrl = new URL(location.origin + location.pathname);
    if (attribution.source === 'x' || attribution.source === 'note') {
      safeUrl.searchParams.set('utm_source', attribution.source);
      safeUrl.searchParams.set('utm_medium', attribution.medium);
      safeUrl.searchParams.set('utm_campaign', attribution.campaign);
      safeUrl.searchParams.set('utm_content', attribution.post);
    }
    gtag('js', new Date());
    gtag('config', MID, Object.assign({},context,{page_location:safeUrl.href,page_referrer:ref ? ref.origin : '',
      cookie_path:ROOT,allow_google_signals:false,allow_ad_personalization_signals:false}));
    const script = document.createElement('script');
    script.async = true; script.src = 'https://www.googletagmanager.com/gtag/js?id=' + MID;
    document.head.appendChild(script);
  }
  function event(name, extra) {
    if (disabled) return;
    const data = Object.assign({},context,extra);
    if (live) gtag('event',name,data);
    else document.dispatchEvent(new CustomEvent('measurement-preview',{detail:{name,data}}));
  }
  const programMap = {'5O7E':'onecareer','3AW0':'miidas'};
  function affiliate(a) {
    try {
      const u = new URL(a.getAttribute('href'),location.href);
      if (u.hostname === 'px.a8.net' && u.pathname === '/svt/ejp') {
        const mat = (u.searchParams.get('a8mat') || '').split(/[ +]/);
        return {network:'a8',program:a.dataset.program || programMap[mat[2]] || clean(mat[2],'other')};
      }
      if (u.hostname === 't.afi-b.com') return {network:'afb',program:a.dataset.program || clean((u.searchParams.get('a') || '').replace(/[^a-z0-9]/gi,''),'other')};
    } catch (_) {}
    return null;
  }
  function ctaId(a) {
    if (a.dataset.cta) return clean(a.dataset.cta,'cta');
    if (a.closest('.sticky-cta')) return 'sticky';
    const area = a.closest('#result') || document.querySelector('main') || document.body;
    const links = Array.from(area.querySelectorAll('a')).filter(x=>affiliate(x));
    const kind = a.classList.contains('cta-sub') ? 'sub' : 'cta';
    return kind + Math.max(1,links.indexOf(a)+1);
  }
  function decorate(a) {
    const info = affiliate(a);
    if (!info) return;
    a.rel = Array.from(new Set((a.rel || '').split(/\s+/).filter(Boolean).concat(['sponsored','nofollow']))).join(' ');
    if (info.network !== 'a8' || disabled) return;
    // Preserve the issued a8mat bytes (including literal '+'); append only A8's documented id1-id5.
    let href = a.getAttribute('href');
    const values = [attribution.source, attribution.post, clean(page,'page'), ctaId(a), attribution.campaign];
    values.forEach((v,i)=>{
      const key = 'id'+(i+1);
      href = href.replace(new RegExp('([?&])'+key+'=[^&#]*','g'),'$1').replace(/[?&]$/,'').replace(/&&/g,'&');
      const hashAt = href.indexOf('#');
      const hash = hashAt < 0 ? '' : href.slice(hashAt);
      const base = hashAt < 0 ? href : href.slice(0,hashAt);
      href = base + (base.includes('?') ? '&' : '?') + key + '=' + clean(v,'none') + hash;
    });
    if (a.getAttribute('href') !== href) a.setAttribute('href',href);
  }
  function scan(){document.querySelectorAll('a').forEach(decorate);}
  scan();
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  let started = false;
  document.addEventListener('click',function(e){
    if (e.target.closest('#quiz .opt')) {
      if (!started) {event('quiz_start'); started = true;}
      event('quiz_step',{step_number:parseInt((document.querySelector('.q-step') || {}).textContent?.match(/\d+/)?.[0] || '0',10)});
    }
    if (e.target.closest('.restart')) started = false;
    const a = e.target.closest('a'); if (!a) return;
    const info = affiliate(a);
    if (info) {decorate(a);event('affiliate_click',{network:info.network,program_id:info.program,cta_id:ctaId(a),transport_type:'beacon'});}
    else if (a.origin === location.origin && /\.html$/.test(a.pathname)) event('internal_click',{destination_id:clean(a.pathname.split('/').pop().replace(/\.html$/,''),'page'),cta_id:clean(a.dataset.cta,'navigation')});
  },true);
  document.addEventListener('auxclick',function(e){if(e.button!==1)return;const a=e.target.closest('a');if(!a)return;const info=affiliate(a);if(info){decorate(a);event('affiliate_click',{network:info.network,program_id:info.program,cta_id:ctaId(a),transport_type:'beacon'});}},true);
  const result=document.getElementById('result');
  let completed=false;
  if(result)new MutationObserver(function(){
    const shown=result.classList.contains('show');
    if(shown&&!completed){event('quiz_complete');completed=true;scan();}
    if(!shown)completed=false;
  }).observe(result,{attributes:true,attributeFilter:['class']});
  document.querySelectorAll('[data-analytics-toggle]').forEach(function(button){
    button.textContent=disabled?'アクセス解析を有効にする':'アクセス解析を停止する';
    button.addEventListener('click',function(){
      try {localStorage.setItem(OPT,disabled?'0':'1');sessionStorage.removeItem(KEY);}catch(_){}
      window['ga-disable-'+MID]=true; location.reload();
    });
  });
})();
