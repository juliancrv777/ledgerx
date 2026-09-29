export default function Home(){
  return <main>
    <p className="eyebrow">FINANCIAL SYSTEMS ENGINEERING</p>
    <h1>LedgerX</h1>
    <p className="lead">A simulated payment platform built around double-entry accounting, concurrency safety, idempotency and event-driven processing.</p>
    <div className="grid">
      <article><b>Ledger</b><span>Double-entry accounting</span></article>
      <article><b>Reliable</b><span>Idempotent transfers</span></article>
      <article><b>Async</b><span>Redis + BullMQ workers</span></article>
    </div>
  </main>
}
