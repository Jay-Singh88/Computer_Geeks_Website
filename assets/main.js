(function(){
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  var form = document.getElementById('enquiryForm');
  var status = document.getElementById('formStatus');
  if (form && status) {
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      status.style.color = 'var(--muted)';
      status.textContent = 'Sending…';
      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      }).then(function(res){
        if (res.ok) {
          form.reset();
          status.style.color = 'var(--green)';
          status.textContent = "Thanks — we've got it and will be in touch shortly.";
        } else {
          status.style.color = 'var(--amber)';
          status.textContent = 'Something went wrong sending that. Try WhatsApp or email instead.';
        }
      }).catch(function(){
        status.style.color = 'var(--amber)';
        status.textContent = 'Something went wrong sending that. Try WhatsApp or email instead.';
      }).finally(function(){
        btn.disabled = false;
      });
    });
  }

  var btn = document.getElementById('menuBtn'), nav = document.getElementById('nav');
  if (btn && nav) {
    btn.addEventListener('click', function(){
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
      btn.textContent = open ? 'Close' : 'Menu';
    });
    nav.addEventListener('click', function(e){
      if (e.target.tagName === 'A' && window.innerWidth <= 900) {
        nav.classList.remove('open'); btn.setAttribute('aria-expanded','false'); btn.textContent='Menu';
      }
    });
  }

  var clock = document.getElementById('clock');
  var feed = document.getElementById('feed');
  var count = document.getElementById('taskCount');
  if (!clock || !feed || !count) return;

  function tickClock(){
    var d = new Date();
    clock.textContent = String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');
  }
  tickClock(); setInterval(tickClock, 1000);

  var events = [
    ['Invoice reminder sent — Kauri Joinery, 14 days overdue','ok'],
    ['Nightly backup verified — 3 servers, 0 errors','ok'],
    ['Security patches applied — 12 endpoints','ok'],
    ['Website enquiry routed to on-call mobile','ok'],
    ['Supplier receipt filed to Xero — $412.80','ok'],
    ['Sign-in blocked — unrecognised location','warn'],
    ['Booking confirmed and added to job calendar','ok'],
    ['Stock reorder drafted — 4 lines below minimum','ok'],
    ['Timesheets compiled for payroll — 9 staff','ok'],
    ['Weekly summary emailed to the owner','ok'],
    ['Phishing email quarantined — 3 recipients','warn'],
    ['Quote followed up — no reply after 5 days','ok']
  ];

  var total = 4182;
  var i = 0;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function stamp(offset){
    var d = new Date(Date.now() - offset*1000);
    return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');
  }

  function row(ev, offset, animate){
    var li = document.createElement('li');
    if (animate) li.className = 'fade-in';
    li.innerHTML = '<span class="tick'+(ev[1]==='warn'?' warn':'')+'" aria-hidden="true">'+(ev[1]==='warn'?'!':'✓')+'</span>'+
                   '<span>'+ev[0]+'<span class="t">'+stamp(offset)+'</span></span>';
    return li;
  }

  for (var s=0; s<7; s++){
    feed.appendChild(row(events[s % events.length], (7-s)*47, false));
    i = (s+1) % events.length;
  }

  if (!reduced){
    setInterval(function(){
      feed.insertBefore(row(events[i], 0, true), feed.firstChild);
      while (feed.children.length > 8) feed.removeChild(feed.lastChild);
      i = (i+1) % events.length;
      total += Math.floor(Math.random()*3)+1;
      count.textContent = total.toLocaleString();
    }, 3200);
  }
})();
