import { Link } from 'react-router-dom'

interface NotFoundProps {
  title?: string
  message?: string
  backTo?: string
  backLabel?: string
}

export default function NotFound({ 
  title = 'Not Found',
  message = 'The page or record you are looking for does not exist.',
  backTo = '/admin/clients',
  backLabel = '← Back to Clients'
}: NotFoundProps) {
  return (
    <div className="text-center py-16">
      <div className="text-6xl mb-4">🔍</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-500 mb-6">{message}</p>
      <Link 
        to={backTo}
        className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors"
      >
        {backLabel}
      </Link>
    </div>
  )
}
