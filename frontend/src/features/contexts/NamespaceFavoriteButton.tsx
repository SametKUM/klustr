import { Star } from 'lucide-react'

export function NamespaceFavoriteButton({ name, favorite, onToggle }: {
  name: string
  favorite: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-label={favorite ? `Unfavorite ${name}` : `Favorite ${name}`}
      aria-pressed={favorite}
      title={favorite ? 'Unfavorite' : 'Favorite'}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
      }}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className={[
        '-mr-1.5 inline-flex size-5 shrink-0 items-center justify-center rounded transition-colors',
        favorite
          ? 'text-amber-500 hover:bg-muted'
          : 'text-muted-foreground/40 hover:bg-muted hover:text-foreground',
      ].join(' ')}
    >
      <Star aria-hidden="true" className={['size-3.5', favorite ? 'fill-current' : ''].join(' ')} />
    </button>
  )
}
