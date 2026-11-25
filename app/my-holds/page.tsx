import { redirect } from "next/navigation";
import { webAuth } from "../../lib/auth0";
import { books, findBook } from "../../lib/books";
import { readerHolds } from "../../lib/reader";
import type { Hold } from "../../lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "My holds" };

async function reserve(form: FormData) {
  "use server";
  const book = findBook(form.get("book"));
  if (!book) redirect("/my-holds?status=unavailable");
  const response = await readerHolds("POST", book.id);
  redirect("/my-holds?status=" + (response.ok ? "reserved" : "unavailable"));
}

export default async function MyHolds({ searchParams }: { searchParams: Promise<{ book?: string; status?: string }> }) {
  const { book, status } = await searchParams;
  const session = await webAuth()?.getSession();
  if (!session) {
    const next = "/my-holds" + (findBook(book) ? "?book=" + book : "");
    return <section className="panel"><p className="eyebrow">YOUR LIBRARY CARD</p><h1>My holds</h1>
      <p>Sign in to see reservations you or your agent have made.</p>
      <a className="button" href={`/auth/login?returnTo=${encodeURIComponent(next)}`}>Sign in <span aria-hidden="true">↗</span></a></section>;
  }
  const result = await readerHolds("GET").catch(() => new Response(null, { status: 503 }));
  const holds: Hold[] = result.ok ? (await result.json()).holds : [];
  return <section className="panel"><p className="eyebrow">YOUR LIBRARY CARD</p><h1>My holds</h1>
    {status === "reserved" && <p role="status">Your book is on hold.</p>}
    {status === "unavailable" && <p role="status">The hold could not be placed.</p>}
    {!result.ok ? <p role="status">Holds are unavailable. Try again later.</p> :
      holds.length ? <ul className="entries">{holds.map((hold) => <li key={hold.bookId}>
        <strong>{findBook(hold.bookId)?.title ?? hold.bookId}</strong>
        <span>{hold.placedBy === "agent" ? "Placed by agent" : "Placed by you"}</span>
      </li>)}</ul> : <p>No books on hold yet.</p>}
    <form action={reserve} className="reserve">
      <label htmlFor="book">Book to reserve</label>
      <select name="book" id="book" defaultValue={findBook(book)?.id}>{books.map((title) =>
        <option key={title.id} value={title.id}>{title.title}</option>)}</select>
      <button className="button">Place hold</button>
    </form>
    <p><a href="/activity">View activity</a> · <a href="/auth/logout">Sign out</a></p>
  </section>;
}
