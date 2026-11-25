import { webAuth } from "../../lib/auth0";
import { findBook } from "../../lib/books";
import { libraryStore, type Activity as Entry } from "../../lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity" };

function Lane({ title, caption, entries }: { title: string; caption: string; entries: Entry[] }) {
  return <section className="lane"><p className="eyebrow">{caption}</p><h2>{title}</h2>
    {entries.length ? <ul className="entries">{entries.map((entry, index) =>
      <li key={`${entry.action}-${entry.at}-${index}`}>
        {entry.action === "viewed_holds" ? "Viewed holds" : `Reserved ${findBook(entry.bookId)?.title ?? "a book"}`}
      </li>)}</ul> : <p>No activity yet.</p>}
  </section>;
}

export default async function Activity() {
  const session = await webAuth()?.getSession();
  if (!session) return <section className="panel"><p className="eyebrow">THE LIBRARY LEDGER</p><h1>Activity</h1>
    <p>Sign in to see your activity and what your agent did for you.</p>
    <a className="button" href="/auth/login?returnTo=/activity">Sign in <span aria-hidden="true">↗</span></a></section>;
  const entries = await Promise.resolve().then(() => libraryStore().activity(session.user.sub)).catch(() => null);
  return <section className="panel"><p className="eyebrow">THE LIBRARY LEDGER</p><h1>Activity</h1>
    <p>See who took each action on your library card.</p>
    {entries ? <div className="lanes">
      <Lane title="Personal agent" caption="ACTING FOR YOU" entries={entries.filter((entry) => entry.actor === "agent")} />
      <Lane title="You" caption="ACCOUNT OWNER" entries={entries.filter((entry) => entry.actor === "person")} />
    </div> : <p role="status">Activity is unavailable. Try again later.</p>}
  </section>;
}
