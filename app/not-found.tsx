export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-[#1D1D1F]">404</h1>
        <p className="mt-4 text-[#8E8E93]">页面不存在</p>
        <a href="/" className="mt-6 inline-block text-[#007AFF] hover:underline">
          返回首页
        </a>
      </div>
    </div>
  )
}
