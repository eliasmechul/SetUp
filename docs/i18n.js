// Turkish interface for Set UP. Translates visible text after each render; user content (posts, names) is never touched.
(() => {
  const TR = {
    // navigation & footer
    'Home': 'Ana sayfa', 'Map': 'Harita', 'Network': 'Ağ', 'Castings': 'Seçmeler', 'Groups': 'Gruplar', 'Meetups': 'Buluşmalar',
    'Messages': 'Mesajlar', 'Alerts': 'Bildirimler', 'Me': 'Ben', 'Log in': 'Giriş yap', 'Sign in': 'Giriş yap', 'Join now': 'Hemen katıl',
    'Privacy': 'Gizlilik', 'Terms': 'Şartlar', 'Impressum': 'Künye', 'English': 'English', 'Türkçe': 'Türkçe',
    'Search people, roles, skills': 'Kişi, rol, beceri ara',
    // landing
    'REC · THE NETWORK FOR FILM PEOPLE': 'REC · FİLM İNSANLARININ AĞI', 'Write your': 'Bir sonraki', 'next scene.': 'sahneni yaz.',
    '…then find the crew to shoot it.': '…sonra onu çekecek ekibi bul.',
    'Share your work, find jobs and castings, join communities and find your crew on the map. One profile for the whole production.':
      'İşini paylaş, iş ve seçme ilanları bul, topluluklara katıl, ekibini haritada bul. Tüm prodüksiyon için tek profil.',
    "Join Set UP. It's free.": 'Set UP’a katıl. Ücretsiz.', 'Full name': 'Ad soyad', 'Email': 'E-posta', 'Password (8+ characters)': 'Şifre (en az 8 karakter)',
    'I am a…': 'Mesleğim…', 'City': 'Şehir', 'Join Set UP': 'Set UP’a katıl', 'Already a member?': 'Zaten üye misin?',
    'Actors': 'Oyuncular', 'Directors': 'Yönetmenler', 'Producers': 'Yapımcılar', 'Cinematographers': 'Görüntü yönetmenleri', 'Editors': 'Kurgucular', 'Sound': 'Ses', 'Writers': 'Yazarlar',
    'The three things people do here': 'Burada insanların yaptığı üç şey', 'Share. Get hired. ': 'Paylaş. İş bul. ', 'Belong.': 'Ait ol.',
    'Share your work': 'İşini paylaş', 'Find jobs and castings': 'İş ve seçme ilanları bul', 'Join communities': 'Topluluklara katıl',
    'Post stills, reels and behind-the-scenes. Like, comment and share, like the networks you already know.': 'Fotoğraf, showreel ve kamera arkası paylaş. Beğen, yorum yap, paylaş.',
    'Post a role or apply with your profile. Every applicant in one list, ready to shortlist.': 'Rol ilanı ver ya da profilinle başvur. Tüm başvurular tek listede.',
    'Groups for your craft and your city. Ask, answer and find your next collaborator.': 'Mesleğin ve şehrin için gruplar. Sor, cevapla, yeni iş ortağını bul.',
    'Find your crew ': 'Ekibini bul ', 'on the map.': 'haritada.', 'Find your crew on the map': 'Ekibini haritada bul',
    'Producers and casting directors zoom to the city where they shoot, filter by role and availability, and connect in one click.': 'Yapımcılar ve cast direktörleri çekim şehrine yakınlaşır, rol ve müsaitliğe göre süzer, tek tıkla bağlanır.',
    'Open the talent map': 'Yetenek haritasını aç', 'Open ': 'Açık ', 'roles': 'roller', 'All castings →': 'Tüm ilanlar →',
    'Everyone who ': 'Film yapan ', 'makes a film': 'herkes', 'Roll ': 'Kamera ', 'camera.': 'başla.', 'your next set starts with a profile': 'bir sonraki setin bir profille başlar',
    'Free to join. Your next set starts with a profile.': 'Katılım ücretsiz. Bir sonraki setin bir profille başlar.',
    // feed
    'Start a post': 'Paylaşım yap', 'Photo': 'Fotoğraf', 'Casting call': 'Seçme ilanı', 'Meetup': 'Buluşma', 'Community': 'Topluluk',
    'Everyone': 'Herkes', 'My network': 'Ağım', 'No posts yet. Be the first!': 'Henüz paylaşım yok. İlk sen ol!',
    'All': 'Hepsi', 'Showcase': 'Vitrin', 'Questions': 'Sorular', 'Tips': 'İpuçları', 'Jobs and calls': 'İş ve çağrılar', 'Collabs': 'İşbirlikleri', 'Events': 'Etkinlikler', 'Film news': 'Film haberleri', 'Updates': 'Güncellemeler',
    'Question': 'Soru', 'Tip': 'İpucu', 'Job': 'İş', 'Collab': 'İşbirliği', 'Event': 'Etkinlik', 'News': 'Haber', 'Update': 'Güncelleme',
    'What are you sharing?': 'Ne paylaşıyorsun?', 'Publish': 'Yayınla', 'Add photo': 'Fotoğraf ekle', 'Repost': 'Yeniden paylaş', 'Report': 'Şikayet et', 'Delete': 'Sil',
    'Casting near you': 'Yakınındaki seçmeler', 'People you may know': 'Tanıyor olabileceğin kişiler', 'Communities': 'Topluluklar', 'Upcoming meetups': 'Yaklaşan buluşmalar',
    'All communities →': 'Tüm topluluklar →', 'All meetups →': 'Tüm buluşmalar →', 'Join': 'Katıl', 'Connect': 'Bağlan', 'Message': 'Mesaj', 'Follow': 'Takip et', 'Following': 'Takip ediliyor',
    'Edit profile': 'Profili düzenle', 'Talent map': 'Yetenek haritası', 'My applications': 'Başvurularım', 'Meetups ': 'Buluşmalar ',
    'Examples.': 'Örnekler.', 'Example': 'Örnek', 'These show how Set UP looks. Real members, jobs and posts replace them as people join.': 'Bunlar Set UP’ın nasıl göründüğünü gösterir. İnsanlar katıldıkça gerçek üyeler, ilanlar ve paylaşımlar bunların yerini alır.',
    // map
    'Find talent on the map': 'Haritada yetenek bul', 'Join to connect': 'Bağlanmak için katıl', 'Post a casting call': 'Seçme ilanı ver', 'Name, craft, skill or city': 'İsim, meslek, beceri veya şehir',
    'All roles': 'Tüm roller', 'Available now': 'Hemen müsait', 'Search': 'Ara', 'Show': 'Göster', 'Open to work': 'İş arıyor', 'Available': 'Müsait',
    // profile
    'About': 'Hakkında', 'Showreel': 'Showreel', 'Watch showreel ↗': 'Showreel’i izle ↗', 'Experience': 'Deneyim', 'Skills': 'Beceriler', 'Posts': 'Paylaşımlar', 'Location': 'Konum',
    'See the talent map →': 'Yetenek haritasına git →', 'Open castings': 'Açık ilanlar', '+ Add credits': '+ Yapım ekle', 'Log out': 'Çıkış yap', 'Remove': 'Kaldır',
    'No posts yet.': 'Henüz paylaşım yok.', 'No credits added yet.': 'Henüz yapım eklenmedi.', 'Add your credits so producers can see your experience.': 'Yapımcılar deneyimini görsün diye yapımlarını ekle.',
    'Name': 'Ad', 'Role': 'Rol', 'City (shown on the map)': 'Şehir (haritada görünür)', 'Headline': 'Başlık', 'Skills (comma separated)': 'Beceriler (virgülle ayır)', 'Showreel link (https://…)': 'Showreel bağlantısı (https://…)',
    'Available from': 'Şu tarihten itibaren müsait', 'Save profile': 'Profili kaydet', 'Change photo': 'Fotoğrafı değiştir', 'Add a credit': 'Yapım ekle', 'Add credit': 'Yapım ekle',
    'Project title': 'Proje adı', 'Your role': 'Rolün', 'Type': 'Tür', 'Year': 'Yıl', 'Description (optional)': 'Açıklama (isteğe bağlı)',
    // castings
    'Search roles, crew, productions': 'Rol, ekip, prodüksiyon ara', 'No castings match. Try another filter.': 'Eşleşen ilan yok. Başka bir filtre dene.', '+ Post a casting call': '+ Seçme ilanı ver',
    'Apply': 'Başvur', 'Send application': 'Başvuruyu gönder', 'Applied': 'Başvuruldu', 'Message (optional)': 'Mesaj (isteğe bağlı)', 'Log in to apply': 'Başvurmak için giriş yap',
    'Acting': 'Oyunculuk', 'Crew': 'Ekip', 'Voice': 'Seslendirme', 'Extras': 'Figüran', 'Other': 'Diğer',
    // communities & meetups
    'Discover': 'Keşfet', 'My communities': 'Topluluklarım', '+ Start a community': '+ Topluluk kur', 'Joined ✓': 'Katıldın ✓', 'Join community': 'Topluluğa katıl', 'Post in community': 'Toplulukta paylaş', 'Discussion': 'Tartışma',
    'Delete community': 'Topluluğu sil', 'Upcoming': 'Yaklaşan', 'Going / Hosting': 'Katılıyorum / Düzenliyorum', '+ Host a meetup': '+ Buluşma düzenle', 'Going ✓': 'Katılıyorum ✓', 'No meetups yet. Host the first one!': 'Henüz buluşma yok. İlkini sen düzenle!',
    // messages, alerts, auth
    'No conversations yet.': 'Henüz konuşma yok.', 'Start a chat': 'Sohbet başlat', 'Send': 'Gönder', 'Write a message…': 'Mesaj yaz…', 'Connection requests': 'Bağlantı istekleri', 'Activity': 'Etkinlik', 'Accept': 'Kabul et', 'Ignore': 'Yoksay',
    'Nothing yet. Post something or apply to a casting.': 'Henüz bir şey yok. Bir şey paylaş ya da bir ilana başvur.', 'Welcome back': 'Tekrar hoş geldin', 'Password': 'Şifre', 'Forgot password?': 'Şifreni mi unuttun?', 'New here?': 'Yeni misin?',
    'Create your free profile': 'Ücretsiz profilini oluştur', 'Create account': 'Hesap oluştur', 'Reset your password': 'Şifreni sıfırla', 'Send reset link': 'Sıfırlama bağlantısı gönder', 'Back to log in': 'Girişe dön',
    'Choose a new password': 'Yeni şifre seç', 'New password (8+ characters)': 'Yeni şifre (en az 8 karakter)', 'Save password': 'Şifreyi kaydet',
    // create modal & report
    'Create': 'Oluştur', 'Casting': 'Seçme', 'Role or position': 'Rol veya pozisyon', 'Category': 'Kategori', 'Pay': 'Ücret', 'Production': 'Prodüksiyon', 'Deadline': 'Son tarih', 'Description': 'Açıklama',
    'Publish casting': 'İlanı yayınla', 'Create meetup': 'Buluşma oluştur', 'Create community': 'Topluluk oluştur', 'Title': 'Başlık', 'Date & time': 'Tarih ve saat', 'Venue': 'Mekan', 'Community name': 'Topluluk adı', 'Topic': 'Konu',
    'What is it about?': 'Ne hakkında?', 'Why are you reporting this?': 'Neden şikayet ediyorsun?', 'Spam or scam': 'Spam veya dolandırıcılık', 'Harassment or hate': 'Taciz veya nefret', 'Misleading or fake': 'Yanıltıcı veya sahte',
    'Inappropriate content': 'Uygunsuz içerik', 'Something else': 'Başka bir şey', 'Details (optional)': 'Ayrıntılar (isteğe bağlı)', 'Send report': 'Şikayeti gönder', 'Add your thoughts (optional)': 'Düşüncelerini ekle (isteğe bağlı)',
    'Say something about this post…': 'Bu paylaşım hakkında bir şey söyle…', 'Share a still, an update or a casting call…': 'Bir kare, güncelleme veya ilan paylaş…',
    'Privacy policy': 'Gizlilik politikası', 'Terms of use': 'Kullanım şartları', 'Draft.': 'Taslak.', 'Page not found': 'Sayfa bulunamadı', 'Back to feed': 'Akışa dön', 'Not found': 'Bulunamadı',
    'Say hello': 'Merhaba de', 'No people in this area. Zoom out or move the map.': 'Bu bölgede kimse yok. Uzaklaştır ya da haritayı kaydır.',
    'No one matches yet.': 'Henüz eşleşen yok.', 'Any role': 'Herhangi bir rol', 'Any city': 'Herhangi bir şehir', 'No applications yet.': 'Henüz başvuru yok.'
  };
  const RX = [
    [/^just now$/, 'şimdi'], [/^(\d+)m ago$/, '$1 dk önce'], [/^(\d+)h ago$/, '$1 sa önce'], [/^(\d+)d ago$/, '$1 gün önce'],
    [/^(\d+) members?$/, '$1 üye'], [/^(\d+) going$/, '$1 katılıyor'], [/^(\d+) applied$/, '$1 başvuru'], [/^(\d+) days? left$/, '$1 gün kaldı'],
    [/^(\d+) connections?$/, '$1 bağlantı'], [/^(\d+) followers?$/, '$1 takipçi'], [/^(\d+) FOUND$/, '$1 SONUÇ'], [/^(\d+) of (\d+) people in this area$/, 'Bu bölgede $2 kişiden $1’i'],
    [/^Posted (.+) by (.+)$/, (m, a, b) => b + ' tarafından ' + tr(a) + ' paylaşıldı'], [/^in (.+)$/, '$1 içinde'], [/^(\d+) applicants?$/, '$1 başvuran']
  ];
  const ATTRS = ['placeholder', 'aria-label', 'title'];
  const SKIP = 'script,style,textarea,.post-body,.bubble,.msg,.legal,.quote,svg';
  let lang = 'en';
  try { lang = localStorage.getItem('lang') || ((navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en'); } catch (e) { /* ignore */ }

  const tr = (str) => {
    const m = str.match(/^(\s*)([\s\S]*?)(\s*)$/); const core = m[2];
    if (!core) return str;
    if (Object.prototype.hasOwnProperty.call(TR, core)) return m[1] + TR[core] + m[3];
    for (const [re, rep] of RX) if (re.test(core)) return m[1] + core.replace(re, rep) + m[3];
    return str;
  };
  const orig = new WeakMap();
  let busy = false;

  function walk(root) {
    if (!root || root.nodeType === 8) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n = root;
    do {
      if (n.nodeType === 3) {
        const p = n.parentElement;
        if (p && !p.closest(SKIP)) {
          if (!orig.has(n)) orig.set(n, n.nodeValue);
          const base = orig.get(n);
          const out = lang === 'tr' ? tr(base) : base;
          if (n.nodeValue !== out) n.nodeValue = out;
        }
      } else if (n.nodeType === 1) {
        for (const a of ATTRS) if (n.hasAttribute && n.hasAttribute(a)) {
          const key = 'data-en-' + a;
          if (!n.hasAttribute(key)) n.setAttribute(key, n.getAttribute(a));
          const base = n.getAttribute(key); const out = lang === 'tr' ? tr(base) : base;
          if (n.getAttribute(a) !== out) n.setAttribute(a, out);
        }
      }
    } while ((n = w.nextNode()));
  }
  function apply(root) { busy = true; try { walk(root || document.body); document.documentElement.lang = lang; } finally { busy = false; } }

  const obs = new MutationObserver((muts) => {
    if (busy) return;
    busy = true;
    try {
      for (const m of muts) m.addedNodes.forEach((nd) => { if (nd.nodeType === 1 || nd.nodeType === 3) walk(nd.nodeType === 3 ? nd.parentNode : nd); });
    } finally { busy = false; }
  });

  window.I18N = {
    get lang() { return lang; },
    set(l) { lang = l === 'tr' ? 'tr' : 'en'; try { localStorage.setItem('lang', lang); } catch (e) { /* ignore */ } apply(document.body); document.querySelectorAll('[data-act=lang]').forEach((b) => { b.textContent = lang === 'tr' ? 'English' : 'Türkçe'; }); },
    toggle() { this.set(lang === 'tr' ? 'en' : 'tr'); },
  };
  const start = () => { obs.observe(document.body, { childList: true, subtree: true }); apply(document.body); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
