import { useState } from 'react'
import { postImageUrlForId } from '../lib/postImage'

interface PostMediaProps {
  postId: string
  className?: string
}

function PostMedia({ postId, className = '' }: PostMediaProps) {
  const src = postImageUrlForId(postId)
  const [broken, setBroken] = useState(false)

  if (broken) {
    return <div className={`post-image post-image-fallback ${className}`.trim()} aria-hidden />
  }

  return (
    <img
      className={`post-image ${className}`.trim()}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  )
}

export default PostMedia
