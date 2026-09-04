import {getCliClient} from 'sanity/cli'
import {readFile} from 'node:fs/promises'
import path from 'node:path'

const client = getCliClient({apiVersion: '2026-08-28'})

const IMAGE_DIR =
  '/tmp/claude-1000/-home-giahoang-dev-ngwh/8d69f8c6-2169-46bb-a5f7-dd2500604538/scratchpad/about-images'

function rnd() {
  return Math.random().toString(36).slice(2, 10)
}

function block(text) {
  return {
    _type: 'block',
    _key: rnd(),
    style: 'normal',
    children: [{_type: 'span', _key: rnd(), text, marks: []}],
    markDefs: [],
  }
}

function heading(text) {
  return {
    _type: 'block',
    _key: rnd(),
    style: 'h3',
    children: [{_type: 'span', _key: rnd(), text, marks: []}],
    markDefs: [],
  }
}

async function uploadImage(filename) {
  const buffer = await readFile(path.join(IMAGE_DIR, filename))
  const asset = await client.assets.upload('image', buffer, {filename})
  return asset
}

async function main() {
  console.log('Uploading real production images...')
  const visionAsset = await uploadImage('vision.webp')
  const tournamentSystemAsset = await uploadImage('tournament-system.webp')
  const athleteDevelopmentAsset = await uploadImage('athlete-development.webp')
  const organizingTeamAsset = await uploadImage('organizing-team.webp')
  const communityAsset = await uploadImage('community.webp')
  console.log('Uploaded 5 image assets.')

  function img(asset, alt) {
    return {
      _type: 'image',
      _key: rnd(),
      asset: {_type: 'reference', _ref: asset._id},
      alt,
    }
  }

  const en = {
    _id: 'aboutPage-en',
    _type: 'aboutPage',
    language: 'en',
    brandStory: [
      block(
        "A future where women's basketball receives the recognition, support, and opportunities it deserves. NGWH works to create a stronger pathway for young athletes, particularly U20 players, by connecting competition, development, and community.",
      ),
      block(
        'Every tournament, every match, and every connection we help build moves toward that vision — young athletes developing their game, forming lasting relationships in the sport, and inspiring the next generation of players and fans.',
      ),
    ],
    vision:
      "A future where women's basketball receives the recognition, support, and opportunities it deserves. NGWH works to create a stronger pathway for young athletes, particularly U20 players, by connecting competition, development, and community.",
    mission: [
      '01. Provide structured, well-organized tournaments for young women\'s basketball players.',
      '02. Give U20 athletes real, competitive game experience.',
      '03. Support clubs, coaches, and players through a connected tournament ecosystem.',
      '04. Promote fair play and professional standards in every competition.',
      '05. Build meaningful connections across the women\'s basketball community.',
      '06. Inspire more young players to take up the sport.',
    ].join('\n'),
    tournamentSystem: [
      block('Every NGWH tournament runs on the same consistent framework, covering:'),
      heading('Competition'),
      block('Clear tournament formats, published schedules, and transparent competition rules.'),
      heading('Officiating'),
      block('A structured officiating process that keeps every match fair and consistent.'),
      heading('Athlete Development'),
      block(
        'Competition doubles as development — young players gain real experience through meaningful games.',
      ),
      heading('Match Operations'),
      block(
        'Fixtures, results, standings, and live updates are all managed through the NGWH platform.',
      ),
      block(
        'Specific certifications, technical partnerships, and official affiliations will be shared here once confirmed.',
      ),
    ],
    organizerAndPartners: [
      block(
        'Running NGWH tournaments takes people working across competition management, coaching, athlete development, event operations, media, and community building.',
      ),
      heading('Competition Operations'),
      block('Scheduling matches, coordinating fixtures, and managing day-to-day competition administration.'),
      heading('Athlete Development'),
      block('Supporting young athletes with opportunities to compete, learn, and keep improving.'),
      heading('Event Operations'),
      block("Coordinating venues, match-day operations, and all the logistics a tournament needs."),
      heading('Media & Community'),
      block(
        'Telling the story of each tournament through coverage, photography, digital content, and community engagement.',
      ),
      block(
        'Partner organizations and committee members will be listed here as collaborations are confirmed.',
      ),
    ],
    images: [
      img(visionAsset, "Young women's basketball players standing together on an indoor court"),
      img(tournamentSystemAsset, "Women's basketball players competing in an indoor tournament"),
      img(athleteDevelopmentAsset, 'Official and referee managing a women\'s basketball match'),
      img(organizingTeamAsset, 'Tournament staff preparing a women\'s basketball event'),
      img(communityAsset, "Women's basketball community members gathered around a basketball court"),
    ],
  }

  const vi = {
    _id: 'aboutPage-vi',
    _type: 'aboutPage',
    language: 'vi',
    brandStory: [
      block(
        'Một tương lai nơi bóng rổ nữ nhận được sự công nhận, hỗ trợ và cơ hội xứng đáng. NGWH hướng tới việc tạo dựng con đường phát triển vững chắc cho các vận động viên trẻ, đặc biệt là lứa tuổi U20, thông qua việc kết nối thi đấu, đào tạo và cộng đồng.',
      ),
      block(
        'Mỗi giải đấu, mỗi trận đấu và mỗi kết nối chúng tôi góp phần xây dựng đều hướng tới tầm nhìn đó — vận động viên trẻ hoàn thiện kỹ năng, xây dựng những mối quan hệ lâu dài trong môn thể thao này, và truyền cảm hứng cho thế hệ cầu thủ, người hâm mộ tiếp theo.',
      ),
    ],
    vision:
      'Một tương lai nơi bóng rổ nữ nhận được sự công nhận, hỗ trợ và cơ hội xứng đáng. NGWH hướng tới việc tạo dựng con đường phát triển vững chắc cho các vận động viên trẻ, đặc biệt là lứa tuổi U20, thông qua việc kết nối thi đấu, đào tạo và cộng đồng.',
    mission: [
      '01. Tổ chức các giải đấu bài bản, có hệ thống cho các vận động viên bóng rổ nữ trẻ.',
      '02. Mang đến cho vận động viên U20 cơ hội thi đấu thực chiến, tích lũy kinh nghiệm thật.',
      '03. Đồng hành cùng các câu lạc bộ, huấn luyện viên và vận động viên trong một hệ sinh thái giải đấu kết nối.',
      '04. Xây dựng môi trường thi đấu công bằng và chuyên nghiệp.',
      '05. Kết nối cộng đồng bóng rổ nữ theo cách thực chất và ý nghĩa.',
      '06. Truyền cảm hứng để thêm nhiều bạn trẻ đến với bóng rổ.',
    ].join('\n'),
    tournamentSystem: [
      block('Mỗi giải đấu của NGWH đều vận hành theo một khung thi đấu thống nhất, bao gồm:'),
      heading('Thi Đấu'),
      block('Thể thức thi đấu rõ ràng, lịch thi đấu công khai và luật chơi minh bạch.'),
      heading('Công Tác Trọng Tài'),
      block('Quy trình trọng tài bài bản, đảm bảo mỗi trận đấu công bằng và nhất quán.'),
      heading('Phát Triển Vận Động Viên'),
      block(
        'Thi đấu cũng chính là quá trình phát triển — cầu thủ trẻ tích lũy kinh nghiệm thực tế qua từng trận đấu có ý nghĩa.',
      ),
      heading('Vận Hành Trận Đấu'),
      block(
        'Lịch thi đấu, kết quả, bảng xếp hạng và cập nhật trực tiếp đều được quản lý qua nền tảng NGWH.',
      ),
      block(
        'Các chứng nhận chuyên môn, đối tác kỹ thuật và liên kết chính thức sẽ được cập nhật tại đây khi có xác nhận.',
      ),
    ],
    organizerAndPartners: [
      block(
        'Để vận hành các giải đấu NGWH cần đội ngũ nhân sự trải rộng từ quản lý giải đấu, huấn luyện, phát triển vận động viên, vận hành sự kiện, truyền thông đến xây dựng cộng đồng.',
      ),
      heading('Vận Hành Giải Đấu'),
      block('Lên lịch thi đấu, điều phối trận đấu và quản lý các công việc hành chính của giải.'),
      heading('Phát Triển Vận Động Viên'),
      block('Hỗ trợ vận động viên trẻ có cơ hội thi đấu, học hỏi và không ngừng tiến bộ.'),
      heading('Vận Hành Sự Kiện'),
      block('Điều phối địa điểm, vận hành ngày thi đấu và toàn bộ hậu cần cho giải đấu.'),
      heading('Truyền Thông & Cộng Đồng'),
      block('Kể câu chuyện của mỗi giải đấu qua tin tức, hình ảnh, nội dung số và kết nối cộng đồng.'),
      block(
        'Các tổ chức đối tác và thành viên ban tổ chức sẽ được cập nhật tại đây khi hợp tác được xác nhận chính thức.',
      ),
    ],
    images: [
      img(visionAsset, 'Các vận động viên bóng rổ nữ trẻ đứng cùng nhau trên sân thi đấu'),
      img(tournamentSystemAsset, 'Vận động viên bóng rổ nữ thi đấu trong giải đấu trong nhà'),
      img(athleteDevelopmentAsset, 'Trọng tài và ban tổ chức điều hành trận đấu bóng rổ nữ'),
      img(organizingTeamAsset, 'Ban tổ chức chuẩn bị cho sự kiện bóng rổ nữ'),
      img(communityAsset, 'Cộng đồng bóng rổ nữ hội tụ trên sân thi đấu'),
    ],
  }

  await client.createOrReplace(en)
  console.log('Created/updated aboutPage-en')
  await client.createOrReplace(vi)
  console.log('Created/updated aboutPage-vi')
}

main().catch((err) => {
  console.error('Migration error:', err)
  process.exit(1)
})
