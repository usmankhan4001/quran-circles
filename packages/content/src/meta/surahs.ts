import type { SurahNumber } from './ayah';

/**
 * Static surah metadata: names and ayah counts only. No Quran text lives in this repository
 * until WP18 is approved (docs/agents/briefs/content.md, "Rights").
 *
 * Names and counts follow the list V1 shipped (services/chapters.ts), checked so the counts
 * add up to 6,236 ayahs.
 */
export interface SurahInfo {
  /** 1 to 114. */
  readonly id: SurahNumber;
  /** Latin transliteration, for example "Al-Baqarah". */
  readonly nameSimple: string;
  /** The Arabic name as printed in the mushaf, without "Surah". */
  readonly nameArabic: string;
  /** The meaning of the name in English. */
  readonly nameEnglish: string;
  readonly ayahCount: number;
}

type Row = readonly [id: number, simple: string, arabic: string, english: string, ayahs: number];

const rows: readonly Row[] = [
  [1, 'Al-Fatihah', 'الفاتحة', 'The Opening', 7],
  [2, 'Al-Baqarah', 'البقرة', 'The Cow', 286],
  [3, "Ali 'Imran", 'آل عمران', 'Family of Imran', 200],
  [4, 'An-Nisa', 'النساء', 'The Women', 176],
  [5, "Al-Ma'idah", 'المائدة', 'The Table Spread', 120],
  [6, "Al-An'am", 'الأنعام', 'The Cattle', 165],
  [7, "Al-A'raf", 'الأعراف', 'The Heights', 206],
  [8, 'Al-Anfal', 'الأنفال', 'The Spoils of War', 75],
  [9, 'At-Tawbah', 'التوبة', 'The Repentance', 129],
  [10, 'Yunus', 'يونس', 'Jonah', 109],
  [11, 'Hud', 'هود', 'Hud', 123],
  [12, 'Yusuf', 'يوسف', 'Joseph', 111],
  [13, "Ar-Ra'd", 'الرعد', 'The Thunder', 43],
  [14, 'Ibrahim', 'ابراهيم', 'Abraham', 52],
  [15, 'Al-Hijr', 'الحجر', 'The Rocky Tract', 99],
  [16, 'An-Nahl', 'النحل', 'The Bee', 128],
  [17, 'Al-Isra', 'الإسراء', 'The Night Journey', 111],
  [18, 'Al-Kahf', 'الكهف', 'The Cave', 110],
  [19, 'Maryam', 'مريم', 'Mary', 98],
  [20, 'Ta-Ha', 'طه', 'Ta-Ha', 135],
  [21, 'Al-Anbya', 'الأنبياء', 'The Prophets', 112],
  [22, 'Al-Hajj', 'الحج', 'The Pilgrimage', 78],
  [23, "Al-Mu'minun", 'المؤمنون', 'The Believers', 118],
  [24, 'An-Nur', 'النور', 'The Light', 64],
  [25, 'Al-Furqan', 'الفرقان', 'The Criterion', 77],
  [26, "Ash-Shu'ara", 'الشعراء', 'The Poets', 227],
  [27, 'An-Naml', 'النمل', 'The Ant', 93],
  [28, 'Al-Qasas', 'القصص', 'The Stories', 88],
  [29, 'Al-Ankabut', 'العنكبوت', 'The Spider', 69],
  [30, 'Ar-Rum', 'الروم', 'The Romans', 60],
  [31, 'Luqman', 'لقمان', 'Luqman', 34],
  [32, 'As-Sajdah', 'السجدة', 'The Prostration', 30],
  [33, 'Al-Ahzab', 'الأحزاب', 'The Combined Forces', 73],
  [34, 'Saba', 'سبأ', 'Sheba', 54],
  [35, 'Fatir', 'فاطر', 'Originator', 45],
  [36, 'Ya-Sin', 'يس', 'Ya Sin', 83],
  [37, 'As-Saffat', 'الصافات', 'Those who set the Ranks', 182],
  [38, 'Sad', 'ص', 'The Letter "Saad"', 88],
  [39, 'Az-Zumar', 'الزمر', 'The Troops', 75],
  [40, 'Ghafir', 'غافر', 'The Forgiver', 85],
  [41, 'Fussilat', 'فصلت', 'Explained in Detail', 54],
  [42, 'Ash-Shura', 'الشورى', 'The Consultation', 53],
  [43, 'Az-Zukhruf', 'الزخرف', 'The Ornaments of Gold', 89],
  [44, 'Ad-Dukhan', 'الدخان', 'The Smoke', 59],
  [45, 'Al-Jathiyah', 'الجاثية', 'The Crouching', 37],
  [46, 'Al-Ahqaf', 'الأحقاف', 'The Wind-Curved Sandhills', 35],
  [47, 'Muhammad', 'محمد', 'Muhammad', 38],
  [48, 'Al-Fath', 'الفتح', 'The Victory', 29],
  [49, 'Al-Hujurat', 'الحجرات', 'The Rooms', 18],
  [50, 'Qaf', 'ق', 'The Letter "Qaf"', 45],
  [51, 'Ad-Dhariyat', 'الذاريات', 'The Winnowing Winds', 60],
  [52, 'At-Tur', 'الطور', 'The Mount', 49],
  [53, 'An-Najm', 'النجم', 'The Star', 62],
  [54, 'Al-Qamar', 'القمر', 'The Moon', 55],
  [55, 'Ar-Rahman', 'الرحمن', 'The Beneficent', 78],
  [56, "Al-Waqi'ah", 'الواقعة', 'The Inevitable', 96],
  [57, 'Al-Hadid', 'الحديد', 'The Iron', 29],
  [58, 'Al-Mujadila', 'المجادلة', 'The Pleading Woman', 22],
  [59, 'Al-Hashr', 'الحشر', 'The Exile', 24],
  [60, 'Al-Mumtahanah', 'الممتحنة', 'She that is to be examined', 13],
  [61, 'As-Saff', 'الصف', 'The Ranks', 14],
  [62, "Al-Jumu'ah", 'الجمعة', 'The Congregation, Friday', 11],
  [63, 'Al-Munafiqun', 'المنافقون', 'The Hypocrites', 11],
  [64, 'At-Taghabun', 'التغابن', 'The Mutual Disillusion', 18],
  [65, 'At-Talaq', 'الطلاق', 'The Divorce', 12],
  [66, 'At-Tahrim', 'التحريم', 'The Prohibition', 12],
  [67, 'Al-Mulk', 'الملك', 'The Sovereignty', 30],
  [68, 'Al-Qalam', 'القلم', 'The Pen', 52],
  [69, 'Al-Haqqah', 'الحاقة', 'The Reality', 52],
  [70, "Al-Ma'arij", 'المعارج', 'The Ascending Stairways', 44],
  [71, 'Nuh', 'نوح', 'Noah', 28],
  [72, 'Al-Jinn', 'الجن', 'The Jinn', 28],
  [73, 'Al-Muzzammil', 'المزمل', 'The Enshrouded One', 20],
  [74, 'Al-Muddaththir', 'المدثر', 'The Cloaked One', 56],
  [75, 'Al-Qiyamah', 'القيامة', 'The Resurrection', 40],
  [76, 'Al-Insan', 'الانسان', 'The Man', 31],
  [77, 'Al-Mursalat', 'المرسلات', 'The Emissaries', 50],
  [78, 'An-Naba', 'النبأ', 'The Tidings', 40],
  [79, "An-Nazi'at", 'النازعات', 'Those who drag forth', 46],
  [80, 'Abasa', 'عبس', 'He Frowned', 42],
  [81, 'At-Takwir', 'التكوير', 'The Overthrowing', 29],
  [82, 'Al-Infitar', 'الإنفطار', 'The Cleaving', 19],
  [83, 'Al-Mutaffifin', 'المطففين', 'The Defrauding', 36],
  [84, 'Al-Inshiqaq', 'الإنشقاق', 'The Sundering', 25],
  [85, 'Al-Buruj', 'البروج', 'The Mansions of the Stars', 22],
  [86, 'At-Tariq', 'الطارق', 'The Nightcommer', 17],
  [87, "Al-A'la", 'الأعلى', 'The Most High', 19],
  [88, 'Al-Ghashiyah', 'الغاشية', 'The Overwhelming', 26],
  [89, 'Al-Fajr', 'الفجر', 'The Dawn', 30],
  [90, 'Al-Balad', 'البلد', 'The City', 20],
  [91, 'Ash-Shams', 'الشمس', 'The Sun', 15],
  [92, 'Al-Layl', 'الليل', 'The Night', 21],
  [93, 'Ad-Duhaa', 'الضحى', 'The Morning Hours', 11],
  [94, 'Ash-Sharh', 'الشرح', 'The Relief', 8],
  [95, 'At-Tin', 'التين', 'The Fig', 8],
  [96, 'Al-Alaq', 'العلق', 'The Clot', 19],
  [97, 'Al-Qadr', 'القدر', 'The Power', 5],
  [98, 'Al-Bayyinah', 'البينة', 'The Clear Proof', 8],
  [99, 'Az-Zalzalah', 'الزلزلة', 'The Earthquake', 8],
  [100, 'Al-Adiyat', 'العاديات', 'The Courser', 11],
  [101, "Al-Qari'ah", 'القارعة', 'The Calamity', 11],
  [102, 'At-Takathur', 'التكاثر', 'The Rivalry in world increase', 8],
  [103, 'Al-Asr', 'العصر', 'The Declining Day', 3],
  [104, 'Al-Humazah', 'الهمزة', 'The Traducer', 9],
  [105, 'Al-Fil', 'الفيل', 'The Elephant', 5],
  [106, 'Quraysh', 'قريش', 'Quraysh', 4],
  [107, "Al-Ma'un", 'الماعون', 'The Small Kindnesses', 7],
  [108, 'Al-Kawthar', 'الكوثر', 'The Abundance', 3],
  [109, 'Al-Kafirun', 'الكافرون', 'The Disbelievers', 6],
  [110, 'An-Nasr', 'النصر', 'The Divine Support', 3],
  [111, 'Al-Masad', 'المسد', 'The Palm Fiber', 5],
  [112, 'Al-Ikhlas', 'الإخلاص', 'The Sincerity', 4],
  [113, 'Al-Falaq', 'الفلق', 'The Daybreak', 5],
  [114, 'An-Nas', 'الناس', 'The Mankind', 6],
];

export const SURAHS: readonly SurahInfo[] = rows.map(
  ([id, nameSimple, nameArabic, nameEnglish, ayahCount]) => ({
    id: id as SurahNumber,
    nameSimple,
    nameArabic,
    nameEnglish,
    ayahCount,
  }),
);

export const SURAH_COUNT = 114;
export const JUZ_COUNT = 30;
/** Every ayah in the Quran, in the Hafs numbering used by the online source. */
export const TOTAL_AYAHS = 6236;

export function isSurahNumber(value: number): value is SurahNumber {
  return Number.isInteger(value) && value >= 1 && value <= SURAH_COUNT;
}

export function getSurah(id: number): SurahInfo | undefined {
  return isSurahNumber(id) ? SURAHS[id - 1] : undefined;
}

export function ayahCountOf(surah: number): number {
  return getSurah(surah)?.ayahCount ?? 0;
}
