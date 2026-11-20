# یلدائنار (Yalda Anar)

> بازی drop-and-merge با تم شب یلدا و فیزیک دایره‌ای سفارشی — PWA با Vanilla JS، بدون Matter.js/Box2D.

[![Version](https://img.shields.io/badge/version-v0.0.3-blue)](https://github.com/andrbi107/yalda-anar/releases/tag/v0.0.3) [![PWA](https://img.shields.io/badge/PWA-installable-purple)](https://andrbi107.github.io/yalda-anar/) [![No deps](https://img.shields.io/badge/dependencies-none-success)](https://github.com/andrbi107/yalda-anar) [![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

🎮 **[بازی کن](https://andrbi107.github.io/yalda-anar/)** — نسخه‌ی آنلاین روی GitHub Pages
📦 **[مخزن گیت‌هاب](https://github.com/andrbi107/yalda-anar)** · 🏷️ **[Release v0.0.3](https://github.com/andrbi107/yalda-anar/releases/tag/v0.0.3)**

---

## تغییرات v0.0.2 (جدید)

**یلدائنار** — combo multiplier: mergeهای پشت‌سرهم در ۲.۵s یک ضریب ×۱ → ×۳ می‌سازند. haptic روی merge/game-over.

**همه‌ی بازی‌ها** — `mobile-ux.js` مشترک (haptics/install prompt/version stamp) + cache sw.js به v2.

---

## تغییرات v0.0.3 (جدید)

**یلدائنار** — باگ چیدمان منو اصلاح شد (سه پنل روی هم می‌افتادند) + میوه‌ها/آجیل‌ها (پسته/بادام/گردو/انجیر) redesign شدند تا شبیه میوه باشند.

---

## معرفی

یلدائنار بازتصور فارسی و festal از ژانر Suika (drop میوه) است. تخته یک کاسه‌ی چوبی زیر آسمان شب یلدا بنفش با ستاره‌های طلایی و هلال کم‌رنگ است. بازیکن میوه‌های فارسی را از یک dropper که بالای کاسه حرکت می‌کند رها می‌کند؛ وقتی دو میوه هم‌اندازه تماس می‌کنند، در میوه‌ی بزرگ‌تر بعدی merge می‌شوند و امتیاز می‌گیرد. زنجیره‌ی هفت‌مرحله‌ای از پسته تا انار می‌رود، و انار اوج نمادین یلدا است — رسیدن به آن یک pop جشن «انار!» می‌سازد، ولی بازی ادامه می‌یابد.

هویت بصری کاملاً با primitives کانواس ساخته شده — gradient شعاعی، صلیب‌های طلایی چهارپر برای ستاره‌ها، قوس‌های قهوه‌ای برای کاسه، و جزئیات per-میوه (شکاف پسته، بیضی نوک‌تیز بادام، درز گردو، بدنه‌ی مستطیل‌گرد خرما، خطوط segment و برگ نارنگی، و تاج مثلث‌های طلایی + نقطه‌های seed انار). فیزیک **از صفر در `main.js` پیاده‌سازی شده** — بدون Matter.js، بدون Box2D، بدون CDN.

## ویژگی‌ها

- **زنجیره‌ی ۷ میوه** — پسته → بادام → گردو → انجیر → خرما → نارنگی → انار (رنگ و radius اختصاصی هر یک).
- **فیزیک سفارشی دایره-دایره** — gravity، damping، wall resolution با restitution، impulse نرمال + اصطکاک tangent، ۲ sub-step.
- **merge هم‌اندازه** — دو میوه هم‌اندازه → میوه‌ی size+1 در نقطه‌ی میانی با pop + ذرات + امتیاز.
- **danger line** — خط چین طلایی نزدیک لبه؛ میوه‌ی ساکن بالای آن بیش از ۱.۵s = گیم‌اور.
- **جشن انار** — اولین ساخت انار = بنر محو «انار!» + ذرات طلایی.
- **رکورد در `localStorage['yaldaAnar.best']`**.
- **دشواری ملایم** — cooldown drop با امتیاز کوتاه می‌شود (۶۲۰ms → ۳۶۰ms).
- **رابط RTL فارسی** (`lang="fa" dir="rtl"`).
- **کنترل کامل تاچ + کیبورد + موس** (Pointer Events یکسان).
- **PWA آفلاین**.

## نحوه‌ی بازی

| دستگاه | حرکت dropper | رها کردن | توقف |
|---|---|---|---|
| **تاچ** | drag افقی روی تخته | tap کوتاه (حرکت کوچک، مدت کوتاه) | دکمه‌ی Pause |
| **کیبورد** | ←/→ | Space/Enter/↓ | Esc یا P |
| **موس** | حرکت موس | کلیک | دکمه‌ی Pause |

### مکانیک بازی

- **زنجیره‌ی میوه**: پسته (r≈۱۳) → بادام (r≈۱۸) → گردو (r≈۲۴) → انجیر (r≈۳۱) → خرما (r≈۳۹) → نارنگی (r≈۴۸) → انار (r≈۵۸). mass ∝ radius.
- **اسپاون**: dropper فقط sizeهای ۰–۴ (پسته…خرما) با وزن به‌سمت کوچک‌ترها؛ preview «بعدی» نشان داده می‌شود.
- **فیزیک**: هر frame `vy += GRAVITY*dt`، damping، integrate، سپس wall resolution با restitution و floor friction. circle-circle با `ITER` تکرار در هر sub-step.
- **merge**: هر زوج هم‌اندازه با `r1+r2+1` px فاصله → merge با velocity pop کوچک و امتیاز `(newSize+1)*10`.
- **danger line**: در `BOWL.top`؛ میوه‌ی ساکن (`|vy|<2.2`) بالای خط → `overTimer`؛ ۱۵۰۰ms پیوسته = گیم‌اور (grace برای میوه‌های در حال پرواز).
- **رکورد**: `localStorage['yaldaAnar.best']`.
- **دشواری**: `cooldown = max(MIN, BASE - score/8)`.

## نصب روی موبایل/دسکتاپ (PWA)

1. لینک بازی را در **Chrome** یا **Edge** باز کنید (اندروید/دسکتاپ) یا **Safari** (iOS).
2. منوی مرورگر → **Install app** / **Add to Home screen** (اندروید) یا **Share → Add to Home Screen** (iOS).
3. آیکن روی صفحه‌ی اصلی ظاهر می‌شود؛ اجرای آن تمام‌صفحه و مستقل از مرورگر است.
4. پس از اولین بارگذاری، بازی **بدون اینترنت** هم کار می‌کند (service worker کل shell را cache کرده است).

## تکنولوژی

- **HTML5 `<canvas>`** — تمام رندر با primitives (`arc`, `fillRect`, `translate`, `rotate`, `shadowBlur`).
- **Vanilla JavaScript** — بدون هیچ کتابخانه، framework یا CDN.
- **CSS** با `clamp()` برای تایپوگرافی responsive، `safe-area-inset` برای notch موبایل، و `100dvh`.
- **PWA**: `manifest.json` + `sw.js` (service worker که کل shell را precache می‌کند) → بازی پس از اولین بارگذاری **کاملاً آفلاین** و **قابل نصب** روی اندروید/iOS/دسکتاپ است.
- بدون تصویر، فونت یا فایل صوتی خارجی — همه‌چیز با کد تولید می‌شود.

## ساختار پروژه

| فایل | نقش |
|---|---|
| `index.html` | Persian RTL، canvas، HUD، overlayها |
| `styles.css` | responsive (flex column، 100dvh، safe-area، max-width 480)، تم بنفش |
| `main.js` | کل بازی: setup، drawing، فیزیک سفارشی، input (Pointer + کیبورد)، screenها، loop |
| `manifest.json` | PWA، `orientation:portrait`، icon `any maskable` |
| `sw.js` | precache + cache-first |
| `icon.svg` | انار red با تاج طلایی روی پس‌زمینه‌ی بنفش |

## شخصی‌سازی

تمام tunableها بالای `main.js`:

- `GRAVITY`, `WALL_E`, `FRUIT_E`, `DAMP`, `FLOOR_FRICTION`, `ITER`, `POS_CORR` — حس فیزیک.
- `DROP_COOLDOWN_BASE`, `DROP_COOLDOWN_MIN` — pacing/difficulty.
- `DANGER_GRACE`, `DANGER_LIMIT` — forgiving بودن قانون overflow.
- آرایه `FRUITS` — `name`، radius `r`، پالت هر میوه (`fill`/`dark`/`hi`).
- `BOWL` (`left`/`right`/`floor`/`top`/`rimY`) و `DROPPER_Y` — هندسه‌ی میدان.
- `SPAWN_MAX` و آرایه `weights` در `randSize()` — اندازه‌های emitted.
- در `styles.css` رنگ‌های gradient/palette آسمان و چوب کاسه.

## توسعه و اجرای محلی

```bash
git clone https://github.com/andrbi107/yalda-anar.git
cd yalda-anar
# سرویس‌ورکر فقط روی http(s) ثبت می‌شود، پس یک سرور محلی راه بیندازید:
python3 -m http.server 8080
# سپس http://localhost:8080/ را در مرورگر باز کنید
```

برای آزمایش روی موبایل، می‌توانید پوشه را روی گوشی با یک سرور استاتیک سرو کنید یا از `ngrok`/مرورگر موبایل روی همان شبکه استفاده کنید.

## استقرار

محتوای شاخه‌ی `main` به‌صورت خودکار از طریق **GitHub Pages** سرو می‌شود:

**https://andrbi107.github.io/yalda-anar/**

هیچ build stepی لازم نیست — همه‌ی مسیرها relative هستند (`./`)، پس بازی هم از root مخزن و هم از زیرپوشه کار می‌کند.

## نسخه‌گذاری (SemVer)

این پروژه از [Semantic Versioning](https://semver.org/lang/fa/) پیروی می‌کند:

- نسخه‌ها از **`0.0.1`** آغاز می‌شوند (مرحله‌ی پیش از پایداری نهایی؛ هر تغییر می‌تواند breaking باشد).
- قالب: `MAJOR.MINOR.PATCH` → در فاز 0.x: `0.MINOR.PATCH`.
- **هر توسعه یا شخصی‌سازی** در یک شاخه‌ی جداگانه انجام می‌شود:
  - `feat/<name>` برای قابلیت جدید یا شخصی‌سازی
  - `fix/<name>` برای رفع باگ
  - `docs/<name>` برای مستندسازی
  - `refactor/<name>` برای بازسازمان‌دهی کد
- پس از merge به `main`، تگ SemVer بعدی زده می‌شود و یک **GitHub Release** منتشر می‌گردد.
- RELEASE NOTES هر بار در صفحه‌ی Releases مخزن ثبت می‌شود.

### نقشه‌ی نسخه‌بندی پیشنهادی برای توسعه‌های بعدی

| نوع تغییر | bump | مثال |
|---|---|---|
| رفع باگ کوچک، tweak رنگ/عدد | PATCH | `0.0.1` → `0.0.2` |
| قابلیت جدید، مکانیک جدید، level جدید | MINOR | `0.0.1` → `0.1.0` |
| بازنویسی API/ساختار، تغییر breaking | MAJOR (هنوز در 0.x) | `0.1.0` → `0.2.0` |
| رسیدن به پایداری نهایی | — | `0.x.0` → `1.0.0` |

## لایسنس

MIT — استفاده، تغییر و بازنشر آزاد. ساختهشده بهعنوان یک مهارت/قالب آموزشی برای بازی‌سازی PWA با Vanilla JS.
