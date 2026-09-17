export type VideoEmbed = {
  provider: 'youtube' | 'vimeo'
  src: string
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const VIMEO_ID = /^\d+$/

/**
 * Accept only the public provider URLs the editorial schema asks authors for.
 * This keeps a CMS URL from becoming an arbitrary iframe source.
 */
export function toVideoEmbed(value: string | null | undefined): VideoEmbed | null {
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null

    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'youtu.be' || host === 'youtube.com' || host === 'm.youtube.com') {
      const pathSegments = url.pathname.split('/').filter(Boolean)
      const id =
        host === 'youtu.be'
          ? pathSegments[0]
          : url.searchParams.get('v') ??
            (['embed', 'shorts', 'live'].includes(pathSegments[0]) ? pathSegments[1] : undefined)

      if (!id || !YOUTUBE_ID.test(id)) return null
      return {
        provider: 'youtube',
        src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
      }
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const match = url.pathname.match(/\/(?:video\/)?(\d+)(?:\/|$)/)
      const id = match?.[1]
      if (!id || !VIMEO_ID.test(id)) return null
      return {provider: 'vimeo', src: `https://player.vimeo.com/video/${id}`}
    }
  } catch {
    return null
  }

  return null
}
