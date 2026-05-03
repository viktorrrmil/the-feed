import { useState } from 'react'
import PostMedia from './PostMedia'
import type { FeedPost } from '../store/gameReducer'

interface PostProps {
  post: FeedPost
  onLike?: (postId: string) => void
}

function Post({ post, onLike }: PostProps) {
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(post.content.likes ?? 0)
  const isAnomaly =
    Boolean(post.content.isTrap) ||
    Boolean(post.content.isOff) ||
    (post.content.glitchLevel ?? 0) > 0

  const handleLike = () => {
    setLiked((prevLiked) => {
      if (prevLiked) {
        setLikes((prevLikes) => Math.max(0, prevLikes - 1))
        return false
      }

      setLikes((prevLikes) => prevLikes + 1)
      onLike?.(post.id)
      return true
    })
  }

  return (
    <article
      className={`post-card post-card-normal ${post.content.isOff ? 'post-card-off' : ''} ${
        post.content.isTrap ? 'post-card-trap' : ''
      } ${isAnomaly ? 'post-card-anomaly' : ''}`}
    >
      <header className="post-head">
        <p>{post.content.author ?? 'Unknown'}</p>
        <span>{post.content.handle ?? '@anonymous'}</span>
      </header>
      <div className="post-media-wrap">
        <PostMedia postId={post.id} />
      </div>
      <p className="post-message">{post.content.message ?? '...'}</p>
      <footer className="post-meta">
        <button
          type="button"
          className={`post-like-button ${liked ? 'post-like-button-active' : ''}`}
          onClick={handleLike}
        >
          ❤ {likes}
        </button>
        <span>{post.content.tag || `#${post.id}`}</span>
      </footer>
    </article>
  )
}

export default Post
