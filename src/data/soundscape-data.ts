/**
 * soundscape-data.ts — single source of truth for the /soundscape page
 * across all four language variants (zh-TW / en / ja / ko).
 *
 * Design decisions:
 *
 * 1. Inline bilingual strings (not i18n modules) because translations
 *    live next to the item they describe. Adding a new sound means
 *    editing ONE file, ONE entry. Previously, zh-TW and en had
 *    separately hand-maintained sound pages with different content
 *    and layouts — the inevitable drift made this refactor necessary.
 *
 * 2. `zh-TW` is the canonical language (required on every Localized
 *    field). `en`, `ja`, `ko` are optional; missing translations fall
 *    through to zh-TW via the `localize()` helper. This lets us ship
 *    the structure immediately and fill in translations incrementally
 *    (merge-first, polish-later — see memory/feedback_merge_first_then_polish).
 *
 * 3. Categories are an ordered array (not a keyed map) so the display
 *    order is fixed and obvious at a glance.
 *
 * 4. Sounds without recordings (empty `sounds` array) still render
 *    their wishlist — that's the "help us collect this" pattern.
 */

import type { Lang } from '../types';

export type Localized = Partial<Record<Lang, string>> & { 'zh-TW': string };

export interface Sound {
  /** Filename under /public/assets/sounds/ */
  file: string;
  location: Localized;
  description: Localized;
  icon: string;
  contributor: string;
  /** Optional — overrides the default github.com/{contributor} link. */
  contributorUrl?: string;
  date: string;
}

export interface WishlistItem {
  icon: string;
  text: Localized;
}

export interface SoundCategory {
  id: string;
  icon: string;
  title: Localized;
  sounds: Sound[];
  wishlist: WishlistItem[];
  /** Deep-article path (same for all languages since articles are lang-routed). */
  article: string;
}

/**
 * Resolve a Localized field for the given language with zh-TW fallback.
 *
 * Treats an empty string as an *intentional* empty (no fallback) — this
 * lets pages opt out of a field on a per-language basis. Only `undefined`
 * triggers the zh-TW fallback.
 */
export function localize(field: Localized, lang: Lang): string {
  const val = field[lang];
  if (val !== undefined) return val;
  return field['zh-TW'];
}

/**
 * Return the English secondary label for a Localized field, but ONLY when
 * viewing from the zh-TW page. Used to show e.g. "都市日常的聲音密碼
 * Urban Soundscape" — a bilingual editorial affordance that's useful for
 * Chinese readers (English is a universal reference) but would be
 * redundant for en/ja/ko readers.
 *
 * Returns empty string (= don't render) when:
 * - lang is not 'zh-TW'
 * - field has no `en` value
 * - `en` is identical to `zh-TW` (would be visual noise)
 */
export function secondary(field: Localized, lang: Lang): string {
  if (lang !== 'zh-TW') return '';
  const en = field.en;
  if (!en || en === field['zh-TW']) return '';
  return en;
}

// ─── UI chrome (hero + section headings + CTA) ───
export const soundscapeUI = {
  meta: {
    title: {
      'zh-TW': '台灣聲景 Taiwan Soundscape — Taiwan.md',
      en: 'Taiwan Soundscape — Taiwan.md',
      ja: '台湾サウンドスケープ — Taiwan.md',
      ko: '타이완 사운드스케이프 — Taiwan.md',
    } as Localized,
    description: {
      'zh-TW':
        '用耳朵認識台灣——田野錄音收集計畫，收錄蟋蟀、垃圾車、廟會、浪聲等台灣獨有的聲音風景',
      en: 'Discover Taiwan through your ears — a field recording collection featuring crickets, garbage trucks, temple festivals, ocean waves, and other uniquely Taiwanese sounds',
      ja: '耳で台湾を知る——フィールドレコーディング収集計画。コオロギ、ゴミ収集車、廟会、波の音など、台湾ならではのサウンドスケープ',
      ko: '귀로 타이완을 알다 — 필드 레코딩 수집 프로젝트. 귀뚜라미, 쓰레기차, 사원, 파도 소리 등 타이완 고유의 사운드스케이프',
    } as Localized,
  },
  hero: {
    eyebrow: '🎧 Soundscape',
    title: {
      'zh-TW': '台灣聲景',
      en: 'Taiwan Soundscape',
      ja: '台湾サウンドスケープ',
      ko: '타이완 사운드스케이프',
    } as Localized,
    subtitle: {
      'zh-TW': '有些故事，用耳朵聽比用眼睛看更真實。',
      en: 'Some stories are best told through ears.',
      ja: '耳で聴くほうが、目で見るよりもリアルな物語がある。',
      ko: '어떤 이야기는 눈보다 귀로 들을 때 더 진실합니다.',
    } as Localized,
    subtitleSecondary: {
      'zh-TW': 'Some stories are best told through ears.',
      en: '',
      ja: '',
      ko: '',
    } as Localized,
    readMoreLabel: {
      'zh-TW': '📖 深度文章：',
      en: '📖 Read more: ',
      ja: '📖 詳しい記事：',
      ko: '📖 깊이 읽기: ',
    } as Localized,
    readMoreLink: {
      'zh-TW': '台灣聲音地景',
      en: 'Taiwan Soundscape (article)',
      ja: '台湾のサウンドスケープ',
      ko: '타이완 사운드스케이프',
    } as Localized,
  },
  sections: {
    wishlistHeading: {
      'zh-TW': '📋 想收集 Wanted',
      en: '📋 Wishlist',
      ja: '📋 集めたい音',
      ko: '📋 수집 희망',
    } as Localized,
    emptyState: {
      'zh-TW': '這個分類還沒有錄音，等你來貢獻！',
      en: 'No recordings yet — be the first contributor!',
      ja: 'このカテゴリーにはまだ録音がありません。最初の貢献者になりましょう！',
      ko: '이 카테고리에는 아직 녹음이 없습니다. 첫 기여자가 되어주세요!',
    } as Localized,
    emptyStateSecondary: {
      'zh-TW': 'No recordings yet — be the first contributor!',
      en: '',
      ja: '',
      ko: '',
    } as Localized,
    readArticle: {
      'zh-TW': '📖 閱讀完整聲音故事 Read more →',
      en: '📖 Read the full sound story →',
      ja: '📖 完全な音の物語を読む →',
      ko: '📖 완전한 소리 이야기 읽기 →',
    } as Localized,
    contributeTitle: {
      'zh-TW': '🎤 貢獻你的錄音',
      en: '🎤 Contribute Your Recording',
      ja: '🎤 録音を投稿する',
      ko: '🎤 녹음 기여하기',
    } as Localized,
    contributeBodyHtml: {
      'zh-TW':
        '用手機錄下 30 秒到 2 分鐘的台灣聲景，轉成 MP3，開一個 PR 就好。<br />不會用 GitHub？直接<a href="mailto:taiwanmd@monoame.com">寄信給我們</a>，附上錄音檔和地點描述。',
      en: 'Record 30 seconds to 2 minutes of a Taiwanese soundscape on your phone, convert to MP3, and open a PR.<br />Not a GitHub user? <a href="mailto:taiwanmd@monoame.com">Email us</a> with the audio file and location description.',
      ja: 'スマホで 30 秒から 2 分の台湾サウンドスケープを録音し、MP3 に変換して PR を開くだけ。<br />GitHub を使わない方は、録音ファイルと場所の説明を添えて<a href="mailto:taiwanmd@monoame.com">メールでお送りください</a>。',
      ko: '스마트폰으로 30초~2분의 타이완 사운드스케이프를 녹음하고, MP3로 변환한 후 PR을 열어주세요.<br />GitHub를 사용하지 않으시나요? 녹음 파일과 위치 설명을 첨부하여 <a href="mailto:taiwanmd@monoame.com">이메일로 보내주세요</a>.',
    } as Localized,
    contributeStep1: {
      'zh-TW': '錄下聲音（30s – 2min）',
      en: 'Record audio (30s – 2min)',
      ja: '音を録音する（30秒〜2分）',
      ko: '소리 녹음 (30초 ~ 2분)',
    } as Localized,
    contributeStep2: {
      'zh-TW': '轉成 MP3（128kbps+）',
      en: 'Convert to MP3 (128kbps+)',
      ja: 'MP3 に変換する（128kbps+）',
      ko: 'MP3로 변환 (128kbps+)',
    } as Localized,
    contributeStep3: {
      'zh-TW': '開 PR 或寄信給我們',
      en: 'Open a PR or email us',
      ja: 'PR を開くかメールを送る',
      ko: 'PR 열기 또는 이메일 보내기',
    } as Localized,
    contributeCtaLabel: {
      'zh-TW': '前往貢獻頁面 →',
      en: 'Go to Contribute page →',
      ja: '貢献ページへ →',
      ko: '기여 페이지로 →',
    } as Localized,
    statsFormat: {
      'zh-TW': '{sounds} recordings · {wanted} wanted · {cats} categories',
      en: '{sounds} recordings · {wanted} wanted · {cats} categories',
      ja: '{sounds} 件の録音 · {wanted} 件募集 · {cats} カテゴリー',
      ko: '{sounds}개 녹음 · {wanted}개 모집 · {cats}개 카테고리',
    } as Localized,
  },
};

// ─── Category + sound data ───
// Ordered array; display order = array order.
export const categories: SoundCategory[] = [
  {
    id: 'urban',
    icon: '🏙️',
    title: {
      'zh-TW': '都市日常的聲音密碼',
      en: 'Urban Soundscape',
      ja: '都市日常のサウンドコード',
      ko: '도시 일상의 소리 암호',
    },
    sounds: [
      {
        file: 'taipei-nangang-garbage-truck-melody-maidens-prayer.mp3',
        location: {
          'zh-TW': '台北南港',
          en: 'Taipei Nangang',
          ja: '台北・南港',
          ko: '타이베이 난강',
        },
        description: {
          'zh-TW': '垃圾車音樂（少女的祈禱）',
          en: "Garbage truck melody (Maiden's Prayer)",
          ja: 'ゴミ収集車の音楽（乙女の祈り）',
          ko: '쓰레기차 음악 (소녀의 기도)',
        },
        contributor: 'x1001000',
        date: '2021-03',
        icon: '🚛',
      },
      {
        file: 'new-taipei-banqiao-garbage-truck-melody-fur-elise.mp3',
        location: {
          'zh-TW': '新北板橋',
          en: 'New Taipei Banqiao',
          ja: '新北・板橋',
          ko: '신베이 반차오',
        },
        description: {
          'zh-TW': '垃圾車音樂（給愛麗絲）',
          en: 'Garbage truck melody (Für Elise)',
          ja: 'ゴミ収集車の音楽（エリーゼのために）',
          ko: '쓰레기차 음악 (엘리제를 위하여)',
        },
        contributor: 'yuweichen1008',
        date: '2026-03',
        icon: '🚛',
      },
    ],
    wishlist: [
      {
        icon: '🚛',
        text: {
          'zh-TW': '各縣市垃圾車音樂',
          en: 'Garbage truck melodies (regional variations)',
          ja: '各県市のゴミ収集車の音楽',
          ko: '각 도시 쓰레기차 음악',
        },
      },
      {
        icon: '🛵',
        text: {
          'zh-TW': '紅燈轉綠的機車起步聲',
          en: 'Scooter swarm at green light',
          ja: '赤信号から青信号へのスクーター発進音',
          ko: '신호등 바뀔 때 스쿠터 출발 소리',
        },
      },
      {
        icon: '📢',
        text: {
          'zh-TW': '選舉宣傳車',
          en: 'Election campaign trucks',
          ja: '選挙宣伝車',
          ko: '선거 선전 차량',
        },
      },
      {
        icon: '🚂',
        text: {
          'zh-TW': '火車進站音樂',
          en: 'Train station jingles',
          ja: '駅の入線メロディ',
          ko: '기차역 진입 음악',
        },
      },
      {
        icon: '🏪',
        text: {
          'zh-TW': '便利商店門鈴聲',
          en: 'Convenience store door chimes',
          ja: 'コンビニのドアベル',
          ko: '편의점 문 차임벨',
        },
      },
    ],
    article: '/music/台灣聲音地景',
  },
  {
    id: 'mrt-soundscape',
    icon: '🚇',
    title: {
      'zh-TW': '捷運聲音地景計畫',
      en: 'MRT Soundscape Project',
      ja: 'MRT サウンドスケーププロジェクト',
      ko: 'MRT 사운드스케이프 프로젝트',
    },
    sounds: [
      {
        file: 'mrt-soundscape-xingtian-temple-worship.mp3',
        location: {
          'zh-TW': '行天宮',
          en: 'Xingtian Temple',
          ja: '行天宮',
          ko: '싱톈궁',
        },
        description: {
          'zh-TW': '拜拜（擲筊、誦經）',
          en: 'Temple worship (divination blocks, chanting)',
          ja: 'お参り（占い木、読経）',
          ko: '참배 (점괘, 독경)',
        },
        contributor: '大禾音樂',
        contributorUrl: 'https://www.harvestmusician.com/',
        date: '2018-03',
        icon: '🏯',
      },
      {
        file: 'mrt-soundscape-ximending-tattoo-parlor.mp3',
        location: {
          'zh-TW': '西門町',
          en: 'Ximending',
          ja: '西門町',
          ko: '시먼딩',
        },
        description: {
          'zh-TW': '刺青店',
          en: 'Tattoo parlor buzz',
          ja: 'タトゥーショップ',
          ko: '타투 샵',
        },
        contributor: '大禾音樂',
        contributorUrl: 'https://www.harvestmusician.com/',
        date: '2018-03',
        icon: '🎨',
      },
      {
        file: 'mrt-soundscape-dihua-street-lunar-new-year-shopping.mp3',
        location: {
          'zh-TW': '迪化街',
          en: 'Dihua Street',
          ja: '迪化街',
          ko: '디화제',
        },
        description: {
          'zh-TW': '買年貨',
          en: 'Lunar New Year shopping',
          ja: '旧正月の買い物',
          ko: '설 명절 장보기',
        },
        contributor: '大禾音樂',
        contributorUrl: 'https://www.harvestmusician.com/',
        date: '2018-03',
        icon: '🧨',
      },
      {
        file: 'mrt-soundscape-taipei-101-new-year-countdown.mp3',
        location: {
          'zh-TW': '台北 101',
          en: 'Taipei 101',
          ja: '台北 101',
          ko: '타이베이 101',
        },
        description: {
          'zh-TW': '跨年倒數',
          en: 'New Year countdown',
          ja: '年越しカウントダウン',
          ko: '새해 카운트다운',
        },
        contributor: '大禾音樂',
        contributorUrl: 'https://www.harvestmusician.com/',
        date: '2018-03',
        icon: '🎆',
      },
      {
        file: 'mrt-soundscape-cks-memorial-hall-pigeons-flying.mp3',
        location: {
          'zh-TW': '中正紀念堂',
          en: 'CKS Memorial Hall',
          ja: '中正紀念堂',
          ko: '중정기념당',
        },
        description: {
          'zh-TW': '鴿子飛翔',
          en: 'Pigeons taking flight',
          ja: '鳩の飛び立ち',
          ko: '비둘기 날아오르는 소리',
        },
        contributor: '大禾音樂',
        contributorUrl: 'https://www.harvestmusician.com/',
        date: '2018-03',
        icon: '🕊️',
      },
      {
        file: 'mrt-soundscape-cks-memorial-hall-camera-shutters.mp3',
        location: {
          'zh-TW': '中正紀念堂',
          en: 'CKS Memorial Hall',
          ja: '中正紀念堂',
          ko: '중정기념당',
        },
        description: {
          'zh-TW': '遊客拍照',
          en: 'Tourist camera shutters',
          ja: '観光客のシャッター音',
          ko: '관광객 카메라 셔터',
        },
        contributor: '大禾音樂',
        contributorUrl: 'https://www.harvestmusician.com/',
        date: '2018-03',
        icon: '📸',
      },
      {
        file: 'mrt-soundscape-daan-forest-park-ducks.mp3',
        location: {
          'zh-TW': '大安森林公園',
          en: "Da'an Forest Park",
          ja: '大安森林公園',
          ko: '다안 삼림공원',
        },
        description: {
          'zh-TW': '賞鴨子',
          en: 'Ducks in the park',
          ja: 'アヒル観察',
          ko: '오리 감상',
        },
        contributor: '大禾音樂',
        contributorUrl: 'https://www.harvestmusician.com/',
        date: '2018-03',
        icon: '🦆',
      },
      {
        file: 'mrt-soundscape-dahu-park-lake-water.mp3',
        location: {
          'zh-TW': '大湖公園',
          en: 'Dahu Park',
          ja: '大湖公園',
          ko: '다후공원',
        },
        description: {
          'zh-TW': '湖水聲',
          en: 'Lake water',
          ja: '湖の水音',
          ko: '호숫물 소리',
        },
        contributor: '大禾音樂',
        contributorUrl: 'https://www.harvestmusician.com/',
        date: '2018-03',
        icon: '🌊',
      },
      {
        file: 'mrt-soundscape-xiaobitan-birdsong.mp3',
        location: {
          'zh-TW': '小碧潭',
          en: 'Xiaobitan',
          ja: '小碧潭',
          ko: '샤오비탄',
        },
        description: {
          'zh-TW': '賞鳥',
          en: 'Birdsong',
          ja: '鳥の観察',
          ko: '새 관찰',
        },
        contributor: '大禾音樂',
        contributorUrl: 'https://www.harvestmusician.com/',
        date: '2018-03',
        icon: '🐦',
      },
      {
        file: 'mrt-soundscape-tamsui-buying-squid.mp3',
        location: {
          'zh-TW': '淡水',
          en: 'Tamsui',
          ja: '淡水',
          ko: '단수이',
        },
        description: {
          'zh-TW': '買花枝',
          en: 'Buying squid at the waterfront',
          ja: 'イカを買う',
          ko: '오징어 사기',
        },
        contributor: '大禾音樂',
        contributorUrl: 'https://www.harvestmusician.com/',
        date: '2018-03',
        icon: '🦑',
      },
      {
        file: 'mrt-soundscape-miramar-cinema.mp3',
        location: {
          'zh-TW': '美麗華',
          en: 'Miramar',
          ja: '美麗華',
          ko: '미라마',
        },
        description: {
          'zh-TW': '看電影',
          en: 'Cinema ambience',
          ja: '映画鑑賞',
          ko: '영화 관람',
        },
        contributor: '大禾音樂',
        contributorUrl: 'https://www.harvestmusician.com/',
        date: '2018-03',
        icon: '🎬',
      },
      {
        file: 'mrt-soundscape-sanmin-bookstore-page-flipping.mp3',
        location: {
          'zh-TW': '三民書局',
          en: 'Sanmin Bookstore',
          ja: '三民書局',
          ko: '삼민서점',
        },
        description: {
          'zh-TW': '翻書聲',
          en: 'Page flipping',
          ja: '本をめくる音',
          ko: '책장 넘기는 소리',
        },
        contributor: '大禾音樂',
        contributorUrl: 'https://www.harvestmusician.com/',
        date: '2018-03',
        icon: '📚',
      },
      {
        file: 'mrt-soundscape-beimen-post-office-mailing.mp3',
        location: {
          'zh-TW': '北門郵局',
          en: 'Beimen Post Office',
          ja: '北門郵便局',
          ko: '베이먼 우체국',
        },
        description: {
          'zh-TW': '寄信',
          en: 'Mailing a letter',
          ja: '手紙を出す',
          ko: '편지 부치기',
        },
        contributor: '大禾音樂',
        contributorUrl: 'https://www.harvestmusician.com/',
        date: '2018-03',
        icon: '📮',
      },
      {
        file: 'mrt-soundscape-zhongshan-station-power-drill.mp3',
        location: {
          'zh-TW': '中山站',
          en: 'Zhongshan Station',
          ja: '中山駅',
          ko: '중산역',
        },
        description: {
          'zh-TW': '螺絲電鑽聲',
          en: 'Power drill',
          ja: '電動ドリルの音',
          ko: '전동 드릴 소리',
        },
        contributor: '大禾音樂',
        contributorUrl: 'https://www.harvestmusician.com/',
        date: '2018-03',
        icon: '🔧',
      },
      {
        file: 'mrt-soundscape-zhongshan-junior-high-station-announcement.mp3',
        location: {
          'zh-TW': '中山國中站',
          en: 'Zhongshan Junior High Station',
          ja: '中山国中駅',
          ko: '중산중학역',
        },
        description: {
          'zh-TW': '喊報告',
          en: 'Student roll call',
          ja: '学生の報告',
          ko: '학생 호명',
        },
        contributor: '大禾音樂',
        contributorUrl: 'https://www.harvestmusician.com/',
        date: '2018-03',
        icon: '📢',
      },
    ],
    wishlist: [],
    article: '/music/台灣聲音地景',
  },
  {
    id: 'sacred',
    icon: '🏯',
    title: {
      'zh-TW': '神聖的聲音：廟會與宗教',
      en: 'Sacred Sounds: Temples & Religion',
      ja: '神聖な音：廟会と宗教',
      ko: '신성한 소리: 사원과 종교',
    },
    sounds: [],
    wishlist: [
      {
        icon: '🥁',
        text: {
          'zh-TW': '北管鑼鼓——廟口的搖滾樂',
          en: 'Beiguan drums — temple rock & roll',
          ja: '北管の鑼鼓——廟口のロック',
          ko: '북관 북 — 사원 앞의 록',
        },
      },
      {
        icon: '🎶',
        text: {
          'zh-TW': '南管——東方最古老的室內樂',
          en: 'Nanguan — oldest chamber music of the East',
          ja: '南管——東洋最古の室内楽',
          ko: '남관 — 동양에서 가장 오래된 실내악',
        },
      },
      {
        icon: '💃',
        text: {
          'zh-TW': '電子花車——神聖與世俗的碰撞',
          en: 'Electronic flower car — sacred meets profane',
          ja: '電子花車——神聖と世俗の衝突',
          ko: '전자 화차 — 신성과 세속의 충돌',
        },
      },
      {
        icon: '🪘',
        text: {
          'zh-TW': '媽祖遶境鑼鼓陣',
          en: 'Mazu pilgrimage drum procession',
          ja: '媽祖巡行の鑼鼓隊',
          ko: '마조 순례 북 행렬',
        },
      },
      {
        icon: '📿',
        text: {
          'zh-TW': '寺廟早課木魚誦經',
          en: 'Temple morning chanting',
          ja: '寺院朝課の木魚と読経',
          ko: '사원 아침 예불 목탁과 독경',
        },
      },
    ],
    article: '/music/台灣聲音地景',
  },
  {
    id: 'indigenous',
    icon: '🏔️',
    title: {
      'zh-TW': '原住民的聲音：大地的記憶',
      en: 'Indigenous Voices: Memory of the Land',
      ja: '先住民の声：大地の記憶',
      ko: '원주민의 소리: 대지의 기억',
    },
    sounds: [],
    wishlist: [
      {
        icon: '🎵',
        text: {
          'zh-TW': '布農族 Pasibutbut（祈禱小米豐收歌）',
          en: 'Bunun Pasibutbut (Millet Prayer Song)',
          ja: 'ブヌン族 Pasibutbut（粟の豊作祈願歌）',
          ko: '부눈족 Pasibutbut (조 풍작 기원가)',
        },
      },
      {
        icon: '🌾',
        text: {
          'zh-TW': '阿美族豐年祭歌舞',
          en: 'Amis Ilisin harvest festival songs',
          ja: 'アミ族豊年祭の歌と踊り',
          ko: '아미족 풍년제 노래와 춤',
        },
      },
      {
        icon: '🎺',
        text: {
          'zh-TW': '排灣族雙管鼻笛',
          en: 'Paiwan double-tube nose flute',
          ja: 'パイワン族の双管鼻笛',
          ko: '파이완족 쌍관 비적',
        },
      },
      {
        icon: '🌊',
        text: {
          'zh-TW': '達悟族拍手歌',
          en: 'Tao hand-clapping songs (Orchid Island)',
          ja: 'タオ族の拍手歌（蘭嶼）',
          ko: '타오족 박수 노래 (란위)',
        },
      },
    ],
    article: '/music/台灣聲音地景',
  },
  {
    id: 'nature',
    icon: '🌿',
    title: {
      'zh-TW': '自然的聲音',
      en: 'Sounds of Nature',
      ja: '自然の音',
      ko: '자연의 소리',
    },
    sounds: [
      {
        file: 'taichung-green-museumbrary-crickets.mp3',
        location: {
          'zh-TW': '台中綠美圖',
          en: 'Taichung Green Museumbrary',
          ja: '台中グリーン美術図書館',
          ko: '타이중 녹색 미술관·도서관',
        },
        description: {
          'zh-TW': '夜晚蟋蟀聲',
          en: 'Evening cricket chorus',
          ja: '夜のコオロギの鳴き声',
          ko: '저녁 귀뚜라미 소리',
        },
        contributor: 'bugnimusic',
        date: '2026-03',
        icon: '🦗',
      },
      {
        file: 'fugui-cape-ocean-waves.mp3',
        location: {
          'zh-TW': '新北石門・富貴角公園步道',
          en: 'Fugui Cape Trail, Shimen, New Taipei',
          ja: '新北・石門・富貴角公園歩道',
          ko: '신베이 스먼 푸구이자오 공원 산책로',
        },
        description: {
          'zh-TW': '海浪拍打岩岸',
          en: 'Ocean waves crashing on rocky shore',
          ja: '岩岸に打ち寄せる波',
          ko: '바위 해안에 부딪히는 파도',
        },
        contributor: 'Perry Su',
        date: '2026-03',
        icon: '🌊',
      },
      {
        file: 'fugui-cape-birds-insects.mp3',
        location: {
          'zh-TW': '新北石門・富貴角公園步道',
          en: 'Fugui Cape Trail, Shimen, New Taipei',
          ja: '新北・石門・富貴角公園歩道',
          ko: '신베이 스먼 푸구이자오 공원 산책로',
        },
        description: {
          'zh-TW': '鳥鳴與蟲聲',
          en: 'Birdsong and insects in coastal trail',
          ja: '鳥の声と虫の音',
          ko: '새소리와 벌레 소리',
        },
        contributor: 'Perry Su',
        date: '2026-03',
        icon: '🐦',
      },
      {
        file: 'erpingding-trail-birds-insects.mp3',
        location: {
          'zh-TW': '新北石門・二坪頂登山步道',
          en: 'Erpingding Trail, Shimen, New Taipei',
          ja: '新北・石門・二坪頂登山道',
          ko: '신베이 스먼 얼핑딩 등산로',
        },
        description: {
          'zh-TW': '山徑鳥鳴與蟲聲',
          en: 'Birds and insects on mountain trail',
          ja: '山道の鳥と虫',
          ko: '산길의 새와 벌레',
        },
        contributor: 'Perry Su',
        date: '2026-03',
        icon: '🐦',
      },
    ],
    wishlist: [
      {
        icon: '🌊',
        text: {
          'zh-TW': '東海岸浪聲',
          en: 'East coast waves',
          ja: '東海岸の波音',
          ko: '동해안 파도 소리',
        },
      },
      {
        icon: '🐦',
        text: {
          'zh-TW': '山林鳥鳴',
          en: 'Mountain birdsong',
          ja: '山林の鳥のさえずり',
          ko: '산림의 새소리',
        },
      },
      {
        icon: '🦗',
        text: {
          'zh-TW': '各地蟲鳴',
          en: 'Insect choruses across Taiwan',
          ja: '各地の虫の音',
          ko: '각지의 벌레 소리',
        },
      },
      {
        icon: '⛈️',
        text: {
          'zh-TW': '春雷與梅雨',
          en: 'Spring thunder and plum rain',
          ja: '春雷と梅雨',
          ko: '봄 천둥과 장마',
        },
      },
      {
        icon: '🐸',
        text: {
          'zh-TW': '台灣特有種蛙鳴',
          en: 'Taiwan endemic frog calls',
          ja: '台湾固有種の蛙の鳴き声',
          ko: '타이완 고유종 개구리 소리',
        },
      },
    ],
    article: '/music/台灣聲音地景',
  },
  {
    id: 'vanishing',
    icon: '⏳',
    title: {
      'zh-TW': '正在消失的聲音',
      en: 'Vanishing Sounds',
      ja: '消えゆく音',
      ko: '사라져가는 소리',
    },
    sounds: [],
    wishlist: [
      {
        icon: '🔪',
        text: {
          'zh-TW': '磨刀師傅的喇叭聲',
          en: "Knife sharpener's horn",
          ja: '包丁研ぎ職人のラッパ',
          ko: '칼갈이 장인의 나팔',
        },
      },
      {
        icon: '📻',
        text: {
          'zh-TW': '五金行的叫賣廣播',
          en: 'Hardware store PA announcements',
          ja: '金物屋の呼び売り放送',
          ko: '철물점 호객 방송',
        },
      },
      {
        icon: '🗣️',
        text: {
          'zh-TW': '台語的聲調變化',
          en: 'Taiwanese Hokkien tonal variations',
          ja: '台湾語の声調変化',
          ko: '타이완어 성조 변화',
        },
      },
      {
        icon: '🍧',
        text: {
          'zh-TW': '叭噗冰淇淋叫賣',
          en: 'Traditional ice cream vendor horn',
          ja: '「バプ」アイスクリーム売りの呼び声',
          ko: '바푸 아이스크림 판매 소리',
        },
      },
    ],
    article: '/music/台灣聲音地景',
  },
];

// ─── Aggregate stats (computed once at module load) ───
export const totalSounds = categories.reduce(
  (sum, cat) => sum + cat.sounds.length,
  0,
);
export const totalWishlist = categories.reduce(
  (sum, cat) => sum + cat.wishlist.length,
  0,
);
export const totalCategories = categories.length;
