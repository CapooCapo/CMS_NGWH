/**
 * Seeds clearly-labelled DEMO content into the Sanity dataset.
 *
 *   npx sanity exec scripts/_seed-demo-content.mjs --with-user-token
 *
 * Every document it writes uses a `demo-` id prefix and a "DEMO — " title
 * prefix so the whole set can be found and removed with one GROQ filter:
 *
 *   *[_id match "demo-*"]
 *
 * It never deletes anything, and the only pre-existing documents it touches
 * are `aboutPage-en` / `aboutPage-vi`, where it fills in the empty `partners`
 * field and leaves every other field alone.
 */
import {getCliClient} from 'sanity/cli'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {randomUUID} from 'node:crypto'

const client = getCliClient({apiVersion: '2026-08-28'})

const IMAGE_DIR = process.env.DEMO_IMAGE_DIR
if (!IMAGE_DIR) throw new Error('Set DEMO_IMAGE_DIR to the directory holding the generated PNGs')

const LOCALES = ['en', 'vi']

// ---------------------------------------------------------------- helpers ---
const key = () => randomUUID().replace(/-/g, '').slice(0, 12)

const block = (text, style = 'normal') => ({
  _type: 'block',
  _key: key(),
  style,
  markDefs: [],
  children: [{_type: 'span', _key: key(), text, marks: []}],
})

const bullets = (items) =>
  items.map((text) => ({
    _type: 'block',
    _key: key(),
    style: 'normal',
    listItem: 'bullet',
    level: 1,
    markDefs: [],
    children: [{_type: 'span', _key: key(), text, marks: []}],
  }))

const imageRef = (assetId, alt) => ({
  _type: 'image',
  _key: key(),
  asset: {_type: 'reference', _ref: assetId},
  alt,
})

const ref = (id) => ({_type: 'reference', _ref: id})

/** A `translation.metadata` document, matching @sanity/document-internationalization. */
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ------------------------------------------------------------ image upload --
const assets = {}
async function uploadAll(names) {
  for (const name of names) {
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
}

// ------------------------------------------------------------------ content --
const DISCLAIMER_EN =
  'DEMO CONTENT — This article is fictional sample content created to exercise the NGWH website. ' +
  'The teams, players, results and events named below do not exist and are not NGWH facts.'
const DISCLAIMER_VI =
  'NỘI DUNG DEMO — Bài viết này là nội dung mẫu hư cấu, được tạo ra để kiểm thử website NGWH. ' +
  'Các đội bóng, cầu thủ, kết quả và sự kiện được nhắc đến dưới đây không có thật và không phải thông tin chính thức của NGWH.'

const NEWS = [
  {
    id: 'demo-news-01',
    category: 'tournament-news',
    date: '2026-08-26T09:30:00.000Z',
    en: {
      title: 'DEMO — Lotus Valley Titans Edge Harbor City Kestrels in Season Opener',
      slug: 'demo-titans-edge-kestrels-season-opener',
      body: [
        block(DISCLAIMER_EN),
        block('A one-possession finish', 'h2'),
        block(
          'The opening night of the fictional NextGen Women Hoops demo season went to the wire, with the Lotus Valley Titans holding on for a two-point win over the Harbor City Kestrels in front of a full house.',
        ),
        block(
          'Neither side led by more than six points after half-time. The Titans forced a turnover with eleven seconds left, and a pair of free throws sealed it before the Kestrels could get a clean look from the corner.',
        ),
        block('What the coaches said', 'h2'),
        block(
          '"We defended without fouling for the last four minutes, and that is the whole game right there," the Titans head coach said afterwards. The Kestrels bench pointed to second-chance points as the difference.',
        ),
        ...bullets([
          'Titans 68 — Kestrels 66 (demo result)',
          'Lead changes: 14 (demo statistic)',
          'Attendance: sold out (demo figure)',
        ]),
        block(
          'Every number on this page is invented for demonstration purposes and should not be reported as a real NGWH result.',
        ),
      ],
    },
    vi: {
      title: 'DEMO — Lotus Valley Titans thắng sát nút Harbor City Kestrels ở trận mở màn',
      slug: 'demo-titans-thang-sat-nut-kestrels-tran-mo-man',
      body: [
        block(DISCLAIMER_VI),
        block('Phân định trong một pha bóng cuối', 'h2'),
        block(
          'Đêm khai mạc của mùa giải demo NextGen Women Hoops được định đoạt ở những giây cuối, khi Lotus Valley Titans giữ vững cách biệt hai điểm trước Harbor City Kestrels trên một khán đài kín chỗ.',
        ),
        block(
          'Sau giờ nghỉ, không đội nào dẫn quá sáu điểm. Titans đoạt lại bóng khi trận đấu còn mười một giây, và hai quả ném phạt đã khép lại thế trận trước khi Kestrels kịp có một cú dứt điểm thuận lợi từ góc sân.',
        ),
        block('Các huấn luyện viên nói gì', 'h2'),
        block(
          '"Chúng tôi phòng ngự bốn phút cuối mà không phạm lỗi, và toàn bộ trận đấu nằm ở đó," HLV trưởng Titans chia sẻ sau trận. Phía Kestrels cho rằng điểm số từ bóng bật bảng là khác biệt lớn nhất.',
        ),
        ...bullets([
          'Titans 68 — Kestrels 66 (kết quả demo)',
          'Số lần đổi ngôi dẫn điểm: 14 (số liệu demo)',
          'Khán giả: kín chỗ (số liệu demo)',
        ]),
        block(
          'Mọi con số trên trang này đều được tạo ra để minh hoạ và không được xem là kết quả thật của NGWH.',
        ),
      ],
    },
  },
  {
    id: 'demo-news-02',
    category: 'inspirational-stories',
    date: '2026-08-19T02:15:00.000Z',
    en: {
      title: 'DEMO — From Community Court to Captain: A Fictional Player Profile',
      slug: 'demo-from-community-court-to-captain',
      body: [
        block(DISCLAIMER_EN),
        block(
          'Vo Thanh Mai is an invented player created for this demo dataset. Her story is written to show how a NextGen Women Hoops profile piece reads once real interviews replace it.',
        ),
        block('Starting late', 'h2'),
        block(
          'In this fictional account she picks up the game at fifteen on an outdoor community court with a bent rim, two years behind most of her age group, and spends her first season learning to defend rather than to score.',
        ),
        block(
          'Three seasons later the same player is captaining a U20 side, running the late-game sets and mentoring two younger guards through their first competitive minutes.',
        ),
        block('Why the story matters', 'h2'),
        block(
          'Profiles like this one exist to show a pathway rather than a highlight reel — that arriving late is not the same as arriving too late. When NGWH publishes real profiles, they will be sourced from real interviews and verified with the athlete.',
        ),
      ],
    },
    vi: {
      title: 'DEMO — Từ sân bóng cộng đồng đến tấm băng đội trưởng: chân dung hư cấu',
      slug: 'demo-tu-san-cong-dong-den-doi-truong',
      body: [
        block(DISCLAIMER_VI),
        block(
          'Võ Thanh Mai là một nhân vật hư cấu được tạo ra cho bộ dữ liệu demo này. Câu chuyện dưới đây nhằm minh hoạ cách một bài chân dung của NextGen Women Hoops sẽ được trình bày, trước khi được thay bằng phỏng vấn thật.',
        ),
        block('Bắt đầu muộn', 'h2'),
        block(
          'Trong câu chuyện hư cấu này, cô bắt đầu chơi bóng rổ năm mười lăm tuổi trên một sân cộng đồng ngoài trời với chiếc vành rổ đã cong, chậm hơn hai năm so với bạn cùng lứa, và dành trọn mùa đầu tiên để học phòng ngự thay vì ghi điểm.',
        ),
        block(
          'Ba mùa giải sau, cũng cầu thủ ấy mang băng đội trưởng một đội U20, cầm nhịp các pha phối hợp cuối trận và dìu dắt hai hậu vệ trẻ trong những phút thi đấu chính thức đầu tiên.',
        ),
        block('Vì sao câu chuyện này quan trọng', 'h2'),
        block(
          'Những bài chân dung như thế này tồn tại để cho thấy một lộ trình, chứ không phải một đoạn highlight — rằng bắt đầu muộn không đồng nghĩa với quá muộn. Khi NGWH đăng chân dung thật, nội dung sẽ đến từ phỏng vấn thật và được chính vận động viên xác nhận.',
        ),
      ],
    },
  },
  {
    id: 'demo-news-03',
    category: 'knowledge-nutrition',
    date: '2026-08-11T07:00:00.000Z',
    en: {
      title: 'DEMO — Fuelling a Double-Header: Eating Between Two Games',
      slug: 'demo-fuelling-a-double-header',
      body: [
        block(DISCLAIMER_EN),
        block(
          'A general-education demo article. It is not medical or dietary advice, and it is not an NGWH nutrition policy. Athletes should follow guidance from their own qualified practitioners.',
        ),
        block('The ninety-minute window', 'h2'),
        block(
          'Tournament schedules often put two games on the same day. The gap between them is usually too short for a full meal and too long to skip eating altogether.',
        ),
        ...bullets([
          'Prioritise carbohydrate that digests easily rather than a heavy plate.',
          'Start rehydrating in the first ten minutes after the final buzzer, not in the warm-up for game two.',
          'Keep the between-games food familiar — a tournament day is the wrong day to try something new.',
          'Plan the food before travel day, because venue options are rarely predictable.',
        ]),
        block('After the second game', 'h2'),
        block(
          'Recovery for the next fixture begins immediately after the last one. A combination of carbohydrate and protein within the first hour, plus fluids to replace what was lost, is the widely taught general principle.',
        ),
      ],
    },
    vi: {
      title: 'DEMO — Dinh dưỡng cho ngày thi đấu đôi: ăn gì giữa hai trận',
      slug: 'demo-dinh-duong-ngay-thi-dau-doi',
      body: [
        block(DISCLAIMER_VI),
        block(
          'Đây là bài viết demo mang tính giáo dục chung. Nội dung không phải lời khuyên y tế hay dinh dưỡng, và cũng không phải quy định dinh dưỡng của NGWH. Vận động viên nên tuân theo hướng dẫn của chuyên gia có chuyên môn.',
        ),
        block('Khoảng trống chín mươi phút', 'h2'),
        block(
          'Lịch thi đấu giải thường xếp hai trận trong cùng một ngày. Khoảng nghỉ giữa hai trận thường quá ngắn cho một bữa đầy đủ, nhưng lại quá dài để nhịn hoàn toàn.',
        ),
        ...bullets([
          'Ưu tiên tinh bột dễ tiêu thay vì một khẩu phần nặng bụng.',
          'Bắt đầu bù nước trong mười phút đầu sau tiếng còi kết thúc, không đợi đến lúc khởi động trận hai.',
          'Chọn món quen thuộc — ngày thi đấu không phải lúc để thử món mới.',
          'Chuẩn bị đồ ăn từ trước ngày di chuyển, vì lựa chọn tại nhà thi đấu thường khó lường.',
        ]),
        block('Sau trận thứ hai', 'h2'),
        block(
          'Quá trình hồi phục cho trận kế tiếp bắt đầu ngay sau trận vừa kết thúc. Nguyên tắc chung thường được giảng dạy là kết hợp tinh bột và đạm trong giờ đầu tiên, cùng với lượng nước bù lại phần đã mất.',
        ),
      ],
    },
  },
  {
    id: 'demo-news-04',
    category: 'tournament-news',
    date: '2026-07-30T04:45:00.000Z',
    en: {
      title: 'DEMO — Group Stage Draw Sets Up Highland Ember vs Riverstone Falcons',
      slug: 'demo-group-stage-draw-highland-riverstone',
      body: [
        block(DISCLAIMER_EN),
        block(
          'The draw described here is fictional and exists only to demonstrate how a fixture-announcement article renders on this site.',
        ),
        block('How the groups fell', 'h2'),
        block(
          'Eight invented clubs were placed into two groups of four. Group A pairs Highland Ember with Riverstone Falcons in the opening round, a matchup that in this demo storyline decided last season’s semi-final.',
        ),
        ...bullets([
          'Group A: Highland Ember, Riverstone Falcons, Lotus Valley Titans, Coastal Lumen',
          'Group B: Harbor City Kestrels, Summit Ridge Foxes, Delta Bay Herons, Ironbark United',
        ]),
        block('Format', 'h2'),
        block(
          'Each club plays the other three in its group once, with the top two advancing to the knock-out round. The full schedule, venues and tip-off times would be published here once confirmed.',
        ),
      ],
    },
    vi: {
      title: 'DEMO — Bốc thăm vòng bảng: Highland Ember gặp Riverstone Falcons',
      slug: 'demo-boc-tham-vong-bang-highland-riverstone',
      body: [
        block(DISCLAIMER_VI),
        block(
          'Kết quả bốc thăm mô tả ở đây là hư cấu, chỉ nhằm minh hoạ cách một bài công bố lịch thi đấu hiển thị trên website.',
        ),
        block('Kết quả chia bảng', 'h2'),
        block(
          'Tám câu lạc bộ hư cấu được chia vào hai bảng, mỗi bảng bốn đội. Bảng A đưa Highland Ember gặp Riverstone Falcons ngay lượt mở màn — cặp đấu mà trong mạch truyện demo này từng định đoạt trận bán kết mùa trước.',
        ),
        ...bullets([
          'Bảng A: Highland Ember, Riverstone Falcons, Lotus Valley Titans, Coastal Lumen',
          'Bảng B: Harbor City Kestrels, Summit Ridge Foxes, Delta Bay Herons, Ironbark United',
        ]),
        block('Thể thức', 'h2'),
        block(
          'Mỗi câu lạc bộ gặp ba đội còn lại trong bảng một lượt, hai đội đứng đầu giành quyền vào vòng loại trực tiếp. Lịch thi đấu đầy đủ, địa điểm và giờ bóng lăn sẽ được công bố tại đây sau khi xác nhận.',
        ),
      ],
    },
  },
  {
    id: 'demo-news-05',
    category: 'inspirational-stories',
    date: '2026-07-15T10:20:00.000Z',
    en: {
      title: 'DEMO — The Volunteer Scorekeepers Who Keep Every Match Running',
      slug: 'demo-volunteer-scorekeepers',
      body: [
        block(DISCLAIMER_EN),
        block(
          'A fictional feature about the table officials at a demo tournament. No real volunteers are described or identified.',
        ),
        block('The quietest seats in the building', 'h2'),
        block(
          'Behind the scorer’s table sit the people who start and stop the clock, log every foul, and make sure the official record matches what actually happened on court.',
        ),
        block(
          'In this demo narrative most of them are former players, and several arrive two hours before tip-off to check the shot clock, the horn and the paper backup sheet that gets used whenever the electronics fail.',
        ),
        block('Why it is worth writing about', 'h2'),
        block(
          'A tournament is only as credible as its record-keeping. Stories about officials rarely make highlight reels, which is precisely why a competition site should make room for them.',
        ),
      ],
    },
    vi: {
      title: 'DEMO — Những tình nguyện viên ghi điểm giữ nhịp cho mọi trận đấu',
      slug: 'demo-tinh-nguyen-vien-ghi-diem',
      body: [
        block(DISCLAIMER_VI),
        block(
          'Bài viết hư cấu về đội ngũ trọng tài bàn tại một giải đấu demo. Không mô tả hay nêu danh tính bất kỳ tình nguyện viên có thật nào.',
        ),
        block('Những chỗ ngồi lặng lẽ nhất nhà thi đấu', 'h2'),
        block(
          'Phía sau bàn thư ký là những người bấm giờ và dừng giờ, ghi lại từng lỗi cá nhân, và bảo đảm biên bản chính thức khớp với những gì thực sự diễn ra trên sân.',
        ),
        block(
          'Trong câu chuyện demo này, phần lớn trong số họ là cựu cầu thủ, và nhiều người có mặt trước giờ bóng lăn hai tiếng để kiểm tra đồng hồ 24 giây, còi báo hiệu và cả biên bản giấy dự phòng dùng mỗi khi thiết bị điện tử gặp sự cố.',
        ),
        block('Vì sao câu chuyện này đáng được kể', 'h2'),
        block(
          'Một giải đấu chỉ đáng tin ngang với chất lượng công tác ghi chép của nó. Những câu chuyện về trọng tài bàn hiếm khi xuất hiện trong các đoạn highlight, và đó chính là lý do một website giải đấu nên dành chỗ cho họ.',
        ),
      ],
    },
  },
  {
    id: 'demo-news-06',
    category: 'knowledge-nutrition',
    date: '2026-06-28T06:00:00.000Z',
    en: {
      title: 'DEMO — Sleep, Recovery and the 48-Hour Turnaround',
      slug: 'demo-sleep-recovery-48-hour-turnaround',
      body: [
        block(DISCLAIMER_EN),
        block(
          'General-education demo content only. Not medical advice and not an NGWH recovery protocol.',
        ),
        block('Why the turnaround is the hard part', 'h2'),
        block(
          'Group-stage schedules frequently leave forty-eight hours between fixtures. That is enough time to recover well and enough time to recover badly, and the difference is usually decided in the first night of sleep.',
        ),
        ...bullets([
          'Late tip-offs push bedtime later; a consistent wake time is easier to protect than a consistent bedtime.',
          'Travel days fragment sleep more than training days do.',
          'Shared accommodation is a real variable at youth tournaments and is worth planning for.',
        ]),
        block('A simple framing', 'h2'),
        block(
          'Coaches in this demo article describe the turnaround in three parts: finish the last game properly, protect the night, and treat the day between as preparation rather than as a rest day that happens to have training in it.',
        ),
      ],
    },
    vi: {
      title: 'DEMO — Giấc ngủ, phục hồi và chu kỳ 48 giờ giữa hai trận',
      slug: 'demo-giac-ngu-phuc-hoi-chu-ky-48-gio',
      body: [
        block(DISCLAIMER_VI),
        block(
          'Nội dung demo mang tính giáo dục chung. Không phải lời khuyên y tế và không phải quy trình phục hồi của NGWH.',
        ),
        block('Vì sao khoảng nghỉ giữa hai trận là phần khó nhất', 'h2'),
        block(
          'Lịch vòng bảng thường để lại bốn mươi tám giờ giữa hai trận. Đó là khoảng thời gian đủ để hồi phục tốt, và cũng đủ để hồi phục tệ — khác biệt thường được quyết định ngay trong đêm ngủ đầu tiên.',
        ),
        ...bullets([
          'Giờ bóng lăn muộn đẩy giờ đi ngủ trễ hơn; giữ giờ thức dậy ổn định dễ hơn giữ giờ đi ngủ ổn định.',
          'Ngày di chuyển làm giấc ngủ đứt quãng nhiều hơn ngày tập luyện.',
          'Ở ghép phòng là một biến số có thật tại các giải trẻ và cần được tính đến từ trước.',
        ]),
        block('Một cách nhìn đơn giản', 'h2'),
        block(
          'Các huấn luyện viên trong bài demo này chia khoảng nghỉ thành ba phần: kết thúc trận vừa rồi cho trọn vẹn, giữ lấy giấc ngủ ban đêm, và xem ngày ở giữa là ngày chuẩn bị chứ không phải ngày nghỉ có kèm buổi tập.',
        ),
      ],
    },
  },
]

// Gallery items, listed newest-first for display. They are CREATED in reverse
// so that Sanity's server-assigned `_createdAt` matches this intended order
// (the frontend sorts on `_createdAt desc`, and `_createdAt` cannot be set).
const GALLERY = [
  {
    id: 'demo-gallery-bts-01',
    category: 'behind-the-scenes',
    photos: ['bts-05-hydration-station', 'bts-06-players-tunnel', 'bts-07-scoreboard-check', 'bts-08-court-setup'],
    en: {
      title: 'DEMO — Match Day Operations',
      alts: [
        'Illustrated placeholder: hydration bottles lined up courtside',
        'Illustrated placeholder: a player silhouette in the arena tunnel',
        'Illustrated placeholder: an arena scoreboard being checked',
        'Illustrated placeholder: an overhead view of a court being set up',
      ],
      body: [
        block(
          'DEMO CONTENT — Illustrated placeholders showing the match-day set-up work that happens before doors open. No real venue, staff or event is depicted.',
        ),
      ],
    },
    vi: {
      title: 'DEMO — Công tác tổ chức ngày thi đấu',
      alts: [
        'Ảnh minh hoạ giả lập: các bình nước xếp hàng cạnh sân',
        'Ảnh minh hoạ giả lập: bóng cầu thủ trong đường hầm nhà thi đấu',
        'Ảnh minh hoạ giả lập: bảng điểm nhà thi đấu đang được kiểm tra',
        'Ảnh minh hoạ giả lập: sân đấu nhìn từ trên cao trong lúc lắp đặt',
      ],
      body: [
        block(
          'NỘI DUNG DEMO — Ảnh minh hoạ giả lập về công tác chuẩn bị trước giờ mở cửa. Không mô tả nhà thi đấu, nhân sự hay sự kiện có thật nào.',
        ),
      ],
    },
  },
  {
    id: 'demo-gallery-bts-02',
    category: 'behind-the-scenes',
    photos: ['bts-01-tactics-board', 'bts-02-team-bench', 'bts-03-strength-session', 'bts-04-agility-drills'],
    en: {
      title: 'DEMO — Practice and Conditioning',
      alts: [
        'Illustrated placeholder: a tactics board with play diagrams',
        'Illustrated placeholder: a team bench during a time-out',
        'Illustrated placeholder: a strength and conditioning session',
        'Illustrated placeholder: agility cones set out for drills',
      ],
      body: [
        block(
          'DEMO CONTENT — Illustrated placeholders representing a training week. No real players, coaches or facilities are depicted.',
        ),
      ],
    },
    vi: {
      title: 'DEMO — Tập luyện và thể lực',
      alts: [
        'Ảnh minh hoạ giả lập: bảng chiến thuật với sơ đồ phối hợp',
        'Ảnh minh hoạ giả lập: băng ghế đội bóng trong giờ hội ý',
        'Ảnh minh hoạ giả lập: buổi tập sức mạnh và thể lực',
        'Ảnh minh hoạ giả lập: các chóp nón bài tập nhanh nhẹn',
      ],
      body: [
        block(
          'NỘI DUNG DEMO — Ảnh minh hoạ giả lập cho một tuần tập luyện. Không mô tả cầu thủ, huấn luyện viên hay cơ sở vật chất có thật nào.',
        ),
      ],
    },
  },
  {
    id: 'demo-gallery-mvp-01',
    category: 'mvp-spotlight',
    photos: ['mvp-01-season'],
    en: {
      title: 'DEMO — Season MVP: Vo Thanh Mai (fictional)',
      alts: ['Illustrated placeholder: an abstract player silhouette holding a ball aloft'],
      body: [
        block(
          'DEMO CONTENT — Vo Thanh Mai is an invented player. The award, the club and the statistics below are fictional and are not NGWH records.',
        ),
        block(
          'In this demo storyline she led her side in assists across the group stage while playing the most minutes of any guard in the competition, and was named Season MVP by a panel of fictional coaches.',
        ),
      ],
    },
    vi: {
      title: 'DEMO — MVP mùa giải: Võ Thanh Mai (hư cấu)',
      alts: ['Ảnh minh hoạ giả lập: bóng dáng cầu thủ trừu tượng giơ cao quả bóng'],
      body: [
        block(
          'NỘI DUNG DEMO — Võ Thanh Mai là nhân vật hư cấu. Danh hiệu, câu lạc bộ và các số liệu bên dưới đều không có thật và không phải hồ sơ chính thức của NGWH.',
        ),
        block(
          'Trong mạch truyện demo này, cô dẫn đầu đội về số đường chuyền thành bàn suốt vòng bảng, đồng thời thi đấu nhiều phút nhất trong số các hậu vệ của giải, và được một hội đồng huấn luyện viên hư cấu bầu chọn là MVP mùa giải.',
        ),
      ],
    },
  },
  {
    id: 'demo-gallery-mvp-02',
    category: 'mvp-spotlight',
    photos: ['mvp-02-finals'],
    en: {
      title: 'DEMO — Finals MVP: Amara Sundqvist (fictional)',
      alts: ['Illustrated placeholder: an abstract player silhouette with both arms raised'],
      body: [
        block(
          'DEMO CONTENT — Amara Sundqvist is an invented player and this award does not exist.',
        ),
        block(
          'The demo narrative has her scoring the go-ahead basket with under a minute left in a fictional final, after a quiet first half in which she took only two shots.',
        ),
      ],
    },
    vi: {
      title: 'DEMO — MVP chung kết: Amara Sundqvist (hư cấu)',
      alts: ['Ảnh minh hoạ giả lập: bóng dáng cầu thủ trừu tượng giơ cao hai tay'],
      body: [
        block('NỘI DUNG DEMO — Amara Sundqvist là nhân vật hư cấu và danh hiệu này không tồn tại.'),
        block(
          'Trong câu chuyện demo, cô ghi rổ vượt lên khi trận chung kết hư cấu còn chưa đầy một phút, sau một hiệp đầu trầm lắng chỉ với hai lần dứt điểm.',
        ),
      ],
    },
  },
  {
    id: 'demo-gallery-mvp-03',
    category: 'mvp-spotlight',
    photos: ['mvp-03-rising-star'],
    en: {
      title: 'DEMO — Rising Star: Dang Kim Ngan (fictional)',
      alts: ['Illustrated placeholder: an abstract player silhouette standing on court'],
      body: [
        block('DEMO CONTENT — Dang Kim Ngan is an invented player and this award does not exist.'),
        block(
          'In the demo storyline she is the youngest player in the competition, joining the rotation midway through the group stage and finishing as her club’s most improved defender.',
        ),
      ],
    },
    vi: {
      title: 'DEMO — Ngôi sao mới: Đặng Kim Ngân (hư cấu)',
      alts: ['Ảnh minh hoạ giả lập: bóng dáng cầu thủ trừu tượng đứng trên sân'],
      body: [
        block('NỘI DUNG DEMO — Đặng Kim Ngân là nhân vật hư cấu và danh hiệu này không tồn tại.'),
        block(
          'Trong mạch truyện demo, cô là cầu thủ trẻ nhất giải, được đưa vào đội hình luân phiên từ giữa vòng bảng và kết thúc giải với danh hiệu cầu thủ phòng ngự tiến bộ nhất của câu lạc bộ.',
        ),
      ],
    },
  },
  {
    id: 'demo-gallery-hog-01',
    category: 'hall-of-glory',
    photos: [
      'hog-01-trophy-lift',
      'hog-02-team-celebration',
      'hog-03-championship-banner',
      'hog-04-winning-basket',
    ],
    en: {
      title: 'DEMO — Championship Final',
      alts: [
        'Illustrated placeholder: a championship trophy lifted under arena lights',
        'Illustrated placeholder: silhouetted players celebrating amid confetti',
        'Illustrated placeholder: championship banners hanging in an arena',
        'Illustrated placeholder: a ball dropping through the net',
      ],
      body: [
        block(
          'DEMO CONTENT — Illustrated placeholders for a fictional championship final. No real match, club or trophy is depicted.',
        ),
      ],
    },
    vi: {
      title: 'DEMO — Trận chung kết',
      alts: [
        'Ảnh minh hoạ giả lập: chiếc cúp vô địch được nâng cao dưới ánh đèn nhà thi đấu',
        'Ảnh minh hoạ giả lập: bóng dáng các cầu thủ ăn mừng giữa mưa kim tuyến',
        'Ảnh minh hoạ giả lập: những lá cờ vô địch treo trong nhà thi đấu',
        'Ảnh minh hoạ giả lập: quả bóng rơi qua lưới rổ',
      ],
      body: [
        block(
          'NỘI DUNG DEMO — Ảnh minh hoạ giả lập cho một trận chung kết hư cấu. Không mô tả trận đấu, câu lạc bộ hay chiếc cúp có thật nào.',
        ),
      ],
    },
  },
  {
    id: 'demo-gallery-hog-02',
    category: 'hall-of-glory',
    photos: ['hog-05-gold-medal', 'hog-06-centre-court', 'hog-07-arena-lights', 'hog-08-final-buzzer'],
    en: {
      title: 'DEMO — Trophy Presentation Night',
      alts: [
        'Illustrated placeholder: a gold medal on a ribbon',
        'Illustrated placeholder: an overhead view of centre court',
        'Illustrated placeholder: arena floodlights above a game ball',
        'Illustrated placeholder: a game ball at the final buzzer',
      ],
      body: [
        block(
          'DEMO CONTENT — Illustrated placeholders for a fictional presentation ceremony. No real award or recipient is depicted.',
        ),
      ],
    },
    vi: {
      title: 'DEMO — Đêm trao cúp',
      alts: [
        'Ảnh minh hoạ giả lập: tấm huy chương vàng trên dải ruy băng',
        'Ảnh minh hoạ giả lập: khu vực giữa sân nhìn từ trên cao',
        'Ảnh minh hoạ giả lập: dàn đèn nhà thi đấu phía trên quả bóng',
        'Ảnh minh hoạ giả lập: quả bóng thi đấu lúc tiếng còi kết thúc vang lên',
      ],
      body: [
        block(
          'NỘI DUNG DEMO — Ảnh minh hoạ giả lập cho một lễ trao giải hư cấu. Không mô tả danh hiệu hay người nhận có thật nào.',
        ),
      ],
    },
  },
]

const PARTNERS = [
  {
    id: 'demo-partner-lotus-court',
    name: 'DEMO — Lotus Court Athletics',
    role: 'Fictional title partner (demo record)',
    logo: 'partner-01-lotus-court',
  },
  {
    id: 'demo-partner-mekong-foundation',
    name: 'DEMO — Mekong Sports Foundation',
    role: 'Fictional development partner (demo record)',
    logo: 'partner-02-mekong-found',
  },
  {
    id: 'demo-partner-northwind',
    name: 'DEMO — Northwind Athletic Apparel',
    role: 'Fictional apparel partner (demo record)',
    logo: 'partner-03-northwind',
  },
  {
    id: 'demo-partner-cityline',
    name: 'DEMO — Cityline Sports Media',
    role: 'Fictional media partner (demo record)',
    logo: 'partner-04-cityline',
  },
]

// --------------------------------------------------------------------- run --
async function main() {
  const imageNames = [
    ...new Set([...GALLERY.flatMap((g) => g.photos), ...PARTNERS.map((p) => p.logo)]),
  ]
  console.log(`Uploading ${imageNames.length} demo images...`)
  await uploadAll(imageNames)

  console.log('\nCreating partner documents...')
  for (const p of PARTNERS) {
    await client.createOrReplace({
      _id: p.id,
      _type: 'partner',
      name: p.name,
      role: p.role,
      logo: {_type: 'image', asset: {_type: 'reference', _ref: assets[p.logo]}},
    })
    console.log(`  ${p.id}`)
  }

  console.log('\nCreating news articles (+ translation metadata)...')
  for (const n of NEWS) {
    const ids = {}
    for (const lang of LOCALES) {
      const id = `${n.id}-${lang}`
      ids[lang] = id
      await client.createOrReplace({
        _id: id,
        _type: 'newsArticle',
        language: lang,
        title: n[lang].title,
        slug: {_type: 'slug', current: n[lang].slug},
        category: n.category,
        date: n.date,
        body: n[lang].body,
      })
    }
    await client.createOrReplace(
      translationMetadata(`demo-trmeta-${n.id}`, 'newsArticle', ids),
    )
    console.log(`  ${n.id} (${n.category})`)
  }

  console.log('\nCreating gallery items oldest-first so _createdAt matches display order...')
  for (const g of [...GALLERY].reverse()) {
    const ids = {}
    for (const lang of LOCALES) {
      const id = `${g.id}-${lang}`
      ids[lang] = id
      await client.createOrReplace({
        _id: id,
        _type: 'galleryItem',
        language: lang,
        category: g.category,
        title: g[lang].title,
        photos: g.photos.map((name, i) => imageRef(assets[name], g[lang].alts[i])),
        body: g[lang].body,
      })
    }
    await client.createOrReplace(
      translationMetadata(`demo-trmeta-${g.id}`, 'galleryItem', ids),
    )
    console.log(`  ${g.id} (${g.category}, ${g.photos.length} photo(s))`)
    await sleep(1200) // guarantee distinct, ordered server-assigned _createdAt
  }

  console.log('\nLinking demo partners into the existing About pages...')
  for (const lang of LOCALES) {
    const id = `aboutPage-${lang}`
    const doc = await client.getDocument(id)
    if (!doc) {
      console.log(`  ${id}: not found — skipped`)
      continue
    }
    if (Array.isArray(doc.partners) && doc.partners.length > 0) {
      console.log(`  ${id}: already has ${doc.partners.length} partner(s) — left untouched`)
      continue
    }
    await client
      .patch(id)
      .set({partners: PARTNERS.map((p) => ({...ref(p.id), _key: key()}))})
      .commit()
    console.log(`  ${id}: linked ${PARTNERS.length} demo partners (no other field changed)`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
