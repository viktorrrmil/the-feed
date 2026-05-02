declare module '*.jsx' {
  import type { ComponentType } from 'react'

  const Component: ComponentType<Record<string, unknown>>
  export default Component
}

declare module '../components/ProfileCard' {
  import type { ComponentType } from 'react'

  const ProfileCard: ComponentType<Record<string, unknown>>
  export default ProfileCard
}

declare module '../components/ASCIIText' {
  import type { ComponentType } from 'react'

  const ASCIIText: ComponentType<Record<string, unknown>>
  export default ASCIIText
}
