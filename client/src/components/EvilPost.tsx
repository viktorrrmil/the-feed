import { useState } from 'react'
import type { FeedPost } from '../store/gameReducer'

interface EvilPostProps {
  post: FeedPost
  isActive?: boolean
  onLike?: (postId: string) => void
}

function EvilPost({ post, isActive = true, onLike }: EvilPostProps) {
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(post.content.likes ?? 0)

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
    <article className={`post-card post-card-evil ${isActive ? 'post-card-evil-active' : ''}`} role="alert">
      <header className="post-head">
        <p>{post.content.author ?? 'Corrupted Broadcast'}</p>
        <span>{post.content.handle ?? '@void_signal'}</span>
      </header>
      <p className="post-message">{post.content.message ?? 'Signal lost.'}</p>
      <footer className="post-meta">
        <button
          type="button"
          className={`post-like-button ${liked ? 'post-like-button-active' : ''}`}
          onClick={handleLike}
        >
          ❤ {likes}
        </button>
        <span>⚠ CORRUPTED</span>
      </footer>
      <p className="evil-enemy-name">ENEMY: {post.content.enemyName ?? 'Unknown'}</p>
    </article>
  )
}

export default EvilPost
