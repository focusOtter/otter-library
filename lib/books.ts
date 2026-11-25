export const books = [
  { id: "tideline", title: "The Tide Line", author: "Rosa Vale", shelf: "NATURE / 01", tone: "pine", description: "A field notebook for slow walks, rock pools, and the quiet lives along the water's edge." },
  { id: "night-train", title: "Night Train North", author: "Milo Hart", shelf: "FICTION / 02", tone: "clay", description: "A cozy mystery on a sleeper train headed toward the last station before winter." },
  { id: "atlas", title: "An Atlas of Small Things", author: "June Park", shelf: "DESIGN / 03", tone: "honey", description: "An illustrated collection of the tools, maps, and small objects we carry from place to place." },
] as const;

export function findBook(id: unknown) {
  return books.find((book) => book.id === id);
}
