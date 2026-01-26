import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">Shared List App</h1>
      <div className="flex gap-4">
        <Link href="/login" className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">Log In</Link>
        <Link href="/register" className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition">Register</Link>
      </div>
    </div>
  )
}
