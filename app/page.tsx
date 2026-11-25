import { books } from "../lib/books";
import { webAuth } from "../lib/auth0";

export default async function Catalog() {
  const auth = webAuth();
  const session = await auth?.getSession();
  return <>
    <section className="hero">
      <div>
        <p className="eyebrow">ISSUE 01 / THE READING ROOM</p>
        <h1>Find your next<br /> <em>good read.</em></h1>
        <p>Browse the shelf yourself or ask your personal agent to pick a book and place a hold. It will ask before it acts.</p>
        <a className="button" href={session ? "/my-holds" : "/auth/login?returnTo=/my-holds"}>
          {session ? "View my holds" : "Sign in to reserve"} <span aria-hidden="true">↗</span>
        </a>
      </div>
      <aside className="card-slip" aria-label="How agent holds work">
        <p className="eyebrow">THE LIBRARY CARD</p>
        <ol><li>Ask your agent for a book</li><li>Sign in and approve a hold</li><li>See who reserved it</li></ol>
      </aside>
    </section>
    <section id="shelf" aria-labelledby="shelf-title">
      <div className="shelf-heading"><div><p className="eyebrow">PUBLIC CATALOG</p><h2 id="shelf-title">On the shelf</h2></div><span>03 TITLES</span></div>
      <div className="books">{books.map((book) => <article className="book" key={book.id}>
        <div className={`book-cover ${book.tone}`}><p>{book.shelf}</p><h3>{book.title}</h3><span>{book.author}</span></div>
        <p>{book.description}</p>
        <a href={`/my-holds?book=${book.id}`}>Reserve this title <span aria-hidden="true">→</span></a>
      </article>)}</div>
    </section>
    <section className="coming" aria-labelledby="coming-title">
      <h2 id="coming-title">Coming soon</h2>
      <p><strong>Guest holds</strong> with Anonymous Sessions · <strong><code>act</code> claims</strong> with Agents as Principals</p>
    </section>
  </>;
}
