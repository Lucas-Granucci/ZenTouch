export function KioskPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 px-6 py-6 sm:px-12">
        <p className="text-2xl font-semibold tracking-tight">ZenTouch<span className="text-teal-700">.</span></p>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-6 py-16 sm:px-12">
        <section aria-labelledby="welcome-title" className="max-w-3xl">
          <p className="mb-6 text-sm font-semibold uppercase tracking-widest text-teal-800">A little less touch. A little more ease.</p>
          <h1 id="welcome-title" className="text-5xl font-semibold leading-tight tracking-tight sm:text-7xl">
            Welcome to<br />a touchless experience.
          </h1>
          <p className="mt-8 max-w-xl text-xl leading-relaxed text-stone-600">
            A simpler way to order, designed around you.
          </p>
          <p className="mt-10 rounded-2xl border border-teal-200 bg-teal-50 px-6 py-5 text-lg text-teal-900">
            Our ordering experience is coming soon.
          </p>
        </section>
      </main>

      <footer className="px-6 py-6 text-sm text-stone-600 sm:px-12">
        ZenTouch · Touchless kiosk prototype
      </footer>
    </div>
  )
}
