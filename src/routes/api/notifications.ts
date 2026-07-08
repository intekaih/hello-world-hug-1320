import { createFileRoute } from "@tanstack/react-router";

export type Notification = {
  id: string;
  type: "new_episode" | "recommendation" | "system";
  movie_slug: string;
  movie_name: string;
  movie_thumb: string;
  episode?: string;
  message: string;
  createdAt: number;
  read: boolean;
};

const IMG = (p: string) => `https://image.tmdb.org/t/p/w500${p}`;

const store: Notification[] = ((globalThis as unknown as {
  __notificationsStore?: Notification[];
}).__notificationsStore ??= [
  { id: "n1", type: "new_episode", movie_slug: "shogun", movie_name: "Shogun",
    movie_thumb: IMG("/7O4iVfOMQmdCSxhOg1WnzG1AInL.jpg"), episode: "9",
    message: "Tập 9 vừa được cập nhật", createdAt: Date.now() - 1000 * 60 * 5, read: false },
  { id: "n2", type: "new_episode", movie_slug: "the-bear", movie_name: "The Bear",
    movie_thumb: IMG("/zPyHtXA8NLdrGDsPvBhI0pZfM63.jpg"), episode: "6",
    message: "Tập 6 vừa được cập nhật", createdAt: Date.now() - 1000 * 60 * 45, read: false },
  { id: "n3", type: "new_episode", movie_slug: "fallout", movie_name: "Fallout",
    movie_thumb: IMG("/AnsSKmcvZuJRB6tIF3TrmYuwLwT.jpg"), episode: "4",
    message: "Tập 4 vừa được cập nhật", createdAt: Date.now() - 1000 * 60 * 60 * 3, read: false },
  { id: "n4", type: "recommendation", movie_slug: "dune-part-two", movie_name: "Dune: Part Two",
    movie_thumb: IMG("/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg"),
    message: "Có thể bạn sẽ thích", createdAt: Date.now() - 1000 * 60 * 60 * 8, read: false },
  { id: "n5", type: "new_episode", movie_slug: "house-of-the-dragon", movie_name: "House of the Dragon",
    movie_thumb: IMG("/z2yahl2uefxDCl0nogcRBstwruJ.jpg"), episode: "10",
    movie_origin_name: "", createdAt: Date.now() - 1000 * 60 * 60 * 24, read: true,
    message: "Tập cuối mùa đã cập nhật" } as Notification,
  { id: "n6", type: "new_episode", movie_slug: "3-body-problem", movie_name: "3 Body Problem",
    movie_thumb: IMG("/yzD9Kf4vjSy5cJefz25f7Y4B9tt.jpg"), episode: "8",
    message: "Tập 8 vừa được cập nhật", createdAt: Date.now() - 1000 * 60 * 60 * 30, read: true },
]);

export const Route = createFileRoute("/api/notifications")({
  server: {
    handlers: {
      GET: async () => Response.json({ items: store }),
    },
  },
});

export { store as notificationsStore };
