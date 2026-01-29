import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <h1 className="text-6xl font-bold text-rpg-text-muted mb-4">404</h1>
      <p className="text-lg text-rpg-text-dim mb-6">Page not found</p>
      <Link
        to="/"
        className="px-4 py-2 bg-rpg-accent hover:bg-rpg-accent-dim text-rpg-bg rounded transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
