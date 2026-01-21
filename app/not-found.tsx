export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-muted-foreground">页面未找到</p>
        <a href="/" className="mt-6 inline-block text-primary hover:underline">
          返回首页
        </a>
      </div>
    </div>
  )
}
