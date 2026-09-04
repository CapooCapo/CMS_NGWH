/**
 * Extends the DEMO news set: adds cover images to the six existing demo
 * articles and creates two more EN/VI article pairs (eight pairs total).
 *
 *   DEMO_IMAGE_DIR=/path/to/pngs \
 *     npx sanity exec scripts/_seed-news-covers.mjs --with-user-token
 *
 * Safety: it only ever writes documents whose _id starts with `demo-`.
 * Existing articles are PATCHED (coverImage set, every other field untouched);
 * nothing is ever deleted.
 */
import {getCliClient} from 'sanity/cli'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {randomUUID} from 'node:crypto'

const client = getCliClient({apiVersion: '2026-08-28'})

const IMAGE_DIR = process.env.DEMO_IMAGE_DIR
if (!IMAGE_DIR) throw new Error('Set DEMO_IMAGE_DIR to the directory holding the generated PNGs')

const LOCALES = ['en', 'vi']
const key = () => randomUUID().replace(/-/g, '').slice(0, 12)

const block = (text, style = 'normal') => ({
  _type: 'block', _key: key(), style, markDefs: [],
  children: [{_type: 'span', _key: key(), text, marks: []}],
})

const bullets = (items) =>
  items.map((text) => ({
    _type: 'block', _key: key(), style: 'normal', listItem: 'bullet', level: 1, markDefs: [],
    children: [{_type: 'span', _key: key(), text, marks: []}],
  }))

const ref = (id) => ({_type: 'reference', _ref: id})

const translationMetadata = (id, schemaType, byLocale) => ({
  _id: id,
  _type: 'translation.metadata',
  schemaTypes: [schemaType],
  translations: LOCALES.map((lang) => ({
    _key: key(),
    _type: 'internationalizedArrayReferenceValue',
    language: lang,
    value: ref(byLocale[lang]),
  })),
})

const DISCLAIMER_EN =
  'DEMO CONTENT — This article is fictional sample content created to exercise the NGWH website. ' +
  'The teams, players, results and events named below do not exist and are not NGWH facts.'
const DISCLAIMER_VI =
  'NỘI DUNG DEMO — Bài viết này là nội dung mẫu hư cấu, được tạo ra để kiểm thử website NGWH. ' +
  'Các đội bóng, cầu thủ, kết quả và sự kiện được nhắc đến dưới đây không có thật và không phải thông tin chính thức của NGWH.'

// --------------------------------------------- covers for existing articles --
// image name -> which demo article it belongs to, plus localised alt text.
const COVERS = {
  'demo-news-01': {
    image: 'news-01-season-opener',
    en: 'Illustrated placeholder: a basketball centred under arena lighting',
    vi: 'Ảnh minh hoạ giả lập: quả bóng rổ ở trung tâm dưới ánh đèn nhà thi đấu',
  },
  'demo-news-02': {
    image: 'news-02-player-profile',
    en: 'Illustrated placeholder: an abstract player silhouette with one arm raised',
    vi: 'Ảnh minh hoạ giả lập: bóng dáng cầu thủ trừu tượng giơ một tay',
  },
  'demo-news-03': {
    image: 'news-03-double-header',
    en: 'Illustrated placeholder: a plate divided into portions, representing a match-day meal',
    vi: 'Ảnh minh hoạ giả lập: đĩa thức ăn chia phần, tượng trưng cho bữa ăn ngày thi đấu',
  },
  'demo-news-04': {
    image: 'news-04-group-draw',
    en: 'Illustrated placeholder: an abstract tournament bracket diagram',
    vi: 'Ảnh minh hoạ giả lập: sơ đồ nhánh đấu trừu tượng',
  },
  'demo-news-05': {
    image: 'news-05-scorers-table',
    en: 'Illustrated placeholder: an abstract scoreboard at the scorer’s table',
    vi: 'Ảnh minh hoạ giả lập: bảng điểm trừu tượng tại bàn thư ký',
  },
  'demo-news-06': {
    image: 'news-06-sleep-recovery',
    en: 'Illustrated placeholder: a crescent moon and stars, representing overnight recovery',
    vi: 'Ảnh minh hoạ giả lập: trăng lưỡi liềm và các vì sao, tượng trưng cho phục hồi qua đêm',
  },
}

// ------------------------------------------------------- two new articles ---
const NEW_ARTICLES = [
  {
    id: 'demo-news-07',
    category: 'tournament-news',
    date: '2026-09-01T08:00:00.000Z',
    image: 'news-07-semi-finals',
    en: {
      title: 'DEMO — Semi-Final Line-Up Confirmed After Final Group Games',
      slug: 'demo-semi-final-line-up-confirmed',
      alt: 'Illustrated placeholder: a stylised trophy under arena lighting',
      body: [
        block(DISCLAIMER_EN),
        block('Four clubs left', 'h3'),
        block(
          'The final round of the fictional demo group stage settled the last two semi-final places, with Highland Ember and Coastal Lumen joining Lotus Valley Titans and Summit Ridge Foxes in the knock-out round.',
        ),
        block(
          'Coastal Lumen advanced on point difference after a defensive second half held their opponents to single figures in the fourth quarter — an invented scenario written to show how a qualification story reads on this site.',
        ),
        block('The semi-final pairings', 'h3'),
        ...bullets([
          'Lotus Valley Titans vs Coastal Lumen (demo fixture)',
          'Summit Ridge Foxes vs Highland Ember (demo fixture)',
          'Both matches listed as same-day fixtures (demo schedule)',
        ]),
        block('What happens next', 'h3'),
        block(
          'Venues, tip-off times and officiating appointments would normally be confirmed here in the days after the draw. Every club, result and detail on this page is fictional demo content.',
        ),
      ],
    },
    vi: {
      title: 'DEMO — Xác định các cặp bán kết sau lượt đấu cuối vòng bảng',
      slug: 'demo-xac-dinh-cac-cap-ban-ket',
      alt: 'Ảnh minh hoạ giả lập: chiếc cúp cách điệu dưới ánh đèn nhà thi đấu',
      body: [
        block(DISCLAIMER_VI),
        block('Bốn câu lạc bộ còn lại', 'h3'),
        block(
          'Lượt đấu cuối của vòng bảng demo đã xác định hai suất bán kết còn lại, khi Highland Ember và Coastal Lumen góp mặt cùng Lotus Valley Titans và Summit Ridge Foxes ở vòng loại trực tiếp.',
        ),
        block(
          'Coastal Lumen giành quyền đi tiếp nhờ hiệu số, sau một hiệp hai phòng ngự chắc chắn giới hạn đối thủ ở một con số trong hiệp tư — tình huống hư cấu được viết ra để minh hoạ cách một bài viết về suất đi tiếp hiển thị trên website.',
        ),
        block('Các cặp đấu bán kết', 'h3'),
        ...bullets([
          'Lotus Valley Titans gặp Coastal Lumen (cặp đấu demo)',
          'Summit Ridge Foxes gặp Highland Ember (cặp đấu demo)',
          'Cả hai trận được xếp trong cùng một ngày (lịch demo)',
        ]),
        block('Tiếp theo là gì', 'h3'),
        block(
          'Thông thường, địa điểm, giờ bóng lăn và phân công trọng tài sẽ được xác nhận tại đây trong những ngày sau lễ bốc thăm. Mọi câu lạc bộ, kết quả và chi tiết trên trang này đều là nội dung demo hư cấu.',
        ),
      ],
    },
  },
  {
    id: 'demo-news-08',
    category: 'knowledge-nutrition',
    date: '2026-08-29T03:30:00.000Z',
    image: 'news-08-hydration-plan',
    en: {
      title: 'DEMO — Hydration Through a Multi-Day Tournament',
      slug: 'demo-hydration-multi-day-tournament',
      alt: 'Illustrated placeholder: a water bottle beside rising droplets',
      body: [
        block(DISCLAIMER_EN),
        block(
          'General-education demo content. This is not medical or dietary advice and it is not an NGWH hydration policy. Athletes should follow guidance from their own qualified practitioners.',
        ),
        block('Hydration is a week, not a bottle', 'h3'),
        block(
          'Across a multi-day tournament, fluid balance carries over from one day to the next. A player who finishes day one behind rarely catches up during the warm-up on day two.',
        ),
        ...bullets([
          'Drink to a plan across the whole day rather than only at the venue.',
          'Indoor arenas can be warmer and drier than the training hall players are used to.',
          'Travel days and air-conditioned coaches add losses that are easy to overlook.',
          'Individual sweat rates vary widely — a squad-wide number will suit almost nobody exactly.',
        ]),
        block('Signals worth watching', 'h3'),
        block(
          'Coaching staff in this demo article describe watching for the practical signs — unusual fatigue late in a game, cramping in the same player on consecutive days, or a noticeable drop in a player’s usual work rate — and treating them as prompts to check in rather than as diagnoses.',
        ),
      ],
    },
    vi: {
      title: 'DEMO — Bù nước xuyên suốt giải đấu nhiều ngày',
      slug: 'demo-bu-nuoc-giai-dau-nhieu-ngay',
      alt: 'Ảnh minh hoạ giả lập: bình nước bên cạnh những giọt nước bay lên',
      body: [
        block(DISCLAIMER_VI),
        block(
          'Nội dung demo mang tính giáo dục chung. Đây không phải lời khuyên y tế hay dinh dưỡng, và cũng không phải quy định bù nước của NGWH. Vận động viên nên tuân theo hướng dẫn của chuyên gia có chuyên môn.',
        ),
        block('Bù nước là chuyện cả tuần, không phải một chai nước', 'h3'),
        block(
          'Trong một giải đấu kéo dài nhiều ngày, cân bằng nước của ngày hôm trước sẽ ảnh hưởng sang ngày hôm sau. Một vận động viên kết thúc ngày thi đấu đầu tiên trong tình trạng thiếu nước hiếm khi bù kịp trong lúc khởi động ngày thứ hai.',
        ),
        ...bullets([
          'Uống nước theo kế hoạch cho cả ngày, không chỉ khi có mặt tại nhà thi đấu.',
          'Nhà thi đấu trong nhà có thể nóng và khô hơn phòng tập quen thuộc của vận động viên.',
          'Ngày di chuyển và xe có điều hoà làm mất nước theo cách dễ bị bỏ qua.',
          'Mức đổ mồ hôi của mỗi người rất khác nhau — một con số áp dụng chung cho cả đội gần như không phù hợp với ai.',
        ]),
        block('Những dấu hiệu đáng chú ý', 'h3'),
        block(
          'Ban huấn luyện trong bài demo này mô tả việc quan sát các dấu hiệu thực tế — mệt bất thường ở cuối trận, chuột rút lặp lại ở cùng một vận động viên trong hai ngày liên tiếp, hoặc cường độ hoạt động giảm rõ rệt so với thường lệ — và xem đó là lý do để hỏi han, chứ không phải một kết luận y khoa.',
        ),
      ],
    },
  },
]

// ------------------------------------------------------------------- run ----
const assets = {}
async function upload(name) {
  const buffer = await readFile(path.join(IMAGE_DIR, `${name}.png`))
  const asset = await client.assets.upload('image', buffer, {
    filename: `demo-${name}.png`,
    title: `DEMO synthetic placeholder — ${name}`,
    description:
      'Synthetic vector placeholder generated for NGWH demo content. Not a photograph. ' +
      'Contains no real logos, trademarks or likenesses.',
  })
  assets[name] = asset._id
  console.log(`  uploaded ${name} -> ${asset._id}`)
}

const imageValue = (name, alt) => ({
  _type: 'image',
  asset: {_type: 'reference', _ref: assets[name]},
  alt,
})

console.log('Uploading news cover images…')
const names = [...new Set([
  ...Object.values(COVERS).map((c) => c.image),
  ...NEW_ARTICLES.map((a) => a.image),
])]
for (const n of names) await upload(n)

console.log('\nPatching cover images onto existing demo articles…')
let tx = client.transaction()
for (const [base, cfg] of Object.entries(COVERS)) {
  for (const lang of LOCALES) {
    const id = `${base}-${lang}`
    if (!id.startsWith('demo-')) throw new Error(`refusing to write non-demo id ${id}`)
    tx = tx.patch(id, (p) => p.set({coverImage: imageValue(cfg.image, cfg[lang])}))
    console.log(`  patch ${id}`)
  }
}
await tx.commit()

console.log('\nCreating the two new demo article pairs…')
tx = client.transaction()
for (const a of NEW_ARTICLES) {
  const byLocale = {}
  for (const lang of LOCALES) {
    const id = `${a.id}-${lang}`
    if (!id.startsWith('demo-')) throw new Error(`refusing to write non-demo id ${id}`)
    byLocale[lang] = id
    tx = tx.createOrReplace({
      _id: id,
      _type: 'newsArticle',
      language: lang,
      title: a[lang].title,
      slug: {_type: 'slug', current: a[lang].slug},
      category: a.category,
      date: a.date,
      coverImage: imageValue(a.image, a[lang].alt),
      body: a[lang].body,
    })
    console.log(`  create ${id}`)
  }
  tx = tx.createOrReplace(translationMetadata(`demo-trmeta-${a.id}`, 'newsArticle', byLocale))
  console.log(`  create demo-trmeta-${a.id}`)
}
await tx.commit()

console.log('\nDone.')
