(function(){
  // UTF-8 so Thai text scans correctly
  qrcode.stringToBytes = function(s){ return Array.from(new TextEncoder().encode(s)); };

  const $ = id => document.getElementById(id);
  let mode = 'link', payload = '', blobCache = null;



  // ---------- contrast check ----------
  function lum(hex){
    const c = [1,3,5].map(i => parseInt(hex.substr(i,2),16)/255).map(v => v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055,2.4));
    return .2126*c[0]+.7152*c[1]+.0722*c[2];
  }

  function show(msg, kind){ const m=$('msg'); m.textContent=msg||''; m.className='msg '+(kind||'warn'); m.hidden=!msg; }

  function render(){
    let r, cap = '';
    if (mode === 'link'){ const t = $('text').value.trim(); r = t ? {data:t} : {err:'พิมพ์ลิงก์หรือข้อความก่อน'}; }
    else if (mode === 'pp'){
      r = promptpay($('ppId').value, $('ppAmt').value);
      if (r.data){ cap = ($('ppName').value.trim() || 'พร้อมเพย์') + (r.amt ? ' · ' + r.amt.toLocaleString('th-TH',{minimumFractionDigits:2}) + ' บาท' : ''); }
    } else { r = wifi(); if (r.data) cap = 'Wi‑Fi: ' + $('ssid').value; }

    $('caption').textContent = cap;
    if (r.err){ show(r.err); return; }

    const fg = $('fg').value, bg = $('bg').value;
    const L1 = lum(fg), L2 = lum(bg);
    let warn = '';
    if (L1 > L2) warn = 'สีโค้ดสว่างกว่าสีพื้น กล้องหลายรุ่นจะสแกนไม่ติด ควรใช้โค้ดสีเข้มบนพื้นสีอ่อน';
    else if ((L2+.05)/(L1+.05) < 4) warn = 'สีโค้ดกับสีพื้นใกล้กันเกินไป อาจสแกนไม่ติด';

    let qr;
    try { qr = qrcode(0, $('ecl').value); qr.addData(r.data, 'Byte'); qr.make(); }
    catch(e){ show('ข้อมูลยาวเกินกว่าจะใส่ในคิวอาร์ได้ ลองตัดให้สั้นลงหรือลดความทนทานลง'); return; }

    const n = qr.getModuleCount(), quiet = 4, total = n + quiet*2;
    const scale = Math.max(8, Math.ceil(1024 / total));
    const cv = document.createElement('canvas');
    cv.width = cv.height = total * scale;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0,0,cv.width,cv.height);
    ctx.fillStyle = fg;
    for (let y=0;y<n;y++) for (let x=0;x<n;x++) if (qr.isDark(y,x)) ctx.fillRect((x+quiet)*scale,(y+quiet)*scale,scale,scale);
    $('qrImg').src = cv.toDataURL('image/png');
    $('qrImg').alt = 'คิวอาร์โค้ด: ' + (cap || r.data);
    blobCache = null;
    cv.toBlob(b => blobCache = b, 'image/png');
    payload = r.data;
    $('payload').textContent = r.data;
    show(warn);
  }

  // ---------- tabs ----------
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    mode = t.dataset.mode;
    document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected', x === t));
    document.querySelectorAll('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== mode);
    try { localStorage.setItem('qr-mode', mode); } catch(e){}
    render();
  }));
  document.querySelectorAll('input,textarea,select').forEach(el => el.addEventListener('input', render));

  // ---------- copy ----------
  $('copyImg').addEventListener('click', () => {
    if (!blobCache || !window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write){
      show('เบราว์เซอร์นี้คัดลอกรูปไม่ได้ ให้กดค้างหรือคลิกขวาที่รูปแล้วเลือกบันทึกรูปแทน'); return;
    }
    navigator.clipboard.write([new ClipboardItem({'image/png': blobCache})])
      .then(() => show('คัดลอกรูปแล้ว วางในแชตหรือเอกสารได้เลย','ok'))
      .catch(() => show('คัดลอกรูปไม่ได้ในหน้านี้ ให้กดค้างหรือคลิกขวาที่รูปแล้วเลือกบันทึกรูปแทน'));
  });
  $('copyText').addEventListener('click', () => {
    const done = () => show('คัดลอกข้อมูลแล้ว','ok');
    const fallback = () => { const r = document.createRange(); r.selectNodeContents($('payload')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); show('เลือกข้อความไว้ให้แล้ว กดคัดลอกได้เลย','ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(payload).then(done, fallback); else fallback();
  });

  let saved = null; try { saved = localStorage.getItem('qr-mode'); } catch(e){}
  const start = saved && document.querySelector('.tab[data-mode="'+saved+'"]');
  if (start) start.click(); else render();
})();
