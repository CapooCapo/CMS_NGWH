/**
 * Uploads the original basketball visuals and adds bilingual public editorial
 * content without changing any existing content outside the two page
 * singletons. Re-running is safe: generated assets and documents are found by
 * their original filename/editorialKey and updated in place.
 *
 *   npx sanity exec scripts/publish-basketball-editorial.mjs --with-user-token
 *
 * Optional:
 *   BASKETBALL_IMAGE_DIR=/absolute/path/to/webp/files \
 *     npx sanity exec scripts/publish-basketball-editorial.mjs --with-user-token
 */
import {getCliClient} from 'sanity/cli'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import path from 'node:path'

const client = getCliClient({apiVersion: '2026-08-28'})
const IMAGE_DIR =
  process.env.BASKETBALL_IMAGE_DIR ??
  path.resolve(process.cwd(), '../web/public/content/basketball')
const LOCALES = ['en', 'vi']

const key = () => randomUUID().replace(/-/g, '').slice(0, 12)
const ref = (id) => ({_type: 'reference', _ref: id})
const image = (assetId, alt, arrayItem = false) => ({
  _type: 'image',
  ...(arrayItem ? {_key: key()} : {}),
  asset: ref(assetId),
  alt,
})
const block = (text, style = 'normal') => ({
  _type: 'block',
  _key: key(),
  style,
  markDefs: [],
  children: [{_type: 'span', _key: key(), text, marks: []}],
})

const VISUALS = {
  hero: 'women-hoops-hero.webp',
  heroLayup: 'women-hoops-clutch-layup.png',
  heroHuddle: 'women-hoops-team-huddle.png',
  champions: 'hall-of-glory-champions.webp',
  championsEmbrace: 'women-hoops-champions-embrace.png',
  championshipJumpShot: 'women-hoops-jump-shot.png',
  championshipRebound: 'women-hoops-defensive-rebound.png',
  medalCeremony: 'women-hoops-medal-ceremony.png',
  practice: 'team-tactics-practice.webp',
  shootingDrill: 'women-hoops-shooting-drill.png',
  strengthSession: 'women-hoops-strength-session.png',
  recoveryBreak: 'women-hoops-recovery-break.png',
  courtSetup: 'women-hoops-court-setup.png',
  mvp: 'mvp-portrait.webp',
  pointGuard: 'women-hoops-point-guard-portrait.png',
  defender: 'women-hoops-defender-portrait.png',
}

const COPY = {
  en: {
    hero: {
      headline: 'The next possession starts now',
      subheadline: 'A home for young women who want to compete, grow and lead the game forward.',
      ctaLabel: 'Explore the tournament',
      alt: 'A women’s basketball player rises for a layup in a brightly lit indoor arena.',
    },
    videos: [
      {
        editorialKey: 'wnba-best-of-2025',
        title: 'Best of WNBA: First Half of the 2025 Season',
        description:
          'A film-room dose of creative passing, tough defence and late-game confidence from women’s basketball at its highest level.',
        sourceLabel: 'WNBA on YouTube',
        videoUrl: 'https://www.youtube.com/watch?v=y1gthAt8FgU',
        thumbnail: 'hero',
        alt: 'A women’s basketball player rises for a layup in a brightly lit indoor arena.',
      },
      {
        editorialKey: 'nba-finals-highlights-2025',
        title: 'NBA Finals: Every Highlight from the 2025 Finals',
        description:
          'Watch the official NBA recap as a study in pace, poise and decision-making under pressure.',
        sourceLabel: 'NBA on YouTube',
        videoUrl: 'https://www.youtube.com/watch?v=ZtS8Yc0ah7c',
        thumbnail: 'champions',
        alt: 'A women’s basketball team celebrates together with an unbranded gold trophy.',
      },
    ],
    gallery: {
      hall: {
        title: 'A championship belongs to every voice',
        body: [
          block(
            'A championship is never only the final shot. It belongs to the teammate who sets the screen, the coach who keeps teaching, and the community that makes room for young athletes to dream bigger.',
          ),
          block(
            'This original editorial visual celebrates that shared moment — the work, belief and joy that turn a season into a memory.',
          ),
        ],
        alt: 'A diverse women’s basketball team celebrates around an unbranded trophy on the court.',
      },
      mvp: {
        title: 'The moment after the buzzer',
        body: [
          block(
            'Leadership is often quiet: a player returning to the gym, learning one more read and making space for the next teammate to shine.',
          ),
          block(
            'This is an original editorial portrait, created to represent that mindset rather than a named athlete or a match result.',
          ),
        ],
        alt: 'An original women’s basketball athlete holds a basketball in an arena tunnel.',
      },
      practice: {
        title: 'The work before tip-off',
        body: [
          block(
            'Every composed fourth quarter begins with the details in practice: listening, communicating and trusting the next pass.',
          ),
          block(
            'This original editorial visual captures the shared focus behind a game-ready team.',
          ),
        ],
        alt: 'A women’s basketball coach draws a play while athletes listen closely in a gym.',
      },
    },
    news: {
      title: 'The work before tip-off: three habits that build a connected team',
      slug: 'the-work-before-tip-off',
      alt: 'A women’s basketball coach draws a play while athletes listen closely in a gym.',
      body: [
        block(
          'The work that strengthens a team is rarely loud. It lives in the repeated habits that make players trust one another when a game speeds up.',
        ),
        block('1. Name the next action', 'h2'),
        block(
          'Clear, early communication gives a teammate a second to react. Call the screen, the help and the outlet with enough time for the player beside you to use it.',
        ),
        block('2. Turn feedback into a shared problem', 'h2'),
        block(
          'Review a possession as a group instead of assigning blame. “What could we see earlier?” creates a better next rep than “Who missed it?”',
        ),
        block('3. End practice with one intention', 'h2'),
        block(
          'Before leaving the court, let each unit name one thing it will carry into the next session. Small commitments turn a practice plan into a team habit.',
        ),
      ],
    },
  },
  vi: {
    hero: {
      headline: 'Pha bóng tiếp theo bắt đầu từ bây giờ',
      subheadline:
        'Nơi các nữ vận động viên trẻ thi đấu, trưởng thành và cùng đưa bóng rổ tiến về phía trước.',
      ctaLabel: 'Khám phá giải đấu',
      alt: 'Một nữ vận động viên bóng rổ bật lên thực hiện cú lên rổ trong nhà thi đấu rực sáng.',
    },
    videos: [
      {
        editorialKey: 'wnba-best-of-2025',
        title: 'Tuyển tập WNBA: nửa đầu mùa giải 2025',
        description:
          'Một buổi xem băng hình giàu cảm hứng với những đường chuyền sáng tạo, phòng ngự quyết liệt và sự tự tin ở các pha bóng cuối trận.',
        sourceLabel: 'WNBA trên YouTube',
        videoUrl: 'https://www.youtube.com/watch?v=y1gthAt8FgU',
        thumbnail: 'hero',
        alt: 'Một nữ vận động viên bóng rổ bật lên thực hiện cú lên rổ trong nhà thi đấu rực sáng.',
      },
      {
        editorialKey: 'nba-finals-highlights-2025',
        title: 'NBA Finals: toàn bộ khoảnh khắc nổi bật của chung kết 2025',
        description:
          'Cùng xem bản tổng hợp chính thức của NBA như một bài học về nhịp độ, bản lĩnh và ra quyết định dưới áp lực.',
        sourceLabel: 'NBA trên YouTube',
        videoUrl: 'https://www.youtube.com/watch?v=ZtS8Yc0ah7c',
        thumbnail: 'champions',
        alt: 'Một đội bóng rổ nữ ăn mừng cùng chiếc cúp vàng không có thương hiệu.',
      },
    ],
    gallery: {
      hall: {
        title: 'Một chức vô địch thuộc về mọi tiếng nói',
        body: [
          block(
            'Một chức vô địch không chỉ nằm ở cú ném cuối. Nó thuộc về người đồng đội chịu khó che người, huấn luyện viên không ngừng chỉ dẫn và cộng đồng đã mở ra không gian để các vận động viên trẻ dám mơ lớn hơn.',
          ),
          block(
            'Hình ảnh biên tập gốc này tôn vinh khoảnh khắc chung ấy — nỗ lực, niềm tin và niềm vui biến một mùa giải thành ký ức.',
          ),
        ],
        alt: 'Một đội bóng rổ nữ đa dạng cùng ăn mừng quanh chiếc cúp không có thương hiệu trên sân.',
      },
      mvp: {
        title: 'Khoảnh khắc sau tiếng còi',
        body: [
          block(
            'Bản lĩnh thường rất lặng lẽ: một vận động viên trở lại sân tập, học thêm một phương án xử lý và mở đường để đồng đội tiếp theo toả sáng.',
          ),
          block(
            'Đây là chân dung biên tập gốc, đại diện cho tinh thần ấy chứ không mô tả một vận động viên hay kết quả trận đấu cụ thể.',
          ),
        ],
        alt: 'Một nữ vận động viên bóng rổ trong hình ảnh gốc cầm bóng ở lối vào nhà thi đấu.',
      },
      practice: {
        title: 'Những điều diễn ra trước giờ bóng lăn',
        body: [
          block(
            'Một hiệp bốn điềm tĩnh luôn bắt đầu từ những chi tiết trong tập luyện: lắng nghe, giao tiếp và tin tưởng đường chuyền tiếp theo.',
          ),
          block(
            'Hình ảnh biên tập gốc này ghi lại sự tập trung chung phía sau một tập thể sẵn sàng thi đấu.',
          ),
        ],
        alt: 'Một huấn luyện viên bóng rổ nữ vẽ bài trong khi các vận động viên chăm chú lắng nghe ở nhà thi đấu.',
      },
    },
    news: {
      title: 'Những điều diễn ra trước giờ bóng lăn: ba thói quen tạo nên tập thể gắn kết',
      slug: 'nhung-dieu-dien-ra-truoc-gio-bong-lan',
      alt: 'Một huấn luyện viên bóng rổ nữ vẽ bài trong khi các vận động viên chăm chú lắng nghe ở nhà thi đấu.',
      body: [
        block(
          'Những điều làm một tập thể mạnh lên hiếm khi ồn ào. Chúng nằm trong các thói quen lặp lại, giúp cầu thủ tin nhau hơn khi nhịp trận đấu tăng cao.',
        ),
        block('1. Gọi tên hành động tiếp theo', 'h2'),
        block(
          'Giao tiếp rõ ràng và sớm cho đồng đội thêm một nhịp để phản ứng. Hãy gọi tình huống che người, hỗ trợ và chuyền ra với đủ thời gian để người bên cạnh sử dụng thông tin đó.',
        ),
        block('2. Biến phản hồi thành vấn đề chung', 'h2'),
        block(
          'Hãy cùng xem lại một pha bóng thay vì tìm người chịu trách nhiệm. Câu hỏi “chúng ta có thể thấy điều gì sớm hơn?” sẽ tạo ra lần tập tiếp theo tốt hơn câu hỏi “ai đã bỏ lỡ?”',
        ),
        block('3. Kết thúc buổi tập bằng một ý định', 'h2'),
        block(
          'Trước khi rời sân, mỗi nhóm nhỏ hãy nói một điều mình sẽ mang tới buổi tập sau. Những cam kết nhỏ biến kế hoạch tập luyện thành thói quen của cả đội.',
        ),
      ],
    },
  },
}

const HERO_SLIDES = {
  en: [
    {
      editorialKey: 'ngwh-editorial-women-hoops-hero',
      visual: 'hero',
      headline: 'The next possession starts now',
      subheadline: 'A home for young women who want to compete, grow and lead the game forward.',
      ctaLabel: 'Explore the tournament',
      ctaHref: '/tournaments',
      alt: 'A women’s basketball player rises for a layup in a brightly lit indoor arena.',
    },
    {
      editorialKey: 'ngwh-editorial-clutch-layup',
      visual: 'heroLayup',
      headline: 'Built for the moments that matter',
      subheadline: 'Every rep, read and recovery prepares a team for the next decisive play.',
      ctaLabel: 'View the latest news',
      ctaHref: '/news',
      alt: 'A women’s basketball player drives for a layup as defenders pursue in an indoor arena.',
    },
    {
      editorialKey: 'ngwh-editorial-team-huddle',
      visual: 'heroHuddle',
      headline: 'One team. One next step.',
      subheadline: 'Competition grows stronger when players, coaches and communities move together.',
      ctaLabel: 'Discover the gallery',
      ctaHref: '/gallery',
      alt: 'Women basketball players join hands in a pre-game huddle at centre court.',
    },
  ],
  vi: [
    {
      editorialKey: 'ngwh-editorial-women-hoops-hero',
      visual: 'hero',
      headline: 'Pha bóng tiếp theo bắt đầu từ bây giờ',
      subheadline:
        'Nơi các nữ vận động viên trẻ thi đấu, trưởng thành và cùng đưa bóng rổ tiến về phía trước.',
      ctaLabel: 'Khám phá giải đấu',
      ctaHref: '/tournaments',
      alt: 'Một nữ vận động viên bóng rổ bật lên thực hiện cú lên rổ trong nhà thi đấu rực sáng.',
    },
    {
      editorialKey: 'ngwh-editorial-clutch-layup',
      visual: 'heroLayup',
      headline: 'Sẵn sàng cho khoảnh khắc quan trọng',
      subheadline: 'Mỗi lần tập, mỗi quyết định và mỗi lần hồi phục đều chuẩn bị cho pha bóng quyết định.',
      ctaLabel: 'Xem tin mới',
      ctaHref: '/news',
      alt: 'Một nữ cầu thủ bóng rổ lên rổ khi các hậu vệ bám đuổi trong nhà thi đấu.',
    },
    {
      editorialKey: 'ngwh-editorial-team-huddle',
      visual: 'heroHuddle',
      headline: 'Một tập thể. Một bước tiến.',
      subheadline: 'Thi đấu mạnh hơn khi cầu thủ, huấn luyện viên và cộng đồng cùng tiến về phía trước.',
      ctaLabel: 'Khám phá thư viện',
      ctaHref: '/gallery',
      alt: 'Các nữ cầu thủ bóng rổ cùng đặt tay trong vòng tròn trước trận ở giữa sân.',
    },
  ],
}

const GALLERY_STORIES = [
  {
    editorialKey: 'ngwh-editorial-championship-night',
    category: 'hall-of-glory',
    visuals: ['champions', 'championsEmbrace', 'heroLayup'],
    en: {
      title: 'Championship night, shared by the whole team',
      alts: [
        'A women’s basketball team lifts an unbranded championship trophy.',
        'Women basketball players embrace and celebrate after a championship game.',
        'A women basketball player drives for a late-game layup.',
      ],
      body: 'The final score lasts a night. The trust built in every possession lasts much longer.',
    },
    vi: {
      title: 'Đêm vô địch của cả tập thể',
      alts: [
        'Một đội bóng rổ nữ nâng chiếc cúp vô địch không có thương hiệu.',
        'Các nữ cầu thủ bóng rổ ôm nhau ăn mừng sau trận chung kết.',
        'Một nữ cầu thủ bóng rổ lên rổ ở pha bóng cuối trận.',
      ],
      body: 'Tỷ số cuối cùng chỉ ở lại trong một đêm. Niềm tin được xây từ từng pha bóng sẽ ở lại lâu hơn.',
    },
  },
  {
    editorialKey: 'ngwh-editorial-championship-details',
    category: 'hall-of-glory',
    visuals: ['championshipJumpShot', 'championshipRebound', 'medalCeremony'],
    en: {
      title: 'The details that decide a final',
      alts: [
        'A women basketball player releases a jump shot during an indoor game.',
        'Two women basketball players contest a defensive rebound beneath the hoop.',
        'A women basketball player receives an unbranded gold medal at courtside.',
      ],
      body: 'Poise, effort and a teammate ready for the next play turn a final into a lasting memory.',
    },
    vi: {
      title: 'Những chi tiết quyết định trận chung kết',
      alts: [
        'Một nữ cầu thủ bóng rổ thực hiện cú ném bật nhảy trong nhà thi đấu.',
        'Hai nữ cầu thủ bóng rổ tranh bóng bật bảng dưới rổ.',
        'Một nữ cầu thủ bóng rổ nhận huy chương vàng không có thương hiệu bên sân.',
      ],
      body: 'Bình tĩnh, nỗ lực và đồng đội sẵn sàng cho pha bóng tiếp theo sẽ biến trận chung kết thành ký ức lâu dài.',
    },
  },
  {
    editorialKey: 'ngwh-editorial-mvp-mindset',
    category: 'mvp-spotlight',
    visuals: ['mvp'],
    en: {
      title: 'The work continues after the buzzer',
      alts: ['A women basketball player holds a basketball in an arena tunnel.'],
      body: 'Leadership is shown in the quiet work: returning to the court, learning another read and making room for the next teammate to shine.',
    },
    vi: {
      title: 'Nỗ lực tiếp tục sau tiếng còi',
      alts: ['Một nữ cầu thủ bóng rổ cầm bóng ở lối vào nhà thi đấu.'],
      body: 'Bản lĩnh nằm trong những nỗ lực thầm lặng: trở lại sân, học thêm một phương án xử lý và mở đường để đồng đội toả sáng.',
    },
  },
  {
    editorialKey: 'ngwh-editorial-mvp-playmaking',
    category: 'mvp-spotlight',
    visuals: ['pointGuard'],
    en: {
      title: 'See the next pass first',
      alts: ['A Vietnamese women basketball point guard holds a basketball courtside.'],
      body: 'A great guard creates calm for everyone else, finding the next option before the defence can take it away.',
    },
    vi: {
      title: 'Nhìn thấy đường chuyền tiếp theo',
      alts: ['Một nữ hậu vệ dẫn bóng người Việt Nam cầm bóng bên sân.'],
      body: 'Một hậu vệ giỏi tạo ra sự bình tĩnh cho cả đội, nhìn thấy phương án tiếp theo trước khi hàng thủ kịp khép lại.',
    },
  },
  {
    editorialKey: 'ngwh-editorial-mvp-defence',
    category: 'mvp-spotlight',
    visuals: ['defender'],
    en: {
      title: 'Defence is a daily decision',
      alts: ['A women basketball player holds a focused defensive stance on an indoor court.'],
      body: 'The most reliable players keep choosing the difficult work: communicate, move their feet and help the teammate beside them.',
    },
    vi: {
      title: 'Phòng ngự là một lựa chọn mỗi ngày',
      alts: ['Một nữ cầu thủ bóng rổ đứng trong tư thế phòng ngự tập trung ở sân trong nhà.'],
      body: 'Những cầu thủ đáng tin cậy luôn chọn phần việc khó: giao tiếp, di chuyển chân và hỗ trợ người đồng đội bên cạnh.',
    },
  },
  {
    editorialKey: 'ngwh-editorial-practice-rhythm',
    category: 'behind-the-scenes',
    visuals: ['practice', 'shootingDrill', 'strengthSession'],
    en: {
      title: 'The rhythm of a focused practice',
      alts: [
        'A women basketball coach reviews a play with athletes in a gym.',
        'Women basketball players complete a shooting drill with a coach.',
        'Women basketball athletes complete a strength and conditioning session.',
      ],
      body: 'Good practice makes the hard choices in a game feel familiar: communicate early, trust the next pass and keep moving together.',
    },
    vi: {
      title: 'Nhịp độ của một buổi tập tập trung',
      alts: [
        'Một huấn luyện viên bóng rổ nữ trao đổi bài tập với các vận động viên trong nhà thi đấu.',
        'Các nữ cầu thủ bóng rổ thực hiện bài tập ném rổ cùng huấn luyện viên.',
        'Các nữ vận động viên bóng rổ thực hiện buổi tập sức mạnh và thể lực.',
      ],
      body: 'Một buổi tập tốt khiến những lựa chọn khó trong trận đấu trở nên quen thuộc: giao tiếp sớm, tin đường chuyền tiếp theo và cùng di chuyển.',
    },
  },
  {
    editorialKey: 'ngwh-editorial-game-day-prep',
    category: 'behind-the-scenes',
    visuals: ['recoveryBreak', 'courtSetup', 'heroHuddle'],
    en: {
      title: 'Preparation is part of the game',
      alts: [
        'Women basketball athletes take a recovery break with their coach at courtside.',
        'Women prepare an indoor basketball court before a game.',
        'Women basketball players put their hands together in a pre-game huddle.',
      ],
      body: 'Recovery, court preparation and a shared intention make the time before tip-off count too.',
    },
    vi: {
      title: 'Chuẩn bị cũng là một phần của trận đấu',
      alts: [
        'Các nữ vận động viên bóng rổ nghỉ hồi phục cùng huấn luyện viên bên sân.',
        'Các nữ nhân sự chuẩn bị sân bóng rổ trong nhà trước trận đấu.',
        'Các nữ cầu thủ bóng rổ cùng đặt tay trong vòng tròn trước trận.',
      ],
      body: 'Hồi phục, chuẩn bị sân và một mục tiêu chung giúp khoảng thời gian trước giờ bóng lăn cũng trở nên ý nghĩa.',
    },
  },
]

const NEWS_STORIES = [
  {
    editorialKey: 'ngwh-editorial-opening-possession',
    category: 'tournament-news',
    date: '2026-09-15T08:00:00.000Z',
    visual: 'heroLayup',
    en: {
      title: 'Starting strong: what an opening possession can teach a team',
      slug: 'starting-strong-opening-possession',
      alt: 'A women basketball player drives for a layup during an indoor game.',
      body: 'An opening possession is a chance to set a tone: talk early, make the simple read and trust the next player to finish the work.',
    },
    vi: {
      title: 'Khởi đầu mạnh mẽ: bài học từ pha bóng đầu tiên',
      slug: 'khoi-dau-manh-me-pha-bong-dau-tien',
      alt: 'Một nữ cầu thủ bóng rổ lên rổ trong nhà thi đấu.',
      body: 'Pha bóng đầu tiên là cơ hội để tạo nhịp độ: gọi bóng sớm, chọn phương án đơn giản và tin đồng đội sẽ hoàn thành phần việc tiếp theo.',
    },
  },
  {
    editorialKey: 'ngwh-editorial-team-habits',
    category: 'inspirational-stories',
    date: '2026-09-15T07:00:00.000Z',
    visual: 'practice',
    en: {
      title: 'The work before tip-off: habits that build a connected team',
      slug: 'the-work-before-tip-off',
      alt: 'A women basketball coach draws a play while athletes listen closely in a gym.',
      body: 'Connected teams are built in ordinary moments: a clear call, an honest review and one useful intention to carry into the next session.',
    },
    vi: {
      title: 'Những điều diễn ra trước giờ bóng lăn: thói quen tạo nên tập thể gắn kết',
      slug: 'nhung-dieu-dien-ra-truoc-gio-bong-lan',
      alt: 'Một huấn luyện viên bóng rổ nữ vẽ bài trong khi các vận động viên chăm chú lắng nghe ở nhà thi đấu.',
      body: 'Một tập thể gắn kết được xây trong những khoảnh khắc bình thường: một lời gọi rõ ràng, một lần xem lại thẳng thắn và mục tiêu hữu ích cho buổi tập sau.',
    },
  },
  {
    editorialKey: 'ngwh-editorial-playmaker-leadership',
    category: 'inspirational-stories',
    date: '2026-09-15T06:00:00.000Z',
    visual: 'pointGuard',
    en: {
      title: 'Leadership is often the next pass',
      slug: 'leadership-is-often-the-next-pass',
      alt: 'A Vietnamese women basketball point guard holds a basketball courtside.',
      body: 'Leadership is not always the loudest voice. It can be the player who notices space, calls a teammate into it and makes the whole group better.',
    },
    vi: {
      title: 'Bản lĩnh đôi khi nằm ở đường chuyền tiếp theo',
      slug: 'ban-linh-nam-o-duong-chuyen-tiep-theo',
      alt: 'Một nữ hậu vệ dẫn bóng người Việt Nam cầm bóng bên sân.',
      body: 'Bản lĩnh không phải lúc nào cũng là tiếng nói lớn nhất. Đó có thể là người nhìn ra khoảng trống, gọi đồng đội vào đó và giúp cả tập thể tốt hơn.',
    },
  },
  {
    editorialKey: 'ngwh-editorial-strength-for-the-season',
    category: 'knowledge-nutrition',
    date: '2026-09-15T05:00:00.000Z',
    visual: 'strengthSession',
    en: {
      title: 'Build strength for the whole season',
      slug: 'build-strength-for-the-whole-season',
      alt: 'Women basketball athletes complete a strength and conditioning session.',
      body: 'A balanced development plan gives athletes time to build strength, recover well and arrive at each session ready to learn. Seek guidance from qualified coaches and health professionals for individual needs.',
    },
    vi: {
      title: 'Xây nền thể lực cho cả mùa giải',
      slug: 'xay-nen-the-luc-cho-ca-mua-giai',
      alt: 'Các nữ vận động viên bóng rổ thực hiện buổi tập sức mạnh và thể lực.',
      body: 'Một kế hoạch phát triển cân bằng giúp vận động viên có thời gian xây thể lực, hồi phục tốt và đến mỗi buổi tập với tinh thần sẵn sàng học hỏi. Hãy tìm tư vấn từ huấn luyện viên và chuyên gia sức khoẻ phù hợp với nhu cầu cá nhân.',
    },
  },
  {
    editorialKey: 'ngwh-editorial-recovery-is-a-team-skill',
    category: 'knowledge-nutrition',
    date: '2026-09-15T04:00:00.000Z',
    visual: 'recoveryBreak',
    en: {
      title: 'Recovery is a team skill, too',
      slug: 'recovery-is-a-team-skill',
      alt: 'Women basketball athletes take a recovery break with their coach at courtside.',
      body: 'The minutes after practice matter. A team that checks in, hydrates and plans its next recovery step gives every player a better chance to return ready.',
    },
    vi: {
      title: 'Hồi phục cũng là kỹ năng của tập thể',
      slug: 'hoi-phuc-cung-la-ky-nang-cua-tap-the',
      alt: 'Các nữ vận động viên bóng rổ nghỉ hồi phục cùng huấn luyện viên bên sân.',
      body: 'Những phút sau buổi tập cũng rất quan trọng. Một tập thể biết hỏi han, bù nước và lên kế hoạch hồi phục sẽ giúp mỗi cầu thủ trở lại sân trong trạng thái sẵn sàng hơn.',
    },
  },
]

async function upload(filename) {
  const existing = await client.fetch(
    '*[_type == "sanity.imageAsset" && originalFilename == $filename][0]._id',
    {filename},
  )
  if (existing) return existing

  const buffer = await readFile(path.join(IMAGE_DIR, filename))
  const asset = await client.assets.upload('image', buffer, {
    filename,
    title: `Original NGWH basketball editorial visual — ${filename}`,
    description:
      'Original synthetic editorial visual for NextGen Women Hoops. It contains no real player likenesses, logos or league marks.',
  })
  console.log(`  uploaded ${filename}`)
  return asset._id
}

async function upsertLocalizedDocument(type, editorialKey, locale, document) {
  const existing = await client.fetch(
    '*[_type == $type && editorialKey == $editorialKey && language == $language][0]{_id}',
    {type, editorialKey, language: locale},
  )
  if (existing?._id) {
    await client.patch(existing._id).set(document).commit()
    return existing._id
  }
  const created = await client.create({_type: type, language: locale, editorialKey, ...document})
  return created._id
}

async function updateHome(locale, assets) {
  const id = `homePage-${locale}`
  const heroSlides = HERO_SLIDES[locale].map((slide, index) => {
    // Keep the original first-slide copy in one place while the new visual
    // set adds two further still-image slides around it.
    const firstSlideCopy = index === 0 ? COPY[locale].hero : null
    return {
      _type: 'heroSlide',
      _key: key(),
      editorialKey: slide.editorialKey,
      headline: firstSlideCopy?.headline ?? slide.headline,
      subheadline: firstSlideCopy?.subheadline ?? slide.subheadline,
      poster: image(assets[slide.visual], firstSlideCopy?.alt ?? slide.alt),
      ctaLabel: firstSlideCopy?.ctaLabel ?? slide.ctaLabel,
      ctaHref: slide.ctaHref,
    }
  })

  const current = await client.getDocument(id)
  if (!current) {
    await client.create({
      _id: id,
      _type: 'homePage',
      language: locale,
      heroSlides,
    })
    console.log(`  created ${id}`)
    return
  }

  // Remove only known imported/demo slides. Editorial slides that were entered
  // by an editor remain available after the new women’s-basketball carousel.
  const retainedSlides = (Array.isArray(current.heroSlides) ? current.heroSlides : []).filter(
    (slide) =>
      !(
        slide.editorialKey?.startsWith('ngwh-editorial-') ||
        slide.headline?.startsWith('DEMO —') ||
        slide.poster?.alt?.toLowerCase().includes('placeholder')
      ),
  )
  const patchData = {heroSlides: [...heroSlides, ...retainedSlides]}
  if (current.championsCorner?.clubName) {
    patchData.championsCorner = {
      ...current.championsCorner,
      image: image(
        assets.champions,
        locale === 'vi'
          ? 'Một đội bóng rổ nữ nâng chiếc cúp vô địch không có thương hiệu.'
          : 'A women’s basketball team lifts an unbranded championship trophy.',
      ),
    }
  }
  await client.patch(id).set(patchData).commit()
  console.log(`  updated ${id}`)
}

async function appendAboutImages(locale, assets) {
  const id = `aboutPage-${locale}`
  const current = await client.getDocument(id)
  if (!current) return
  const images = Array.isArray(current.images) ? current.images : []
  const additions = [
    {
      assetId: assets.championsEmbrace,
      alt:
        locale === 'vi'
          ? 'Các nữ cầu thủ bóng rổ ôm nhau ăn mừng sau trận chung kết.'
          : 'Women basketball players embrace and celebrate after a championship game.',
    },
    {
      assetId: assets.shootingDrill,
      alt:
        locale === 'vi'
          ? 'Các nữ cầu thủ bóng rổ thực hiện bài tập ném rổ cùng huấn luyện viên.'
          : 'Women basketball players complete a shooting drill with a coach.',
    },
    {
      assetId: assets.heroHuddle,
      alt:
        locale === 'vi'
          ? 'Các nữ cầu thủ bóng rổ cùng đặt tay trong vòng tròn trước trận.'
          : 'Women basketball players put their hands together in a pre-game huddle.',
    },
  ].filter(({assetId}) => !images.some((item) => item.asset?._ref === assetId))
  if (additions.length === 0) return
  await client
    .patch(id)
    .setIfMissing({images: []})
    .append(
      'images',
      additions.map(({assetId, alt}) => image(assetId, alt, true)),
    )
    .commit()
  console.log(`  added ${additions.length} original basketball visual(s) to ${id}`)
}

async function upsertTranslationMetadata(schemaType, byLocale) {
  const existing = await client.fetch(
    '*[_type == "translation.metadata" && references($en) && references($vi)][0]._id',
    {en: byLocale.en, vi: byLocale.vi},
  )
  if (existing) return
  await client.create({
    _type: 'translation.metadata',
    schemaTypes: [schemaType],
    translations: LOCALES.map((language) => ({
      _key: key(),
      _type: 'internationalizedArrayReferenceValue',
      language,
      value: ref(byLocale[language]),
    })),
  })
}

async function main() {
  console.log('Uploading original basketball visuals…')
  const assets = {}
  for (const [name, filename] of Object.entries(VISUALS)) assets[name] = await upload(filename)

  console.log('\nUpdating Home editorial media…')
  for (const locale of LOCALES) await updateHome(locale, assets)

  console.log('\nCreating gallery stories…')
  await Promise.all(
    GALLERY_STORIES.map(async (story) => {
      const entries = await Promise.all(
        LOCALES.map(async (locale) => {
          const content = story[locale]
          const id = await upsertLocalizedDocument('galleryItem', story.editorialKey, locale, {
            category: story.category,
            title: content.title,
            photos: story.visuals.map((visual, index) =>
              image(assets[visual], content.alts[index], true),
            ),
            body: [block(content.body)],
          })
          return [locale, id]
        }),
      )
      await upsertTranslationMetadata('galleryItem', Object.fromEntries(entries))
    }),
  )
  await Promise.all(LOCALES.map((locale) => appendAboutImages(locale, assets)))

  console.log('\nCreating bilingual news features…')
  await Promise.all(
    NEWS_STORIES.map(async (story) => {
      const entries = await Promise.all(
        LOCALES.map(async (locale) => {
          const content = story[locale]
          const id = await upsertLocalizedDocument('newsArticle', story.editorialKey, locale, {
            title: content.title,
            slug: {_type: 'slug', current: content.slug},
            category: story.category,
            date: story.date,
            coverImage: image(assets[story.visual], content.alt),
            body: [block(content.body)],
          })
          return [locale, id]
        }),
      )
      await upsertTranslationMetadata('newsArticle', Object.fromEntries(entries))
    }),
  )

  console.log('\nDone. Original visuals and public editorial content are live in Sanity.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
