# Quran Circles: all Urdu text for proofreading

1614 lines. Claude drafted every Urdu line, and each needs a native reader's check before release.

**How to correct:** write your fix in the empty **Fix** column of that row (or change the Urdu in place).
Leave a line alone if it is fine. Keep anything in curly brackets exactly as it is, such as `{name}` or `{when}`;
the app fills these in. You can move them within the sentence, but don't translate or remove them.
The **Key** column tells Claude where each line lives in the code, so please don't change it.

Rows marked 🛠 belong to user app screens still being built, so their wording may change a little.
Surah names (shown in Arabic as in the mushaf) and the Maududi translation are not in this file.

## Contents

- [User app](#user-app) (557)
- [Credits and licences screen](#credits-and-licences-screen) (22)
- [Error messages (all apps)](#error-messages-all-apps) (24)
- [Men, women, family labels (all apps)](#men-women-family-labels-all-apps) (3)
- [Programme names (all apps)](#programme-names-all-apps) (4)
- [Shared buttons and labels (all apps)](#shared-buttons-and-labels-all-apps) (22)
- [Venue facilities (all apps)](#venue-facilities-all-apps) (8)
- [Weekday names (all apps)](#weekday-names-all-apps) (7)
- [Phone notifications](#phone-notifications) (8)
- [WhatsApp, SMS and push messages](#whatsapp-sms-and-push-messages) (9)
- [Posters and share cards](#posters-and-share-cards) (12)
- [Admin app (coordinators)](#admin-app-coordinators) (442)
- [Console (staff website)](#console-staff-website) (496)

## User app

### App name

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1 | Name |  | Quran Circles | قرآن سرکلز |  | `app.name` |
| 2 | Saved copy |  | Showing what we saved earlier. | جو پہلے محفوظ کیا تھا وہ دکھایا جا رہا ہے۔ |  | `app.savedCopy` |

### Bottom tabs

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 3 | Home |  | Home | ہوم |  | `tabs.home` |
| 4 | Nearby |  | Nearby | قریب |  | `tabs.nearby` |
| 5 | My journey |  | My Journey | میرا سفر |  | `tabs.myJourney` |
| 6 | Quran prayer |  | Quran & Prayer | قرآن و نماز |  | `tabs.quranPrayer` |

### Profile

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 7 | Title | heading | Profile | پروفائل |  | `profile.title` |
| 8 | Language › En |  | English | English |  | `profile.language.en` |
| 9 | Language › Ur |  | Urdu | اردو |  | `profile.language.ur` |
| 10 | Language › Title | heading | Language | زبان |  | `profile.language.title` |
| 11 | Text size › Title | heading | Text size | متن کا سائز |  | `profile.textSize.title` |
| 12 | Text size › Sample |  | This is how your text will look. | آپ کا متن اس طرح نظر آئے گا۔ |  | `profile.textSize.sample` |
| 13 | Text size › Step0 |  | Standard | عام |  | `profile.textSize.step0` |
| 14 | Text size › Step1 |  | Large | بڑا |  | `profile.textSize.step1` |
| 15 | Text size › Step2 |  | Larger | زیادہ بڑا |  | `profile.textSize.step2` |
| 16 | Text size › Step3 |  | Largest | سب سے بڑا |  | `profile.textSize.step3` |
| 17 | Appearance › Title | heading | Appearance | ظاہری شکل |  | `profile.appearance.title` |
| 18 | Dark mode |  | Dark mode | ڈارک موڈ |  | `profile.darkMode` |
| 19 | High contrast |  | High contrast | زیادہ فرق والے رنگ |  | `profile.highContrast` |
| 20 | Alerts › Title | heading | Alerts | اطلاعات |  | `profile.alerts.title` |
| 21 | Alerts › Venue |  | Alerts for {venue} | {venue} کی اطلاعات |  | `profile.alerts.venue` |
| 22 | Alerts › Empty |  | Follow a venue to set its alerts. | اطلاعات لگانے کے لیے کسی مقام کو فالو کریں۔ |  | `profile.alerts.empty` |
| 23 | Whatsapp |  | WhatsApp reminders | واٹس ایپ یاد دہانی |  | `profile.whatsapp` |
| 24 | Details › Title | heading | About you | آپ کے بارے میں |  | `profile.details.title` |
| 25 | Details › Help |  | These are optional. They help coordinators plan. | یہ اختیاری ہیں۔ ان سے کوآرڈینیٹرز کو منصوبہ بندی میں مدد ملتی ہے۔ |  | `profile.details.help` |
| 26 | Name › Label | label read by screen readers or shown on a control | Name | نام |  | `profile.name.label` |
| 27 | Phone › Label | label read by screen readers or shown on a control | WhatsApp number | واٹس ایپ نمبر |  | `profile.phone.label` |
| 28 | Age band › Label | label read by screen readers or shown on a control | Age | عمر |  | `profile.ageBand.label` |
| 29 | Profession › Label | label read by screen readers or shown on a control | Profession | پیشہ |  | `profile.profession.label` |
| 30 | Education › Label | label read by screen readers or shown on a control | Education | تعلیم |  | `profile.education.label` |
| 31 | Prior reading › Label | label read by screen readers or shown on a control | Quran reading so far | اب تک قرآن کی تلاوت |  | `profile.priorReading.label` |
| 32 | Save | button | Save | محفوظ کریں |  | `profile.save` |
| 33 | Saved |  | Saved. | محفوظ ہو گیا۔ |  | `profile.saved` |
| 34 | Account › Title | heading | Account | اکاؤنٹ |  | `profile.account.title` |
| 35 | Account › Sign out |  | Sign out | سائن آؤٹ |  | `profile.account.signOut` |
| 36 | Account › Delete | button | Delete my account | میرا اکاؤنٹ حذف کریں |  | `profile.account.delete` |
| 37 | Account › Delete › Title | heading | Delete your account? | کیا اکاؤنٹ حذف کریں؟ |  | `profile.account.delete.title` |
| 38 | Account › Delete › Body | explanation text | This removes your registrations and personal details. It cannot be undone. | اس سے آپ کی رجسٹریشنز اور ذاتی معلومات مٹ جائیں گی۔ اسے واپس نہیں کیا جا سکتا۔ |  | `profile.account.delete.body` |
| 39 | Account › Delete › Confirm | button | Delete my account | میرا اکاؤنٹ حذف کریں |  | `profile.account.delete.confirm` |
| 40 | Account › Delete › Keep |  | Keep my account | میرا اکاؤنٹ رہنے دیں |  | `profile.account.delete.keep` |
| 41 | Support |  | Help and support | مدد اور سپورٹ |  | `profile.support` |
| 42 | About |  | About Quran Circles | قرآن سرکلز کے بارے میں |  | `profile.about` |
| 43 | Open | button | Open profile | پروفائل کھولیں |  | `profile.open` |
| 44 | Guest name |  | Guest | مہمان |  | `profile.guestName` |
| 45 | Account › Signed out |  | You are not signed in. You can browse without an account. | آپ سائن اِن نہیں ہیں۔ آپ بغیر اکاؤنٹ کے بھی دیکھ سکتے ہیں۔ |  | `profile.account.signedOut` |
| 46 | Account › Sign in |  | Sign in | سائن اِن |  | `profile.account.signIn` |
| 47 | Account › Sign out › Done | button | You are signed out. | آپ سائن آؤٹ ہو گئے۔ |  | `profile.account.signOut.done` |
| 48 | Account › Delete › Done | button | Your account is deleted. | آپ کا اکاؤنٹ حذف ہو گیا۔ |  | `profile.account.delete.done` |
| 49 | Appearance › System |  | Same as phone | فون کے مطابق |  | `profile.appearance.system` |
| 50 | Appearance › Light |  | Light | روشن |  | `profile.appearance.light` |
| 51 | Appearance › Dark |  | Dark | تاریک |  | `profile.appearance.dark` |
| 52 | Appearance › High contrast |  | High contrast | نمایاں فرق |  | `profile.appearance.highContrast` |
| 53 | Notifications › Title | heading | Alerts on this device | اس ڈیوائس پر اطلاعات |  | `profile.notifications.title` |
| 54 | Push › Label | label read by screen readers or shown on a control | Push alerts | پش اطلاعات |  | `profile.push.label` |
| 55 | Push › Description | explanation text | Time changes, cancellations and seats that open up. | وقت کی تبدیلی، منسوخی اور خالی ہونے والی نشستیں۔ |  | `profile.push.description` |
| 56 | Push › Denied |  | Alerts are blocked. Turn them on in your phone settings. | اطلاعات بند ہیں۔ انہیں اپنے فون کی سیٹنگز میں آن کریں۔ |  | `profile.push.denied` |
| 57 | Push › Unsupported |  | This browser cannot show alerts. On an iPhone, add the app to your Home Screen first. | یہ براؤزر اطلاعات نہیں دکھا سکتا۔ آئی فون پر پہلے ایپ کو ہوم اسکرین میں شامل کریں۔ |  | `profile.push.unsupported` |
| 58 | Whatsapp › Description | explanation text | A message on WhatsApp when a session changes, if you allow it. | اگر آپ اجازت دیں تو نشست بدلنے پر واٹس ایپ پیغام ملے گا۔ |  | `profile.whatsapp.description` |
| 59 | Support › Help |  | Help and contact | مدد اور رابطہ |  | `profile.support.help` |
| 60 | Support › Version |  | Version {version} | ورژن {version} |  | `profile.support.version` |
| 61 | Reading › Title | heading | Reading | تلاوت |  | `profile.reading.title` |
| 62 | Goal › Label | label read by screen readers or shown on a control | Daily goal | روزانہ کا ہدف |  | `profile.goal.label` |
| 63 | Goal › Helper |  | Optional. Meeting it counts as a day read. | اختیاری۔ اسے پورا کرنے سے تلاوت کا دن شمار ہوتا ہے۔ |  | `profile.goal.helper` |
| 64 | Goal › None |  | No goal | کوئی ہدف نہیں |  | `profile.goal.none` |
| 65 | Goal › Option |  | {goal} a day | روزانہ {goal} |  | `profile.goal.option` |
| 66 | Revise after › Label | label read by screen readers or shown on a control | Revise after | اتنے دن بعد دہرائیں |  | `profile.reviseAfter.label` |
| 67 | Revise after › Helper |  | A memorised surah shows in Revise this week after this long. | یاد کی ہوئی سورت اتنے دن بعد اس ہفتے دہرائیں میں نظر آتی ہے۔ |  | `profile.reviseAfter.helper` |
| 68 | Revise after › Option › One |  | 1 day | 1 دن |  | `profile.reviseAfter.option.one` |
| 69 | Revise after › Option › Other |  | {count} days | {count} دن |  | `profile.reviseAfter.option.other` |
| 70 | Ayah push › Label | label read by screen readers or shown on a control | Ayah of the day | آج کی آیت کی اطلاع |  | `profile.ayahPush.label` |
| 71 | Ayah push › Description | explanation text | A notification each morning with the day's ayah, when notifications are on. | ہر صبح آج کی آیت کی اطلاع، جب اطلاعات آن ہوں۔ |  | `profile.ayahPush.description` |

### Home

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 72 | Season › Dora title |  | Dora near you | آپ کے قریب دورہ |  | `home.season.doraTitle` |
| 73 | Season › Circles title |  | Circles near you | آپ کے قریب سرکلز |  | `home.season.circlesTitle` |
| 74 | Next session › Title | heading | Your next session | آپ کی اگلی نشست |  | `home.nextSession.title` |
| 75 | Next session › Near |  | Next session near you | آپ کے قریب اگلی نشست |  | `home.nextSession.near` |
| 76 | Next session › Action |  | See details | تفصیل دیکھیں |  | `home.nextSession.action` |
| 77 | Next session › Empty › Title | heading | No sessions near you yet | آپ کے قریب ابھی کوئی نشست نہیں |  | `home.nextSession.empty.title` |
| 78 | Next session › Empty › Body | explanation text | You can ask for a circle in your area. | آپ اپنے علاقے میں سرکل کی درخواست کر سکتے ہیں۔ |  | `home.nextSession.empty.body` |
| 79 | Updates › Title | heading | Updates | اپڈیٹس |  | `home.updates.title` |
| 80 | Updates › Empty |  | No updates yet. Follow a venue to hear from it. | ابھی کوئی اپڈیٹ نہیں۔ کسی مقام کو فالو کریں تاکہ اس کی اطلاع ملے۔ |  | `home.updates.empty` |
| 81 | Updates › See all |  | See all updates | تمام اپڈیٹس دیکھیں |  | `home.updates.seeAll` |
| 82 | Reading › Title | heading | Continue reading | پڑھنا جاری رکھیں |  | `home.reading.title` |
| 83 | Reading › Position |  | {surah}, verse {ayah} | {surah}، آیت {ayah} |  | `home.reading.position` |
| 84 | Reading › Start |  | Start reading | پڑھنا شروع کریں |  | `home.reading.start` |
| 85 | Offline |  | You are offline. Showing what we saved earlier. | آپ آف لائن ہیں۔ پہلے سے محفوظ معلومات دکھائی جا رہی ہیں۔ |  | `home.offline` |
| 86 | Also › Dora |  | Also running: Dora | ساتھ ہی دورہ بھی جاری ہے |  | `home.also.dora` |
| 87 | Also › Circles |  | Also running: weekly circles | ساتھ ہی ہفتہ وار سرکل بھی جاری ہیں |  | `home.also.circles` |
| 88 | Choose city |  | Choose your city to see sessions near you. | اپنے قریب کی نشستیں دیکھنے کے لیے اپنا شہر چنیں۔ |  | `home.chooseCity` |
| 89 | Choose city › Action |  | Choose city | شہر چنیں |  | `home.chooseCity.action` |
| 90 | Next session › Empty › Action | message when there is nothing to show | Browse sessions | نشستیں دیکھیں |  | `home.nextSession.empty.action` |
| 91 | Next session › Empty › Body no city | message when there is nothing to show | Choose your city to see sessions, or ask for a circle. | نشستیں دیکھنے کے لیے اپنا شہر چنیں، یا سرکل کی درخواست کریں۔ |  | `home.nextSession.empty.bodyNoCity` |
| 92 | Prayer › Title | heading | Prayer times | نماز کے اوقات |  | `home.prayer.title` |
| 93 | Prayer › Placeholder | placeholder inside an empty field | Open Quran & Prayer for today's prayer times. | آج کی نماز کے اوقات کے لیے قرآن اور نماز کھولیں۔ |  | `home.prayer.placeholder` |
| 94 | Reading › Placeholder | placeholder inside an empty field | Open Quran & Prayer to start reading. | پڑھنا شروع کرنے کے لیے قرآن اور نماز کھولیں۔ |  | `home.reading.placeholder` |
| 95 | Updates › Signed out |  | Sign in to hear from the venues you follow. | جن مقامات کو آپ فالو کرتے ہیں ان کی خبریں سننے کے لیے سائن اِن کریں۔ |  | `home.updates.signedOut` |
| 96 | Updates › Sign in |  | Sign in | سائن اِن |  | `home.updates.signIn` |
| 97 | Map › Count › One |  | 1 circle near you | آپ کے قریب 1 حلقہ |  | `home.map.count.one` |
| 98 | Map › Count › Other |  | {count} circles near you | آپ کے قریب {count} حلقے |  | `home.map.count.other` |
| 99 | Map › Open | button | Open the map | نقشہ کھولیں |  | `home.map.open` |
| 100 | Ayah › Title | heading | Ayah of the day | آج کی آیت |  | `home.ayah.title` |
| 101 | Ayah › Reference |  | Surah {surah}, ayah {ayah} | سورہ نمبر {surah}، آیت {ayah} |  | `home.ayah.reference` |
| 102 | Ayah › Read |  | Read this ayah | یہ آیت پڑھیں |  | `home.ayah.read` |
| 103 | Ayah › From |  | Chosen by {name} | {name} کی طرف سے منتخب |  | `home.ayah.from` |
| 104 | Ayah › From › Venue |  | Chosen by a masjid you follow | آپ کی فالو کی ہوئی مسجد کی طرف سے منتخب |  | `home.ayah.from.venue` |
| 105 | Ayah › From › Circle |  | Chosen by a circle you follow | آپ کے فالو کیے ہوئے حلقے کی طرف سے منتخب |  | `home.ayah.from.circle` |
| 106 | Also › Title | heading | Also in the app | ایپ میں مزید |  | `home.also.title` |
| 107 | Also › Quran |  | Quran | قرآن |  | `home.also.quran` |
| 108 | Also › Qibla |  | Qibla | قبلہ |  | `home.also.qibla` |
| 109 | Map › Count nearest › One |  | 1 circle near you · nearest {distance} | آپ کے قریب 1 حلقہ · قریب ترین {distance} |  | `home.map.countNearest.one` |
| 110 | Map › Count nearest › Other |  | {count} circles near you · nearest {distance} | آپ کے قریب {count} حلقے · قریب ترین {distance} |  | `home.map.countNearest.other` |
| 111 | Distance › Metres |  | {distance} m | {distance} میٹر |  | `home.distance.metres` |
| 112 | Distance › Km |  | {distance} km | {distance} کلومیٹر |  | `home.distance.km` |
| 113 | Hijri › Date |  | {day} {month} {year} AH | {day} {month} {year} ہجری |  | `home.hijri.date` |
| 114 | Countdown › Now |  | Starting now | ابھی شروع ہو رہا ہے |  | `home.countdown.now` |
| 115 | Countdown › Minutes › One |  | in 1 minute | 1 منٹ میں |  | `home.countdown.minutes.one` |
| 116 | Countdown › Minutes › Other |  | in {count} minutes | {count} منٹ میں |  | `home.countdown.minutes.other` |
| 117 | Countdown › Hours › One |  | in 1 hour | 1 گھنٹے میں |  | `home.countdown.hours.one` |
| 118 | Countdown › Hours › Other |  | in {count} hours | {count} گھنٹے میں |  | `home.countdown.hours.other` |
| 119 | Countdown › Days › One |  | in 1 day | 1 دن میں |  | `home.countdown.days.one` |
| 120 | Countdown › Days › Other |  | in {count} days | {count} دن میں |  | `home.countdown.days.other` |
| 121 | Next › My registration |  | My registration | میری رجسٹریشن |  | `home.next.myRegistration` |
| 122 | Ayah › Source |  | Arabic text from the online Quran source | عربی متن آن لائن قرآن ماخذ سے |  | `home.ayah.source` |

### Prayer times

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 123 | Title | heading | Prayer times | نماز کے اوقات |  | `prayer.title` |
| 124 | Next | button | Next prayer | اگلی نماز |  | `prayer.next` |
| 125 | Countdown |  | {prayer} in {time} | {prayer} میں {time} |  | `prayer.countdown` |
| 126 | Fajr |  | Fajr | فجر |  | `prayer.fajr` |
| 127 | Sunrise |  | Sunrise | طلوع آفتاب |  | `prayer.sunrise` |
| 128 | Dhuhr |  | Dhuhr | ظہر |  | `prayer.dhuhr` |
| 129 | Asr |  | Asr | عصر |  | `prayer.asr` |
| 130 | Maghrib |  | Maghrib | مغرب |  | `prayer.maghrib` |
| 131 | Isha |  | Isha | عشاء |  | `prayer.isha` |
| 132 | Hijri |  | Hijri date | ہجری تاریخ |  | `prayer.hijri` |
| 133 | Hijri note |  | The Hijri date follows moon sighting in Pakistan. | ہجری تاریخ پاکستان میں چاند نظر آنے کے مطابق ہے۔ |  | `prayer.hijriNote` |
| 134 | City |  | Times for {city} | {city} کے اوقات |  | `prayer.city` |
| 135 | No city › Title | heading | Choose your city | اپنا شہر منتخب کریں |  | `prayer.noCity.title` |
| 136 | No city › Body | explanation text | We need your city to show prayer times. | نماز کے اوقات دکھانے کے لیے ہمیں آپ کا شہر چاہیے۔ |  | `prayer.noCity.body` |
| 137 | No city › Action |  | Choose city | شہر منتخب کریں |  | `prayer.noCity.action` |
| 138 | Am |  | AM | صبح |  | `prayer.am` |
| 139 | Pm |  | PM | شام |  | `prayer.pm` |
| 140 | Next › Tomorrow |  | Tomorrow | کل |  | `prayer.next.tomorrow` |
| 141 | Badge › Next | button | Next | اگلی |  | `prayer.badge.next` |
| 142 | Countdown › Hours minutes |  | {hours} h {minutes} min | {hours} گھنٹے {minutes} منٹ |  | `prayer.countdown.hoursMinutes` |
| 143 | Countdown › Minutes seconds |  | {minutes} min {seconds} s | {minutes} منٹ {seconds} سیکنڈ |  | `prayer.countdown.minutesSeconds` |
| 144 | Countdown › Seconds |  | {seconds} s | {seconds} سیکنڈ |  | `prayer.countdown.seconds` |
| 145 | Place › Label | label read by screen readers or shown on a control | City | شہر |  | `prayer.place.label` |
| 146 | View › Label | label read by screen readers or shown on a control | Calendar view | کیلنڈر کا انداز |  | `prayer.view.label` |
| 147 | View › Week |  | Week | ہفتہ |  | `prayer.view.week` |
| 148 | View › Month |  | Month | مہینہ |  | `prayer.view.month` |
| 149 | Calendar › Today |  | Today | آج |  | `prayer.calendar.today` |
| 150 | Calendar › Previous week |  | Previous week | پچھلا ہفتہ |  | `prayer.calendar.previousWeek` |
| 151 | Calendar › Next week |  | Next week | اگلا ہفتہ |  | `prayer.calendar.nextWeek` |
| 152 | Calendar › Previous month |  | Previous month | پچھلا مہینہ |  | `prayer.calendar.previousMonth` |
| 153 | Calendar › Next month |  | Next month | اگلا مہینہ |  | `prayer.calendar.nextMonth` |
| 154 | Calendar › Month title |  | {month} {year} | {month} {year} |  | `prayer.calendar.monthTitle` |
| 155 | Calendar › Select day |  | {weekday}, {day} {month} | {weekday}، {day} {month} |  | `prayer.calendar.selectDay` |
| 156 | Date › Gregorian |  | {weekday}, {day} {month} {year} | {weekday}، {day} {month} {year} |  | `prayer.date.gregorian` |
| 157 | Date › Hijri |  | {day} {month} {year} AH | {day} {month} {year} ہجری |  | `prayer.date.hijri` |
| 158 | Method |  | Calculated with the University of Islamic Sciences, Karachi method, and the Hanafi time for Asr. | جامعہ علومِ اسلامیہ کراچی کے طریقے اور حنفی وقتِ عصر کے مطابق حساب کیا گیا ہے۔ |  | `prayer.method` |
| 159 | Weekday › 0 |  | Sunday | اتوار |  | `prayer.weekday.0` |
| 160 | Weekday › 1 |  | Monday | پیر |  | `prayer.weekday.1` |
| 161 | Weekday › 2 |  | Tuesday | منگل |  | `prayer.weekday.2` |
| 162 | Weekday › 3 |  | Wednesday | بدھ |  | `prayer.weekday.3` |
| 163 | Weekday › 4 |  | Thursday | جمعرات |  | `prayer.weekday.4` |
| 164 | Weekday › 5 |  | Friday | جمعہ |  | `prayer.weekday.5` |
| 165 | Weekday › 6 |  | Saturday | ہفتہ |  | `prayer.weekday.6` |
| 166 | Weekday short › 0 |  | Sun | اتوار |  | `prayer.weekdayShort.0` |
| 167 | Weekday short › 1 |  | Mon | پیر |  | `prayer.weekdayShort.1` |
| 168 | Weekday short › 2 |  | Tue | منگل |  | `prayer.weekdayShort.2` |
| 169 | Weekday short › 3 |  | Wed | بدھ |  | `prayer.weekdayShort.3` |
| 170 | Weekday short › 4 |  | Thu | جمعرات |  | `prayer.weekdayShort.4` |
| 171 | Weekday short › 5 |  | Fri | جمعہ |  | `prayer.weekdayShort.5` |
| 172 | Weekday short › 6 |  | Sat | ہفتہ |  | `prayer.weekdayShort.6` |
| 173 | Month › 1 |  | January | جنوری |  | `prayer.month.1` |
| 174 | Month › 2 |  | February | فروری |  | `prayer.month.2` |
| 175 | Month › 3 |  | March | مارچ |  | `prayer.month.3` |
| 176 | Month › 4 |  | April | اپریل |  | `prayer.month.4` |
| 177 | Month › 5 |  | May | مئی |  | `prayer.month.5` |
| 178 | Month › 6 |  | June | جون |  | `prayer.month.6` |
| 179 | Month › 7 |  | July | جولائی |  | `prayer.month.7` |
| 180 | Month › 8 |  | August | اگست |  | `prayer.month.8` |
| 181 | Month › 9 |  | September | ستمبر |  | `prayer.month.9` |
| 182 | Month › 10 |  | October | اکتوبر |  | `prayer.month.10` |
| 183 | Month › 11 |  | November | نومبر |  | `prayer.month.11` |
| 184 | Month › 12 |  | December | دسمبر |  | `prayer.month.12` |
| 185 | Hijri month › 1 |  | Muharram | محرم |  | `prayer.hijriMonth.1` |
| 186 | Hijri month › 2 |  | Safar | صفر |  | `prayer.hijriMonth.2` |
| 187 | Hijri month › 3 |  | Rabi al-awwal | ربیع الاول |  | `prayer.hijriMonth.3` |
| 188 | Hijri month › 4 |  | Rabi al-thani | ربیع الثانی |  | `prayer.hijriMonth.4` |
| 189 | Hijri month › 5 |  | Jumada al-awwal | جمادی الاول |  | `prayer.hijriMonth.5` |
| 190 | Hijri month › 6 |  | Jumada al-thani | جمادی الثانی |  | `prayer.hijriMonth.6` |
| 191 | Hijri month › 7 |  | Rajab | رجب |  | `prayer.hijriMonth.7` |
| 192 | Hijri month › 8 |  | Shaban | شعبان |  | `prayer.hijriMonth.8` |
| 193 | Hijri month › 9 |  | Ramadan | رمضان |  | `prayer.hijriMonth.9` |
| 194 | Hijri month › 10 |  | Shawwal | شوال |  | `prayer.hijriMonth.10` |
| 195 | Hijri month › 11 |  | Dhu al-Qadah | ذی القعدہ |  | `prayer.hijriMonth.11` |
| 196 | Hijri month › 12 |  | Dhu al-Hijjah | ذی الحجہ |  | `prayer.hijriMonth.12` |
| 197 | City name › Karachi |  | Karachi | کراچی |  | `prayer.cityName.karachi` |
| 198 | City name › Lahore |  | Lahore | لاہور |  | `prayer.cityName.lahore` |
| 199 | City name › Islamabad |  | Islamabad | اسلام آباد |  | `prayer.cityName.islamabad` |
| 200 | City name › Rawalpindi |  | Rawalpindi | راولپنڈی |  | `prayer.cityName.rawalpindi` |
| 201 | City name › Faisalabad |  | Faisalabad | فیصل آباد |  | `prayer.cityName.faisalabad` |
| 202 | City name › Multan |  | Multan | ملتان |  | `prayer.cityName.multan` |
| 203 | City name › Peshawar |  | Peshawar | پشاور |  | `prayer.cityName.peshawar` |
| 204 | City name › Quetta |  | Quetta | کوئٹہ |  | `prayer.cityName.quetta` |
| 205 | City name › Hyderabad |  | Hyderabad | حیدرآباد |  | `prayer.cityName.hyderabad` |
| 206 | City name › Gujranwala |  | Gujranwala | گوجرانوالہ |  | `prayer.cityName.gujranwala` |
| 207 | City name › Sialkot |  | Sialkot | سیالکوٹ |  | `prayer.cityName.sialkot` |
| 208 | City name › Bahawalpur |  | Bahawalpur | بہاولپور |  | `prayer.cityName.bahawalpur` |
| 209 | City name › Abbottabad |  | Abbottabad | ایبٹ آباد |  | `prayer.cityName.abbottabad` |
| 210 | City name › Gilgit |  | Gilgit | گلگت |  | `prayer.cityName.gilgit` |
| 211 | Calendar › Week title |  | {from} to {to} | {from} سے {to} تک |  | `prayer.calendar.weekTitle` |
| 212 | Calendar › Row label | label read by screen readers or shown on a control | {date}. Hijri {hijri}. | {date}۔ ہجری {hijri}۔ |  | `prayer.calendar.rowLabel` |

### Nearby (map and list)

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 213 | Title | heading | Nearby | قریب |  | `nearby.title` |
| 214 | Search › Label | label read by screen readers or shown on a control | Search | تلاش |  | `nearby.search.label` |
| 215 | Search › Placeholder | placeholder inside an empty field | Search by area or venue | علاقے یا مقام سے تلاش کریں |  | `nearby.search.placeholder` |
| 216 | View › Label | label read by screen readers or shown on a control | Show as | اس طرح دکھائیں |  | `nearby.view.label` |
| 217 | View › Map |  | Map | نقشہ |  | `nearby.view.map` |
| 218 | View › List |  | List | فہرست |  | `nearby.view.list` |
| 219 | Map › Label | label read by screen readers or shown on a control | Map of places near you | آپ کے قریب مقامات کا نقشہ |  | `nearby.map.label` |
| 220 | Location › Use |  | Use my location | میرا مقام استعمال کریں |  | `nearby.location.use` |
| 221 | Location › Denied |  | Location is off. Search by area instead. | لوکیشن بند ہے۔ اس کی بجائے علاقے سے تلاش کریں۔ |  | `nearby.location.denied` |
| 222 | Filters › Title | heading | Filters | فلٹر |  | `nearby.filters.title` |
| 223 | Filters › Open | button | Filters | فلٹر |  | `nearby.filters.open` |
| 224 | Filters › Day |  | Day | دن |  | `nearby.filters.day` |
| 225 | Filters › Time |  | Time | وقت |  | `nearby.filters.time` |
| 226 | Filters › Section |  | Section | حصہ |  | `nearby.filters.section` |
| 227 | Filters › Language |  | Language | زبان |  | `nearby.filters.language` |
| 228 | Filters › Area |  | Area | علاقہ |  | `nearby.filters.area` |
| 229 | Filters › Any |  | Any | کوئی بھی |  | `nearby.filters.any` |
| 230 | Filters › Apply |  | Show results | نتائج دکھائیں |  | `nearby.filters.apply` |
| 231 | Filters › Clear | button | Clear filters | فلٹر ہٹائیں |  | `nearby.filters.clear` |
| 232 | Time › Morning |  | Morning | صبح |  | `nearby.time.morning` |
| 233 | Time › Afternoon |  | Afternoon | دوپہر |  | `nearby.time.afternoon` |
| 234 | Time › Evening |  | Evening | شام |  | `nearby.time.evening` |
| 235 | Time › Night |  | Night | رات |  | `nearby.time.night` |
| 236 | Result › Count › One |  | 1 place near you | آپ کے قریب 1 مقام |  | `nearby.result.count.one` |
| 237 | Result › Count › Other |  | {count} places near you | آپ کے قریب {count} مقامات |  | `nearby.result.count.other` |
| 238 | Result › Distance |  | {distance} km away | {distance} کلومیٹر دور |  | `nearby.result.distance` |
| 239 | Result › Next session |  | Next: {when} | اگلی نشست: {when} |  | `nearby.result.nextSession` |
| 240 | Empty › Title | heading | No sessions found | کوئی نشست نہیں ملی |  | `nearby.empty.title` |
| 241 | Empty › Body | explanation text | Try another day or area, or ask for a circle near you. | کوئی اور دن یا علاقہ آزمائیں، یا اپنے قریب سرکل کی درخواست کریں۔ |  | `nearby.empty.body` |
| 242 | Request › Action |  | Request a circle near me | میرے قریب سرکل کی درخواست |  | `nearby.request.action` |
| 243 | Offline |  | You are offline. Showing places we saved earlier. | آپ آف لائن ہیں۔ پہلے سے محفوظ مقامات دکھائے جا رہے ہیں۔ |  | `nearby.offline` |
| 244 | Area › Button |  | Choose area | علاقہ چنیں |  | `nearby.area.button` |
| 245 | Area › Title | heading | Choose your area | اپنا علاقہ چنیں |  | `nearby.area.title` |
| 246 | Area › All |  | All areas | تمام علاقے |  | `nearby.area.all` |
| 247 | Area › Search label | label read by screen readers or shown on a control | Search areas | علاقے تلاش کریں |  | `nearby.area.searchLabel` |
| 248 | Area › Search placeholder |  | Type an area name | علاقے کا نام لکھیں |  | `nearby.area.searchPlaceholder` |
| 249 | Area › No match |  | No area matches. Try another spelling. | کوئی علاقہ نہیں ملا۔ کوئی اور ہجے آزمائیں۔ |  | `nearby.area.noMatch` |
| 250 | Area › Choose city first |  | Choose a city first, then its areas show here. | پہلے شہر چنیں، پھر اس کے علاقے یہاں نظر آئیں گے۔ |  | `nearby.area.chooseCityFirst` |
| 251 | City › Label | label read by screen readers or shown on a control | City | شہر |  | `nearby.city.label` |
| 252 | City › All |  | All cities | تمام شہر |  | `nearby.city.all` |
| 253 | Empty › With filters | message when there is nothing to show | Nothing matches these filters. Clear a filter to see more. | ان فلٹرز سے کچھ نہیں ملا۔ مزید دیکھنے کے لیے کوئی فلٹر ہٹائیں۔ |  | `nearby.empty.withFilters` |
| 254 | Filters › Button count |  | Filters ({count}) | فلٹر ({count}) |  | `nearby.filters.buttonCount` |
| 255 | Filters › Program |  | Programme | پروگرام |  | `nearby.filters.program` |
| 256 | Load more |  | Show more | مزید دکھائیں |  | `nearby.loadMore` |
| 257 | Map › Hint | hint under a field | Tap a pin to see the place. | مقام دیکھنے کے لیے پن پر ٹیپ کریں۔ |  | `nearby.map.hint` |
| 258 | Map › More sessions |  | {count} sessions here | یہاں {count} نشستیں |  | `nearby.map.moreSessions` |
| 259 | Map › Unavailable |  | The map is not available. The list shows the same places. | نقشہ دستیاب نہیں۔ فہرست میں وہی مقامات ہیں۔ |  | `nearby.map.unavailable` |
| 260 | Map › View venue |  | View this venue | یہ مقام دیکھیں |  | `nearby.map.viewVenue` |
| 261 | Request › Soon |  | Requesting a circle is coming soon. | سرکل کی درخواست جلد آ رہی ہے۔ |  | `nearby.request.soon` |
| 262 | Ask › Title | heading | Ask for a circle near you | اپنے قریب حلقہ مانگیں |  | `nearby.ask.title` |
| 263 | Ask › Body | explanation text | No circle close by? Tell us where you are and we will try to start one. | قریب کوئی حلقہ نہیں؟ ہمیں اپنی جگہ بتائیں، ہم شروع کرنے کی کوشش کریں گے۔ |  | `nearby.ask.body` |
| 264 | Ask › Action |  | Ask for a circle | حلقہ مانگیں |  | `nearby.ask.action` |

### Venue page

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 265 | Address › Title | heading | Address | پتہ |  | `venue.address.title` |
| 266 | Directions |  | Get directions | راستہ دیکھیں |  | `venue.directions` |
| 267 | Call |  | Call the venue | مقام کو کال کریں |  | `venue.call` |
| 268 | Follow |  | Follow this venue | اس مقام کو فالو کریں |  | `venue.follow` |
| 269 | Following |  | Following | فالو کر رہے ہیں |  | `venue.following` |
| 270 | Share | button | Invite a friend or family | دوست یا گھر والوں کو بلائیں |  | `venue.share` |
| 271 | Facilities › Title | heading | Facilities | سہولیات |  | `venue.facilities.title` |
| 272 | Facilities › None |  | The coordinator has not added facilities yet. | کوآرڈینیٹر نے ابھی سہولیات نہیں لکھیں۔ |  | `venue.facilities.none` |
| 273 | Sessions › Title | heading | Sessions | نشستیں |  | `venue.sessions.title` |
| 274 | Sessions › Empty |  | No sessions here yet. | یہاں ابھی کوئی نشست نہیں۔ |  | `venue.sessions.empty` |
| 275 | Not found › Title | heading | We could not find this venue | یہ مقام نہیں ملا |  | `venue.notFound.title` |
| 276 | Not found › Body | explanation text | It may have been removed. Go back to Nearby to find another. | ہو سکتا ہے اسے ہٹا دیا گیا ہو۔ دوسرا مقام ڈھونڈنے کے لیے قریب پر واپس جائیں۔ |  | `venue.notFound.body` |
| 277 | Title | heading | Venue | مقام |  | `venue.title` |
| 278 | No phone |  | No phone number listed. | فون نمبر درج نہیں۔ |  | `venue.noPhone` |
| 279 | Unfollow |  | Unfollow this venue | اس مقام کو فالو کرنا ختم کریں |  | `venue.unfollow` |

### Session page

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 280 | When |  | When | کب |  | `session.when` |
| 281 | Schedule |  | Every {day} at {time} | ہر {day} کو {time} بجے |  | `session.schedule` |
| 282 | Next | button | Next: {date} | اگلی نشست: {date} |  | `session.next` |
| 283 | Teacher |  | Teacher: {name} | استاد: {name} |  | `session.teacher` |
| 284 | Language |  | Language: {language} | زبان: {language} |  | `session.language` |
| 285 | Section |  | For: {section} | کے لیے: {section} |  | `session.section` |
| 286 | Portion › Title | heading | Today's portion | آج کا حصہ |  | `session.portion.title` |
| 287 | Portion › Read ahead |  | Read ahead | پہلے سے پڑھیں |  | `session.portion.readAhead` |
| 288 | Seats left › One |  | 1 seat left | 1 نشست باقی ہے |  | `session.seatsLeft.one` |
| 289 | Seats left › Other |  | {count} seats left | {count} نشستیں باقی ہیں |  | `session.seatsLeft.other` |
| 290 | Full |  | This session is full. | یہ نشست بھر چکی ہے۔ |  | `session.full` |
| 291 | Waitlist |  | Join the waiting list | انتظار کی فہرست میں شامل ہوں |  | `session.waitlist` |
| 292 | Cancelled |  | This session is cancelled. | یہ نشست منسوخ ہے۔ |  | `session.cancelled` |
| 293 | Changed |  | The time changed. New time: {when} | وقت بدل گیا ہے۔ نیا وقت: {when} |  | `session.changed` |
| 294 | Recap › Title | heading | After the session | نشست کے بعد |  | `session.recap.title` |
| 295 | Online |  | Join online | آن لائن شامل ہوں |  | `session.online` |
| 296 | Title | heading | Session | نشست |  | `session.title` |
| 297 | Duration › One |  | 1 minute | 1 منٹ |  | `session.duration.one` |
| 298 | Duration › Other |  | {count} minutes | {count} منٹ |  | `session.duration.other` |
| 299 | Open venue |  | See the venue | مقام دیکھیں |  | `session.openVenue` |
| 300 | Circle |  | About this circle | اس سرکل کے بارے میں |  | `session.circle` |
| 301 | Registration |  | Registration | رجسٹریشن |  | `session.registration` |
| 302 | Registration › Not needed |  | You do not need to register. Just come. | رجسٹر کرنے کی ضرورت نہیں۔ بس تشریف لائیں۔ |  | `session.registration.notNeeded` |
| 303 | Registration › Open | button | Registration is open. | رجسٹریشن کھلی ہے۔ |  | `session.registration.open` |
| 304 | Registration › Full waitlist |  | The session is full. You can join the waiting list. | نشست بھر چکی ہے۔ آپ انتظار کی فہرست میں شامل ہو سکتے ہیں۔ |  | `session.registration.fullWaitlist` |
| 305 | Upcoming |  | Coming up | آنے والی نشستیں |  | `session.upcoming` |
| 306 | No upcoming |  | No dates are planned yet. | ابھی کوئی تاریخ طے نہیں۔ |  | `session.noUpcoming` |
| 307 | Register |  | Register | رجسٹر کریں |  | `session.register` |
| 308 | On waitlist |  | You are on the waiting list | آپ انتظار کی فہرست میں ہیں |  | `session.onWaitlist` |
| 309 | Already registered |  | You are registered | آپ رجسٹر ہو چکے ہیں |  | `session.alreadyRegistered` |
| 310 | Schedule › Every day |  | Every day at {time} | ہر روز {time} بجے |  | `session.schedule.everyDay` |
| 311 | Schedule › On days |  | {days} at {time} | {days}، {time} بجے |  | `session.schedule.onDays` |
| 312 | Schedule › One off |  | {date} at {time} | {date}، {time} بجے |  | `session.schedule.oneOff` |
| 313 | Portion › Para |  | Para {number} | پارہ {number} |  | `session.portion.para` |
| 314 | Portion › Surah |  | Surah {number} | سورت {number} |  | `session.portion.surah` |
| 315 | Portion › Ayah range |  | Surah {surah}, ayahs {from} to {to} | سورت {surah}، آیات {from} سے {to} تک |  | `session.portion.ayahRange` |
| 316 | Days › Every day |  | Every day | ہر روز |  | `session.days.everyDay` |
| 317 | Share | button | Share | شیئر کریں |  | `session.share` |
| 318 | Share › Message |  | {title}, {venue}: {when} | {title}، {venue}: {when} |  | `session.share.message` |
| 319 | Share › Unavailable |  | Sharing is not available on this device. | اس فون پر شیئر کرنا ممکن نہیں۔ |  | `session.share.unavailable` |

### Registering for a session

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 320 | Title | heading | Register | رجسٹر کریں |  | `registration.title` |
| 321 | Step |  | Step {current} of {total} | مرحلہ {current} از {total} |  | `registration.step` |
| 322 | Name › Label | label read by screen readers or shown on a control | Full name | پورا نام |  | `registration.name.label` |
| 323 | Name › Error |  | Enter your name. | اپنا نام لکھیں۔ |  | `registration.name.error` |
| 324 | Phone › Label | label read by screen readers or shown on a control | WhatsApp number | واٹس ایپ نمبر |  | `registration.phone.label` |
| 325 | Phone › Help |  | We send a code to this number on WhatsApp. | ہم اس نمبر پر واٹس ایپ پر کوڈ بھیجیں گے۔ |  | `registration.phone.help` |
| 326 | Phone › Error |  | Enter a mobile number we can use. | ایسا موبائل نمبر لکھیں جو ہم استعمال کر سکیں۔ |  | `registration.phone.error` |
| 327 | Area › Label | label read by screen readers or shown on a control | Your area | آپ کا علاقہ |  | `registration.area.label` |
| 328 | Area › Placeholder | placeholder inside an empty field | Choose your area | اپنا علاقہ منتخب کریں |  | `registration.area.placeholder` |
| 329 | Area › Error |  | Choose your area. | اپنا علاقہ منتخب کریں۔ |  | `registration.area.error` |
| 330 | Section › Label | label read by screen readers or shown on a control | Section | حصہ |  | `registration.section.label` |
| 331 | Party size › Label | label read by screen readers or shown on a control | How many people are coming? | کتنے لوگ آ رہے ہیں؟ |  | `registration.partySize.label` |
| 332 | Party size › Help |  | Count yourself too. | اپنے آپ کو بھی گنیں۔ |  | `registration.partySize.help` |
| 333 | Party size › Decrease |  | Fewer people | کم لوگ |  | `registration.partySize.decrease` |
| 334 | Party size › Increase |  | More people | زیادہ لوگ |  | `registration.partySize.increase` |
| 335 | Consent › Whatsapp |  | Send me reminders on WhatsApp | مجھے واٹس ایپ پر یاد دہانی بھیجیں |  | `registration.consent.whatsapp` |
| 336 | Consent › Help |  | You can change this any time in Profile. | آپ اسے کسی بھی وقت پروفائل میں بدل سکتے ہیں۔ |  | `registration.consent.help` |
| 337 | Send code |  | Send code | کوڈ بھیجیں |  | `registration.sendCode` |
| 338 | Submit | button | Register | رجسٹر کریں |  | `registration.submit` |
| 339 | Code › Title | heading | Enter the code | کوڈ لکھیں |  | `registration.code.title` |
| 340 | Code › Body | explanation text | We sent a 6-digit code to {phone} on WhatsApp. | ہم نے {phone} پر واٹس ایپ پر 6 ہندسوں کا کوڈ بھیجا ہے۔ |  | `registration.code.body` |
| 341 | Code › Label | label read by screen readers or shown on a control | 6-digit code | 6 ہندسوں کا کوڈ |  | `registration.code.label` |
| 342 | Code › Confirm | button | Confirm | تصدیق کریں |  | `registration.code.confirm` |
| 343 | Code › Resend |  | Send the code again | کوڈ دوبارہ بھیجیں |  | `registration.code.resend` |
| 344 | Code › Resend in |  | Send again in {seconds} seconds | {seconds} سیکنڈ میں دوبارہ بھیجیں |  | `registration.code.resendIn` |
| 345 | Code › Change number |  | Use a different number | دوسرا نمبر استعمال کریں |  | `registration.code.changeNumber` |
| 346 | Success › Title | heading | You are registered | آپ کا اندراج ہو گیا |  | `registration.success.title` |
| 347 | Success › Body | explanation text | We will remind you before the session. | ہم نشست سے پہلے آپ کو یاد دلائیں گے۔ |  | `registration.success.body` |
| 348 | Waitlist › Title | heading | You are on the waiting list | آپ انتظار کی فہرست میں ہیں |  | `registration.waitlist.title` |
| 349 | Waitlist › Body | explanation text | We will tell you if a seat opens. | اگر جگہ ملی تو ہم آپ کو بتائیں گے۔ |  | `registration.waitlist.body` |
| 350 | Success › Journey |  | See it in My Journey | میرے سفر میں دیکھیں |  | `registration.success.journey` |
| 351 | Success › Done | button | Done | مکمل |  | `registration.success.done` |
| 352 | Intro | explanation text | Tell us a little so we can keep a seat for you. | ہمیں تھوڑا سا بتائیں تاکہ ہم آپ کے لیے نشست رکھ سکیں۔ |  | `registration.intro` |
| 353 | Waitlist intro |  | This session is full. Join the waiting list and we will tell you if a seat opens. | یہ نشست بھر چکی ہے۔ انتظار کی فہرست میں شامل ہوں، نشست خالی ہوئی تو ہم بتائیں گے۔ |  | `registration.waitlistIntro` |
| 354 | City › Label | label read by screen readers or shown on a control | City | شہر |  | `registration.city.label` |
| 355 | Section › Fixed |  | This session is for: {section} | یہ نشست اس کے لیے ہے: {section} |  | `registration.section.fixed` |
| 356 | Submit waitlist |  | Join the waiting list | انتظار کی فہرست میں شامل ہوں |  | `registration.submitWaitlist` |
| 357 | Problem › Section |  | Choose a section. | حصہ چنیں۔ |  | `registration.problem.section` |
| 358 | Problem › Party size |  | Choose how many people are coming. | بتائیں کتنے لوگ آ رہے ہیں۔ |  | `registration.problem.partySize` |
| 359 | Confirmation › Position |  | Your place on the waiting list: {count} | انتظار کی فہرست میں آپ کا نمبر: {count} |  | `registration.confirmation.position` |
| 360 | Confirmation › Party › One |  | 1 person | 1 فرد |  | `registration.confirmation.party.one` |
| 361 | Confirmation › Party › Other |  | {count} people | {count} افراد |  | `registration.confirmation.party.other` |
| 362 | Back to session |  | Back to the session | نشست پر واپس جائیں |  | `registration.backToSession` |

### My Journey

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 363 | Title | heading | My Journey | میرا سفر |  | `journey.title` |
| 364 | Sign in › Title | heading | Sign in to see your journey | اپنا سفر دیکھنے کے لیے سائن اِن کریں |  | `journey.signIn.title` |
| 365 | Sign in › Body | explanation text | You can browse without an account. Sign in to register and follow. | اکاؤنٹ کے بغیر بھی دیکھ سکتے ہیں۔ رجسٹر اور فالو کرنے کے لیے سائن اِن کریں۔ |  | `journey.signIn.body` |
| 366 | Sign in › Action |  | Sign in | سائن اِن |  | `journey.signIn.action` |
| 367 | Registrations › Title | heading | Your registrations | آپ کی رجسٹریشنز |  | `journey.registrations.title` |
| 368 | Registrations › Empty › Title | heading | You have not registered yet | آپ نے ابھی رجسٹر نہیں کیا |  | `journey.registrations.empty.title` |
| 369 | Registrations › Empty › Body | explanation text | Find a session near you and register in a tap. | اپنے قریب نشست ڈھونڈیں اور ایک ٹیپ میں رجسٹر کریں۔ |  | `journey.registrations.empty.body` |
| 370 | Registrations › Empty › Action | message when there is nothing to show | Find a session | نشست ڈھونڈیں |  | `journey.registrations.empty.action` |
| 371 | Status › Confirmed |  | Registered | رجسٹر ہو چکے |  | `journey.status.confirmed` |
| 372 | Status › Waitlisted |  | Waiting list | انتظار کی فہرست |  | `journey.status.waitlisted` |
| 373 | Status › Cancelled |  | Cancelled | منسوخ |  | `journey.status.cancelled` |
| 374 | Reminder › Label | label read by screen readers or shown on a control | Remind me before this session | اس نشست سے پہلے یاد دلائیں |  | `journey.reminder.label` |
| 375 | Cancel | button | Cancel registration | رجسٹریشن منسوخ کریں |  | `journey.cancel` |
| 376 | Cancel › Title | heading | Cancel your registration? | کیا رجسٹریشن منسوخ کریں؟ |  | `journey.cancel.title` |
| 377 | Cancel › Body | explanation text | You can register again later if there is room. | اگر جگہ ہوئی تو آپ بعد میں دوبارہ رجسٹر کر سکتے ہیں۔ |  | `journey.cancel.body` |
| 378 | Cancel › Confirm | button | Yes, cancel | جی ہاں، منسوخ کریں |  | `journey.cancel.confirm` |
| 379 | Cancel › Keep |  | Keep it | رہنے دیں |  | `journey.cancel.keep` |
| 380 | Followed › Title | heading | Venues and circles you follow | جو مقامات اور سرکلز آپ فالو کرتے ہیں |  | `journey.followed.title` |
| 381 | Followed › Empty |  | You are not following anything yet. | آپ نے ابھی کچھ فالو نہیں کیا۔ |  | `journey.followed.empty` |
| 382 | Progress › Title | heading | Circle progress | سرکل کی پیش رفت |  | `journey.progress.title` |
| 383 | Progress › Reached |  | Reached: {portion} | یہاں تک پہنچے: {portion} |  | `journey.progress.reached` |
| 384 | Companion › Title | heading | Session companion | نشست کا ساتھی |  | `journey.companion.title` |
| 385 | Companion › Recap |  | Recap from the coordinator | کوآرڈینیٹر کا خلاصہ |  | `journey.companion.recap` |
| 386 | Companion › No recap |  | No recap yet. | ابھی کوئی خلاصہ نہیں۔ |  | `journey.companion.noRecap` |
| 387 | Cancel › Done | button | Your registration is cancelled. | آپ کا اندراج منسوخ ہو گیا۔ |  | `journey.cancel.done` |
| 388 | Follows › Venue |  | Venue | مقام |  | `journey.follows.venue` |
| 389 | Follows › Circle |  | Circle | سرکل |  | `journey.follows.circle` |
| 390 | Follows › Unfollow |  | Unfollow | فالو ختم کریں |  | `journey.follows.unfollow` |
| 391 | Summary › Upcoming |  | Upcoming | آنے والے |  | `journey.summary.upcoming` |
| 392 | Summary › Waiting |  | On the waiting list | انتظار کی فہرست میں |  | `journey.summary.waiting` |
| 393 | Summary › Following |  | Following | فالو کیے ہوئے |  | `journey.summary.following` |

### Quran reader

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 394 | Title | heading | Quran | قرآن |  | `quran.title` |
| 395 | Tab › Quran |  | Quran | قرآن |  | `quran.tab.quran` |
| 396 | Tab › Prayer |  | Prayer times | نماز کے اوقات |  | `quran.tab.prayer` |
| 397 | Continue | button | Continue reading | پڑھنا جاری رکھیں |  | `quran.continue` |
| 398 | Surahs |  | Surahs | سورتیں |  | `quran.surahs` |
| 399 | Search |  | Find a surah | سورت ڈھونڈیں |  | `quran.search` |
| 400 | Bookmarks › Title | heading | Bookmarks | بک مارکس |  | `quran.bookmarks.title` |
| 401 | Bookmarks › Empty |  | No bookmarks yet. Tap the bookmark on any verse. | ابھی کوئی بک مارک نہیں۔ کسی آیت پر بک مارک کا نشان دبائیں۔ |  | `quran.bookmarks.empty` |
| 402 | Bookmark › Add | button | Add bookmark | بک مارک لگائیں |  | `quran.bookmark.add` |
| 403 | Bookmark › Remove | button | Remove bookmark | بک مارک ہٹائیں |  | `quran.bookmark.remove` |
| 404 | Translation › Show |  | Show English translation | اردو ترجمہ دکھائیں |  | `quran.translation.show` |
| 405 | Text size |  | Text size | متن کا سائز |  | `quran.textSize` |
| 406 | Offline › Save | button | Save for offline reading | آف لائن پڑھنے کے لیے محفوظ کریں |  | `quran.offline.save` |
| 407 | Offline › Saving |  | Saving: {percent}% | محفوظ ہو رہا ہے: {percent}% |  | `quran.offline.saving` |
| 408 | Offline › Saved |  | Saved on this phone | اس فون پر محفوظ ہے |  | `quran.offline.saved` |
| 409 | Offline › Unavailable |  | This part is not saved. Connect to the internet to read it. | یہ حصہ محفوظ نہیں۔ پڑھنے کے لیے انٹرنیٹ سے جڑیں۔ |  | `quran.offline.unavailable` |
| 410 | Search › Placeholder | placeholder inside an empty field | Surah name or number | سورت کا نام یا نمبر |  | `quran.search.placeholder` |
| 411 | Search › Empty › Title | heading | No surah found | کوئی سورت نہیں ملی |  | `quran.search.empty.title` |
| 412 | Search › Empty › Body | explanation text | Try a different spelling, or type a number from 1 to 114. | نام کے ہجے بدل کر دیکھیں، یا 1 سے 114 تک کوئی نمبر لکھیں۔ |  | `quran.search.empty.body` |
| 413 | Tab › Label | label read by screen readers or shown on a control | Browse the Quran | قرآن دیکھیں |  | `quran.tab.label` |
| 414 | Tab › Surah |  | Surahs | سورتیں |  | `quran.tab.surah` |
| 415 | Tab › Juz |  | Juz | پارے |  | `quran.tab.juz` |
| 416 | Tab › Bookmarks |  | Bookmarks | بک مارکس |  | `quran.tab.bookmarks` |
| 417 | Surah › Title | heading | Surah {name} | سورۃ {name} |  | `quran.surah.title` |
| 418 | Surah › Ayahs › One |  | {count} ayah | {count} آیت |  | `quran.surah.ayahs.one` |
| 419 | Surah › Ayahs › Other |  | {count} ayahs | {count} آیات |  | `quran.surah.ayahs.other` |
| 420 | Juz › Title | heading | Juz {number} | پارہ {number} |  | `quran.juz.title` |
| 421 | Juz › Starts |  | Starts at {surah}, ayah {ayah} | {surah}، آیت {ayah} سے شروع |  | `quran.juz.starts` |
| 422 | Ayah ref |  | {surah}, ayah {ayah} | {surah}، آیت {ayah} |  | `quran.ayahRef` |
| 423 | Bookmarks › Local only |  | Bookmarks are saved on this phone. Sign in to keep them on your account. | بک مارکس اس فون میں محفوظ ہیں۔ انہیں اپنے اکاؤنٹ میں رکھنے کے لیے سائن اِن کریں۔ |  | `quran.bookmarks.localOnly` |
| 424 | Bookmark › Add label | label read by screen readers or shown on a control | Bookmark ayah {number} | آیت {number} کو بک مارک کریں |  | `quran.bookmark.addLabel` |
| 425 | Bookmark › Remove label | label read by screen readers or shown on a control | Remove the bookmark from ayah {number} | آیت {number} سے بک مارک ہٹائیں |  | `quran.bookmark.removeLabel` |
| 426 | Bookmark › Remove item |  | Remove the bookmark for {place} | {place} کا بک مارک ہٹائیں |  | `quran.bookmark.removeItem` |
| 427 | Reader › Settings |  | Reading settings | پڑھنے کی ترتیبات |  | `quran.reader.settings` |
| 428 | Reader › Larger |  | Make the Arabic text larger | عربی متن بڑا کریں |  | `quran.reader.larger` |
| 429 | Reader › Smaller |  | Make the Arabic text smaller | عربی متن چھوٹا کریں |  | `quran.reader.smaller` |
| 430 | Reader › Size value |  | Size {step} of {total} | سائز {step} از {total} |  | `quran.reader.sizeValue` |
| 431 | Reader › Jump |  | Go to an ayah | آیت پر جائیں |  | `quran.reader.jump` |
| 432 | Reader › Jump › Label | label read by screen readers or shown on a control | Ayah number | آیت نمبر |  | `quran.reader.jump.label` |
| 433 | Reader › Jump › Go |  | Go | جائیں |  | `quran.reader.jump.go` |
| 434 | Reader › Jump › Invalid | error message | Type a number from 1 to {max}. | 1 سے {max} تک کوئی نمبر لکھیں۔ |  | `quran.reader.jump.invalid` |
| 435 | Reader › Jump › Invalid juz |  | Type an ayah that exists, such as 255 or 2:255. | کوئی موجود آیت لکھیں، جیسے 255 یا 2:255۔ |  | `quran.reader.jump.invalidJuz` |
| 436 | Reader › Surahs |  | Go to a surah | سورت پر جائیں |  | `quran.reader.surahs` |
| 437 | Reader › Previous surah |  | Previous surah | پچھلی سورت |  | `quran.reader.previousSurah` |
| 438 | Reader › Next surah |  | Next surah | اگلی سورت |  | `quran.reader.nextSurah` |
| 439 | Reader › Loading |  | Loading the Quran | قرآن لوڈ ہو رہا ہے |  | `quran.reader.loading` |
| 440 | Reader › Offline uncached |  | This part is not saved on your phone yet. Connect to the internet to read it. | یہ حصہ ابھی آپ کے فون میں محفوظ نہیں۔ اسے پڑھنے کے لیے انٹرنیٹ سے جڑیں۔ |  | `quran.reader.offlineUncached` |
| 441 | Reader › Stale note |  | Showing the copy saved on your phone. It could not be refreshed. | فون میں محفوظ نقل دکھائی جا رہی ہے۔ اسے تازہ نہیں کیا جا سکا۔ |  | `quran.reader.staleNote` |
| 442 | Reader › Translation missing |  | Translation not available | ترجمہ دستیاب نہیں |  | `quran.reader.translationMissing` |
| 443 | Reader › Open menu |  | Surahs and settings | سورتیں اور ترتیبات |  | `quran.reader.openMenu` |
| 444 | Ayah › Number |  | Ayah {number} | آیت {number} |  | `quran.ayah.number` |
| 445 | Share › Action |  | Share | شیئر کریں |  | `quran.share.action` |
| 446 | Share › Title | heading | Quran {key} | قرآن {key} |  | `quran.share.title` |
| 447 | Import › Title | heading | Bring over your old bookmarks | پرانے بک مارکس لے آئیں |  | `quran.import.title` |
| 448 | Import › Body › One |  | We found {count} bookmark saved in this browser. Add it to your account? | اس براؤزر میں {count} بک مارک محفوظ ملا۔ کیا اسے اپنے اکاؤنٹ میں شامل کریں؟ |  | `quran.import.body.one` |
| 449 | Import › Body › Other |  | We found {count} bookmarks saved in this browser. Add them to your account? | اس براؤزر میں {count} بک مارکس محفوظ ملے۔ کیا انہیں اپنے اکاؤنٹ میں شامل کریں؟ |  | `quran.import.body.other` |
| 450 | Import › Body place |  | We found the place you last read in this browser. Bring it over? | اس براؤزر میں آپ کی آخری پڑھی ہوئی جگہ ملی۔ کیا اسے لے آئیں؟ |  | `quran.import.bodyPlace` |
| 451 | Import › Action |  | Import | شامل کریں |  | `quran.import.action` |
| 452 | Import › Skip |  | No thanks | نہیں، شکریہ |  | `quran.import.skip` |
| 453 | Import › Working |  | Importing | شامل ہو رہا ہے |  | `quran.import.working` |
| 454 | Import › Done › One |  | Added {count} bookmark to your account. | آپ کے اکاؤنٹ میں {count} بک مارک شامل ہو گیا۔ |  | `quran.import.done.one` |
| 455 | Import › Done › Other |  | Added {count} bookmarks to your account. | آپ کے اکاؤنٹ میں {count} بک مارکس شامل ہو گئے۔ |  | `quran.import.done.other` |
| 456 | Import › Error |  | We could not import right now. Please try again. | ابھی شامل نہیں ہو سکا۔ براہِ کرم دوبارہ کوشش کریں۔ |  | `quran.import.error` |
| 457 | Credit › Arabic |  | Arabic text: Tanzil Project (tanzil.net) | عربی متن: تنزیل پروجیکٹ (tanzil.net) |  | `quran.credit.arabic` |
| 458 | Unavailable › Title | heading | Quran & Prayer is coming | قرآن اور نماز جلد آ رہے ہیں |  | `quran.unavailable.title` |
| 459 | Unavailable › Body | explanation text | Reading and prayer times are not in this version yet. | پڑھنا اور نماز کے اوقات ابھی اس ورژن میں شامل نہیں۔ |  | `quran.unavailable.body` |

### Reminders

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 460 | On |  | We will remind you before this session. | ہم اس نشست سے پہلے یاد دلائیں گے۔ |  | `reminders.on` |
| 461 | Off |  | Reminder turned off. | یاد دہانی بند کر دی گئی۔ |  | `reminders.off` |
| 462 | Denied |  | Reminders are blocked. Turn them on in your phone settings. | یاد دہانیاں بند ہیں۔ انہیں اپنے فون کی سیٹنگز میں آن کریں۔ |  | `reminders.denied` |
| 463 | Toggle › Description | explanation text | A reminder on this device. It is free and works without internet. | اس ڈیوائس پر یاد دہانی۔ یہ مفت ہے اور انٹرنیٹ کے بغیر بھی چلتی ہے۔ |  | `reminders.toggle.description` |
| 464 | Unsupported |  | Reminders need the phone app. Install it to get them. | یاد دہانیوں کے لیے فون ایپ چاہیے۔ انہیں پانے کے لیے ایپ انسٹال کریں۔ |  | `reminders.unsupported` |

### Session times

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 465 | Separator |  | ,  | ،  |  | `schedule.separator` |

### Sign in

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 466 | Title | heading | Sign in | سائن اِن |  | `signIn.title` |
| 467 | Phone › Intro | explanation text | Enter your mobile number. We will send a code on WhatsApp, or by SMS if WhatsApp is not available. | اپنا موبائل نمبر لکھیں۔ ہم واٹس ایپ پر کوڈ بھیجیں گے، اور اگر واٹس ایپ دستیاب نہ ہو تو ایس ایم ایس سے۔ |  | `signIn.phone.intro` |
| 468 | Phone › Label | label read by screen readers or shown on a control | Mobile number | موبائل نمبر |  | `signIn.phone.label` |
| 469 | Phone › Helper |  | For example 0300 1234567 | مثلاً 0300 1234567 |  | `signIn.phone.helper` |
| 470 | Phone › Submit | button | Send code | کوڈ بھیجیں |  | `signIn.phone.submit` |
| 471 | Code › Intro whatsapp |  | We sent a 6-digit code on WhatsApp. Enter it here. | ہم نے واٹس ایپ پر 6 ہندسوں کا کوڈ بھیجا ہے۔ یہاں لکھیں۔ |  | `signIn.code.introWhatsapp` |
| 472 | Code › Intro sms |  | We sent a 6-digit code by SMS. Enter it here. | ہم نے ایس ایم ایس پر 6 ہندسوں کا کوڈ بھیجا ہے۔ یہاں لکھیں۔ |  | `signIn.code.introSms` |
| 473 | Code › Label | label read by screen readers or shown on a control | 6-digit code | 6 ہندسوں کا کوڈ |  | `signIn.code.label` |
| 474 | Code › Submit | button | Sign in | سائن اِن کریں |  | `signIn.code.submit` |
| 475 | Code › Resend |  | Send the code again | کوڈ دوبارہ بھیجیں |  | `signIn.code.resend` |
| 476 | Code › Resend in › One |  | Send again in 1 second | 1 سیکنڈ بعد دوبارہ بھیجیں |  | `signIn.code.resendIn.one` |
| 477 | Code › Resend in › Other |  | Send again in {count} seconds | {count} سیکنڈ بعد دوبارہ بھیجیں |  | `signIn.code.resendIn.other` |
| 478 | Code › Use sms |  | Send it by SMS instead | اس کے بجائے ایس ایم ایس پر بھیجیں |  | `signIn.code.useSms` |
| 479 | Code › Change number |  | Use a different number | دوسرا نمبر استعمال کریں |  | `signIn.code.changeNumber` |
| 480 | Name › Intro | explanation text | What should we call you? You can skip this. | ہم آپ کو کس نام سے پکاریں؟ آپ اسے چھوڑ سکتے ہیں۔ |  | `signIn.name.intro` |
| 481 | Name › Label | label read by screen readers or shown on a control | Your name | آپ کا نام |  | `signIn.name.label` |
| 482 | Name › Submit | button | Save and continue | محفوظ کریں اور آگے بڑھیں |  | `signIn.name.submit` |
| 483 | Name › Skip |  | Skip for now | ابھی چھوڑیں |  | `signIn.name.skip` |
| 484 | Problem › Phone |  | Enter a Pakistani mobile number, such as 0300 1234567. | پاکستانی موبائل نمبر لکھیں، جیسے 0300 1234567۔ |  | `signIn.problem.phone` |
| 485 | Problem › Code |  | The code has 6 digits. | کوڈ 6 ہندسوں کا ہوتا ہے۔ |  | `signIn.problem.code` |
| 486 | Problem › Name |  | Enter a name of 1 to 80 letters. | 1 سے 80 حروف کا نام لکھیں۔ |  | `signIn.problem.name` |
| 487 | Retry after › One |  | Try again in 1 second. | 1 سیکنڈ بعد دوبارہ کوشش کریں۔ |  | `signIn.retryAfter.one` |
| 488 | Retry after › Other |  | Try again in {count} seconds. | {count} سیکنڈ بعد دوبارہ کوشش کریں۔ |  | `signIn.retryAfter.other` |

### Updates

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 489 | Title | heading | Updates | اطلاعات |  | `updates.title` |
| 490 | Signed out › Title | heading | Sign in to see updates | اطلاعات دیکھنے کے لیے سائن اِن کریں |  | `updates.signedOut.title` |
| 491 | Signed out › Body | explanation text | Updates from your venues and circles show here. | آپ کے مقامات اور سرکلز کی اطلاعات یہاں نظر آتی ہیں۔ |  | `updates.signedOut.body` |
| 492 | Signed out › Action |  | Sign in | سائن اِن |  | `updates.signedOut.action` |
| 493 | Empty › Title | heading | No updates yet | ابھی کوئی اطلاع نہیں |  | `updates.empty.title` |
| 494 | Empty › Body | explanation text | Follow a venue to hear about time changes and special lectures. | وقت کی تبدیلی اور خصوصی لیکچرز کی خبر کے لیے کسی مقام کو فالو کریں۔ |  | `updates.empty.body` |
| 495 | Mark all |  | Mark all as read | سب پڑھا ہوا کریں |  | `updates.markAll` |
| 496 | Unread marker |  | Unread | نہیں پڑھا |  | `updates.unreadMarker` |
| 497 | Kind › Announcement |  | Announcement | اعلان |  | `updates.kind.announcement` |
| 498 | Kind › Time change |  | Time change | وقت میں تبدیلی |  | `updates.kind.time_change` |
| 499 | Kind › Cancellation |  | Cancelled | منسوخ |  | `updates.kind.cancellation` |
| 500 | Kind › Special lecture |  | Special lecture | خصوصی لیکچر |  | `updates.kind.special_lecture` |
| 501 | Go to session |  | Go to session | نشست پر جائیں |  | `updates.goToSession` |

### Days read

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 502 | Title | heading | Days read | تلاوت کے دن |  | `daysRead.title` |
| 503 | Week |  | {read} of {total} days this week | اس ہفتے {total} میں سے {read} دن |  | `daysRead.week` |
| 504 | Month › One |  | 1 day this month | اس مہینے 1 دن |  | `daysRead.month.one` |
| 505 | Month › Other |  | {count} days this month | اس مہینے {count} دن |  | `daysRead.month.other` |
| 506 | Mark today |  | I read today | میں نے آج تلاوت کی |  | `daysRead.markToday` |
| 507 | Counted today |  | Today is counted | آج کا دن شمار ہو گیا |  | `daysRead.countedToday` |
| 508 | Goal |  | Your goal: {goal} a day | آپ کا ہدف: روزانہ {goal} |  | `daysRead.goal` |
| 509 | Goal met |  | I met today's goal | میں نے آج کا ہدف پورا کیا |  | `daysRead.goalMet` |
| 510 | Goal met done |  | Today's goal is counted | آج کا ہدف شمار ہو گیا |  | `daysRead.goalMetDone` |
| 511 | Set goal |  | Set a daily goal | روزانہ کا ہدف مقرر کریں |  | `daysRead.setGoal` |
| 512 | Signed out |  | Sign in to count the days you read. Only you can see them. | تلاوت کے دن شمار کرنے کے لیے سائن ان کریں۔ انہیں صرف آپ دیکھ سکتے ہیں۔ |  | `daysRead.signedOut` |
| 513 | Sign in |  | Sign in | سائن ان کریں |  | `daysRead.signIn` |
| 514 | Private |  | Only you can see your days read. | آپ کے تلاوت کے دن صرف آپ دیکھ سکتے ہیں۔ |  | `daysRead.private` |
| 515 | Error › Out of range | error message | This day can no longer be counted. Please check the date on your phone. | یہ دن اب شمار نہیں ہو سکتا۔ براہ کرم اپنے فون کی تاریخ دیکھ لیں۔ |  | `daysRead.error.outOfRange` |
| 516 | Unit › Pages › One |  | 1 page | 1 صفحہ |  | `daysRead.unit.pages.one` |
| 517 | Unit › Pages › Other |  | {count} pages | {count} صفحات |  | `daysRead.unit.pages.other` |
| 518 | Unit › Rukus › One |  | 1 ruku | 1 رکوع |  | `daysRead.unit.rukus.one` |
| 519 | Unit › Rukus › Other |  | {count} rukus | {count} رکوع |  | `daysRead.unit.rukus.other` |
| 520 | Unit › Minutes › One |  | 1 minute | 1 منٹ |  | `daysRead.unit.minutes.one` |
| 521 | Unit › Minutes › Other |  | {count} minutes | {count} منٹ |  | `daysRead.unit.minutes.other` |

### Read together today card

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 522 | Title | heading | Read together today | آج مل کر تلاوت |  | `communityToday.title` |
| 523 | Readers › One |  | 1 person read today | آج 1 شخص نے تلاوت کی |  | `communityToday.readers.one` |
| 524 | Readers › Other |  | {count} people read today | آج {count} لوگوں نے تلاوت کی |  | `communityToday.readers.other` |
| 525 | Pages › One |  | 1 page read together | مل کر 1 صفحہ پڑھا گیا |  | `communityToday.pages.one` |
| 526 | Pages › Other |  | {count} pages read together | مل کر {count} صفحات پڑھے گئے |  | `communityToday.pages.other` |

### Read tonight's portion

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 527 | Eyebrow |  | Read along | ساتھ پڑھیں |  | `readAlong.eyebrow` |
| 528 | Title | heading | Read tonight's portion | آج کی نشست کا حصہ پڑھیں |  | `readAlong.title` |
| 529 | Session |  | {session}, {time} | {session}، {time} |  | `readAlong.session` |
| 530 | Open | button | Start reading | پڑھنا شروع کریں |  | `readAlong.open` |

### Memorisation

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 531 | Title | heading | Memorisation | حفظ |  | `memorisation.title` |
| 532 | Status › Learning |  | Learning | یاد کر رہے ہیں |  | `memorisation.status.learning` |
| 533 | Status › Memorised |  | Memorised | یاد ہے |  | `memorisation.status.memorised` |
| 534 | Status › Revising |  | Revising | دہرا رہے ہیں |  | `memorisation.status.revising` |
| 535 | Revise › Title | heading | Revise this week | اس ہفتے دہرائیں |  | `memorisation.revise.title` |
| 536 | Revise › Note › One |  | Memorised surahs you have not marked revised for 1 day. No reminders are sent. | یاد کی ہوئی وہ سورتیں جنہیں آپ نے 1 دن سے دہرایا ہوا نشان نہیں کیا۔ کوئی یاد دہانی نہیں بھیجی جاتی۔ |  | `memorisation.revise.note.one` |
| 537 | Revise › Note › Other |  | Memorised surahs you have not marked revised for {count} days. No reminders are sent. | یاد کی ہوئی وہ سورتیں جنہیں آپ نے {count} دن سے دہرایا ہوا نشان نہیں کیا۔ کوئی یاد دہانی نہیں بھیجی جاتی۔ |  | `memorisation.revise.note.other` |
| 538 | Revise › Empty |  | Nothing to revise this week. | اس ہفتے دہرانے کے لیے کچھ نہیں۔ |  | `memorisation.revise.empty` |
| 539 | Mark revised |  | Mark revised | دہرا لی |  | `memorisation.markRevised` |
| 540 | Mark revised for |  | Mark {surah} revised | {surah} دہرا لی |  | `memorisation.markRevisedFor` |
| 541 | Revised › Done | button | Marked revised | دہرانا درج ہو گیا |  | `memorisation.revised.done` |
| 542 | Last revised |  | Last revised {date} | آخری بار دہرائی: {date} |  | `memorisation.lastRevised` |
| 543 | Never revised |  | Not revised yet | ابھی نہیں دہرائی |  | `memorisation.neverRevised` |
| 544 | List › Title | heading | Your surahs | آپ کی سورتیں |  | `memorisation.list.title` |
| 545 | List › Empty |  | Mark a surah you are learning or have memorised. | وہ سورت منتخب کریں جو آپ یاد کر رہے ہیں یا جو آپ کو یاد ہے۔ |  | `memorisation.list.empty` |
| 546 | Add › Label | label read by screen readers or shown on a control | Mark a surah | سورت پر نشان لگائیں |  | `memorisation.add.label` |
| 547 | Add › Placeholder | placeholder inside an empty field | Choose a surah | سورت چنیں |  | `memorisation.add.placeholder` |
| 548 | Clear | button | Clear the mark | نشان ہٹائیں |  | `memorisation.clear` |
| 549 | Saved |  | Saved | محفوظ ہو گیا |  | `memorisation.saved` |
| 550 | Error |  | That did not save. Please try again. | یہ محفوظ نہیں ہوا۔ براہ کرم دوبارہ کوشش کریں۔ |  | `memorisation.error` |
| 551 | Private |  | Only you can see your memorisation. | آپ کا حفظ صرف آپ دیکھ سکتے ہیں۔ |  | `memorisation.private` |
| 552 | Signed out |  | Sign in to keep track of the surahs you are learning. It is saved to your account and only you can see it. | جو سورتیں آپ یاد کر رہے ہیں ان کا ریکارڈ رکھنے کے لیے سائن ان کریں۔ یہ آپ کے اکاؤنٹ میں محفوظ رہتا ہے اور صرف آپ دیکھ سکتے ہیں۔ |  | `memorisation.signedOut` |
| 553 | Sign in |  | Sign in | سائن ان کریں |  | `memorisation.signIn` |
| 554 | Off |  | The memorisation tracker is not available yet. | حفظ کا ریکارڈ ابھی دستیاب نہیں۔ |  | `memorisation.off` |
| 555 | Summary › Start |  | Keep track of the surahs you are learning | جو سورتیں آپ یاد کر رہے ہیں ان کا ریکارڈ رکھیں |  | `memorisation.summary.start` |
| 556 | Summary › Due › One |  | 1 surah to revise this week | اس ہفتے دہرانے کے لیے 1 سورت |  | `memorisation.summary.due.one` |
| 557 | Summary › Due › Other |  | {count} surahs to revise this week | اس ہفتے دہرانے کے لیے {count} سورتیں |  | `memorisation.summary.due.other` |


## Credits and licences screen

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 558 | Title | heading | About and credits | تعارف اور اعترافات |  | `credits.title` |
| 559 | Open | button | About and credits | تعارف اور اعترافات |  | `credits.open` |
| 560 | Intro | explanation text | Quran Circles is free. It is built on the work of others, credited here with thanks. | قرآن سرکلز مفت ہے۔ یہ دوسروں کے کام پر بنی ہے، جن کا یہاں شکریے کے ساتھ ذکر ہے۔ |  | `credits.intro` |
| 561 | Fonts › Heading |  | Fonts | فونٹ |  | `credits.fonts.heading` |
| 562 | Figtree › Name |  | Figtree | Figtree |  | `credits.figtree.name` |
| 563 | Figtree › Body | explanation text | © 2022 The Figtree Project Authors. SIL Open Font License 1.1. | © 2022 The Figtree Project Authors۔ SIL اوپن فونٹ لائسنس 1.1۔ |  | `credits.figtree.body` |
| 564 | Figtree › Link |  | Licence: SIL OFL 1.1 | لائسنس: SIL OFL 1.1 |  | `credits.figtree.link` |
| 565 | Mehr › Name |  | Mehr Nastaliq Web | مہر نستعلیق ویب (Mehr Nastaliq Web) |  | `credits.mehr.name` |
| 566 | Mehr › Body | explanation text | © Mehr Type, with the Center for Speech and Language Technologies (CSaLT), Information Technology University of the Punjab, Lahore. CC BY-SA 4.0. Used unmodified. | © مہر ٹائپ، سینٹر فار اسپیچ اینڈ لینگویج ٹیکنالوجیز (CSaLT)، انفارمیشن ٹیکنالوجی یونیورسٹی آف دی پنجاب، لاہور کے اشتراک سے۔ CC BY-SA 4.0۔ بغیر کسی تبدیلی کے استعمال کیا گیا۔ |  | `credits.mehr.body` |
| 567 | Mehr › Link |  | Licence: CC BY-SA 4.0 | لائسنس: CC BY-SA 4.0 |  | `credits.mehr.link` |
| 568 | Kfgqpc › Name |  | KFGQPC Uthmanic Script HAFS | KFGQPC Uthmanic Script HAFS |  | `credits.kfgqpc.name` |
| 569 | Kfgqpc › Body | explanation text | © King Fahd Glorious Qur'an Printing Complex, Madinah. Free to use and share, not for sale. Used unmodified. | © شاہ فہد قرآن کریم پرنٹنگ کمپلیکس، مدینہ منورہ۔ استعمال اور تقسیم مفت، فروخت کی اجازت نہیں۔ بغیر کسی تبدیلی کے استعمال کیا گیا۔ |  | `credits.kfgqpc.body` |
| 570 | Kfgqpc › Link |  | fonts.qurancomplex.gov.sa | fonts.qurancomplex.gov.sa |  | `credits.kfgqpc.link` |
| 571 | Text › Heading |  | Quran text and translations | قرآن کا متن اور تراجم |  | `credits.text.heading` |
| 572 | Tanzil › Name |  | Quran text: Tanzil Project | قرآن کا متن: تنزیل پروجیکٹ |  | `credits.tanzil.name` |
| 573 | Tanzil › Body | explanation text | The Arabic text comes from the Tanzil Project, CC BY 3.0, used verbatim. | عربی متن تنزیل پروجیکٹ سے لیا گیا ہے، CC BY 3.0، بغیر کسی تبدیلی کے۔ |  | `credits.tanzil.body` |
| 574 | Tanzil › Link |  | tanzil.net | tanzil.net |  | `credits.tanzil.link` |
| 575 | Translation ur › Name |  | Urdu translation | اردو ترجمہ |  | `credits.translationUr.name` |
| 576 | Translation ur › Body | explanation text | Abul A'la Maududi, Tafhim al-Qur'an. Via Tanzil.net, for non-commercial use. | سید ابوالاعلیٰ مودودی، تفہیم القرآن۔ تنزیل کے ذریعے، غیر تجارتی استعمال کے لیے۔ |  | `credits.translationUr.body` |
| 577 | Translation en › Name |  | English translation | انگریزی ترجمہ |  | `credits.translationEn.name` |
| 578 | Translation en › Body | explanation text | Abul A'la Maududi, Towards Understanding the Qur'an, translated by Zafar Ishaq Ansari. Via Tanzil.net, for non-commercial use. | سید ابوالاعلیٰ مودودی، Towards Understanding the Qur'an، ترجمہ: ظفر اسحاق انصاری۔ تنزیل کے ذریعے، غیر تجارتی استعمال کے لیے۔ |  | `credits.translationEn.body` |
| 579 | Console › Heading |  | Credits | اعترافات |  | `credits.console.heading` |


## Error messages (all apps)

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 580 | Validation failed |  | Some details are missing or not valid. Please check and try again. | کچھ معلومات ادھوری یا درست نہیں ہیں۔ براہ کرم دیکھ کر دوبارہ کوشش کریں۔ |  | `errors.validation_failed` |
| 581 | Unauthenticated |  | Please sign in to continue. | جاری رکھنے کے لیے براہ کرم سائن اِن کریں۔ |  | `errors.unauthenticated` |
| 582 | Token expired |  | Your sign-in has expired. Please sign in again. | آپ کا سائن اِن ختم ہو گیا ہے۔ براہ کرم دوبارہ سائن اِن کریں۔ |  | `errors.token_expired` |
| 583 | Refresh token invalid | error message | Please sign in again. | براہ کرم دوبارہ سائن اِن کریں۔ |  | `errors.refresh_token_invalid` |
| 584 | Forbidden |  | You do not have permission to do this. | آپ کو یہ کام کرنے کی اجازت نہیں ہے۔ |  | `errors.forbidden` |
| 585 | Account suspended |  | This account is not active. Please contact support. | یہ اکاؤنٹ فعال نہیں ہے۔ براہ کرم مدد سے رابطہ کریں۔ |  | `errors.account_suspended` |
| 586 | Not found |  | We could not find what you were looking for. | جو آپ ڈھونڈ رہے تھے وہ نہیں ملا۔ |  | `errors.not_found` |
| 587 | Conflict |  | This clashes with something that already exists. Please refresh and try again. | یہ پہلے سے موجود کسی چیز سے ٹکرا رہا ہے۔ براہ کرم صفحہ تازہ کر کے دوبارہ کوشش کریں۔ |  | `errors.conflict` |
| 588 | Rate limited |  | Too many tries. Please wait a little and try again. | بہت زیادہ کوششیں ہو گئیں۔ براہ کرم تھوڑا انتظار کر کے دوبارہ کوشش کریں۔ |  | `errors.rate_limited` |
| 589 | Internal error |  | Something went wrong on our side. Please try again. | ہماری طرف سے کچھ خرابی ہو گئی۔ براہ کرم دوبارہ کوشش کریں۔ |  | `errors.internal_error` |
| 590 | Service unavailable |  | The service is busy right now. Please try again in a few minutes. | سروس اس وقت مصروف ہے۔ براہ کرم چند منٹ بعد دوبارہ کوشش کریں۔ |  | `errors.service_unavailable` |
| 591 | Otp invalid | error message | That code is not right. Please check it and try again. | یہ کوڈ درست نہیں ہے۔ براہ کرم دیکھ کر دوبارہ کوشش کریں۔ |  | `errors.otp_invalid` |
| 592 | Otp expired |  | That code has expired. Please ask for a new one. | اس کوڈ کی مدت ختم ہو گئی ہے۔ براہ کرم نیا کوڈ منگوائیں۔ |  | `errors.otp_expired` |
| 593 | Otp too many attempts |  | Too many wrong codes. Please wait before trying again. | بہت زیادہ غلط کوڈ ڈالے گئے۔ براہ کرم کچھ دیر بعد کوشش کریں۔ |  | `errors.otp_too_many_attempts` |
| 594 | Already registered |  | You are already registered for this session. | آپ اس نشست کے لیے پہلے ہی رجسٹر ہیں۔ |  | `errors.already_registered` |
| 595 | Registration closed |  | Registration for this session is closed. | اس نشست کے لیے رجسٹریشن بند ہے۔ |  | `errors.registration_closed` |
| 596 | Session full |  | This session is full. | یہ نشست بھر چکی ہے۔ |  | `errors.session_full` |
| 597 | Session cancelled |  | This session has been cancelled. | یہ نشست منسوخ ہو چکی ہے۔ |  | `errors.session_cancelled` |
| 598 | Occurrence in past |  | This session has already taken place. | یہ نشست ہو چکی ہے۔ |  | `errors.occurrence_in_past` |
| 599 | Circle not pending |  | This circle is not waiting for approval. | یہ سرکل منظوری کا منتظر نہیں ہے۔ |  | `errors.circle_not_pending` |
| 600 | Circle request exists |  | You have already asked for a circle in this area. | آپ اس علاقے میں سرکل کی درخواست پہلے ہی دے چکے ہیں۔ |  | `errors.circle_request_exists` |
| 601 | Role already assigned |  | This person already has this role. | اس شخص کے پاس یہ ذمہ داری پہلے سے ہے۔ |  | `errors.role_already_assigned` |
| 602 | Last national admin |  | There must always be at least one national admin. | کم از کم ایک قومی ایڈمن ہمیشہ موجود ہونا چاہیے۔ |  | `errors.last_national_admin` |
| 603 | Invite expired |  | This invitation has expired. | اس دعوت کی مدت ختم ہو گئی ہے۔ |  | `errors.invite_expired` |


## Men, women, family labels (all apps)

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 604 | Women |  | Women | خواتین |  | `sections.women` |
| 605 | Men |  | Men | مرد |  | `sections.men` |
| 606 | Family |  | Family | فیملی |  | `sections.family` |


## Programme names (all apps)

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 607 | Dora |  | Dora | دورہ |  | `programs.dora` |
| 608 | Circles |  | Weekly circles | ہفتہ وار سرکل |  | `programs.circles` |
| 609 | Programme | programme name stored in the database | Dora | دورہ |  | `program.dora` |
| 610 | Programme | programme name stored in the database | Circles | حلقے |  | `program.circles` |


## Shared buttons and labels (all apps)

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 611 | Close |  | Close | بند کریں |  | `ui.close` |
| 612 | Back | button | Back | واپس |  | `ui.back` |
| 613 | Loading |  | Loading | لوڈ ہو رہا ہے |  | `ui.loading` |
| 614 | Dismiss |  | Dismiss | ہٹائیں |  | `ui.dismiss` |
| 615 | Retry | button | Try again | دوبارہ کوشش کریں |  | `ui.retry` |
| 616 | Unread |  | {count} unread | {count} نئے |  | `ui.unread` |
| 617 | New updates |  | New updates | نئی اپڈیٹس |  | `ui.newUpdates` |
| 618 | Select placeholder |  | Choose one | منتخب کریں |  | `ui.selectPlaceholder` |
| 619 | Required | error message | Required | ضروری |  | `ui.required` |
| 620 | Optional |  | Optional | اختیاری |  | `ui.optional` |
| 621 | On |  | On | آن |  | `ui.on` |
| 622 | Off |  | Off | آف |  | `ui.off` |
| 623 | Remove | button | Remove {name} | {name} ہٹائیں |  | `ui.remove` |
| 624 | Error title |  | Something went wrong | کچھ گڑبڑ ہو گئی |  | `ui.errorTitle` |
| 625 | Error body |  | We could not load this. Please try again. | یہ لوڈ نہیں ہو سکا۔ براہ کرم دوبارہ کوشش کریں۔ |  | `ui.errorBody` |
| 626 | Offline title |  | You are offline | آپ آف لائن ہیں |  | `ui.offlineTitle` |
| 627 | Offline body |  | Check your internet connection, then try again. | اپنا انٹرنیٹ کنکشن دیکھیں، پھر دوبارہ کوشش کریں۔ |  | `ui.offlineBody` |
| 628 | Clear search |  | Clear search | تلاش صاف کریں |  | `ui.clearSearch` |
| 629 | Seats left |  | {count} places left | {count} جگہیں باقی |  | `ui.seatsLeft` |
| 630 | Seats left one |  | 1 place left | 1 جگہ باقی |  | `ui.seatsLeftOne` |
| 631 | Seats full |  | Full | مکمل |  | `ui.seatsFull` |
| 632 | Seats no limit |  | No limit on places | جگہوں کی کوئی حد نہیں |  | `ui.seatsNoLimit` |


## Venue facilities (all apps)

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 633 | Women section |  | Women's section | خواتین کا حصہ |  | `facilities.womenSection` |
| 634 | Parking |  | Parking | پارکنگ |  | `facilities.parking` |
| 635 | Wudu area |  | Wudu area | وضو کی جگہ |  | `facilities.wuduArea` |
| 636 | Elder wheelchair access |  | Access for elders and wheelchairs | بزرگوں اور وہیل چیئر کے لیے رسائی |  | `facilities.elderWheelchairAccess` |
| 637 | Child friendly |  | Child friendly | بچوں کے لیے موزوں |  | `facilities.childFriendly` |
| 638 | Entrance notes |  | How to find the entrance | داخلے کا راستہ |  | `facilities.entranceNotes` |
| 639 | Available |  | Available | دستیاب |  | `facilities.available` |
| 640 | Not listed |  | Not listed | درج نہیں |  | `facilities.notListed` |


## Weekday names (all apps)

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 641 | Mon |  | Monday | پیر |  | `days.mon` |
| 642 | Tue |  | Tuesday | منگل |  | `days.tue` |
| 643 | Wed |  | Wednesday | بدھ |  | `days.wed` |
| 644 | Thu |  | Thursday | جمعرات |  | `days.thu` |
| 645 | Fri |  | Friday | جمعہ |  | `days.fri` |
| 646 | Sat |  | Saturday | ہفتہ |  | `days.sat` |
| 647 | Sun |  | Sunday | اتوار |  | `days.sun` |


## Phone notifications

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 648 | Time change › Title | heading | Time change: {sessionTitle} | وقت میں تبدیلی: {sessionTitle} |  | `notifications.timeChange.title` |
| 649 | Cancelled › Title | heading | Cancelled: {sessionTitle} | منسوخ: {sessionTitle} |  | `notifications.cancelled.title` |
| 650 | Waitlist promoted › Title | heading | A seat opened up | ایک نشست خالی ہو گئی |  | `notifications.waitlistPromoted.title` |
| 651 | Reminder › Title | heading | Session reminder | نشست کی یاد دہانی |  | `notifications.reminder.title` |
| 652 | Reminder › Body | explanation text | {sessionTitle} at {venueName}, {when} | {venueName} میں {sessionTitle}، {when} |  | `notifications.reminder.body` |
| 653 | Ayah › Title | heading | Ayah of the day | آج کی آیت |  | `notifications.ayah.title` |
| 654 | Ayah › Body | explanation text | Surah {surah}, ayah {ayah}. Tap to read it. | سورہ نمبر {surah}، آیت {ayah}۔ پڑھنے کے لیے ٹیپ کریں۔ |  | `notifications.ayah.body` |
| 655 | Channel |  | Session reminders | نشست کی یاد دہانیاں |  | `notifications.channel` |


## WhatsApp, SMS and push messages

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 656 | Auth code | message sent to people (whatsapp, sms) | {code} is your Quran Circles code. It works for {minutes} minutes. Do not share it. | آپ کا قرآن سرکلز کوڈ {code} ہے۔ یہ {minutes} منٹ تک کارآمد ہے۔ اسے کسی کو نہ بتائیں۔ |  | `auth_code` |
| 657 | Registration confirmation | message sent to people (whatsapp, push) | Assalamu alaikum {name}. You are registered for {sessionTitle} at {venueName}, {when}. Details: {link} | السلام علیکم {name}۔ آپ {venueName} میں {sessionTitle} کے لیے رجسٹر ہو گئے ہیں، {when}۔ تفصیل: {link} |  | `registration_confirmation` |
| 658 | Session reminder | message sent to people (push, whatsapp) | Reminder: {sessionTitle} at {venueName}, {when}. {link} | یاد دہانی: {venueName} میں {sessionTitle}، {when}۔ {link} |  | `session_reminder` |
| 659 | Session changed | message sent to people (push, whatsapp) | Change: {sessionTitle} at {venueName} is now {newWhen}. {link} | تبدیلی: {venueName} میں {sessionTitle} اب {newWhen} ہو گا۔ {link} |  | `session_changed` |
| 660 | Session cancelled | message sent to people (push, whatsapp) | Cancelled: {sessionTitle}, {when}. {link} | منسوخ: {sessionTitle}، {when}۔ {link} |  | `session_cancelled` |
| 661 | Waitlist promoted | message sent to people (push, whatsapp) | A seat opened up. You are now registered for {sessionTitle}, {when}. {link} | ایک نشست خالی ہو گئی۔ اب آپ {sessionTitle} کے لیے رجسٹر ہیں، {when}۔ {link} |  | `waitlist_promoted` |
| 662 | Coordinator invite | message sent to people (whatsapp, sms) | {inviterName} invited you to help run {scopeName} on Quran Circles. Sign in with this number: {link} | {inviterName} نے آپ کو قرآن سرکلز پر {scopeName} چلانے کی دعوت دی ہے۔ اسی نمبر سے سائن اِن کریں: {link} |  | `coordinator_invite` |
| 663 | Circle opened | message sent to people (push, whatsapp) | A new circle opened in {areaName}: {circleName}. {link} | {areaName} میں نیا سرکل شروع ہوا: {circleName}۔ {link} |  | `circle_opened` |
| 664 | Replies that stop or restart messages | words people may type back; any of these stops or restarts messages | stop / unsubscribe … \| start / subscribe … | بند، روکیں، روکیے، سٹاپ \| شروع |  | `whatsapp.optOutWords` |


## Posters and share cards

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 665 | Scan to register | printed on the poster | Scan to register | رجسٹریشن کے لیے اسکین کریں |  | `poster.scanToRegister` |
| 666 | Scan to open | printed on the poster | Scan to open in the app | ایپ میں کھولنے کے لیے اسکین کریں |  | `poster.scanToOpen` |
| 667 | Daily at | printed on the poster | Every day at {time} | ہر روز {time} بجے |  | `poster.dailyAt` |
| 668 | On date at | printed on the poster | {date} at {time} | {date}، {time} بجے |  | `poster.onDateAt` |
| 669 | List and | printed on the poster |  and  |  اور  |  | `poster.listAnd` |
| 670 | List comma | printed on the poster | ,  | ،  |  | `poster.listComma` |
| 671 | Period › Morning | printed on the poster | am | صبح |  | `poster.period.morning` |
| 672 | Period › Noon | printed on the poster | pm | دوپہر |  | `poster.period.noon` |
| 673 | Period › Evening | printed on the poster | pm | شام |  | `poster.period.evening` |
| 674 | Period › Night | printed on the poster | pm | رات |  | `poster.period.night` |
| 675 | Period › Late night | printed on the poster | am | رات |  | `poster.period.lateNight` |
| 676 | Alt | printed on the poster | {title}: Quran circle at {venue}, {when} | {title}: {venue} میں قرآن حلقہ، {when} |  | `poster.alt` |


## Admin app (coordinators)

### Registrants

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 677 | Title | heading | Today's registrants | آج کے رجسٹر شدہ لوگ |  | `admin.registrants.title` |
| 678 | Session |  | Session | نشست |  | `admin.registrants.session` |
| 679 | Search |  | Search by name | نام سے تلاش کریں |  | `admin.registrants.search` |
| 680 | Filter › All | filter option | All | سب |  | `admin.registrants.filter.all` |
| 681 | Filter › Waitlist | filter option | Waiting list | انتظار کی فہرست |  | `admin.registrants.filter.waitlist` |
| 682 | Total › One |  | 1 person coming | 1 شخص آ رہا ہے |  | `admin.registrants.total.one` |
| 683 | Total › Other |  | {count} people coming | {count} لوگ آ رہے ہیں |  | `admin.registrants.total.other` |
| 684 | Party |  | Party of {count} | {count} افراد |  | `admin.registrants.party` |
| 685 | Call |  | Call | کال کریں |  | `admin.registrants.call` |
| 686 | Whatsapp |  | Message on WhatsApp | واٹس ایپ پر پیغام بھیجیں |  | `admin.registrants.whatsapp` |
| 687 | Waitlisted |  | Waiting list | انتظار کی فہرست |  | `admin.registrants.waitlisted` |
| 688 | Empty › Title | heading | No one has registered yet | ابھی کسی نے رجسٹر نہیں کیا |  | `admin.registrants.empty.title` |
| 689 | Empty › Body | explanation text | People who register will appear here. | رجسٹر کرنے والے یہاں نظر آئیں گے۔ |  | `admin.registrants.empty.body` |
| 690 | Offline |  | You are offline. This list is from {time}. | آپ آف لائن ہیں۔ یہ فہرست {time} کی ہے۔ |  | `admin.registrants.offline` |
| 691 | Date |  | Date | تاریخ |  | `admin.registrants.date` |
| 692 | Status › Label | label read by screen readers or shown on a control | Status | حالت |  | `admin.registrants.status.label` |
| 693 | Confirmed |  | Coming | آ رہے ہیں |  | `admin.registrants.confirmed` |
| 694 | More |  | Show more | مزید دکھائیں |  | `admin.registrants.more` |
| 695 | No name |  | No name given | نام نہیں دیا |  | `admin.registrants.noName` |
| 696 | No phone |  | No phone number | فون نمبر نہیں |  | `admin.registrants.noPhone` |
| 697 | Call name |  | Call {name} | {name} کو کال کریں |  | `admin.registrants.callName` |
| 698 | Whatsapp name |  | Message {name} on WhatsApp | {name} کو واٹس ایپ پر پیغام بھیجیں |  | `admin.registrants.whatsappName` |
| 699 | Section › Women |  | Women | خواتین |  | `admin.registrants.section.women` |
| 700 | Section › Men |  | Men | مرد |  | `admin.registrants.section.men` |
| 701 | Section › Family |  | Families | خاندان |  | `admin.registrants.section.family` |
| 702 | Stat › People |  | People | لوگ |  | `admin.registrants.stat.people` |
| 703 | Stat › Registrations |  | Registrations | رجسٹریشنز |  | `admin.registrants.stat.registrations` |
| 704 | Stat › Waitlisted |  | Waiting | انتظار میں |  | `admin.registrants.stat.waitlisted` |
| 705 | No match |  | No one matches your search. | آپ کی تلاش سے کوئی نام نہیں ملتا۔ |  | `admin.registrants.noMatch` |
| 706 | Take attendance |  | Take attendance | حاضری لگائیں |  | `admin.registrants.takeAttendance` |

### Post update

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 707 | Title | heading | Post an update | اپڈیٹ بھیجیں |  | `admin.postUpdate.title` |
| 708 | Audience › Label | label read by screen readers or shown on a control | Who should see this? | یہ کسے نظر آئے؟ |  | `admin.postUpdate.audience.label` |
| 709 | Audience › Followers |  | People who follow {venue} | جو لوگ {venue} کو فالو کرتے ہیں |  | `admin.postUpdate.audience.followers` |
| 710 | Audience › Registered |  | People registered for this session | اس نشست کے لیے رجسٹر شدہ لوگ |  | `admin.postUpdate.audience.registered` |
| 711 | Template › Label | label read by screen readers or shown on a control | Start from a template | نمونے سے شروع کریں |  | `admin.postUpdate.template.label` |
| 712 | Template › None |  | Write my own | اپنا لکھیں |  | `admin.postUpdate.template.none` |
| 713 | Body › Label | label read by screen readers or shown on a control | Message | پیغام |  | `admin.postUpdate.body.label` |
| 714 | Body › Help |  | Keep it short and clear. | مختصر اور صاف لکھیں۔ |  | `admin.postUpdate.body.help` |
| 715 | Body › Error |  | Write a message. | پیغام لکھیں۔ |  | `admin.postUpdate.body.error` |
| 716 | Body › Count |  | {count} of {max} characters | {count} از {max} حروف |  | `admin.postUpdate.body.count` |
| 717 | Channel › App |  | App notification | ایپ نوٹیفکیشن |  | `admin.postUpdate.channel.app` |
| 718 | Channel › Whatsapp |  | WhatsApp, only for people who agreed | واٹس ایپ، صرف ان کے لیے جنہوں نے اجازت دی |  | `admin.postUpdate.channel.whatsapp` |
| 719 | Preview |  | Preview | پیش نظارہ |  | `admin.postUpdate.preview` |
| 720 | Submit | button | Post update | اپڈیٹ بھیجیں |  | `admin.postUpdate.submit` |
| 721 | Confirm › Title | heading | Send to {count} people? | کیا {count} لوگوں کو بھیجیں؟ |  | `admin.postUpdate.confirm.title` |
| 722 | Confirm › Body | explanation text | You cannot take it back after it is sent. | بھیجنے کے بعد اسے واپس نہیں لیا جا سکتا۔ |  | `admin.postUpdate.confirm.body` |
| 723 | Confirm › Send | button | Send | بھیجیں |  | `admin.postUpdate.confirm.send` |
| 724 | Confirm › Cancel | button | Not yet | ابھی نہیں |  | `admin.postUpdate.confirm.cancel` |
| 725 | Success |  | Update posted. | اپڈیٹ بھیج دی گئی۔ |  | `admin.postUpdate.success` |
| 726 | Subtitle |  | Tell people about a change or a reminder | لوگوں کو تبدیلی یا یاد دہانی کے بارے میں بتائیں |  | `admin.postUpdate.subtitle` |
| 727 | About |  | About this session | اس سیشن کے بارے میں |  | `admin.postUpdate.about` |
| 728 | Who for |  | Who is it for? | یہ کن کے لیے ہے؟ |  | `admin.postUpdate.whoFor` |
| 729 | Level › National |  | Everyone | سب |  | `admin.postUpdate.level.national` |
| 730 | Level › City |  | A city | ایک شہر |  | `admin.postUpdate.level.city` |
| 731 | Level › Venue |  | A venue | ایک جگہ |  | `admin.postUpdate.level.venue` |
| 732 | Reach › National |  | People who follow any venue | کسی بھی جگہ کو فالو کرنے والے |  | `admin.postUpdate.reach.national` |
| 733 | Reach › City |  | People who follow venues in {name} | {name} کی جگہوں کو فالو کرنے والے |  | `admin.postUpdate.reach.city` |
| 734 | Reach › Venue |  | People who follow {name} | {name} کو فالو کرنے والے |  | `admin.postUpdate.reach.venue` |
| 735 | No scope |  | Your role cannot post updates. | آپ کا کردار اپ ڈیٹ بھیجنے کی اجازت نہیں دیتا۔ |  | `admin.postUpdate.noScope` |
| 736 | Template › Help |  | Fill in the blanks below. You can still change the words. | نیچے خالی جگہیں بھریں۔ الفاظ پھر بھی بدلے جا سکتے ہیں۔ |  | `admin.postUpdate.template.help` |
| 737 | Title › Label | label read by screen readers or shown on a control | Title | عنوان |  | `admin.postUpdate.title.label` |
| 738 | Language › Help |  | Write in one language or both. People see their own language when you wrote it. | ایک زبان میں لکھیں یا دونوں میں۔ لوگ اپنی زبان میں دیکھیں گے اگر آپ نے اس میں لکھا ہو۔ |  | `admin.postUpdate.language.help` |
| 739 | Notify › Label | label read by screen readers or shown on a control | Send a notification | اطلاع بھی بھیجیں |  | `admin.postUpdate.notify.label` |
| 740 | Notify › Help |  | Off means it only appears in the feed. | بند ہو تو یہ صرف فیڈ میں نظر آئے گی۔ |  | `admin.postUpdate.notify.help` |
| 741 | Who will see |  | Who will see it | کون دیکھے گا |  | `admin.postUpdate.whoWillSee` |
| 742 | Will notify |  | They will also get a notification. | انہیں اطلاع بھی ملے گی۔ |  | `admin.postUpdate.willNotify` |
| 743 | Feed only |  | It appears in the feed only. No notification. | یہ صرف فیڈ میں نظر آئے گی۔ اطلاع نہیں جائے گی۔ |  | `admin.postUpdate.feedOnly` |
| 744 | Send | button | Send now | ابھی بھیجیں |  | `admin.postUpdate.send` |
| 745 | Edit |  | Change it | بدلیں |  | `admin.postUpdate.edit` |
| 746 | Sent title |  | Update posted | اپ ڈیٹ بھیج دی گئی |  | `admin.postUpdate.sentTitle` |
| 747 | Sent to › One |  | Sent to 1 person | 1 شخص کو بھیجی گئی |  | `admin.postUpdate.sentTo.one` |
| 748 | Sent to › Other |  | Sent to {count} people | {count} لوگوں کو بھیجی گئی |  | `admin.postUpdate.sentTo.other` |
| 749 | Sent notified |  | They were also notified. | انہیں اطلاع بھی بھیجی گئی۔ |  | `admin.postUpdate.sentNotified` |
| 750 | Sent feed only |  | It is in the feed. No notification was sent. | یہ فیڈ میں ہے۔ اطلاع نہیں بھیجی گئی۔ |  | `admin.postUpdate.sentFeedOnly` |
| 751 | Another |  | Post another | ایک اور بھیجیں |  | `admin.postUpdate.another` |
| 752 | Error › Scope | error message | Choose who the update is for. | چنیں کہ اپ ڈیٹ کن کے لیے ہے۔ |  | `admin.postUpdate.error.scope` |
| 753 | Error › Title required | error message | Write a title. | عنوان لکھیں۔ |  | `admin.postUpdate.error.titleRequired` |
| 754 | Error › Title long | error message | The title is too long. Keep it under 500 characters. | عنوان بہت لمبا ہے۔ اسے 500 حروف سے کم رکھیں۔ |  | `admin.postUpdate.error.titleLong` |
| 755 | Error › Body long | error message | The message is too long. Keep it under 4000 characters. | پیغام بہت لمبا ہے۔ اسے 4000 حروف سے کم رکھیں۔ |  | `admin.postUpdate.error.bodyLong` |
| 756 | Error › Template blanks | error message | Fill in all the blanks of the template. | سانچے کی تمام خالی جگہیں بھریں۔ |  | `admin.postUpdate.error.templateBlanks` |
| 757 | Var › Venue |  | Venue | جگہ |  | `admin.postUpdate.var.venue` |
| 758 | Var › Time |  | Time | وقت |  | `admin.postUpdate.var.time` |
| 759 | Var › Date |  | Date | تاریخ |  | `admin.postUpdate.var.date` |
| 760 | Var › Session |  | Session | سیشن |  | `admin.postUpdate.var.session` |
| 761 | Var › Reason |  | Reason | وجہ |  | `admin.postUpdate.var.reason` |
| 762 | Send by |  | Send by | ذریعہ |  | `admin.postUpdate.sendBy` |
| 763 | Message |  | Your message | آپ کا پیغام |  | `admin.postUpdate.message` |
| 764 | Counting |  | Counting who it will reach… | گنتی ہو رہی ہے کہ یہ کتنے لوگوں تک پہنچے گی… |  | `admin.postUpdate.counting` |
| 765 | Will reach › One |  | This will reach 1 person | یہ 1 شخص تک پہنچے گی |  | `admin.postUpdate.willReach.one` |
| 766 | Will reach › Other |  | This will reach {count} people | یہ {count} لوگوں تک پہنچے گی |  | `admin.postUpdate.willReach.other` |
| 767 | Confirm to › One |  | Send to 1 person? | کیا 1 شخص کو بھیجیں؟ |  | `admin.postUpdate.confirmTo.one` |
| 768 | Confirm to › Other |  | Send to {count} people? | کیا {count} لوگوں کو بھیجیں؟ |  | `admin.postUpdate.confirmTo.other` |
| 769 | Confirm no count |  | Send this update? | کیا یہ اطلاع بھیجیں؟ |  | `admin.postUpdate.confirmNoCount` |

### Schedule

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 770 | Title | heading | Change session time | نشست کا وقت بدلیں |  | `admin.schedule.title` |
| 771 | Current |  | Now: {when} | اب: {when} |  | `admin.schedule.current` |
| 772 | Date › Label | label read by screen readers or shown on a control | New date | نئی تاریخ |  | `admin.schedule.date.label` |
| 773 | Time › Label | label read by screen readers or shown on a control | New time | نیا وقت |  | `admin.schedule.time.label` |
| 774 | Scope › Label | label read by screen readers or shown on a control | Apply to | کس پر لاگو کریں |  | `admin.schedule.scope.label` |
| 775 | Scope › One |  | This session only | صرف اس نشست پر |  | `admin.schedule.scope.one` |
| 776 | Scope › All |  | Every session from now on | اب سے ہر نشست پر |  | `admin.schedule.scope.all` |
| 777 | Notify › Label | label read by screen readers or shown on a control | Tell registered people | رجسٹر شدہ لوگوں کو بتائیں |  | `admin.schedule.notify.label` |
| 778 | Notify › Help |  | They get a message with the new time. | انہیں نئے وقت کا پیغام ملے گا۔ |  | `admin.schedule.notify.help` |
| 779 | Reason › Label | label read by screen readers or shown on a control | Reason (optional) | وجہ (اختیاری) |  | `admin.schedule.reason.label` |
| 780 | Error › Past | error message | Choose a time that has not passed. | ایسا وقت چنیں جو گزرا نہ ہو۔ |  | `admin.schedule.error.past` |
| 781 | Submit | button | Save new time | نیا وقت محفوظ کریں |  | `admin.schedule.submit` |
| 782 | Success |  | Time changed. | وقت بدل گیا۔ |  | `admin.schedule.success` |
| 783 | Cancel › Action |  | Cancel this session | یہ نشست منسوخ کریں |  | `admin.schedule.cancel.action` |
| 784 | Cancel › Title | heading | Cancel this session? | کیا یہ نشست منسوخ کریں؟ |  | `admin.schedule.cancel.title` |
| 785 | Cancel › Body | explanation text | Registered people will be told. | رجسٹر شدہ لوگوں کو بتا دیا جائے گا۔ |  | `admin.schedule.cancel.body` |
| 786 | Cancel › Confirm | button | Yes, cancel it | جی ہاں، منسوخ کریں |  | `admin.schedule.cancel.confirm` |
| 787 | Cancel › Keep |  | Keep it | رہنے دیں |  | `admin.schedule.cancel.keep` |
| 788 | Time › Help |  | Use 24-hour time, for example 17:30. Pakistan time. | 24 گھنٹے کا وقت لکھیں، مثلاً 17:30۔ پاکستان کا وقت۔ |  | `admin.schedule.time.help` |
| 789 | Duration › Label | label read by screen readers or shown on a control | How long (minutes) | دورانیہ (منٹ) |  | `admin.schedule.duration.label` |
| 790 | Minutes |  | minutes | منٹ |  | `admin.schedule.minutes` |
| 791 | Days › Label | label read by screen readers or shown on a control | Days | دن |  | `admin.schedule.days.label` |
| 792 | From › Label | label read by screen readers or shown on a control | Starting from | کب سے |  | `admin.schedule.from.label` |
| 793 | From › Help |  | Dates before this stay as they are. | اس سے پہلے کی تاریخیں جیسی ہیں ویسی رہیں گی۔ |  | `admin.schedule.from.help` |
| 794 | Review |  | Review the change | تبدیلی دیکھیں |  | `admin.schedule.review` |
| 795 | Confirm › Title | heading | Save this change? | کیا یہ تبدیلی محفوظ کریں؟ |  | `admin.schedule.confirm.title` |
| 796 | Effect › When |  | New time: {time}, from {date} | نیا وقت: {time}، {date} سے |  | `admin.schedule.effect.when` |
| 797 | Effect › Dates › One |  | 1 coming date will change | 1 آنے والی تاریخ بدل جائے گی |  | `admin.schedule.effect.dates.one` |
| 798 | Effect › Dates › Other |  | {count} coming dates will change | {count} آنے والی تاریخیں بدل جائیں گی |  | `admin.schedule.effect.dates.other` |
| 799 | Effect › Notify › One |  | 1 registered person will be told | 1 رجسٹر شخص کو بتایا جائے گا |  | `admin.schedule.effect.notify.one` |
| 800 | Effect › Notify › Other |  | {count} registered people will be told | {count} رجسٹر لوگوں کو بتایا جائے گا |  | `admin.schedule.effect.notify.other` |
| 801 | Effect › Notify unknown |  | Registered people will be told. | رجسٹر لوگوں کو بتایا جائے گا۔ |  | `admin.schedule.effect.notifyUnknown` |
| 802 | Effect › Quiet |  | No one will be told. | کسی کو نہیں بتایا جائے گا۔ |  | `admin.schedule.effect.quiet` |
| 803 | Poster note |  | A printed poster with the old time will be out of date. Print a new one. | پرانے وقت والا چھپا ہوا پوسٹر پرانا ہو جائے گا۔ نیا پوسٹر چھاپیں۔ |  | `admin.schedule.posterNote` |
| 804 | Saved › Dates › One |  | 1 coming date was changed | 1 آنے والی تاریخ بدل دی گئی |  | `admin.schedule.saved.dates.one` |
| 805 | Saved › Dates › Other |  | {count} coming dates were changed | {count} آنے والی تاریخیں بدل دی گئیں |  | `admin.schedule.saved.dates.other` |
| 806 | Saved › Notified |  | Registered people were told. | رجسٹر لوگوں کو بتا دیا گیا۔ |  | `admin.schedule.saved.notified` |
| 807 | Saved › Quiet |  | No one was told. | کسی کو نہیں بتایا گیا۔ |  | `admin.schedule.saved.quiet` |
| 808 | Error › Time | error message | Use 24-hour time, for example 17:30. | 24 گھنٹے کا وقت لکھیں، مثلاً 17:30۔ |  | `admin.schedule.error.time` |
| 809 | Error › Duration | error message | Choose between 5 and 600 minutes. | 5 سے 600 منٹ کے درمیان چنیں۔ |  | `admin.schedule.error.duration` |
| 810 | Error › Days | error message | Choose at least one day. | کم از کم ایک دن چنیں۔ |  | `admin.schedule.error.days` |
| 811 | Error › Effective from | error message | Enter a date like 2026-11-02. | تاریخ اس طرح لکھیں: 2026-11-02۔ |  | `admin.schedule.error.effectiveFrom` |
| 812 | Error › Nothing | error message | Nothing has changed. | کچھ نہیں بدلا۔ |  | `admin.schedule.error.nothing` |

### Venue editor

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 813 | Title › New |  | Add a venue | مقام شامل کریں |  | `admin.venueEditor.title.new` |
| 814 | Title › Edit |  | Edit venue | مقام میں تبدیلی |  | `admin.venueEditor.title.edit` |
| 815 | Name en › Label | label read by screen readers or shown on a control | Name in English | انگریزی میں نام |  | `admin.venueEditor.nameEn.label` |
| 816 | Name ur › Label | label read by screen readers or shown on a control | Name in Urdu | اردو میں نام |  | `admin.venueEditor.nameUr.label` |
| 817 | Address › Label | label read by screen readers or shown on a control | Address | پتہ |  | `admin.venueEditor.address.label` |
| 818 | Area › Label | label read by screen readers or shown on a control | Area | علاقہ |  | `admin.venueEditor.area.label` |
| 819 | Pin › Label | label read by screen readers or shown on a control | Place the pin at the entrance | پن کو داخلے کے مقام پر رکھیں |  | `admin.venueEditor.pin.label` |
| 820 | Phone › Label | label read by screen readers or shown on a control | Venue phone number | مقام کا فون نمبر |  | `admin.venueEditor.phone.label` |
| 821 | Phone › Help |  | Everyone can see this number. | یہ نمبر سب کو نظر آئے گا۔ |  | `admin.venueEditor.phone.help` |
| 822 | Facilities › Title | heading | Facilities | سہولیات |  | `admin.venueEditor.facilities.title` |
| 823 | Facilities › Help |  | Tick what the venue has. | جو سہولت موجود ہو اس پر نشان لگائیں۔ |  | `admin.venueEditor.facilities.help` |
| 824 | Entrance › Label | label read by screen readers or shown on a control | How to find the entrance | داخلے کا راستہ |  | `admin.venueEditor.entrance.label` |
| 825 | Submit | button | Save venue | مقام محفوظ کریں |  | `admin.venueEditor.submit` |
| 826 | Saved |  | Venue saved. | مقام محفوظ ہو گیا۔ |  | `admin.venueEditor.saved` |
| 827 | Archive › Action |  | Archive this venue | اس مقام کو آرکائیو کریں |  | `admin.venueEditor.archive.action` |
| 828 | Archive › Title | heading | Archive this venue? | کیا اس مقام کو آرکائیو کریں؟ |  | `admin.venueEditor.archive.title` |
| 829 | Archive › Body | explanation text | People will no longer see it. You can bring it back later. | لوگوں کو یہ نظر نہیں آئے گا۔ آپ اسے بعد میں واپس لا سکتے ہیں۔ |  | `admin.venueEditor.archive.body` |
| 830 | Archive › Confirm | button | Archive | آرکائیو کریں |  | `admin.venueEditor.archive.confirm` |
| 831 | Archive › Keep |  | Keep it | رہنے دیں |  | `admin.venueEditor.archive.keep` |
| 832 | Circles › Title | heading | Circles here | یہاں کے حلقے |  | `admin.venueEditor.circles.title` |
| 833 | Circles › Help |  | Open a circle to edit it, or start a new one at this venue. | کسی حلقے میں تبدیلی کے لیے اسے کھولیں، یا اس جگہ نیا حلقہ شروع کریں۔ |  | `admin.venueEditor.circles.help` |
| 834 | Circles › Empty |  | No circles meet here yet. | یہاں ابھی کوئی حلقہ نہیں۔ |  | `admin.venueEditor.circles.empty` |
| 835 | Cannot create |  | Your role cannot add venues. | آپ کا کردار جگہیں شامل کرنے کی اجازت نہیں دیتا۔ |  | `admin.venueEditor.cannotCreate` |
| 836 | City › Label | label read by screen readers or shown on a control | City | شہر |  | `admin.venueEditor.city.label` |
| 837 | Name › Label | label read by screen readers or shown on a control | Venue name | جگہ کا نام |  | `admin.venueEditor.name.label` |
| 838 | Lat › Label | label read by screen readers or shown on a control | Latitude | عرض بلد |  | `admin.venueEditor.lat.label` |
| 839 | Lng › Label | label read by screen readers or shown on a control | Longitude | طول بلد |  | `admin.venueEditor.lng.label` |
| 840 | Coords › Help |  | For example 24.8607 and 67.0011. Open the place in a map app and copy the numbers. | مثلاً 24.8607 اور 67.0011۔ نقشے کی ایپ میں جگہ کھول کر اعداد نقل کریں۔ |  | `admin.venueEditor.coords.help` |
| 841 | Facility › Women section |  | Separate women's section | خواتین کے لیے الگ حصہ |  | `admin.venueEditor.facility.womenSection` |
| 842 | Facility › Parking |  | Parking | پارکنگ |  | `admin.venueEditor.facility.parking` |
| 843 | Facility › Wudu area |  | Place for wudu | وضو کی جگہ |  | `admin.venueEditor.facility.wuduArea` |
| 844 | Facility › Elder wheelchair access |  | Access for elders and wheelchairs | بزرگوں اور وہیل چیئر کے لیے رسائی |  | `admin.venueEditor.facility.elderWheelchairAccess` |
| 845 | Facility › Child friendly |  | Suitable for children | بچوں کے لیے موزوں |  | `admin.venueEditor.facility.childFriendly` |
| 846 | Error › City | error message | Choose a city. | شہر منتخب کریں۔ |  | `admin.venueEditor.error.city` |
| 847 | Error › Area | error message | Choose an area. | علاقہ منتخب کریں۔ |  | `admin.venueEditor.error.area` |
| 848 | Error › Name | error message | Enter the venue name. | جگہ کا نام لکھیں۔ |  | `admin.venueEditor.error.name` |
| 849 | Error › Address | error message | Enter the address. | پتہ لکھیں۔ |  | `admin.venueEditor.error.address` |
| 850 | Error › Lat | error message | Enter a latitude between -90 and 90. | -90 اور 90 کے درمیان عرض بلد لکھیں۔ |  | `admin.venueEditor.error.lat` |
| 851 | Error › Lng | error message | Enter a longitude between -180 and 180. | -180 اور 180 کے درمیان طول بلد لکھیں۔ |  | `admin.venueEditor.error.lng` |
| 852 | Error › Phone | error message | Enter a phone number, for example 0300 1234567. | فون نمبر لکھیں، مثلاً 0300 1234567۔ |  | `admin.venueEditor.error.phone` |
| 853 | Error › Nothing | error message | Nothing has changed. | کچھ نہیں بدلا۔ |  | `admin.venueEditor.error.nothing` |
| 854 | Details |  | Name and address | نام اور پتہ |  | `admin.venueEditor.details` |
| 855 | Contact |  | Contact | رابطہ |  | `admin.venueEditor.contact` |

### Circle editor

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 856 | Title › New |  | Add a circle | سرکل شامل کریں |  | `admin.circleEditor.title.new` |
| 857 | Title › Edit |  | Edit circle | سرکل میں تبدیلی |  | `admin.circleEditor.title.edit` |
| 858 | Name › Label | label read by screen readers or shown on a control | Circle name | سرکل کا نام |  | `admin.circleEditor.name.label` |
| 859 | Teacher › Label | label read by screen readers or shown on a control | Teacher (optional) | استاد (اختیاری) |  | `admin.circleEditor.teacher.label` |
| 860 | Kind › Label | label read by screen readers or shown on a control | Type | قسم |  | `admin.circleEditor.kind.label` |
| 861 | Kind › Class |  | Regular class | باقاعدہ کلاس |  | `admin.circleEditor.kind.class` |
| 862 | Kind › Drop in |  | Open drop-in | کھلی نشست |  | `admin.circleEditor.kind.dropIn` |
| 863 | Language › Label | label read by screen readers or shown on a control | Language | زبان |  | `admin.circleEditor.language.label` |
| 864 | Section › Label | label read by screen readers or shown on a control | Section | حصہ |  | `admin.circleEditor.section.label` |
| 865 | Schedule › Label | label read by screen readers or shown on a control | When it meets | کب ہوتی ہے |  | `admin.circleEditor.schedule.label` |
| 866 | Capacity › Label | label read by screen readers or shown on a control | Limit the seats | نشستیں محدود کریں |  | `admin.circleEditor.capacity.label` |
| 867 | Capacity › Count |  | Number of seats | نشستوں کی تعداد |  | `admin.circleEditor.capacity.count` |
| 868 | Online › Label | label read by screen readers or shown on a control | Online link (optional) | آن لائن لنک (اختیاری) |  | `admin.circleEditor.online.label` |
| 869 | Save draft |  | Save draft | مسودہ محفوظ کریں |  | `admin.circleEditor.saveDraft` |
| 870 | Send for approval |  | Send for approval | منظوری کے لیے بھیجیں |  | `admin.circleEditor.sendForApproval` |
| 871 | Status › Draft |  | Draft | مسودہ |  | `admin.circleEditor.status.draft` |
| 872 | Status › Pending |  | Waiting for the city coordinator | شہر کے کوآرڈینیٹر کا انتظار |  | `admin.circleEditor.status.pending` |
| 873 | Status › Published |  | Published | شائع شدہ |  | `admin.circleEditor.status.published` |
| 874 | Status › Rejected |  | Not approved | منظور نہیں ہوا |  | `admin.circleEditor.status.rejected` |
| 875 | Approve |  | Approve | منظور کریں |  | `admin.circleEditor.approve` |
| 876 | Reject |  | Do not approve | منظور نہ کریں |  | `admin.circleEditor.reject` |
| 877 | Reject › Reason |  | Reason | وجہ |  | `admin.circleEditor.reject.reason` |
| 878 | Saved |  | Circle saved. | سرکل محفوظ ہو گیا۔ |  | `admin.circleEditor.saved` |
| 879 | Cannot create |  | Your role cannot create circles. | آپ کا کردار حلقے بنانے کی اجازت نہیں دیتا۔ |  | `admin.circleEditor.cannotCreate` |
| 880 | Created title |  | Circle created | حلقہ بن گیا |  | `admin.circleEditor.createdTitle` |
| 881 | Created live |  | It is now public. | اب یہ سب کو نظر آئے گا۔ |  | `admin.circleEditor.createdLive` |
| 882 | Created pending |  | It is waiting for the city coordinator. It stays hidden until it is approved. | یہ شہر کے کوآرڈینیٹر کی منظوری کا منتظر ہے۔ منظوری تک یہ چھپا رہے گا۔ |  | `admin.circleEditor.createdPending` |
| 883 | Decision title |  | Your decision | آپ کا فیصلہ |  | `admin.circleEditor.decisionTitle` |
| 884 | Decision helper |  | This circle is waiting for you. Approving it makes it public. | یہ حلقہ آپ کے فیصلے کا منتظر ہے۔ منظور کرنے پر یہ سب کو نظر آئے گا۔ |  | `admin.circleEditor.decisionHelper` |
| 885 | Description | explanation text | About this circle | اس حلقے کے بارے میں |  | `admin.circleEditor.description` |
| 886 | Error › Link | error message | Enter a web address that starts with https:// | https:// سے شروع ہونے والا ویب پتہ لکھیں۔ |  | `admin.circleEditor.error.link` |
| 887 | Error › Name | error message | Enter the circle name. | حلقے کا نام لکھیں۔ |  | `admin.circleEditor.error.name` |
| 888 | Error › Nothing | error message | Nothing has changed. | کچھ نہیں بدلا۔ |  | `admin.circleEditor.error.nothing` |
| 889 | Error › Teacher | error message | The teacher name must be 2 to 80 letters. | استاد کا نام 2 سے 80 حروف کا ہونا چاہیے۔ |  | `admin.circleEditor.error.teacher` |
| 890 | Error › Venue | error message | Choose a venue. | جگہ منتخب کریں۔ |  | `admin.circleEditor.error.venue` |
| 891 | Online › Help |  | Only if the circle also meets online. | صرف اس صورت میں جب حلقہ آن لائن بھی ہو۔ |  | `admin.circleEditor.online.help` |
| 892 | Pending note |  | Sent. It stays hidden until the city coordinator approves it. | بھیج دیا گیا۔ شہر کے کوآرڈینیٹر کی منظوری تک یہ چھپا رہے گا۔ |  | `admin.circleEditor.pendingNote` |
| 893 | Reject › Note |  | Why not? (optional) | کیوں نہیں؟ (اختیاری) |  | `admin.circleEditor.reject.note` |
| 894 | Reject › Note help |  | The venue coordinator will see this. | جگہ کا کوآرڈینیٹر اسے دیکھے گا۔ |  | `admin.circleEditor.reject.noteHelp` |
| 895 | Reject › Title | heading | Do not approve this circle? | کیا یہ حلقہ منظور نہیں کرنا؟ |  | `admin.circleEditor.reject.title` |
| 896 | Section › Women |  | Women | خواتین |  | `admin.circleEditor.section.women` |
| 897 | Section › Men |  | Men | مرد |  | `admin.circleEditor.section.men` |
| 898 | Section › Family |  | Families | خاندان |  | `admin.circleEditor.section.family` |
| 899 | Status › Pending approval |  | Waiting for approval | منظوری کا انتظار |  | `admin.circleEditor.status.pending_approval` |
| 900 | Status › Archived |  | Archived | محفوظ شدہ |  | `admin.circleEditor.status.archived` |
| 901 | Status waiting |  | Waiting for the city coordinator to decide | شہر کے کوآرڈینیٹر کے فیصلے کا انتظار |  | `admin.circleEditor.statusWaiting` |
| 902 | Submit | button | Create circle | حلقہ بنائیں |  | `admin.circleEditor.submit` |
| 903 | Teacher › Help |  | Optional. Only a name, not an account. | اختیاری۔ صرف نام، اکاؤنٹ نہیں۔ |  | `admin.circleEditor.teacher.help` |
| 904 | Venue › Label | label read by screen readers or shown on a control | Venue | جگہ |  | `admin.circleEditor.venue.label` |
| 905 | Reject › Body | explanation text | The circle stays hidden. The venue coordinator can change it and send it again. | حلقہ چھپا رہے گا۔ مقام کے منتظم اسے بدل کر دوبارہ بھیج سکتے ہیں۔ |  | `admin.circleEditor.reject.body` |
| 906 | Who for |  | Language and section | زبان اور حصہ |  | `admin.circleEditor.whoFor` |
| 907 | Archive › Title | heading | Archive this circle | یہ حلقہ محفوظ شدہ میں ڈالیں |  | `admin.circleEditor.archive.title` |
| 908 | Archive › Help |  | People will no longer see it in the app. | لوگ اسے ایپ میں نہیں دیکھ سکیں گے۔ |  | `admin.circleEditor.archive.help` |
| 909 | Archive › Action |  | Archive circle | حلقہ محفوظ شدہ میں ڈالیں |  | `admin.circleEditor.archive.action` |
| 910 | Archive › Confirm title |  | Archive this circle? | کیا یہ حلقہ محفوظ شدہ میں ڈالیں؟ |  | `admin.circleEditor.archive.confirmTitle` |
| 911 | Archive › Confirm body |  | It stops showing in the app for everyone. | یہ سب کے لیے ایپ میں دکھنا بند ہو جائے گا۔ |  | `admin.circleEditor.archive.confirmBody` |
| 912 | Archived note |  | This circle is archived. People no longer see it in the app. | یہ حلقہ محفوظ شدہ ہے۔ لوگ اسے ایپ میں نہیں دیکھتے۔ |  | `admin.circleEditor.archivedNote` |

### Attendance

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 913 | Title | heading | Attendance | حاضری |  | `admin.attendance.title` |
| 914 | Headcount › Label | label read by screen readers or shown on a control | Headcount | کل تعداد |  | `admin.attendance.headcount.label` |
| 915 | Headcount › Help |  | How many people came. | کتنے لوگ آئے۔ |  | `admin.attendance.headcount.help` |
| 916 | Tick › Help |  | Tick the people you know. The headcount can be higher. | جنہیں آپ جانتے ہیں ان پر نشان لگائیں۔ کل تعداد زیادہ ہو سکتی ہے۔ |  | `admin.attendance.tick.help` |
| 917 | Present |  | Present | حاضر |  | `admin.attendance.present` |
| 918 | Mark all |  | Mark everyone present | سب کو حاضر لگائیں |  | `admin.attendance.markAll` |
| 919 | Clear | button | Clear all | سب ہٹائیں |  | `admin.attendance.clear` |
| 920 | Ticked |  | {present} of {total} ticked | {total} میں سے {present} پر نشان |  | `admin.attendance.ticked` |
| 921 | Recap › Label | label read by screen readers or shown on a control | Recap note (optional) | خلاصہ (اختیاری) |  | `admin.attendance.recap.label` |
| 922 | Portion › Label | label read by screen readers or shown on a control | Portion read | پڑھا گیا حصہ |  | `admin.attendance.portion.label` |
| 923 | Save | button | Save attendance | حاضری محفوظ کریں |  | `admin.attendance.save` |
| 924 | Saved |  | Attendance saved. | حاضری محفوظ ہو گئی۔ |  | `admin.attendance.saved` |
| 925 | Saved offline |  | Saved on this phone. We will send it when you are online. | اس فون پر محفوظ ہے۔ آن لائن ہوتے ہی بھیج دی جائے گی۔ |  | `admin.attendance.savedOffline` |
| 926 | Empty |  | No one is registered for this session. You can still enter a headcount. | اس نشست کے لیے کوئی رجسٹر نہیں۔ آپ پھر بھی کل تعداد لکھ سکتے ہیں۔ |  | `admin.attendance.empty` |
| 927 | Add | button | Add | شامل کریں |  | `admin.attendance.add` |
| 928 | Drop ins title |  | Others who came | دوسرے آنے والے |  | `admin.attendance.dropInsTitle` |
| 929 | Drop ins helper |  | Add people who came without registering. A name is optional. | جو لوگ رجسٹر کیے بغیر آئے انہیں شامل کریں۔ نام لکھنا ضروری نہیں۔ |  | `admin.attendance.dropInsHelper` |
| 930 | Error › Less than ticked | error message | The headcount is lower than the people you ticked. | گنتی نشان زد لوگوں سے کم ہے۔ |  | `admin.attendance.error.lessThanTicked` |
| 931 | Name label | label read by screen readers or shown on a control | Name (optional) | نام (اختیاری) |  | `admin.attendance.nameLabel` |
| 932 | No registrants title |  | No one is registered | کوئی رجسٹر نہیں ہوا |  | `admin.attendance.noRegistrantsTitle` |
| 933 | No registrants body |  | You can still enter a headcount. | آپ پھر بھی گنتی درج کر سکتے ہیں۔ |  | `admin.attendance.noRegistrantsBody` |
| 934 | People label | label read by screen readers or shown on a control | People | افراد |  | `admin.attendance.peopleLabel` |
| 935 | Registered helper |  | Tick each person who came. The people who came with them count too. | ہر آنے والے پر نشان لگائیں۔ ان کے ساتھ آنے والے بھی گنے جائیں گے۔ |  | `admin.attendance.registeredHelper` |
| 936 | Registered title |  | Registered people | رجسٹر ہونے والے لوگ |  | `admin.attendance.registeredTitle` |
| 937 | Remove | button | Remove | ہٹائیں |  | `admin.attendance.remove` |
| 938 | Ticked total |  | {count} people ticked | {count} افراد پر نشان |  | `admin.attendance.tickedTotal` |
| 939 | Type number |  | Type a number | عدد لکھیں |  | `admin.attendance.typeNumber` |
| 940 | Unnamed |  | Someone who came | ایک آنے والا |  | `admin.attendance.unnamed` |

### Account

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 941 | Title | heading | Account | اکاؤنٹ |  | `admin.account.title` |
| 942 | Signed in as |  | Signed in as | آپ اس نام سے داخل ہیں |  | `admin.account.signedInAs` |
| 943 | No name |  | Name not set | نام درج نہیں |  | `admin.account.noName` |
| 944 | Display |  | How the app looks | ایپ کیسی نظر آئے |  | `admin.account.display` |
| 945 | Language |  | Language | زبان |  | `admin.account.language` |
| 946 | Text size |  | Text size | تحریر کا سائز |  | `admin.account.textSize` |
| 947 | Size › 0 |  | Standard | معیاری |  | `admin.account.size.0` |
| 948 | Size › 1 |  | Large | بڑا |  | `admin.account.size.1` |
| 949 | Size › 2 |  | Larger | زیادہ بڑا |  | `admin.account.size.2` |
| 950 | Size › 3 |  | Largest | سب سے بڑا |  | `admin.account.size.3` |
| 951 | Colors |  | Colours | رنگ |  | `admin.account.colors` |
| 952 | Color › System |  | Same as the phone | فون کے مطابق |  | `admin.account.color.system` |
| 953 | Color › Light |  | Light | روشن |  | `admin.account.color.light` |
| 954 | Color › Dark |  | Dark | گہرا |  | `admin.account.color.dark` |
| 955 | Color › High contrast |  | High contrast | نمایاں رنگ |  | `admin.account.color.highContrast` |
| 956 | Sign out |  | Sign out | باہر نکلیں |  | `admin.account.signOut` |
| 957 | Look after |  | You look after | آپ کی ذمہ داری |  | `admin.account.lookAfter` |

### Common

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 958 | Cancel | button | Cancel | منسوخ کریں |  | `admin.common.cancel` |
| 959 | Decrease |  | Fewer: {label} | {label} کم کریں |  | `admin.common.decrease` |
| 960 | Increase |  | More: {label} | {label} زیادہ کریں |  | `admin.common.increase` |
| 961 | Done | button | Done | مکمل |  | `admin.common.done` |
| 962 | English |  | English | انگریزی |  | `admin.common.english` |
| 963 | Urdu |  | Urdu | اردو |  | `admin.common.urdu` |
| 964 | Save | button | Save | محفوظ کریں |  | `admin.common.save` |
| 965 | Not available |  | This is not available to you. It may be outside the places you look after, or it was removed. | یہ آپ کے لیے دستیاب نہیں۔ ہو سکتا ہے یہ آپ کی جگہوں سے باہر ہو، یا ہٹا دیا گیا ہو۔ |  | `admin.common.notAvailable` |
| 966 | Not accepted |  | This was not accepted. Check it and try again. | یہ قبول نہیں ہوا۔ دیکھ کر دوبارہ کوشش کریں۔ |  | `admin.common.notAccepted` |

### Home

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 967 | Title | heading | Today | آج |  | `admin.home.title` |
| 968 | Today section |  | Today | آج |  | `admin.home.todaySection` |
| 969 | Other section |  | Other sessions | دوسرے سیشن |  | `admin.home.otherSection` |
| 970 | All section |  | Your sessions | آپ کے سیشن |  | `admin.home.allSection` |
| 971 | Empty title |  | No sessions in your area yet | آپ کے علاقے میں ابھی کوئی سیشن نہیں |  | `admin.home.emptyTitle` |
| 972 | Empty body |  | Sessions you look after will appear here. | جن سیشنز کی آپ نگرانی کرتے ہیں وہ یہاں نظر آئیں گے۔ |  | `admin.home.emptyBody` |
| 973 | Draft |  | Draft | مسودہ |  | `admin.home.draft` |
| 974 | Post update |  | Post an update | اپ ڈیٹ بھیجیں |  | `admin.home.postUpdate` |
| 975 | Session |  | Session | سیشن |  | `admin.home.session` |
| 976 | Registrants |  | Registrants | رجسٹر ہونے والے |  | `admin.home.registrants` |
| 977 | Registrants today |  | Today's registrants | آج رجسٹر ہونے والے |  | `admin.home.registrantsToday` |
| 978 | Post about |  | Update about this session | اس سیشن کے بارے میں اپ ڈیٹ |  | `admin.home.postAbout` |
| 979 | Change time |  | Change the time | وقت بدلیں |  | `admin.home.changeTime` |
| 980 | Dates |  | Coming dates | آنے والی تاریخیں |  | `admin.home.dates` |
| 981 | No dates |  | No dates coming up. | کوئی آنے والی تاریخ نہیں۔ |  | `admin.home.noDates` |
| 982 | Attendance |  | Attendance | حاضری |  | `admin.home.attendance` |
| 983 | Edit occurrence |  | Portion and notes | حصہ اور نوٹ |  | `admin.home.editOccurrence` |
| 984 | Cancelled |  | Cancelled | منسوخ |  | `admin.home.cancelled` |
| 985 | Headcount |  | {count} came | {count} آئے |  | `admin.home.headcount` |
| 986 | Every day |  | Every day | ہر روز |  | `admin.home.everyDay` |
| 987 | Seats |  | {taken} of {capacity} seats taken | {capacity} میں سے {taken} نشستیں بھر چکی ہیں |  | `admin.home.seats` |
| 988 | Section › Women |  | Women | خواتین |  | `admin.home.section.women` |
| 989 | Section › Men |  | Men | مرد |  | `admin.home.section.men` |
| 990 | Section › Family |  | Families | خاندان |  | `admin.home.section.family` |
| 991 | Next section |  | Next session | اگلا سیشن |  | `admin.home.nextSection` |
| 992 | Coming |  | coming | آ رہے ہیں |  | `admin.home.coming` |
| 993 | Quick actions |  | Quick actions | فوری کام |  | `admin.home.quickActions` |
| 994 | Post short |  | Post update | اپ ڈیٹ بھیجیں |  | `admin.home.postShort` |
| 995 | Change time short |  | Change time | وقت بدلیں |  | `admin.home.changeTimeShort` |
| 996 | Greeting |  | Assalamu alaikum, {name} | السلام علیکم، {name} |  | `admin.home.greeting` |
| 997 | Greeting plain |  | Assalamu alaikum | السلام علیکم |  | `admin.home.greetingPlain` |

### Places

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 998 | Circle count › One |  | {count} circle | {count} حلقہ |  | `admin.places.circleCount.one` |
| 999 | Circle count › Other |  | {count} circles | {count} حلقے |  | `admin.places.circleCount.other` |
| 1000 | Title | heading | Places | جگہیں |  | `admin.places.title` |
| 1001 | Venues |  | Venues | مقامات |  | `admin.places.venues` |
| 1002 | Circles |  | Circles | حلقے |  | `admin.places.circles` |
| 1003 | New venue |  | Add a venue | جگہ شامل کریں |  | `admin.places.newVenue` |
| 1004 | New circle |  | Add a circle | حلقہ شامل کریں |  | `admin.places.newCircle` |
| 1005 | No venues title |  | No venues yet | ابھی کوئی جگہ نہیں |  | `admin.places.noVenuesTitle` |
| 1006 | No venues body |  | Venues you look after will appear here. | جن جگہوں کی آپ نگرانی کرتے ہیں وہ یہاں نظر آئیں گی۔ |  | `admin.places.noVenuesBody` |
| 1007 | No circles title |  | No circles yet | ابھی کوئی حلقہ نہیں |  | `admin.places.noCirclesTitle` |
| 1008 | No circles body |  | Circles in your area will appear here. | آپ کے علاقے کے حلقے یہاں نظر آئیں گے۔ |  | `admin.places.noCirclesBody` |
| 1009 | Archived |  | Archived | محفوظ شدہ |  | `admin.places.archived` |
| 1010 | Needs decision › One |  | 1 circle is waiting for your decision | 1 حلقہ آپ کے فیصلے کا منتظر ہے |  | `admin.places.needsDecision.one` |
| 1011 | Needs decision › Other |  | {count} circles are waiting for your decision | {count} حلقے آپ کے فیصلے کے منتظر ہیں |  | `admin.places.needsDecision.other` |
| 1012 | Search venues |  | Search venues | مقامات تلاش کریں |  | `admin.places.searchVenues` |
| 1013 | Search circles |  | Search circles | حلقے تلاش کریں |  | `admin.places.searchCircles` |

### Occurrence

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1014 | Title | heading | This date | یہ تاریخ |  | `admin.occurrence.title` |
| 1015 | Portion › Title | heading | Portion for this date | اس تاریخ کا حصہ |  | `admin.occurrence.portion.title` |
| 1016 | Portion › Kind |  | What will be read | کیا پڑھا جائے گا |  | `admin.occurrence.portion.kind` |
| 1017 | Portion › None |  | Not set | مقرر نہیں |  | `admin.occurrence.portion.none` |
| 1018 | Portion › Para |  | Para | پارہ |  | `admin.occurrence.portion.para` |
| 1019 | Portion › Surah |  | Surah | سورت |  | `admin.occurrence.portion.surah` |
| 1020 | Portion › Ayah range |  | Verses | آیات |  | `admin.occurrence.portion.ayah_range` |
| 1021 | Portion › Lesson |  | Lesson | سبق |  | `admin.occurrence.portion.lesson` |
| 1022 | Para › Label | label read by screen readers or shown on a control | Para number (1 to 30) | پارہ نمبر (1 سے 30) |  | `admin.occurrence.para.label` |
| 1023 | Para › Help |  | For example 5. | مثلاً 5۔ |  | `admin.occurrence.para.help` |
| 1024 | Surah › Label | label read by screen readers or shown on a control | Surah number (1 to 114) | سورت نمبر (1 سے 114) |  | `admin.occurrence.surah.label` |
| 1025 | Surah › Help |  | For example 36. | مثلاً 36۔ |  | `admin.occurrence.surah.help` |
| 1026 | From ayah |  | From verse | آیت سے |  | `admin.occurrence.fromAyah` |
| 1027 | To ayah |  | To verse | آیت تک |  | `admin.occurrence.toAyah` |
| 1028 | Lesson › Label | label read by screen readers or shown on a control | Lesson title | سبق کا عنوان |  | `admin.occurrence.lesson.label` |
| 1029 | Portion label › Label | label read by screen readers or shown on a control | Short note on the portion (optional) | حصے پر مختصر نوٹ (اختیاری) |  | `admin.occurrence.portionLabel.label` |
| 1030 | Portion label › Help |  | For example: first half. | مثلاً: پہلا نصف۔ |  | `admin.occurrence.portionLabel.help` |
| 1031 | Recap › Title | heading | Recap | خلاصہ |  | `admin.occurrence.recap.title` |
| 1032 | Recap › Label | label read by screen readers or shown on a control | Recap note (optional) | خلاصے کا نوٹ (اختیاری) |  | `admin.occurrence.recap.label` |
| 1033 | Recap › Help |  | A few lines for people who could not come. | ان لوگوں کے لیے چند سطریں جو نہ آ سکے۔ |  | `admin.occurrence.recap.help` |
| 1034 | Recap › Language |  | Language of the recap | خلاصے کی زبان |  | `admin.occurrence.recap.language` |
| 1035 | Cancel › This |  | Cancel this date | یہ تاریخ منسوخ کریں |  | `admin.occurrence.cancel.this` |
| 1036 | Cancel › Help |  | Only this date is cancelled. Other dates stay as they are. | صرف یہ تاریخ منسوخ ہوگی۔ باقی تاریخیں ویسی ہی رہیں گی۔ |  | `admin.occurrence.cancel.help` |
| 1037 | Cancel › Notify |  | Tell registered people | رجسٹر لوگوں کو بتائیں |  | `admin.occurrence.cancel.notify` |
| 1038 | Cancel › Title | heading | Cancel this date? | کیا یہ تاریخ منسوخ کرنی ہے؟ |  | `admin.occurrence.cancel.title` |
| 1039 | Cancel › Confirm | button | Yes, cancel it | ہاں، منسوخ کریں |  | `admin.occurrence.cancel.confirm` |
| 1040 | Cancel › Confirm notify |  | Registered people will be told. | رجسٹر لوگوں کو بتایا جائے گا۔ |  | `admin.occurrence.cancel.confirmNotify` |
| 1041 | Cancel › Confirm quiet |  | No one will be told. | کسی کو نہیں بتایا جائے گا۔ |  | `admin.occurrence.cancel.confirmQuiet` |
| 1042 | Error › Para | error message | Enter a number from 1 to 30. | 1 سے 30 تک کا عدد لکھیں۔ |  | `admin.occurrence.error.para` |
| 1043 | Error › Surah | error message | Enter a number from 1 to 114. | 1 سے 114 تک کا عدد لکھیں۔ |  | `admin.occurrence.error.surah` |
| 1044 | Error › Ayahs | error message | Enter the first and last verse. The last is not before the first. | پہلی اور آخری آیت لکھیں۔ آخری آیت پہلی سے پہلے نہ ہو۔ |  | `admin.occurrence.error.ayahs` |
| 1045 | Error › Lesson | error message | Enter a lesson title of up to 200 characters. | 200 حروف تک سبق کا عنوان لکھیں۔ |  | `admin.occurrence.error.lesson` |
| 1046 | Error › Label | label read by screen readers or shown on a control | The note is too long. Keep it under 200 characters. | نوٹ بہت لمبا ہے۔ اسے 200 حروف سے کم رکھیں۔ |  | `admin.occurrence.error.label` |
| 1047 | Error › Recap | error message | The recap is too long. Keep it under 2000 characters. | خلاصہ بہت لمبا ہے۔ اسے 2000 حروف سے کم رکھیں۔ |  | `admin.occurrence.error.recap` |
| 1048 | Error › Nothing | error message | Nothing has changed. | کچھ نہیں بدلا۔ |  | `admin.occurrence.error.nothing` |

### Scope

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1049 | Working as |  | You are working as | آپ اس حیثیت سے کام کر رہے ہیں |  | `admin.scope.workingAs` |
| 1050 | Role › National admin |  | National admin | قومی ایڈمن |  | `admin.scope.role.national_admin` |
| 1051 | Role › City coordinator |  | City coordinator | شہر کا کوآرڈینیٹر |  | `admin.scope.role.city_coordinator` |
| 1052 | Role › Venue coordinator |  | Venue coordinator | جگہ کا کوآرڈینیٹر |  | `admin.scope.role.venue_coordinator` |

### Sign in

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1053 | Title | heading | Sign in | داخل ہوں |  | `admin.signIn.title` |
| 1054 | Subtitle |  | For coordinators and admins | کوآرڈینیٹرز اور ایڈمنز کے لیے |  | `admin.signIn.subtitle` |
| 1055 | Phone label | label read by screen readers or shown on a control | Phone number | فون نمبر |  | `admin.signIn.phoneLabel` |
| 1056 | Phone helper |  | The number your admin invited. We will send a code on WhatsApp, or by SMS if WhatsApp is not available. | وہ نمبر جس پر آپ کو دعوت ملی۔ ہم واٹس ایپ پر کوڈ بھیجیں گے، اور اگر واٹس ایپ دستیاب نہ ہو تو ایس ایم ایس سے۔ |  | `admin.signIn.phoneHelper` |
| 1057 | Phone invalid |  | Enter a Pakistan mobile number, for example 0300 1234567. | پاکستانی موبائل نمبر لکھیں، مثلاً 0300 1234567۔ |  | `admin.signIn.phoneInvalid` |
| 1058 | Send code |  | Send code | کوڈ بھیجیں |  | `admin.signIn.sendCode` |
| 1059 | Code label | label read by screen readers or shown on a control | Code | کوڈ |  | `admin.signIn.codeLabel` |
| 1060 | Code helper |  | Enter the 6-digit code we sent to {phone}. | {phone} پر بھیجا گیا 6 ہندسوں کا کوڈ لکھیں۔ |  | `admin.signIn.codeHelper` |
| 1061 | Code invalid |  | Enter the 6-digit code. | 6 ہندسوں کا کوڈ لکھیں۔ |  | `admin.signIn.codeInvalid` |
| 1062 | Verify |  | Sign in | داخل ہوں |  | `admin.signIn.verify` |
| 1063 | Resend in |  | Send again in {seconds} seconds | {seconds} سیکنڈ میں دوبارہ بھیجیں |  | `admin.signIn.resendIn` |
| 1064 | Resend |  | Send the code again | کوڈ دوبارہ بھیجیں |  | `admin.signIn.resend` |
| 1065 | Change number |  | Use a different number | دوسرا نمبر استعمال کریں |  | `admin.signIn.changeNumber` |
| 1066 | Wait seconds |  | Please wait {seconds} seconds. | براہ کرم {seconds} سیکنڈ انتظار کریں۔ |  | `admin.signIn.waitSeconds` |
| 1067 | Invite only |  | Only invited numbers can use this app. | صرف دعوت پانے والے نمبر یہ ایپ استعمال کر سکتے ہیں۔ |  | `admin.signIn.inviteOnly` |
| 1068 | Not invited title |  | This number has no access | اس نمبر کو رسائی نہیں |  | `admin.signIn.notInvitedTitle` |
| 1069 | Not invited body |  | This number has not been invited as a coordinator. Ask your admin to invite it, then sign in again. | اس نمبر کو کوآرڈینیٹر کے طور پر دعوت نہیں ملی۔ اپنے ایڈمن سے دعوت دینے کا کہیں، پھر دوبارہ داخل ہوں۔ |  | `admin.signIn.notInvitedBody` |
| 1070 | Heading |  | Sign in with your phone | اپنے فون سے سائن ان کریں |  | `admin.signIn.heading` |

### Tabs

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1071 | Label | label read by screen readers or shown on a control | Main menu | مرکزی مینو |  | `admin.tabs.label` |
| 1072 | Today |  | Today | آج |  | `admin.tabs.today` |
| 1073 | Updates |  | Updates | اپ ڈیٹس |  | `admin.tabs.updates` |
| 1074 | Places |  | Places | جگہیں |  | `admin.tabs.places` |
| 1075 | Account |  | Account | اکاؤنٹ |  | `admin.tabs.account` |

### Updates

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1076 | Title | heading | Updates | اپ ڈیٹس |  | `admin.updates.title` |
| 1077 | Empty title |  | No updates yet | ابھی کوئی اپ ڈیٹ نہیں |  | `admin.updates.emptyTitle` |
| 1078 | Empty body |  | Updates you post will appear here. | آپ کی بھیجی ہوئی اپ ڈیٹس یہاں نظر آئیں گی۔ |  | `admin.updates.emptyBody` |
| 1079 | Recipients › One |  | Reached 1 person | 1 شخص تک پہنچی |  | `admin.updates.recipients.one` |
| 1080 | Recipients › Other |  | Reached {count} people | {count} لوگوں تک پہنچی |  | `admin.updates.recipients.other` |

### Daily ayah

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1081 | Title | heading | Ayah of the day | آج کی آیت |  | `admin.dailyAyah.title` |
| 1082 | Day |  | Day | دن |  | `admin.dailyAyah.day` |
| 1083 | Today |  | Today | آج |  | `admin.dailyAyah.today` |
| 1084 | Your pick |  | Your pick | آپ کا انتخاب |  | `admin.dailyAyah.yourPick` |
| 1085 | No pick |  | No pick | کوئی انتخاب نہیں |  | `admin.dailyAyah.noPick` |
| 1086 | Reference |  | Surah {surah}, ayah {ayah} | سورہ نمبر {surah}، آیت {ayah} |  | `admin.dailyAyah.reference` |
| 1087 | Who sees › Venue |  | People who follow this venue see this ayah that day. | اس مقام کو فالو کرنے والے اس دن یہ آیت دیکھیں گے۔ |  | `admin.dailyAyah.whoSees.venue` |
| 1088 | Who sees › Circle |  | People who follow this circle see this ayah that day. | اس حلقے کو فالو کرنے والے اس دن یہ آیت دیکھیں گے۔ |  | `admin.dailyAyah.whoSees.circle` |
| 1089 | No pick help |  | No ayah is chosen here for this day yet. | اس دن کے لیے یہاں ابھی کوئی آیت منتخب نہیں۔ |  | `admin.dailyAyah.noPickHelp` |
| 1090 | Remove | button | Remove pick | انتخاب ہٹائیں |  | `admin.dailyAyah.remove` |
| 1091 | Remove › Title | heading | Remove this pick? | یہ انتخاب ہٹائیں؟ |  | `admin.dailyAyah.remove.title` |
| 1092 | Remove › Body | explanation text | On {date}, followers will see {reference} instead. | {date} کو فالو کرنے والے اس کے بجائے {reference} دیکھیں گے۔ |  | `admin.dailyAyah.remove.body` |
| 1093 | Removed |  | Pick removed. | انتخاب ہٹا دیا گیا۔ |  | `admin.dailyAyah.removed` |
| 1094 | Form › Title new |  | Choose the ayah | آیت منتخب کریں |  | `admin.dailyAyah.form.titleNew` |
| 1095 | Form › Title change |  | Change the ayah | آیت بدلیں |  | `admin.dailyAyah.form.titleChange` |
| 1096 | Form › Help |  | Only the surah and ayah numbers are saved. The app shows the Arabic and the translation. | صرف سورہ اور آیت کے نمبر محفوظ ہوتے ہیں۔ عربی متن اور ترجمہ ایپ خود دکھاتی ہے۔ |  | `admin.dailyAyah.form.help` |
| 1097 | Surah › Label | label read by screen readers or shown on a control | Surah number (1 to 114) | سورہ نمبر (1 سے 114) |  | `admin.dailyAyah.surah.label` |
| 1098 | Ayah › Label | label read by screen readers or shown on a control | Ayah number | آیت نمبر |  | `admin.dailyAyah.ayah.label` |
| 1099 | Ayah count › One |  | Surah {surah} has {count} ayah. | سورہ {surah} میں {count} آیت ہے۔ |  | `admin.dailyAyah.ayahCount.one` |
| 1100 | Ayah count › Other |  | Surah {surah} has {count} ayahs. | سورہ {surah} میں {count} آیات ہیں۔ |  | `admin.dailyAyah.ayahCount.other` |
| 1101 | Error › Surah | error message | Enter a surah number from 1 to 114. | 1 سے 114 تک سورہ نمبر لکھیں۔ |  | `admin.dailyAyah.error.surah` |
| 1102 | Error › Ayah | error message | Enter the ayah number. | آیت نمبر لکھیں۔ |  | `admin.dailyAyah.error.ayah` |
| 1103 | Error › Not in surah › One | error message | Surah {surah} has only {count} ayah. Enter a number from 1 to {count}. | سورہ {surah} میں صرف {count} آیت ہے۔ 1 سے {count} تک نمبر لکھیں۔ |  | `admin.dailyAyah.error.notInSurah.one` |
| 1104 | Error › Not in surah › Other | error message | Surah {surah} has {count} ayahs. Enter a number from 1 to {count}. | سورہ {surah} میں {count} آیات ہیں۔ 1 سے {count} تک نمبر لکھیں۔ |  | `admin.dailyAyah.error.notInSurah.other` |
| 1105 | Error › Same | error message | This ayah is already the pick for this day. | یہ آیت اس دن کے لیے پہلے سے منتخب ہے۔ |  | `admin.dailyAyah.error.same` |
| 1106 | Save | button | Save pick | انتخاب محفوظ کریں |  | `admin.dailyAyah.save` |
| 1107 | Replace |  | Replace pick | انتخاب بدلیں |  | `admin.dailyAyah.replace` |
| 1108 | Saved |  | Saved. Followers see {reference} on {date}. | محفوظ ہو گیا۔ فالو کرنے والے {date} کو {reference} دیکھیں گے۔ |  | `admin.dailyAyah.saved` |
| 1109 | Fallback › Title | heading | Without a pick | انتخاب نہ ہو تو |  | `admin.dailyAyah.fallback.title` |
| 1110 | Fallback › National |  | Followers see the national pick for the day: {reference}. | فالو کرنے والے اس دن کا قومی انتخاب دیکھیں گے: {reference}۔ |  | `admin.dailyAyah.fallback.national` |
| 1111 | Fallback › Built in |  | Followers see the app's own ayah for the day: {reference}. | فالو کرنے والے ایپ کی اپنی فہرست سے اس دن کی آیت دیکھیں گے: {reference}۔ |  | `admin.dailyAyah.fallback.builtIn` |
| 1112 | Fallback › Note |  | Someone who follows more than one place with its own pick that day sees this too. | جو شخص ایک سے زیادہ ایسی جگہوں کو فالو کرتا ہو جن کا اس دن اپنا انتخاب ہو، وہ بھی یہی دیکھے گا۔ |  | `admin.dailyAyah.fallback.note` |
| 1113 | Upcoming › Title | heading | Coming up | آنے والے دن |  | `admin.dailyAyah.upcoming.title` |
| 1114 | Upcoming › Empty |  | No picks here in the days shown. | دکھائے گئے دنوں میں یہاں کوئی انتخاب نہیں۔ |  | `admin.dailyAyah.upcoming.empty` |
| 1115 | Upcoming › Row |  | {date}, {reference} | {date}، {reference} |  | `admin.dailyAyah.upcoming.row` |
| 1116 | Entry › Help › Venue |  | Choose the ayah that people who follow this venue see each day. | وہ آیت منتخب کریں جو اس مقام کو فالو کرنے والے ہر دن دیکھیں۔ |  | `admin.dailyAyah.entry.help.venue` |
| 1117 | Entry › Help › Circle |  | Choose the ayah that people who follow this circle see each day. | وہ آیت منتخب کریں جو اس حلقے کو فالو کرنے والے ہر دن دیکھیں۔ |  | `admin.dailyAyah.entry.help.circle` |
| 1118 | Entry › Action |  | Choose ayahs | آیات منتخب کریں |  | `admin.dailyAyah.entry.action` |


## Console (staff website)

### Invites

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1119 | Title | heading | Invite coordinators | کوآرڈینیٹرز کو دعوت دیں |  | `console.invites.title` |
| 1120 | New |  | Invite a coordinator | کوآرڈینیٹر کو دعوت دیں |  | `console.invites.new` |
| 1121 | Phone › Label | label read by screen readers or shown on a control | WhatsApp number | واٹس ایپ نمبر |  | `console.invites.phone.label` |
| 1122 | Role › Label | label read by screen readers or shown on a control | Role | ذمہ داری |  | `console.invites.role.label` |
| 1123 | Role › City |  | City coordinator | شہر کا کوآرڈینیٹر |  | `console.invites.role.city` |
| 1124 | Role › Venue |  | Venue coordinator | مقام کا کوآرڈینیٹر |  | `console.invites.role.venue` |
| 1125 | Scope › City |  | City | شہر |  | `console.invites.scope.city` |
| 1126 | Scope › Venue |  | Venue | مقام |  | `console.invites.scope.venue` |
| 1127 | Send | button | Send invite | دعوت بھیجیں |  | `console.invites.send` |
| 1128 | Sent |  | Invite sent. | دعوت بھیج دی گئی۔ |  | `console.invites.sent` |
| 1129 | List › Title | heading | Invites | دعوتیں |  | `console.invites.list.title` |
| 1130 | Status › Pending |  | Waiting | انتظار میں |  | `console.invites.status.pending` |
| 1131 | Status › Accepted |  | Accepted | قبول کی گئی |  | `console.invites.status.accepted` |
| 1132 | Status › Expired |  | Expired | مدت ختم |  | `console.invites.status.expired` |
| 1133 | Status › Revoked |  | Cancelled | منسوخ |  | `console.invites.status.revoked` |
| 1134 | Revoke |  | Cancel invite | دعوت منسوخ کریں |  | `console.invites.revoke` |
| 1135 | Resend |  | Send again | دوبارہ بھیجیں |  | `console.invites.resend` |
| 1136 | Empty |  | No invites yet. | ابھی کوئی دعوت نہیں۔ |  | `console.invites.empty` |
| 1137 | Unnamed |  | No name given | نام نہیں دیا گیا |  | `console.invites.unnamed` |
| 1138 | Intro | explanation text | Invite coordinators, see who holds a role now and hand a venue or city to someone else. | کوآرڈینیٹرز کو دعوت دیں، دیکھیں اب کس کے پاس ذمہ داری ہے، اور مقام یا شہر کسی اور کے سپرد کریں۔ |  | `console.invites.intro` |
| 1139 | Active › Title | heading | Current coordinators | موجودہ کوآرڈینیٹرز |  | `console.invites.active.title` |
| 1140 | Active › Empty › Title | heading | No coordinators yet | ابھی کوئی کوآرڈینیٹر نہیں |  | `console.invites.active.empty.title` |
| 1141 | Active › Empty › Body | explanation text | Invite someone to get started. | شروع کرنے کے لیے کسی کو دعوت دیں۔ |  | `console.invites.active.empty.body` |
| 1142 | Col › Person | table column heading | Person | فرد |  | `console.invites.col.person` |
| 1143 | Col › Phone | table column heading | WhatsApp number | واٹس ایپ نمبر |  | `console.invites.col.phone` |
| 1144 | Col › Role | table column heading | Role | ذمہ داری |  | `console.invites.col.role` |
| 1145 | Col › Scope | table column heading | Where | کہاں |  | `console.invites.col.scope` |
| 1146 | Col › Expires | table column heading | Expires | مدت ختم ہو گی |  | `console.invites.col.expires` |
| 1147 | Col › Since | table column heading | Since | کب سے |  | `console.invites.col.since` |
| 1148 | Col › Status | table column heading | Status | حالت |  | `console.invites.col.status` |
| 1149 | Col › Actions | table column heading | Actions | کارروائیاں |  | `console.invites.col.actions` |
| 1150 | Form › Name › Label | label read by screen readers or shown on a control | Name | نام |  | `console.invites.form.name.label` |
| 1151 | Form › Name › Invalid | error message | Use 2 to 80 letters. | 2 سے 80 حروف لکھیں۔ |  | `console.invites.form.name.invalid` |
| 1152 | Form › Phone › Hint | hint under a field | The code goes to this WhatsApp number. Example: 0300 1234567. | کوڈ اسی واٹس ایپ نمبر پر جائے گا۔ مثال: 0300 1234567۔ |  | `console.invites.form.phone.hint` |
| 1153 | Form › Phone › Preview |  | Will be saved as {phone}. | {phone} کے طور پر محفوظ ہو گا۔ |  | `console.invites.form.phone.preview` |
| 1154 | Form › Role › Required | error message | Choose a role. | ذمہ داری چنیں۔ |  | `console.invites.form.role.required` |
| 1155 | Form › Scope › Required | error message | Choose where this role applies. | چنیں کہ یہ ذمہ داری کہاں ہے۔ |  | `console.invites.form.scope.required` |
| 1156 | Form › Venue option |  | {venue} ({city}) | {venue} ({city}) |  | `console.invites.form.venueOption` |
| 1157 | Handover |  | Hand over | سپرد کریں |  | `console.invites.handover` |
| 1158 | Handover › Title | heading | Hand over {scope} | {scope} سپرد کریں |  | `console.invites.handover.title` |
| 1159 | Handover › Warning |  | The new coordinator gets access now. {previous} loses access at once. History stays. | نئے کوآرڈینیٹر کو ابھی رسائی مل جائے گی۔ {previous} کی رسائی فوراً ختم ہو جائے گی۔ پرانا ریکارڈ محفوظ رہے گا۔ |  | `console.invites.handover.warning` |
| 1160 | Handover › Person › Label | label read by screen readers or shown on a control | New coordinator | نیا کوآرڈینیٹر |  | `console.invites.handover.person.label` |
| 1161 | Handover › Person › Hint | hint under a field | People who already have a role. Someone new must be invited and sign in first. | وہ لوگ جن کے پاس پہلے سے ذمہ داری ہے۔ نئے فرد کو پہلے دعوت دیں، اور وہ سائن ان کرے۔ |  | `console.invites.handover.person.hint` |
| 1162 | Handover › Person › Required | error message | Choose who takes over. | چنیں کہ کون ذمہ داری لے گا۔ |  | `console.invites.handover.person.required` |
| 1163 | Handover › Submit | button | Hand over | سپرد کریں |  | `console.invites.handover.submit` |
| 1164 | Handover › Nobody |  | No one else to hand over to yet. Invite the person first, and come back here after they sign in. | ابھی کوئی اور نہیں جسے سپرد کیا جا سکے۔ پہلے اس فرد کو دعوت دیں، اور سائن ان کے بعد یہاں واپس آئیں۔ |  | `console.invites.handover.nobody` |
| 1165 | Handed over |  | Handed over. The new coordinator has access now. | سپرد کر دیا گیا۔ نئے کوآرڈینیٹر کو اب رسائی مل گئی ہے۔ |  | `console.invites.handedOver` |
| 1166 | Remove | button | Remove access | رسائی ختم کریں |  | `console.invites.remove` |
| 1167 | Remove › Title | heading | Remove access? | رسائی ختم کریں؟ |  | `console.invites.remove.title` |
| 1168 | Remove › Body | explanation text | {name} will lose access to {scope} at once. History stays. | {name} کی {scope} تک رسائی فوراً ختم ہو جائے گی۔ ریکارڈ محفوظ رہے گا۔ |  | `console.invites.remove.body` |
| 1169 | Remove › Confirm | button | Yes, remove access | جی، رسائی ختم کریں |  | `console.invites.remove.confirm` |
| 1170 | Removed |  | Access removed. | رسائی ختم کر دی گئی۔ |  | `console.invites.removed` |
| 1171 | Revoke › Title | heading | Cancel this invite? | یہ دعوت منسوخ کریں؟ |  | `console.invites.revoke.title` |
| 1172 | Revoke › Body | explanation text | {name} will not be able to join as {role}. | {name} بطور {role} شامل نہیں ہو سکے گا۔ |  | `console.invites.revoke.body` |
| 1173 | Revoke › Confirm | button | Yes, cancel invite | جی، دعوت منسوخ کریں |  | `console.invites.revoke.confirm` |
| 1174 | Revoked |  | Invite cancelled. | دعوت منسوخ کر دی گئی۔ |  | `console.invites.revoked` |
| 1175 | Show past |  | Show past coordinators | سابق کوآرڈینیٹرز دکھائیں |  | `console.invites.showPast` |
| 1176 | Show past invites |  | Show past invites | پرانی دعوتیں دکھائیں |  | `console.invites.showPastInvites` |
| 1177 | Status › Active |  | Active | فعال |  | `console.invites.status.active` |
| 1178 | Status › Ended |  | Ended {date} | ختم {date} |  | `console.invites.status.ended` |
| 1179 | Revoke › For |  | for the number ending {digits} | اس نمبر کے لیے جس کے آخری ہندسے {digits} ہیں |  | `console.invites.revoke.for` |
| 1180 | Resent |  | Invite sent again, with a new expiry date. | دعوت دوبارہ بھیج دی گئی، نئی آخری تاریخ کے ساتھ۔ |  | `console.invites.resent` |
| 1181 | Filter › Label | label read by screen readers or shown on a control | Show | دکھائیں |  | `console.invites.filter.label` |
| 1182 | Filter › All | filter option | All | سب |  | `console.invites.filter.all` |
| 1183 | Filter › Empty | filter option | No invites with this status. | اس حالت کی کوئی دعوت نہیں۔ |  | `console.invites.filter.empty` |
| 1184 | Form › Rejected |  | This was not accepted. Check it and try again. | یہ قبول نہیں ہوا۔ اسے دیکھ کر دوبارہ کوشش کریں۔ |  | `console.invites.form.rejected` |
| 1185 | Handover › Mode › Label | label read by screen readers or shown on a control | Hand over to | کس کے سپرد کریں |  | `console.invites.handover.mode.label` |
| 1186 | Handover › Mode › Existing |  | Someone who already has a role | کوئی جس کے پاس پہلے سے ذمہ داری ہے |  | `console.invites.handover.mode.existing` |
| 1187 | Handover › Mode › Phone |  | A phone number | ایک فون نمبر |  | `console.invites.handover.mode.phone` |
| 1188 | Handover › Person › Hint existing |  | People who already have a role. | وہ لوگ جن کے پاس پہلے سے ذمہ داری ہے۔ |  | `console.invites.handover.person.hintExisting` |
| 1189 | Handover › Nobody yet |  | No one else has a role yet. Choose “A phone number” to invite someone new. | ابھی کسی اور کے پاس ذمہ داری نہیں۔ کسی نئے فرد کو دعوت دینے کے لیے “ایک فون نمبر” منتخب کریں۔ |  | `console.invites.handover.nobodyYet` |
| 1190 | Handover › Invite warning |  | We send an invite to this number. When they accept it, they get access and {previous} loses it in the same step. Until then nothing changes. | ہم اس نمبر پر دعوت بھیجیں گے۔ جب وہ قبول کریں گے تو انہیں رسائی ملے گی اور اسی وقت {previous} کی رسائی ختم ہو جائے گی۔ تب تک کچھ نہیں بدلے گا۔ |  | `console.invites.handover.inviteWarning` |
| 1191 | Handover › Send invite |  | Send the handover invite | سپردگی کی دعوت بھیجیں |  | `console.invites.handover.sendInvite` |
| 1192 | Handover invited |  | Invite sent. The handover happens when they accept it. | دعوت بھیج دی گئی۔ سپردگی تب ہو گی جب وہ اسے قبول کریں گے۔ |  | `console.invites.handoverInvited` |
| 1193 | Handover tag |  | Handover | سپردگی |  | `console.invites.handoverTag` |
| 1194 | Handover gone › Title | heading | The handover cannot be sent again | سپردگی کی دعوت دوبارہ نہیں بھیجی جا سکتی |  | `console.invites.handoverGone.title` |
| 1195 | Handover gone › Body | explanation text | The coordinator this invite was going to replace no longer holds the role, so there is nothing to hand over. You can send it again as a plain invite instead. | جس کوآرڈینیٹر کی جگہ یہ دعوت تھی، اب ان کے پاس یہ ذمہ داری نہیں، اس لیے سپرد کرنے کو کچھ نہیں۔ آپ اسے عام دعوت کے طور پر دوبارہ بھیج سکتے ہیں۔ |  | `console.invites.handoverGone.body` |
| 1196 | Handover gone › Resend plain |  | Send without the handover | سپردگی کے بغیر بھیجیں |  | `console.invites.handoverGone.resendPlain` |
| 1197 | Kpi › Waiting | number card | Invites waiting | منتظر دعوتیں |  | `console.invites.kpi.waiting` |
| 1198 | Kpi › Accepted | number card | Invites accepted | قبول شدہ دعوتیں |  | `console.invites.kpi.accepted` |
| 1199 | Kpi › Expired | number card | Invites expired | ختم شدہ دعوتیں |  | `console.invites.kpi.expired` |
| 1200 | Kpi › Active | number card | People with a role | کردار رکھنے والے لوگ |  | `console.invites.kpi.active` |
| 1201 | Search |  | Search invites by name or number | دعوتیں نام یا نمبر سے تلاش کریں |  | `console.invites.search` |
| 1202 | Active › Search |  | Search people by name or number | لوگوں کو نام یا نمبر سے تلاش کریں |  | `console.invites.active.search` |

### Import

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1203 | Title | heading | Bulk import | ایک ساتھ درآمد |  | `console.import.title` |
| 1204 | Step › Upload |  | Choose file | فائل چنیں |  | `console.import.step.upload` |
| 1205 | Step › Check |  | Check | جانچ |  | `console.import.step.check` |
| 1206 | Step › Import |  | Import | درآمد |  | `console.import.step.import` |
| 1207 | File › Choose |  | Choose a CSV file | CSV فائل چنیں |  | `console.import.file.choose` |
| 1208 | File › Help |  | Use the template. One row for each venue. | نمونہ استعمال کریں۔ ہر مقام کی ایک قطار۔ |  | `console.import.file.help` |
| 1209 | Template › Download |  | Download the template | نمونہ ڈاؤن لوڈ کریں |  | `console.import.template.download` |
| 1210 | Dry run › Title | heading | Check the file first | پہلے فائل جانچیں |  | `console.import.dryRun.title` |
| 1211 | Dry run › Help |  | Nothing is saved until you confirm. | تصدیق تک کچھ محفوظ نہیں ہوتا۔ |  | `console.import.dryRun.help` |
| 1212 | Dry run › Run |  | Check file | فائل جانچیں |  | `console.import.dryRun.run` |
| 1213 | Dry run › Running |  | Checking the file | فائل جانچی جا رہی ہے |  | `console.import.dryRun.running` |
| 1214 | Result › Ready › One |  | 1 row is ready | 1 قطار تیار ہے |  | `console.import.result.ready.one` |
| 1215 | Result › Ready › Other |  | {count} rows are ready | {count} قطاریں تیار ہیں |  | `console.import.result.ready.other` |
| 1216 | Result › Errors › One |  | 1 row needs fixing | 1 قطار درست کرنی ہے |  | `console.import.result.errors.one` |
| 1217 | Result › Errors › Other |  | {count} rows need fixing | {count} قطاریں درست کرنی ہیں |  | `console.import.result.errors.other` |
| 1218 | Row › Error |  | Row {row}: {message} | قطار {row}: {message} |  | `console.import.row.error` |
| 1219 | Errors › Download |  | Download the problems as a file | مسائل فائل کی صورت میں ڈاؤن لوڈ کریں |  | `console.import.errors.download` |
| 1220 | Confirm | button | Import {count} rows | {count} قطاریں درآمد کریں |  | `console.import.confirm` |
| 1221 | Done | button | Import finished. {count} rows added. | درآمد مکمل۔ {count} قطاریں شامل ہو گئیں۔ |  | `console.import.done` |
| 1222 | Start again |  | Start again | دوبارہ شروع کریں |  | `console.import.startAgain` |
| 1223 | Empty |  | Choose a file to begin. | شروع کرنے کے لیے فائل چنیں۔ |  | `console.import.empty` |
| 1224 | Intro | explanation text | Add many venues, coordinators or sessions from a CSV file. You see a report first, and nothing is saved until you confirm. | CSV فائل سے بہت سے مقامات، کوآرڈینیٹرز یا نشستیں شامل کریں۔ پہلے رپورٹ دکھائی جاتی ہے اور تصدیق تک کچھ محفوظ نہیں ہوتا۔ |  | `console.import.intro` |
| 1225 | Kind › Label | label read by screen readers or shown on a control | What are you importing? | آپ کیا درآمد کر رہے ہیں؟ |  | `console.import.kind.label` |
| 1226 | Kind › Venues |  | Venues | مقامات |  | `console.import.kind.venues` |
| 1227 | Kind › Coordinators |  | Coordinator invites | کوآرڈینیٹر دعوتیں |  | `console.import.kind.coordinators` |
| 1228 | Kind › Sessions |  | Sessions | نشستیں |  | `console.import.kind.sessions` |
| 1229 | Kind › Venues › Hint | hint under a field | One row for each venue, with its city and area. | ہر مقام کی ایک قطار، شہر اور علاقے کے ساتھ۔ |  | `console.import.kind.venues.hint` |
| 1230 | Kind › Coordinators › Hint | hint under a field | One row for each invite, with the person's WhatsApp number and role. | ہر دعوت کی ایک قطار، فرد کے واٹس ایپ نمبر اور ذمہ داری کے ساتھ۔ |  | `console.import.kind.coordinators.hint` |
| 1231 | Kind › Sessions › Hint | hint under a field | One row for each session, with its venue. | ہر نشست کی ایک قطار، اس کے مقام کے ساتھ۔ |  | `console.import.kind.sessions.hint` |
| 1232 | File › Hint | hint under a field | A CSV file with a header row. Up to {max} rows. | ہیڈر قطار والی CSV فائل۔ زیادہ سے زیادہ {max} قطاریں۔ |  | `console.import.file.hint` |
| 1233 | Nothing saved |  | Nothing has been saved yet. | ابھی کچھ محفوظ نہیں ہوا۔ |  | `console.import.nothingSaved` |
| 1234 | Summary |  | Summary of the check | جانچ کا خلاصہ |  | `console.import.summary` |
| 1235 | Count › Total |  | Rows | قطاریں |  | `console.import.count.total` |
| 1236 | Count › Valid |  | Ready | تیار |  | `console.import.count.valid` |
| 1237 | Count › Duplicate |  | Already there | پہلے سے موجود |  | `console.import.count.duplicate` |
| 1238 | Count › Invalid | error message | Need fixing | درست کرنی ہیں |  | `console.import.count.invalid` |
| 1239 | File problems |  | Problems with the file | فائل کے مسائل |  | `console.import.fileProblems` |
| 1240 | Severity › Error |  | Fix | درست کریں |  | `console.import.severity.error` |
| 1241 | Severity › Warning |  | Note | نوٹ |  | `console.import.severity.warning` |
| 1242 | At line |  | Line {line}: | قطار {line}: |  | `console.import.atLine` |
| 1243 | No rows › Title | heading | No rows found | کوئی قطار نہیں ملی |  | `console.import.noRows.title` |
| 1244 | No rows › Body | explanation text | The file has a header but no data rows. | فائل میں ہیڈر ہے مگر ڈیٹا کی کوئی قطار نہیں۔ |  | `console.import.noRows.body` |
| 1245 | Blocked › Title | heading | This file cannot be imported yet | یہ فائل ابھی درآمد نہیں ہو سکتی |  | `console.import.blocked.title` |
| 1246 | Blocked › Body | explanation text | Fix the problems in your file, then choose it again or press Check again. Nothing is imported until every row is right. | فائل میں مسائل درست کریں، پھر اسے دوبارہ چنیں یا دوبارہ جانچیں دبائیں۔ جب تک ہر قطار درست نہ ہو کچھ درآمد نہیں ہوتا۔ |  | `console.import.blocked.body` |
| 1247 | Blocked › Nothing new |  | Every row is already there, so there is nothing to import. | ہر قطار پہلے سے موجود ہے، اس لیے درآمد کرنے کو کچھ نہیں۔ |  | `console.import.blocked.nothingNew` |
| 1248 | Show all |  | Show every row | ہر قطار دکھائیں |  | `console.import.showAll` |
| 1249 | Show more |  | Show {count} more | {count} مزید دکھائیں |  | `console.import.showMore` |
| 1250 | No problems |  | No problems found in any row. | کسی قطار میں کوئی مسئلہ نہیں ملا۔ |  | `console.import.noProblems` |
| 1251 | Table › Caption |  | Rows checked | جانچی گئی قطاریں |  | `console.import.table.caption` |
| 1252 | Col › Line | table column heading | Line | قطار |  | `console.import.col.line` |
| 1253 | Col › Row | table column heading | Row | اندراج |  | `console.import.col.row` |
| 1254 | Col › Status | table column heading | Status | حالت |  | `console.import.col.status` |
| 1255 | Col › Problems | table column heading | Problems | مسائل |  | `console.import.col.problems` |
| 1256 | Col › Severity | table column heading | Kind | قسم |  | `console.import.col.severity` |
| 1257 | Col › Column | table column heading | Column | کالم |  | `console.import.col.column` |
| 1258 | Col › Message | table column heading | Message | پیغام |  | `console.import.col.message` |
| 1259 | Status › Valid |  | Ready | تیار |  | `console.import.status.valid` |
| 1260 | Status › Duplicate |  | Already there, skipped | پہلے سے موجود، چھوڑ دی گئی |  | `console.import.status.duplicate` |
| 1261 | Status › Invalid | error message | Needs fixing | درست کرنی ہے |  | `console.import.status.invalid` |
| 1262 | Check again |  | Check again | دوبارہ جانچیں |  | `console.import.checkAgain` |
| 1263 | Applying |  | Importing {done} of {total} | {total} میں سے {done} درآمد ہو رہی ہیں |  | `console.import.applying` |
| 1264 | Result |  | Result | نتیجہ |  | `console.import.result` |
| 1265 | Another |  | Import another file | دوسری فائل درآمد کریں |  | `console.import.another` |
| 1266 | Skipped existing › One |  | 1 row was already there and was skipped. | 1 قطار پہلے سے موجود تھی اور چھوڑ دی گئی۔ |  | `console.import.skippedExisting.one` |
| 1267 | Skipped existing › Other |  | {count} rows were already there and were skipped. | {count} قطاریں پہلے سے موجود تھیں اور چھوڑ دی گئیں۔ |  | `console.import.skippedExisting.other` |
| 1268 | Confirm › Title | heading | Import these rows? | یہ قطاریں درآمد کریں؟ |  | `console.import.confirm.title` |
| 1269 | Confirm › Creating › One |  | 1 row will be added. | 1 قطار شامل ہو گی۔ |  | `console.import.confirm.creating.one` |
| 1270 | Confirm › Creating › Other |  | {count} rows will be added. | {count} قطاریں شامل ہوں گی۔ |  | `console.import.confirm.creating.other` |
| 1271 | Confirm › Skipped › One |  | 1 row is already there and will be skipped. | 1 قطار پہلے سے موجود ہے اور چھوڑ دی جائے گی۔ |  | `console.import.confirm.skipped.one` |
| 1272 | Confirm › Skipped › Other |  | {count} rows are already there and will be skipped. | {count} قطاریں پہلے سے موجود ہیں اور چھوڑ دی جائیں گی۔ |  | `console.import.confirm.skipped.other` |
| 1273 | Confirm › Warning |  | Rows are added one at a time, so this cannot be undone in one step. If it stops, check the file again to continue. | قطاریں ایک ایک کر کے شامل ہوتی ہیں، اس لیے یہ ایک قدم میں واپس نہیں ہو سکتا۔ رک جائے تو جاری رکھنے کے لیے فائل دوبارہ جانچیں۔ |  | `console.import.confirm.warning` |
| 1274 | Stopped › Title | heading | The import stopped part of the way | درآمد درمیان میں رک گئی |  | `console.import.stopped.title` |
| 1275 | Stopped › Body | explanation text | {created} rows were added. {remaining} rows were not added. It stopped at line {line}. | {created} قطاریں شامل ہو گئیں۔ {remaining} شامل نہیں ہوئیں۔ یہ قطار {line} پر رک گئی۔ |  | `console.import.stopped.body` |
| 1276 | Stopped › Next | button | Press Check again. Rows already added are skipped, and the rest can be imported. | دوبارہ جانچیں دبائیں۔ جو قطاریں شامل ہو چکیں وہ چھوڑ دی جائیں گی اور باقی درآمد ہو سکتی ہیں۔ |  | `console.import.stopped.next` |
| 1277 | Issue › Csv empty file |  | The file is empty. | فائل خالی ہے۔ |  | `console.import.issue.csvEmptyFile` |
| 1278 | Issue › Csv file too large |  | The file is too large. Split it into smaller files. | فائل بہت بڑی ہے۔ اسے چھوٹی فائلوں میں تقسیم کریں۔ |  | `console.import.issue.csvFileTooLarge` |
| 1279 | Issue › Csv too many rows |  | The file has too many rows. Split it into smaller files. | فائل میں بہت زیادہ قطاریں ہیں۔ اسے چھوٹی فائلوں میں تقسیم کریں۔ |  | `console.import.issue.csvTooManyRows` |
| 1280 | Issue › Csv unterminated quote |  | A quotation mark opened here is never closed. | یہاں کھولا گیا اقتباسی نشان کبھی بند نہیں ہوا۔ |  | `console.import.issue.csvUnterminatedQuote` |
| 1281 | Issue › Csv stray quote |  | A quotation mark is in the wrong place. Put the whole cell in quotes and double any quote inside it. | اقتباسی نشان غلط جگہ ہے۔ پورے خانے کو اقتباسی نشانوں میں رکھیں اور اندر کے نشان کو دوہرا لکھیں۔ |  | `console.import.issue.csvStrayQuote` |
| 1282 | Issue › Missing column |  | The column “{column}” is missing. | کالم “{column}” موجود نہیں۔ |  | `console.import.issue.missingColumn` |
| 1283 | Issue › Duplicate column |  | The column “{column}” appears more than once. | کالم “{column}” ایک سے زیادہ بار آیا ہے۔ |  | `console.import.issue.duplicateColumn` |
| 1284 | Issue › Unknown column |  | The column “{column}” is not used and was ignored. | کالم “{column}” استعمال نہیں ہوتا اور نظر انداز کیا گیا۔ |  | `console.import.issue.unknownColumn` |
| 1285 | Issue › Column count |  | This row has {found} cells but the header has {expected}. | اس قطار میں {found} خانے ہیں مگر ہیڈر میں {expected} ہیں۔ |  | `console.import.issue.columnCount` |
| 1286 | Issue › Required | error message | “{column}” is required. | “{column}” ضروری ہے۔ |  | `console.import.issue.required` |
| 1287 | Issue › Invalid value |  | “{column}” is not valid. | “{column}” درست نہیں۔ |  | `console.import.issue.invalidValue` |
| 1288 | Issue › Invalid number |  | “{column}” must be a number. | “{column}” عدد ہونا چاہیے۔ |  | `console.import.issue.invalidNumber` |
| 1289 | Issue › Invalid boolean |  | “{column}” must be yes or no. | “{column}” میں yes یا no لکھیں۔ |  | `console.import.issue.invalidBoolean` |
| 1290 | Issue › Invalid date |  | “{column}” must be a real date like 2027-03-01. | “{column}” میں اصل تاریخ لکھیں، جیسے 2027-03-01۔ |  | `console.import.issue.invalidDate` |
| 1291 | Issue › Invalid time |  | “{column}” must be a time like 20:00. | “{column}” میں وقت لکھیں، جیسے 20:00۔ |  | `console.import.issue.invalidTime` |
| 1292 | Issue › Invalid days |  | “{column}” must list days like Mon\|Wed. | “{column}” میں دن لکھیں، جیسے Mon\|Wed۔ |  | `console.import.issue.invalidDays` |
| 1293 | Issue › Invalid phone |  | “{column}” is not a valid phone number. | “{column}” درست فون نمبر نہیں۔ |  | `console.import.issue.invalidPhone` |
| 1294 | Issue › Phone not mobile |  | “{column}” must be a mobile number with WhatsApp. | “{column}” واٹس ایپ والا موبائل نمبر ہونا چاہیے۔ |  | `console.import.issue.phoneNotMobile` |
| 1295 | Issue › Unknown city |  | The city in “{column}” is not on our list. | “{column}” کا شہر ہماری فہرست میں نہیں۔ |  | `console.import.issue.unknownCity` |
| 1296 | Issue › Unknown area |  | The area in “{column}” is not on our list for that city. | “{column}” کا علاقہ اس شہر کی فہرست میں نہیں۔ |  | `console.import.issue.unknownArea` |
| 1297 | Issue › Unknown venue |  | No venue that you look after matches “{column}”. | “{column}” سے کوئی ایسا مقام نہیں ملتا جس کی آپ نگرانی کرتے ہیں۔ |  | `console.import.issue.unknownVenue` |
| 1298 | Issue › Ambiguous venue |  | More than one venue matches “{column}”. Add the city. | “{column}” سے ایک سے زیادہ مقامات ملتے ہیں۔ شہر بھی لکھیں۔ |  | `console.import.issue.ambiguousVenue` |
| 1299 | Issue › Unknown role |  | “{column}” must be national_admin, city_coordinator or venue_coordinator. | “{column}” national_admin، city_coordinator یا venue_coordinator ہونا چاہیے۔ |  | `console.import.issue.unknownRole` |
| 1300 | Issue › Out of scope |  | This is outside the places you look after (“{column}”). | یہ آپ کے زیرِ نگرانی مقامات سے باہر ہے (“{column}”)۔ |  | `console.import.issue.outOfScope` |
| 1301 | Issue › Duplicate in file |  | The same entry is already on line {firstLine}. | یہی اندراج قطار {firstLine} پر پہلے آ چکا ہے۔ |  | `console.import.issue.duplicateInFile` |
| 1302 | Issue › Phone repeated |  | This number is also on line {firstLine}, for a different place. | یہ نمبر قطار {firstLine} پر بھی ہے، کسی اور جگہ کے لیے۔ |  | `console.import.issue.phoneRepeated` |
| 1303 | Issue › Already exists |  | This is already in the system, so it will be skipped. | یہ پہلے سے نظام میں ہے، اس لیے چھوڑ دیا جائے گا۔ |  | `console.import.issue.alreadyExists` |
| 1304 | Issue › Already invited |  | This person already has a waiting invite for this role, so it will be skipped. | اس فرد کو اس ذمہ داری کی دعوت پہلے سے بھیجی جا چکی ہے، اس لیے چھوڑ دی جائے گی۔ |  | `console.import.issue.alreadyInvited` |
| 1305 | Issue › Already assigned |  | This person already has this role, so it will be skipped. | اس فرد کے پاس یہ ذمہ داری پہلے سے ہے، اس لیے چھوڑ دی جائے گی۔ |  | `console.import.issue.alreadyAssigned` |
| 1306 | Apply › One |  | Import 1 row | 1 قطار درآمد کریں |  | `console.import.apply.one` |
| 1307 | Apply › Other |  | Import {count} rows | {count} قطاریں درآمد کریں |  | `console.import.apply.other` |
| 1308 | Steps › Label | label read by screen readers or shown on a control | Steps | مراحل |  | `console.import.steps.label` |
| 1309 | Step › Current |  | Step {number} of {total} | مرحلہ {number} از {total} |  | `console.import.step.current` |
| 1310 | Issue › Invalid reference |  | “{column}” points to something that does not exist. | “{column}” کسی ایسی چیز کی طرف اشارہ کرتا ہے جو موجود نہیں۔ |  | `console.import.issue.invalidReference` |
| 1311 | Issue › Area not in city |  | The area in “{column}” belongs to another city. | “{column}” میں دیا گیا علاقہ کسی اور شہر کا ہے۔ |  | `console.import.issue.areaNotInCity` |
| 1312 | Issue › Already there |  | This is already there, or earlier in this file, so it will be skipped. | یہ پہلے سے موجود ہے، یا اسی فائل میں پہلے آ چکا ہے، اس لیے چھوڑ دیا جائے گا۔ |  | `console.import.issue.alreadyThere` |
| 1313 | Refused › Title | heading | Nothing was imported | کچھ بھی امپورٹ نہیں ہوا |  | `console.import.refused.title` |
| 1314 | Refused › Body | explanation text | Something changed since the check, and some rows were refused. No row was saved. Fix the rows marked below, then check the file again. | جانچ کے بعد کچھ بدل گیا اور کچھ قطاریں قبول نہیں ہوئیں۔ کوئی قطار محفوظ نہیں ہوئی۔ نیچے نشان زدہ قطاریں درست کریں، پھر فائل دوبارہ جانچیں۔ |  | `console.import.refused.body` |
| 1315 | Failed › Nothing saved |  | No row was saved. It is safe to try again. | کوئی قطار محفوظ نہیں ہوئی۔ دوبارہ کوشش کرنا محفوظ ہے۔ |  | `console.import.failed.nothingSaved` |
| 1316 | Server checked |  | Checked by the server against what is already there. | سرور نے پہلے سے موجود ریکارڈ کے ساتھ جانچ لیا ہے۔ |  | `console.import.serverChecked` |
| 1317 | Importing |  | Importing. All rows are saved together, or none are. | امپورٹ ہو رہا ہے۔ سب قطاریں ایک ساتھ محفوظ ہوں گی، یا کوئی بھی نہیں۔ |  | `console.import.importing` |
| 1318 | Confirm › All or nothing |  | All rows are saved together in one step. If any row is refused, nothing is saved. | سب قطاریں ایک ہی قدم میں ایک ساتھ محفوظ ہوں گی۔ اگر کوئی قطار قبول نہ ہوئی تو کچھ بھی محفوظ نہیں ہو گا۔ |  | `console.import.confirm.allOrNothing` |
| 1319 | Problems › Title | heading | Problems to fix | درست کرنے کے مسائل |  | `console.import.problems.title` |

### Exports

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1320 | Title | heading | Exports | برآمدات |  | `console.exports.title` |
| 1321 | Kind › Registrations |  | Registrations | رجسٹریشنز |  | `console.exports.kind.registrations` |
| 1322 | Kind › Attendance |  | Attendance | حاضری |  | `console.exports.kind.attendance` |
| 1323 | Filter › City | filter option | City | شہر |  | `console.exports.filter.city` |
| 1324 | Filter › Venue | filter option | Venue | مقام |  | `console.exports.filter.venue` |
| 1325 | Filter › Dates | filter option | Dates | تاریخیں |  | `console.exports.filter.dates` |
| 1326 | Format › Csv |  | CSV file | CSV فائل |  | `console.exports.format.csv` |
| 1327 | Generate |  | Create export | برآمد بنائیں |  | `console.exports.generate` |
| 1328 | Generating |  | Creating your file | آپ کی فائل بن رہی ہے |  | `console.exports.generating` |
| 1329 | Ready |  | Your file is ready | آپ کی فائل تیار ہے |  | `console.exports.ready` |
| 1330 | Download |  | Download | ڈاؤن لوڈ |  | `console.exports.download` |
| 1331 | Privacy |  | This file has personal details. Share it only with people who need it. | اس فائل میں ذاتی معلومات ہیں۔ صرف انہی کو دیں جنہیں ضرورت ہو۔ |  | `console.exports.privacy` |
| 1332 | Empty |  | Nothing to export for these filters. | ان فلٹرز کے لیے کچھ برآمد کرنے کو نہیں۔ |  | `console.exports.empty` |
| 1333 | History › Title | heading | Recent exports | حالیہ برآمدات |  | `console.exports.history.title` |
| 1334 | History › Empty |  | No exports yet. | ابھی کوئی برآمد نہیں۔ |  | `console.exports.history.empty` |
| 1335 | Intro | explanation text | Download the people who registered for a session, a venue or a whole city. | کسی نشست، مقام یا پورے شہر میں رجسٹر ہونے والوں کی فہرست ڈاؤن لوڈ کریں۔ |  | `console.exports.intro` |
| 1336 | Privacy › Title | heading | Personal details | ذاتی معلومات |  | `console.exports.privacy.title` |
| 1337 | Audited |  | Every export is recorded in the audit log. | ہر برآمد آڈٹ لاگ میں درج ہوتی ہے۔ |  | `console.exports.audited` |
| 1338 | Target › Label | label read by screen readers or shown on a control | Export by | برآمد کا طریقہ |  | `console.exports.target.label` |
| 1339 | Target › Session |  | Session | نشست |  | `console.exports.target.session` |
| 1340 | Choose hint | hint under a field | Choose one to see how many sessions it covers. | چنیں تاکہ معلوم ہو کتنی نشستیں شامل ہیں۔ |  | `console.exports.chooseHint` |
| 1341 | Will export › One |  | 1 session will be exported. | 1 نشست برآمد ہو گی۔ |  | `console.exports.willExport.one` |
| 1342 | Will export › Other |  | {count} sessions will be exported. | {count} نشستیں برآمد ہوں گی۔ |  | `console.exports.willExport.other` |
| 1343 | Progress |  | Exported {done} of {total} sessions | {total} میں سے {done} نشستیں برآمد ہو چکیں |  | `console.exports.progress` |
| 1344 | Done › One |  | Your file is saved, with 1 session. | آپ کی فائل محفوظ ہو گئی، اس میں 1 نشست ہے۔ |  | `console.exports.done.one` |
| 1345 | Done › Other |  | Your file is saved, with {count} sessions. | آپ کی فائل محفوظ ہو گئی، اس میں {count} نشستیں ہیں۔ |  | `console.exports.done.other` |
| 1346 | Failed |  | The export did not finish | برآمد مکمل نہیں ہوئی |  | `console.exports.failed` |
| 1347 | Partial not saved |  | {done} of {total} sessions were exported before it stopped. No file was saved. Please try again. | رکنے سے پہلے {total} میں سے {done} نشستیں برآمد ہوئیں۔ کوئی فائل محفوظ نہیں ہوئی۔ براہ کرم دوبارہ کوشش کریں۔ |  | `console.exports.partialNotSaved` |
| 1348 | Unreadable |  | One of the files could not be read, so no file was saved. | ایک فائل پڑھی نہ جا سکی، اس لیے کوئی فائل محفوظ نہیں ہوئی۔ |  | `console.exports.unreadable` |
| 1349 | Saved |  | Your file was saved. Share it only with people who need it. | آپ کی فائل محفوظ ہو گئی۔ اسے صرف انہی کو دیں جنہیں ضرورت ہو۔ |  | `console.exports.saved` |
| 1350 | Registrations › Title | heading | Registrations | رجسٹریشنز |  | `console.exports.registrations.title` |
| 1351 | Registrations › Title for |  | Registrations: {session} | رجسٹریشنز: {session} |  | `console.exports.registrations.titleFor` |
| 1352 | Registrations › Back | button | Back to sessions | نشستوں پر واپس |  | `console.exports.registrations.back` |
| 1353 | Registrations › Sensitive |  | These are real people. Names and numbers are only for running the session. | یہ اصل لوگ ہیں۔ نام اور نمبر صرف نشست چلانے کے لیے ہیں۔ |  | `console.exports.registrations.sensitive` |
| 1354 | Registrations › Empty › Title | heading | No registrations yet | ابھی کوئی رجسٹریشن نہیں |  | `console.exports.registrations.empty.title` |
| 1355 | Registrations › Empty › Body | explanation text | Registrations appear here as people sign up. | لوگ رجسٹر ہوں گے تو یہاں نظر آئیں گے۔ |  | `console.exports.registrations.empty.body` |
| 1356 | Col › Name | table column heading | Name | نام |  | `console.exports.col.name` |
| 1357 | Col › Phone | table column heading | WhatsApp number | واٹس ایپ نمبر |  | `console.exports.col.phone` |
| 1358 | Col › Section | table column heading | Section | حصہ |  | `console.exports.col.section` |
| 1359 | Col › Party size | table column heading | People | افراد |  | `console.exports.col.partySize` |
| 1360 | Col › Status | table column heading | Status | حالت |  | `console.exports.col.status` |
| 1361 | Col › Whatsapp | table column heading | WhatsApp alerts | واٹس ایپ اطلاعات |  | `console.exports.col.whatsapp` |
| 1362 | Col › Registered | table column heading | Registered | رجسٹر ہوئے |  | `console.exports.col.registered` |
| 1363 | No name |  | No name | نام نہیں |  | `console.exports.noName` |
| 1364 | Status › Confirmed |  | Confirmed | تصدیق شدہ |  | `console.exports.status.confirmed` |
| 1365 | Status › Waitlisted |  | Waiting list | انتظار فہرست |  | `console.exports.status.waitlisted` |
| 1366 | Status › Cancelled |  | Cancelled | منسوخ |  | `console.exports.status.cancelled` |
| 1367 | Filter › Occurrence | filter option | Day | دن |  | `console.exports.filter.occurrence` |
| 1368 | Filter › All occurrences | filter option | All days | تمام دن |  | `console.exports.filter.allOccurrences` |
| 1369 | Totals › Label | label read by screen readers or shown on a control | Totals | کل |  | `console.exports.totals.label` |
| 1370 | Totals › Registrations |  | Registrations | رجسٹریشنز |  | `console.exports.totals.registrations` |
| 1371 | Totals › People |  | People | افراد |  | `console.exports.totals.people` |
| 1372 | Totals › Waitlisted |  | On the waiting list | انتظار فہرست میں |  | `console.exports.totals.waitlisted` |
| 1373 | Intro › Scoped |  | Download the people who registered at a venue or in a whole city, for the dates you choose. | کسی مقام یا پورے شہر میں رجسٹر ہونے والے لوگوں کی فہرست، آپ کی منتخب تاریخوں کے لیے، ڈاؤن لوڈ کریں۔ |  | `console.exports.intro.scoped` |
| 1374 | All venues |  | All venues | تمام مقامات |  | `console.exports.allVenues` |
| 1375 | Filter › From | filter option | From | سے |  | `console.exports.filter.from` |
| 1376 | Filter › To | filter option | To | تک |  | `console.exports.filter.to` |
| 1377 | Dates › Hint | hint under a field | The day people registered, in Pakistan time. Leave both empty for all dates. | جس دن لوگوں نے رجسٹر کیا، پاکستان کے وقت کے مطابق۔ تمام تاریخوں کے لیے دونوں خالی چھوڑ دیں۔ |  | `console.exports.dates.hint` |
| 1378 | Dates › Order |  | The end date must be on or after the start date. | آخری تاریخ شروع کی تاریخ کے دن یا اس کے بعد ہونی چاہیے۔ |  | `console.exports.dates.order` |
| 1379 | Dates › Invalid | error message | Use a real date. | درست تاریخ لکھیں۔ |  | `console.exports.dates.invalid` |
| 1380 | Venue › Required | error message | Choose a venue. | مقام منتخب کریں۔ |  | `console.exports.venue.required` |
| 1381 | Too many |  | This file would have more than {max} rows. Choose a venue or fewer days. | اس فائل میں {max} سے زیادہ قطاریں ہوں گی۔ کوئی مقام یا کم دن منتخب کریں۔ |  | `console.exports.tooMany` |
| 1382 | Session hint | hint under a field | To export one session, open its registrations from Sessions. | ایک نشست ایکسپورٹ کرنے کے لیے نشستوں میں جا کر اس کی رجسٹریشنز کھولیں۔ |  | `console.exports.sessionHint` |
| 1383 | Saved rows › One |  | Your file is saved, with 1 registration. | آپ کی فائل محفوظ ہو گئی، 1 رجسٹریشن کے ساتھ۔ |  | `console.exports.savedRows.one` |
| 1384 | Saved rows › Other |  | Your file is saved, with {count} registrations. | آپ کی فائل محفوظ ہو گئی، {count} رجسٹریشنز کے ساتھ۔ |  | `console.exports.savedRows.other` |
| 1385 | Registrations › Search |  | Search by name or number | نام یا نمبر سے تلاش کریں |  | `console.exports.registrations.search` |

### Shell

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1386 | App title |  | Quran Circles console | قرآن سرکلز کنسول |  | `console.shell.appTitle` |
| 1387 | Skip to content |  | Skip to main content | مرکزی مواد پر جائیں |  | `console.shell.skipToContent` |
| 1388 | Nav label | label read by screen readers or shown on a control | Main menu | مرکزی مینو |  | `console.shell.navLabel` |
| 1389 | Language |  | Language | زبان |  | `console.shell.language` |
| 1390 | Language › En |  | English | English |  | `console.shell.language.en` |
| 1391 | Language › Ur |  | اردو | اردو |  | `console.shell.language.ur` |
| 1392 | Theme |  | Colours | رنگ |  | `console.shell.theme` |
| 1393 | Theme › System |  | Same as device | ڈیوائس کے مطابق |  | `console.shell.theme.system` |
| 1394 | Theme › Light |  | Light | روشن |  | `console.shell.theme.light` |
| 1395 | Theme › Dark |  | Dark | گہرا |  | `console.shell.theme.dark` |
| 1396 | Text size |  | Text size | متن کا سائز |  | `console.shell.textSize` |
| 1397 | Text size › Step0 |  | Normal | عام |  | `console.shell.textSize.step0` |
| 1398 | Text size › Step1 |  | Large | بڑا |  | `console.shell.textSize.step1` |
| 1399 | Text size › Step2 |  | Larger | زیادہ بڑا |  | `console.shell.textSize.step2` |
| 1400 | Text size › Step3 |  | Largest | سب سے بڑا |  | `console.shell.textSize.step3` |
| 1401 | Sign out |  | Sign out | سائن آؤٹ کریں |  | `console.shell.signOut` |
| 1402 | Unnamed |  | Coordinator | کوآرڈینیٹر |  | `console.shell.unnamed` |
| 1403 | Cancel | button | Cancel | منسوخ کریں |  | `console.shell.cancel` |
| 1404 | Keep |  | Keep it | رہنے دیں |  | `console.shell.keep` |
| 1405 | Load more |  | Show more | مزید دکھائیں |  | `console.shell.loadMore` |
| 1406 | Filters |  | Filters | فلٹرز |  | `console.shell.filters` |
| 1407 | Filter › City | filter option | City | شہر |  | `console.shell.filter.city` |
| 1408 | Filter › Venue | filter option | Venue | مقام |  | `console.shell.filter.venue` |
| 1409 | Filter › Status | filter option | Status | حالت |  | `console.shell.filter.status` |
| 1410 | Filter › All | filter option | All | سب |  | `console.shell.filter.all` |
| 1411 | Retry after |  | Please wait {seconds} seconds first. | براہ کرم پہلے {seconds} سیکنڈ انتظار کریں۔ |  | `console.shell.retryAfter` |
| 1412 | Forbidden › Title | heading | You cannot open this page | آپ یہ صفحہ نہیں کھول سکتے |  | `console.shell.forbidden.title` |
| 1413 | Forbidden › Body | explanation text | Your role does not include this page. Ask an admin if you need it. | آپ کی ذمہ داری میں یہ صفحہ شامل نہیں۔ ضرورت ہو تو منتظم سے پوچھیں۔ |  | `console.shell.forbidden.body` |
| 1414 | Not found › Title | heading | We could not find that page | ہمیں وہ صفحہ نہیں ملا |  | `console.shell.notFound.title` |
| 1415 | Not found › Body | explanation text | Use the menu to go to a page. | کسی صفحے پر جانے کے لیے مینو استعمال کریں۔ |  | `console.shell.notFound.body` |
| 1416 | Brand sub |  | Console | کنسول |  | `console.shell.brandSub` |
| 1417 | Tools label | label read by screen readers or shown on a control | Display settings | ڈسپلے کی ترتیبات |  | `console.shell.toolsLabel` |
| 1418 | Feature off › Title | heading | This page is switched off | یہ صفحہ بند ہے |  | `console.shell.featureOff.title` |
| 1419 | Feature off › Body | explanation text | It appears here once the feature is turned on. Ask a national admin if you expected it. | یہ سہولت آن ہونے پر یہاں نظر آئے گا۔ اگر آپ کو اس کی توقع تھی تو قومی منتظم سے پوچھیں۔ |  | `console.shell.featureOff.body` |

### Nav

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1420 | Sessions |  | Sessions | نشستیں |  | `console.nav.sessions` |
| 1421 | Venues |  | Venues | مقامات |  | `console.nav.venues` |
| 1422 | Coordinators |  | Coordinators | کوآرڈینیٹرز |  | `console.nav.coordinators` |
| 1423 | Exports |  | Exports | برآمدات |  | `console.nav.exports` |
| 1424 | Import |  | Bulk import | ایک ساتھ درآمد |  | `console.nav.import` |
| 1425 | Audit |  | Audit log | آڈٹ لاگ |  | `console.nav.audit` |
| 1426 | Settings |  | Settings | ترتیبات |  | `console.nav.settings` |
| 1427 | Daily ayahs |  | Ayah of the day | آج کی آیت |  | `console.nav.dailyAyahs` |

### Roles

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1428 | National admin |  | National admin | قومی منتظم |  | `console.roles.national_admin` |
| 1429 | City coordinator |  | City coordinator | شہر کا کوآرڈینیٹر |  | `console.roles.city_coordinator` |
| 1430 | Venue coordinator |  | Venue coordinator | مقام کا کوآرڈینیٹر |  | `console.roles.venue_coordinator` |

### Scope

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1431 | National |  | All of Pakistan | پورا پاکستان |  | `console.scope.national` |

### Phone

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1432 | Error › Empty | error message | Enter a WhatsApp number. | واٹس ایپ نمبر لکھیں۔ |  | `console.phone.error.empty` |
| 1433 | Error › Invalid | error message | That number is not right. Try 0300 1234567. | یہ نمبر درست نہیں۔ اس طرح لکھیں: 0300 1234567۔ |  | `console.phone.error.invalid` |
| 1434 | Error › Not mobile | error message | Use a mobile number that has WhatsApp. | واٹس ایپ والا موبائل نمبر لکھیں۔ |  | `console.phone.error.notMobile` |

### Sign in

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1435 | Title | heading | Sign in | سائن ان کریں |  | `console.signIn.title` |
| 1436 | Intro | explanation text | Coordinators sign in with a code sent to their WhatsApp. | کوآرڈینیٹرز واٹس ایپ پر بھیجے گئے کوڈ سے سائن ان کرتے ہیں۔ |  | `console.signIn.intro` |
| 1437 | Phone › Label | label read by screen readers or shown on a control | WhatsApp number | واٹس ایپ نمبر |  | `console.signIn.phone.label` |
| 1438 | Phone › Hint | hint under a field | For example 0300 1234567. | مثال کے طور پر 0300 1234567۔ |  | `console.signIn.phone.hint` |
| 1439 | Send code |  | Send code | کوڈ بھیجیں |  | `console.signIn.sendCode` |
| 1440 | Code › Label | label read by screen readers or shown on a control | 6-digit code | 6 ہندسوں کا کوڈ |  | `console.signIn.code.label` |
| 1441 | Code › Hint | hint under a field | Enter the code we sent to your WhatsApp. | واٹس ایپ پر بھیجا گیا کوڈ لکھیں۔ |  | `console.signIn.code.hint` |
| 1442 | Code › Invalid | error message | Enter the 6 digits of the code. | کوڈ کے 6 ہندسے لکھیں۔ |  | `console.signIn.code.invalid` |
| 1443 | Verify |  | Sign in | سائن ان کریں |  | `console.signIn.verify` |
| 1444 | Resend |  | Send a new code | نیا کوڈ بھیجیں |  | `console.signIn.resend` |
| 1445 | Resend in |  | You can ask for a new code in {seconds} seconds. | آپ {seconds} سیکنڈ بعد نیا کوڈ مانگ سکتے ہیں۔ |  | `console.signIn.resendIn` |
| 1446 | Change number |  | Use a different number | دوسرا نمبر استعمال کریں |  | `console.signIn.changeNumber` |
| 1447 | No access › Title | heading | This number cannot open the console | یہ نمبر کنسول نہیں کھول سکتا |  | `console.signIn.noAccess.title` |
| 1448 | No access › Body | explanation text | Ask a coordinator or admin to invite you first. | پہلے کسی کوآرڈینیٹر یا منتظم سے دعوت بھیجنے کو کہیں۔ |  | `console.signIn.noAccess.body` |

### Sessions

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1449 | Title | heading | Sessions | نشستیں |  | `console.sessions.title` |
| 1450 | Intro | explanation text | Sessions at the venues you look after. Open one to see who registered. | آپ کے مقامات کی نشستیں۔ رجسٹر ہونے والوں کو دیکھنے کے لیے کوئی نشست کھولیں۔ |  | `console.sessions.intro` |
| 1451 | Empty › Title | heading | No sessions found | کوئی نشست نہیں ملی |  | `console.sessions.empty.title` |
| 1452 | Empty › Body | explanation text | Try another filter, or add sessions with the bulk import. | دوسرا فلٹر آزمائیں، یا بلک امپورٹ سے نشستیں شامل کریں۔ |  | `console.sessions.empty.body` |
| 1453 | Col › Title | heading | Session | نشست |  | `console.sessions.col.title` |
| 1454 | Col › Venue | table column heading | Venue | مقام |  | `console.sessions.col.venue` |
| 1455 | Col › City | table column heading | City | شہر |  | `console.sessions.col.city` |
| 1456 | Col › When | table column heading | When | کب |  | `console.sessions.col.when` |
| 1457 | Col › Section | table column heading | Section | حصہ |  | `console.sessions.col.section` |
| 1458 | Col › Language | table column heading | Language | زبان |  | `console.sessions.col.language` |
| 1459 | Col › Seats | table column heading | Seats | جگہیں |  | `console.sessions.col.seats` |
| 1460 | Col › Status | table column heading | Status | حالت |  | `console.sessions.col.status` |
| 1461 | Col › Actions | table column heading | Actions | کارروائیاں |  | `console.sessions.col.actions` |
| 1462 | Registrations |  | Registrations | رجسٹریشنز |  | `console.sessions.registrations` |
| 1463 | Seats › Of |  | {taken} of {capacity} | {taken} از {capacity} |  | `console.sessions.seats.of` |
| 1464 | Seats › Unlimited |  | No limit | کوئی حد نہیں |  | `console.sessions.seats.unlimited` |
| 1465 | Status › Draft |  | Draft | مسودہ |  | `console.sessions.status.draft` |
| 1466 | Status › Published |  | Published | شائع شدہ |  | `console.sessions.status.published` |
| 1467 | Status › Cancelled |  | Cancelled | منسوخ |  | `console.sessions.status.cancelled` |
| 1468 | Status › Archived |  | Archived | محفوظ شدہ |  | `console.sessions.status.archived` |
| 1469 | Kpi › Total | number card | Sessions | نشستیں |  | `console.sessions.kpi.total` |
| 1470 | Kpi › This week | number card | Meeting in the next 7 days | اگلے 7 دنوں میں ہونے والی |  | `console.sessions.kpi.thisWeek` |
| 1471 | Kpi › Full | number card | Full | بھری ہوئی |  | `console.sessions.kpi.full` |
| 1472 | Kpi › Waiting | number card | Waiting for approval | منظوری کی منتظر |  | `console.sessions.kpi.waiting` |
| 1473 | Search |  | Search sessions, venues or teachers | نشستیں، مقامات یا معلم تلاش کریں |  | `console.sessions.search` |
| 1474 | Add | button | Add sessions | نشستیں شامل کریں |  | `console.sessions.add` |

### Venues

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1475 | Title | heading | Venues | مقامات |  | `console.venues.title` |
| 1476 | Intro | explanation text | Venues you look after, with their public contact numbers. | آپ کے زیرِ نگرانی مقامات، ان کے عوامی رابطہ نمبروں کے ساتھ۔ |  | `console.venues.intro` |
| 1477 | Col › Name | table column heading | Venue | مقام |  | `console.venues.col.name` |
| 1478 | Col › City | table column heading | City | شہر |  | `console.venues.col.city` |
| 1479 | Col › Address | table column heading | Address | پتہ |  | `console.venues.col.address` |
| 1480 | Col › Phone | table column heading | Contact number | رابطہ نمبر |  | `console.venues.col.phone` |
| 1481 | Col › Women section | table column heading | Women's section | خواتین کا حصہ |  | `console.venues.col.womenSection` |
| 1482 | Col › Status | table column heading | Status | حالت |  | `console.venues.col.status` |
| 1483 | Status › Active |  | Active | فعال |  | `console.venues.status.active` |
| 1484 | Status › Archived |  | Archived | محفوظ شدہ |  | `console.venues.status.archived` |
| 1485 | Include archived |  | Show archived venues | محفوظ شدہ مقامات دکھائیں |  | `console.venues.includeArchived` |
| 1486 | Empty › Title | heading | No venues found | کوئی مقام نہیں ملا |  | `console.venues.empty.title` |
| 1487 | Empty › Body | explanation text | Try another city, or add venues with the bulk import. | دوسرا شہر آزمائیں، یا بلک امپورٹ سے مقامات شامل کریں۔ |  | `console.venues.empty.body` |
| 1488 | Kpi › Active | number card | Venues | مقامات |  | `console.venues.kpi.active` |
| 1489 | Kpi › Women section | number card | With a women’s section | خواتین کے حصے والے |  | `console.venues.kpi.womenSection` |
| 1490 | Kpi › No contact | number card | No contact number | رابطہ نمبر نہیں |  | `console.venues.kpi.noContact` |
| 1491 | Kpi › Archived | number card | Archived | محفوظ شدہ |  | `console.venues.kpi.archived` |
| 1492 | Search |  | Search venues or addresses | مقامات یا پتے تلاش کریں |  | `console.venues.search` |
| 1493 | Add | button | Add venues | مقامات شامل کریں |  | `console.venues.add` |

### Audit

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1494 | Title | heading | Audit log | آڈٹ لاگ |  | `console.audit.title` |
| 1495 | Intro | explanation text | Who did what, and when. It lists actions and records, not people's details. | کس نے کب کیا کیا۔ اس میں کارروائیاں اور ریکارڈ ہیں، لوگوں کی ذاتی معلومات نہیں۔ |  | `console.audit.intro` |
| 1496 | Col › When | table column heading | When | کب |  | `console.audit.col.when` |
| 1497 | Col › Who | table column heading | Who | کس نے |  | `console.audit.col.who` |
| 1498 | Col › Action | table column heading | Action | کارروائی |  | `console.audit.col.action` |
| 1499 | Col › Record | table column heading | Record | ریکارڈ |  | `console.audit.col.record` |
| 1500 | Col › Scope | table column heading | Where | کہاں |  | `console.audit.col.scope` |
| 1501 | System |  | System | نظام |  | `console.audit.system` |
| 1502 | Filter › Entity type | filter option | Record type | ریکارڈ کی قسم |  | `console.audit.filter.entityType` |
| 1503 | Filter › From | filter option | From | از |  | `console.audit.filter.from` |
| 1504 | Filter › To | filter option | To | تک |  | `console.audit.filter.to` |
| 1505 | Empty › Title | heading | Nothing in the log | لاگ میں کچھ نہیں |  | `console.audit.empty.title` |
| 1506 | Empty › Body | explanation text | Try other dates or filters. | دوسری تاریخیں یا فلٹر آزمائیں۔ |  | `console.audit.empty.body` |
| 1507 | Kpi › Entries | number card | Entries | اندراجات |  | `console.audit.kpi.entries` |
| 1508 | Kpi › People | number card | People | لوگ |  | `console.audit.kpi.people` |
| 1509 | Kpi › Exports | number card | Exports | ایکسپورٹس |  | `console.audit.kpi.exports` |
| 1510 | Search |  | Search people, actions or records | لوگ، کام یا ریکارڈ تلاش کریں |  | `console.audit.search` |

### Settings

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1511 | Title | heading | Settings | ترتیبات |  | `console.settings.title` |
| 1512 | Intro | explanation text | Platform settings for the whole country. Only national admins can change them. | پورے ملک کے لیے پلیٹ فارم کی ترتیبات۔ انہیں صرف قومی منتظم بدل سکتے ہیں۔ |  | `console.settings.intro` |
| 1513 | Hijri › Label | label read by screen readers or shown on a control | Hijri date adjustment | ہجری تاریخ کی تبدیلی |  | `console.settings.hijri.label` |
| 1514 | Hijri › Hint | hint under a field | Pakistan starts months by moon sighting. Add or remove days so the apps show the right date. | پاکستان میں مہینے چاند دیکھ کر شروع ہوتے ہیں۔ ایپ میں درست تاریخ کے لیے دن بڑھائیں یا گھٹائیں۔ |  | `console.settings.hijri.hint` |
| 1515 | Hijri › None |  | No change | کوئی تبدیلی نہیں |  | `console.settings.hijri.none` |
| 1516 | Hijri › Days |  | {days} days | {days} دن |  | `console.settings.hijri.days` |
| 1517 | Hijri › Invalid | error message | Choose a value from −2 to +2. | −2 سے +2 تک کوئی قدر چنیں۔ |  | `console.settings.hijri.invalid` |
| 1518 | Season › Label | label read by screen readers or shown on a control | Season on the home screen | ہوم اسکرین پر موسم |  | `console.settings.season.label` |
| 1519 | Season › Hint | hint under a field | Dora or Circles leads the home screen in the apps. | ایپ کی ہوم اسکرین پر دورہ یا سرکلز پہلے آتے ہیں۔ |  | `console.settings.season.hint` |
| 1520 | Season › Dora |  | Dora | دورہ |  | `console.settings.season.dora` |
| 1521 | Season › Circles |  | Circles | سرکلز |  | `console.settings.season.circles` |
| 1522 | Cap › Label | label read by screen readers or shown on a control | WhatsApp messages per person each day | فی فرد روزانہ واٹس ایپ پیغامات |  | `console.settings.cap.label` |
| 1523 | Cap › Hint | hint under a field | From 0 to 5. | 0 سے 5 تک۔ |  | `console.settings.cap.hint` |
| 1524 | Cap › Invalid | error message | Use a whole number from 0 to 5. | 0 سے 5 تک پورا عدد لکھیں۔ |  | `console.settings.cap.invalid` |
| 1525 | Threshold › Label | label read by screen readers or shown on a control | Circle request alert level | سرکل درخواست کی اطلاع کی حد |  | `console.settings.threshold.label` |
| 1526 | Threshold › Hint | hint under a field | How many requests in one area before it is flagged. | ایک علاقے میں کتنی درخواستوں پر اسے نشان زد کیا جائے۔ |  | `console.settings.threshold.hint` |
| 1527 | Threshold › Invalid | error message | Use a whole number from 1 to 1000. | 1 سے 1000 تک پورا عدد لکھیں۔ |  | `console.settings.threshold.invalid` |
| 1528 | Save | button | Save | محفوظ کریں |  | `console.settings.save` |
| 1529 | Saved |  | Settings saved. | ترتیبات محفوظ ہو گئیں۔ |  | `console.settings.saved` |
| 1530 | Lead › Legend |  | Reminder before a session | نشست سے پہلے یاد دہانی |  | `console.settings.lead.legend` |
| 1531 | Lead › Hint | hint under a field | How many minutes before a session starts its reminder is sent. From 5 to 1440 (24 hours). | نشست شروع ہونے سے کتنے منٹ پہلے یاد دہانی بھیجی جائے۔ 5 سے 1440 (24 گھنٹے) تک۔ |  | `console.settings.lead.hint` |
| 1532 | Lead › Dora |  | Dora sessions (minutes) | دورہ کی نشستیں (منٹ) |  | `console.settings.lead.dora` |
| 1533 | Lead › Circles |  | Circles sessions (minutes) | حلقوں کی نشستیں (منٹ) |  | `console.settings.lead.circles` |
| 1534 | Lead › Invalid | error message | Use a whole number from 5 to 1440. | 5 سے 1440 تک پورا عدد لکھیں۔ |  | `console.settings.lead.invalid` |

### Kpi

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1535 | Label | label read by screen readers or shown on a control | Numbers at a glance | ایک نظر میں اعداد |  | `console.kpi.label` |
| 1536 | Partial |  | These numbers count the rows loaded so far. Load more to include the rest. | یہ اعداد اب تک لوڈ ہونے والی قطاروں کے ہیں۔ باقی شامل کرنے کے لیے مزید لوڈ کریں۔ |  | `console.kpi.partial` |

### Search

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1537 | No match › Title | heading | Nothing matches “{query}” | “{query}” سے کچھ نہیں ملا |  | `console.search.noMatch.title` |
| 1538 | No match › Body | explanation text | Check the spelling, or clear the search to see every row. | ہجے دیکھیں، یا سب قطاریں دیکھنے کے لیے تلاش صاف کریں۔ |  | `console.search.noMatch.body` |
| 1539 | No match › Partial |  | Only the rows loaded so far were searched. Load more, or check the spelling. | صرف اب تک لوڈ ہونے والی قطاروں میں تلاش کی گئی۔ مزید لوڈ کریں، یا ہجے دیکھیں۔ |  | `console.search.noMatch.partial` |

### Daily ayahs

| # | Where | What it is | English | Urdu now | Fix | Key |
|---|---|---|---|---|---|---|
| 1540 | Title | heading | Ayah of the day | آج کی آیت |  | `console.dailyAyahs.title` |
| 1541 | Intro | explanation text | Choose the ayah people see on Home each day. Only the surah and ayah numbers are kept; the app shows the Arabic and the translation. | ہر دن ہوم پر دکھائی جانے والی آیت چنیں۔ صرف سورت اور آیت کے نمبر محفوظ ہوتے ہیں؛ عربی متن اور ترجمہ ایپ دکھاتی ہے۔ |  | `console.dailyAyahs.intro` |
| 1542 | Kpi › National | number card | National picks | قومی انتخاب |  | `console.dailyAyahs.kpi.national` |
| 1543 | Kpi › Venue | number card | Venue picks | مقام کے انتخاب |  | `console.dailyAyahs.kpi.venue` |
| 1544 | Kpi › Circle | number card | Circle picks | سرکل کے انتخاب |  | `console.dailyAyahs.kpi.circle` |
| 1545 | Kpi › Gaps | number card | Days on the built-in list | بلٹ اِن فہرست والے دن |  | `console.dailyAyahs.kpi.gaps` |
| 1546 | List › Title | heading | Picks | انتخاب |  | `console.dailyAyahs.list.title` |
| 1547 | Filter › From | filter option | From | سے |  | `console.dailyAyahs.filter.from` |
| 1548 | Filter › To | filter option | To | تک |  | `console.dailyAyahs.filter.to` |
| 1549 | Filter › Scope | filter option | Show picks for | کس کے انتخاب دکھائیں |  | `console.dailyAyahs.filter.scope` |
| 1550 | Filter › All | filter option | All | سب |  | `console.dailyAyahs.filter.all` |
| 1551 | Filter › National | filter option | National | قومی |  | `console.dailyAyahs.filter.national` |
| 1552 | Filter › Venue | filter option | Venues | مقامات |  | `console.dailyAyahs.filter.venue` |
| 1553 | Filter › Circle | filter option | Circles | سرکلز |  | `console.dailyAyahs.filter.circle` |
| 1554 | Range › Title | heading | Choose the dates to show | دکھانے کے لیے تاریخیں چنیں |  | `console.dailyAyahs.range.title` |
| 1555 | Range › Invalid | error message | The start date is after the end date. | شروع کی تاریخ آخری تاریخ کے بعد ہے۔ |  | `console.dailyAyahs.range.invalid` |
| 1556 | Range › Too big | error message | Show at most {days} days at once. | ایک وقت میں زیادہ سے زیادہ {days} دن دکھائیں۔ |  | `console.dailyAyahs.range.tooBig` |
| 1557 | Scope › Venue |  | Venue | مقام |  | `console.dailyAyahs.scope.venue` |
| 1558 | Scope › Circle |  | Circle | سرکل |  | `console.dailyAyahs.scope.circle` |
| 1559 | Col › Date | table column heading | Date | تاریخ |  | `console.dailyAyahs.col.date` |
| 1560 | Col › Ayah | table column heading | Ayah | آیت |  | `console.dailyAyahs.col.ayah` |
| 1561 | Col › Place | table column heading | Applies to | کس کے لیے |  | `console.dailyAyahs.col.place` |
| 1562 | Col › Updated | table column heading | Last changed | آخری تبدیلی |  | `console.dailyAyahs.col.updated` |
| 1563 | Col › Actions | table column heading | Actions | اقدامات |  | `console.dailyAyahs.col.actions` |
| 1564 | Col › Source | table column heading | Comes from | کہاں سے |  | `console.dailyAyahs.col.source` |
| 1565 | Ref |  | Surah {surah}, ayah {ayah} | سورت {surah}، آیت {ayah} |  | `console.dailyAyahs.ref` |
| 1566 | Place › Circle |  | {circle} at {venue} | {venue} میں {circle} |  | `console.dailyAyahs.place.circle` |
| 1567 | Place › Unknown |  | A place outside your list | آپ کی فہرست سے باہر کی جگہ |  | `console.dailyAyahs.place.unknown` |
| 1568 | View only |  | View only | صرف دیکھ سکتے ہیں |  | `console.dailyAyahs.viewOnly` |
| 1569 | Row › Change | button | Change | بدلیں |  | `console.dailyAyahs.row.change` |
| 1570 | Row › Change label | label read by screen readers or shown on a control | Change the pick for {date}, {place} | {date}، {place} کا انتخاب بدلیں |  | `console.dailyAyahs.row.changeLabel` |
| 1571 | Row › Remove | button | Remove | ہٹائیں |  | `console.dailyAyahs.row.remove` |
| 1572 | Row › Remove label | label read by screen readers or shown on a control | Remove the pick for {date}, {place} | {date}، {place} کا انتخاب ہٹائیں |  | `console.dailyAyahs.row.removeLabel` |
| 1573 | Empty › Title | heading | No picks for these dates | ان تاریخوں کے لیے کوئی انتخاب نہیں |  | `console.dailyAyahs.empty.title` |
| 1574 | Empty › Body | explanation text | Each day uses the next rule below: the national pick, or the built-in list. | ہر دن نیچے دیا گیا اگلا اصول لاگو ہوگا: قومی انتخاب، یا بلٹ اِن فہرست۔ |  | `console.dailyAyahs.empty.body` |
| 1575 | Add | button | Set a pick | انتخاب مقرر کریں |  | `console.dailyAyahs.add` |
| 1576 | Form › Title | heading | Set a pick | انتخاب مقرر کریں |  | `console.dailyAyahs.form.title` |
| 1577 | Form › Date |  | Date | تاریخ |  | `console.dailyAyahs.form.date` |
| 1578 | Form › Scope |  | Applies to | کس کے لیے |  | `console.dailyAyahs.form.scope` |
| 1579 | Form › Venue |  | Venue | مقام |  | `console.dailyAyahs.form.venue` |
| 1580 | Form › Circle |  | Circle | سرکل |  | `console.dailyAyahs.form.circle` |
| 1581 | Form › Surah |  | Surah | سورت |  | `console.dailyAyahs.form.surah` |
| 1582 | Form › Surah option |  | Surah {number} ({count} ayahs) | سورت {number} ({count} آیات) |  | `console.dailyAyahs.form.surahOption` |
| 1583 | Form › Ayah |  | Ayah | آیت |  | `console.dailyAyahs.form.ayah` |
| 1584 | Form › Ayah hint | hint under a field | A number from 1 to {count}. | 1 سے {count} تک کوئی نمبر۔ |  | `console.dailyAyahs.form.ayahHint` |
| 1585 | Form › Ayah hint no surah | hint under a field | Choose the surah first. | پہلے سورت چنیں۔ |  | `console.dailyAyahs.form.ayahHintNoSurah` |
| 1586 | Form › Preview |  | Preview | پیش منظر |  | `console.dailyAyahs.form.preview` |
| 1587 | Form › Preview count |  | Surah {surah} has {count} ayahs. | سورت {surah} میں {count} آیات ہیں۔ |  | `console.dailyAyahs.form.previewCount` |
| 1588 | Form › Preview empty |  | Choose a surah and an ayah to see the reference. | حوالہ دیکھنے کے لیے سورت اور آیت چنیں۔ |  | `console.dailyAyahs.form.previewEmpty` |
| 1589 | Form › Text note |  | The app shows the Arabic and the translation from its reader. The console keeps only the numbers. | عربی متن اور ترجمہ ایپ اپنے ریڈر سے دکھاتی ہے۔ کنسول صرف نمبر محفوظ کرتا ہے۔ |  | `console.dailyAyahs.form.textNote` |
| 1590 | Form › Replaces |  | This date and place already has {ref}. Saving replaces it. | اس تاریخ اور جگہ کے لیے پہلے سے {ref} مقرر ہے۔ محفوظ کرنے سے یہ بدل جائے گا۔ |  | `console.dailyAyahs.form.replaces` |
| 1591 | Form › Save | button | Save pick | انتخاب محفوظ کریں |  | `console.dailyAyahs.form.save` |
| 1592 | Form › Clear | button | Clear | صاف کریں |  | `console.dailyAyahs.form.clear` |
| 1593 | Form › Saved |  | Pick saved for {date}. | {date} کا انتخاب محفوظ ہو گیا۔ |  | `console.dailyAyahs.form.saved` |
| 1594 | Error › Date › Required | error message | Choose a date. | تاریخ چنیں۔ |  | `console.dailyAyahs.error.date.required` |
| 1595 | Error › Date › Invalid | error message | Enter a real date. | درست تاریخ لکھیں۔ |  | `console.dailyAyahs.error.date.invalid` |
| 1596 | Error › Scope › Required | error message | Choose where the pick applies. | چنیں کہ یہ انتخاب کس کے لیے ہے۔ |  | `console.dailyAyahs.error.scope.required` |
| 1597 | Error › Venue › Required | error message | Choose a venue. | مقام چنیں۔ |  | `console.dailyAyahs.error.venue.required` |
| 1598 | Error › Circle › Required | error message | Choose a circle. | سرکل چنیں۔ |  | `console.dailyAyahs.error.circle.required` |
| 1599 | Error › Surah › Required | error message | Choose a surah. | سورت چنیں۔ |  | `console.dailyAyahs.error.surah.required` |
| 1600 | Error › Surah › Range | error message | Choose a surah from 1 to 114. | 1 سے 114 تک کوئی سورت چنیں۔ |  | `console.dailyAyahs.error.surah.range` |
| 1601 | Error › Ayah › Required | error message | Enter an ayah number. | آیت کا نمبر لکھیں۔ |  | `console.dailyAyahs.error.ayah.required` |
| 1602 | Error › Ayah › Not in surah | error message | Surah {surah} has {count} ayahs. Enter a number from 1 to {count}. | سورت {surah} میں {count} آیات ہیں۔ 1 سے {count} تک کوئی نمبر لکھیں۔ |  | `console.dailyAyahs.error.ayah.notInSurah` |
| 1603 | Error › Place gone | error message | That venue or circle no longer exists. Choose another one. | یہ مقام یا سرکل اب موجود نہیں۔ کوئی اور چنیں۔ |  | `console.dailyAyahs.error.placeGone` |
| 1604 | Remove › Title | heading | Remove this pick? | یہ انتخاب ہٹائیں؟ |  | `console.dailyAyahs.remove.title` |
| 1605 | Remove › Body | explanation text | {date}, {place}: {ref}. That day falls back to the next rule. | {date}، {place}: {ref}۔ اس دن اگلا اصول لاگو ہوگا۔ |  | `console.dailyAyahs.remove.body` |
| 1606 | Remove › Keep |  | Keep it | رہنے دیں |  | `console.dailyAyahs.remove.keep` |
| 1607 | Remove › Confirm | button | Remove pick | انتخاب ہٹائیں |  | `console.dailyAyahs.remove.confirm` |
| 1608 | Removed |  | Pick removed. That day now falls back to the next rule. | انتخاب ہٹا دیا گیا۔ اس دن اب اگلا اصول لاگو ہوگا۔ |  | `console.dailyAyahs.removed` |
| 1609 | Remove › Gone |  | That pick was already removed. The list is up to date. | یہ انتخاب پہلے ہی ہٹایا جا چکا تھا۔ فہرست تازہ ہے۔ |  | `console.dailyAyahs.remove.gone` |
| 1610 | Fallback › Title | heading | Days without a pick | بغیر انتخاب کے دن |  | `console.dailyAyahs.fallback.title` |
| 1611 | Fallback › Rule |  | Someone who follows exactly one venue or circle with a pick that day sees that pick. Everyone else sees the national pick, and on a day without one, the next ayah from a built-in list of {count} well-known ayat. | جو شخص اس دن کسی ایک ایسے مقام یا سرکل کو فالو کرتا ہو جس کا انتخاب مقرر ہو، اسے وہی آیت دکھائی دیتی ہے۔ باقی سب کو قومی انتخاب، اور جس دن قومی انتخاب نہ ہو، {count} معروف آیات کی بلٹ اِن فہرست سے اگلی آیت دکھائی دیتی ہے۔ |  | `console.dailyAyahs.fallback.rule` |
| 1612 | Fallback › Caption |  | What everyone sees on the next days | اگلے دنوں میں سب کو کیا دکھائی دے گا |  | `console.dailyAyahs.fallback.caption` |
| 1613 | Fallback › Source › National |  | National pick | قومی انتخاب |  | `console.dailyAyahs.fallback.source.national` |
| 1614 | Fallback › Source › Built in |  | Built-in list | بلٹ اِن فہرست |  | `console.dailyAyahs.fallback.source.builtIn` |

