const POST_IMG_COUNT = 16

/** Stable index 1..16 from post id (same post always maps to same image). */
export function postImageUrlForId(postId: string): string {
  let h = 0
  for (let i = 0; i < postId.length; i++) {
    h = (Math.imul(31, h) + postId.charCodeAt(i)) >>> 0
  }
  const n = (h % POST_IMG_COUNT) + 1
  return `/post_img_${n}.png`
}
