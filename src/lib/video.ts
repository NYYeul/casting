export function embedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtube.com') {
      const id =
        parsed.searchParams.get('v') ||
        parsed.pathname.match(/^\/(?:shorts|embed)\/([\w-]{6,})/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).match(/^[\w-]{6,}/)?.[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'vimeo.com') {
      const id = parsed.pathname.match(/^\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}
