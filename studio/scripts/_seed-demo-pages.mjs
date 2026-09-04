/**
 * Seeds DEMO content for the `homePage` and `contactPage` localized singletons.
 *
 *   HERO_DIR=/path/to/clips npx sanity exec scripts/_seed-demo-pages.mjs --with-user-token
 *
 * Covers REQ-HOME-001 (hero video), REQ-HOME-002 (tagline), REQ-HOME-003
 * (mission overview), REQ-HOME-006 (Champions Corner) and REQ-CONTACT-001
 * (office info / hotline / support emails).
 *
 * Writes only `homePage-en|vi` and `contactPage-en|vi`. It reuses the existing
 * DEMO image assets already in the dataset for hero posters rather than
 * uploading duplicates, and uploads the hero clips as Sanity file assets.
 * Nothing is deleted; other documents are untouched.
 */
import {getCliClient} from 'sanity/cli'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {randomUUID} from 'node:crypto'

const client = getCliClient({apiVersion: '2026-08-28'})
const HERO_DIR = process.env.HERO_DIR
if (!HERO_DIR) throw new Error('Set HERO_DIR to the directory holding hero1..3.mp4')

const key = () => randomUUID().replace(/-/g, '').slice(0, 12)
const block = (text, style = 'normal') => ({
  _type: 'block', _key: key(), style, markDefs: [],
  children: [{_type: 'span', _key: key(), text, marks: []}],
})

/** Resolves an existing DEMO image asset id by its original filename. */
async function assetIdByFilename(filename) {
  const id = await client.fetch(
    `*[_type == "sanity.imageAsset" && originalFilename == $filename][0]._id`,
    {filename}
  )
  if (!id) throw new Error(`Image asset not found: ${filename}`)
  return id
}

const imageRef = (assetId, alt) => ({
  _type: 'image',
  asset: {_type: 'reference', _ref: assetId},
  alt,
})

// Upload the three clips once and reuse the URLs for both locales.
const clips = []
for (const n of [1, 2, 3]) {
  const buffer = await readFile(path.join(HERO_DIR, `hero${n}.mp4`))
  const asset = await client.assets.upload('file', buffer, {
    filename: `demo-hero-${n}.mp4`,
    title: `DEMO synthetic hero clip ${n}`,
    description:
      'Synthetic placeholder clip generated from DEMO vector stills. Not footage; ' +
      'contains no real people, logos or trademarks.',
  })
  clips.push(asset.url)
  console.log(`  uploaded hero${n}.mp4 -> ${asset.url}`)
}

const POSTERS = [
  'demo-hog-02-team-celebration.png',
  'demo-hog-04-winning-basket.png',
  'demo-hog-07-arena-lights.png',
]
const posterIds = []
for (const filename of POSTERS) posterIds.push(await assetIdByFilename(filename))

const HOME = {
  en: {
    tagline: "Where Tomorrow's Legends Rise",
    missionTitle: 'Our mission',
    mission: [
      block(
        'DEMO CONTENT — NextGen Women Hoops is a U20 women’s basketball platform built to connect competition, development and community. Every tournament is run to the same published framework so young athletes get real, well-organised games.'
      ),
      block(
        'This overview is sample copy for the demo dataset. The full brand story, vision and mission live on the About page.'
      ),
    ],
    slides: [
      {
        headline: 'A season built for young athletes',
        subheadline:
          'DEMO — Structured U20 competition connecting clubs, coaches and players nationwide.',
        ctaLabel: 'Explore tournaments',
        ctaHref: '/tournaments',
        alt: 'Illustrated placeholder: silhouetted players celebrating amid confetti',
      },
      {
        headline: 'Every possession counts',
        subheadline: 'DEMO — Fixtures, live scores and standings, updated as games finish.',
        ctaLabel: 'Live scoreboard',
        ctaHref: '/live',
        alt: 'Illustrated placeholder: a ball dropping through the net',
      },
      {
        headline: 'Bring your club into the system',
        subheadline: 'DEMO — Register once, then manage your roster season by season.',
        ctaLabel: 'Register your club',
        ctaHref: '/clubs/register',
        alt: 'Illustrated placeholder: arena floodlights above a game ball',
      },
    ],
    champion: {
      clubName: 'DEMO — Highland Ember',
      seasonLabel: 'DEMO — NGWH U20 Season 2025',
      summary:
        'DEMO CONTENT — a fictional defending champion used to demonstrate this section. Highland Ember does not exist and this is not an NGWH record.',
      clubSlug: 'demo-highland-ember',
      alt: 'Illustrated placeholder: a championship trophy lifted under arena lights',
    },
  },
  vi: {
    tagline: 'Nơi những huyền thoại tương lai toả sáng',
    missionTitle: 'Sứ mệnh của chúng tôi',
    mission: [
      block(
        'NỘI DUNG DEMO — NextGen Women Hoops là nền tảng bóng rổ nữ U20 được xây dựng để kết nối thi đấu, đào tạo và cộng đồng. Mọi giải đấu đều vận hành theo cùng một bộ khung đã công bố, để các vận động viên trẻ có những trận đấu thực sự và được tổ chức bài bản.'
      ),
      block(
        'Phần giới thiệu này là nội dung mẫu cho bộ dữ liệu demo. Câu chuyện thương hiệu, tầm nhìn và sứ mệnh đầy đủ nằm ở trang Giới thiệu.'
      ),
    ],
    slides: [
      {
        headline: 'Một mùa giải dành cho vận động viên trẻ',
        subheadline:
          'DEMO — Hệ thống thi đấu U20 bài bản, kết nối câu lạc bộ, huấn luyện viên và cầu thủ trên toàn quốc.',
        ctaLabel: 'Khám phá giải đấu',
        ctaHref: '/tournaments',
        alt: 'Ảnh minh hoạ giả lập: bóng dáng các cầu thủ ăn mừng giữa mưa kim tuyến',
      },
      {
        headline: 'Từng pha bóng đều quan trọng',
        subheadline:
          'DEMO — Lịch thi đấu, tỷ số trực tiếp và bảng xếp hạng, cập nhật ngay khi trận đấu kết thúc.',
        ctaLabel: 'Bảng điểm trực tiếp',
        ctaHref: '/live',
        alt: 'Ảnh minh hoạ giả lập: quả bóng rơi qua lưới rổ',
      },
      {
        headline: 'Đưa câu lạc bộ của bạn vào hệ thống',
        subheadline:
          'DEMO — Đăng ký một lần, sau đó quản lý danh sách cầu thủ theo từng mùa giải.',
        ctaLabel: 'Đăng ký câu lạc bộ',
        ctaHref: '/clubs/register',
        alt: 'Ảnh minh hoạ giả lập: dàn đèn nhà thi đấu phía trên quả bóng',
      },
    ],
    champion: {
      clubName: 'DEMO — Highland Ember',
      seasonLabel: 'DEMO — Giải U20 NGWH 2025',
      summary:
        'NỘI DUNG DEMO — đương kim vô địch hư cấu dùng để minh hoạ mục này. Highland Ember không tồn tại và đây không phải hồ sơ chính thức của NGWH.',
      clubSlug: 'demo-highland-ember',
      alt: 'Ảnh minh hoạ giả lập: chiếc cúp vô địch được nâng cao dưới ánh đèn nhà thi đấu',
    },
  },
}

const CONTACT = {
  en: {
    officeName: 'DEMO — NextGen Women Hoops Organizing Committee',
    address:
      'DEMO ADDRESS — 12 Sample Street, Demo Ward\nDistrict 1, Ho Chi Minh City\nVietnam',
    hotline: '+84 28 0000 0000',
    emails: [
      {label: 'General enquiries', address: 'demo-info@example.test'},
      {label: 'Club registration', address: 'demo-clubs@example.test'},
      {label: 'Media', address: 'demo-media@example.test'},
    ],
    officeHours: 'Monday to Friday, 09:00 – 17:00 (ICT)',
    note: [
      block(
        'DEMO CONTENT — every address, phone number and email on this page is fictional and routes nowhere. Replace them with the real committee details before launch.'
      ),
    ],
    formIntro:
      'Send the organizing committee a message. Submissions are recorded for review; no automatic email routing is configured yet.',
  },
  vi: {
    officeName: 'DEMO — Ban tổ chức NextGen Women Hoops',
    address:
      'ĐỊA CHỈ DEMO — 12 Đường Mẫu, Phường Demo\nQuận 1, Thành phố Hồ Chí Minh\nViệt Nam',
    hotline: '+84 28 0000 0000',
    emails: [
      {label: 'Thông tin chung', address: 'demo-info@example.test'},
      {label: 'Đăng ký câu lạc bộ', address: 'demo-clubs@example.test'},
      {label: 'Truyền thông', address: 'demo-media@example.test'},
    ],
    officeHours: 'Thứ Hai đến thứ Sáu, 09:00 – 17:00 (giờ Việt Nam)',
    note: [
      block(
        'NỘI DUNG DEMO — mọi địa chỉ, số điện thoại và email trên trang này đều là hư cấu và không dẫn tới đâu. Hãy thay bằng thông tin thật của ban tổ chức trước khi ra mắt.'
      ),
    ],
    formIntro:
      'Gửi tin nhắn cho ban tổ chức. Nội dung sẽ được ghi nhận để xem xét; hiện chưa cấu hình chuyển tiếp email tự động.',
  },
}

for (const locale of ['en', 'vi']) {
  const home = HOME[locale]
  await client.createOrReplace({
    _id: `homePage-${locale}`,
    _type: 'homePage',
    language: locale,
    tagline: home.tagline,
    missionTitle: home.missionTitle,
    missionOverview: home.mission,
    heroSlides: home.slides.map((slide, i) => ({
      _type: 'heroSlide',
      _key: key(),
      headline: slide.headline,
      subheadline: slide.subheadline,
      videoUrl: clips[i],
      poster: imageRef(posterIds[i], slide.alt),
      ctaLabel: slide.ctaLabel,
      ctaHref: slide.ctaHref,
    })),
    championsCorner: {
      clubName: home.champion.clubName,
      seasonLabel: home.champion.seasonLabel,
      summary: home.champion.summary,
      clubSlug: home.champion.clubSlug,
      image: imageRef(await assetIdByFilename('demo-hog-01-trophy-lift.png'), home.champion.alt),
    },
  })
  console.log(`  homePage-${locale} written (${home.slides.length} hero slides)`)

  const contact = CONTACT[locale]
  await client.createOrReplace({
    _id: `contactPage-${locale}`,
    _type: 'contactPage',
    language: locale,
    officeName: contact.officeName,
    address: contact.address,
    hotline: contact.hotline,
    emails: contact.emails.map((e) => ({_type: 'supportEmail', _key: key(), ...e})),
    officeHours: contact.officeHours,
    note: contact.note,
    formIntro: contact.formIntro,
  })
  console.log(`  contactPage-${locale} written`)
}

console.log('\nDone.')
